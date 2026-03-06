'use server'

import { z } from 'zod'
import { assertSuperadmin } from '@/lib/superadmin/guard'
import { createServiceClient } from '@/lib/supabase/service-client'

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionState = {
  error?: string
  status?: number
  success?: boolean
  data?: {
    companyId: string
    tempPassword: string
    deepLink: string
  }
} | null

type InviteLinkState = {
  error?: string
  status?: number
  success?: boolean
  data?: {
    deepLink: string
  }
} | null

// ─── Schema ───────────────────────────────────────────────────────────────────

const createCompanySchema = z.object({
  name: z.string().min(2, 'Firma adı en az 2 karakter olmalıdır'),
  sektor: z.string().min(1, 'Sektör zorunludur'),
  admin_email: z.string().email('Geçerli bir e-posta adresi giriniz'),
  plan: z.enum(['starter', 'pro', 'enterprise'], {
    error: 'Geçerli bir plan seçiniz',
  }),
})

// ─── Helper: generate invite token and deep link ──────────────────────────────

async function generateInviteTokenAndLink(
  companyId: string,
  actorId: string
): Promise<{ raw: string; tokenHash: string; deepLink: string; expiresAt: string }> {
  const raw = crypto.randomUUID()

  // SHA-256 hash of the raw token — only the hash is stored in DB
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(raw)
  )
  const tokenHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const botUsername =
    process.env.TELEGRAM_BOT_USERNAME_SIHIRBAZ || 'SihirbazBot'
  const deepLink = `https://t.me/${botUsername}?start=${raw}`

  return { raw, tokenHash, deepLink, expiresAt }
}

// ─── createCompany ────────────────────────────────────────────────────────────

/**
 * Creates a new company atomically:
 * 1. Creates auth user (email+password) via service role admin API
 * 2. Calls provision_company RPC (companies + users + subscription + 12 agent_definitions)
 * 3. Generates onboarding invite link (SHA-256 token stored in DB)
 * 4. Writes audit log for both create_company and generate_invite actions
 *
 * On RPC failure: compensating transaction deletes the auth user (rollback).
 * All operations are protected by assertSuperadmin() guard.
 */
export async function createCompany(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // Guard — throws 'FORBIDDEN' if not superadmin
  let actorId: string
  try {
    actorId = await assertSuperadmin()
  } catch {
    return { error: 'Bu işlem için yetkiniz yok', status: 403 }
  }

  // Validate form input
  const raw = {
    name: formData.get('name'),
    sektor: formData.get('sektor'),
    admin_email: formData.get('admin_email'),
    plan: formData.get('plan'),
  }

  const parsed = createCompanySchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message
    return { error: firstError ?? 'Geçersiz form verisi' }
  }

  const { name, sektor, admin_email: adminEmail, plan } = parsed.data

  // Generate slug from company name
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 63)

  // Generate temporary password (12 chars from UUID — simple and readable)
  const tempPassword = crypto.randomUUID().slice(0, 12)

  const serviceClient = createServiceClient()

  // Step 1: Create auth user
  const { data: authData, error: authError } =
    await serviceClient.auth.admin.createUser({
      email: adminEmail,
      password: tempPassword,
      email_confirm: true,
    })

  if (authError || !authData.user) {
    return {
      error: 'Kullanıcı oluşturulamadı: ' + (authError?.message ?? 'Bilinmeyen hata'),
    }
  }

  const authUserId = authData.user.id

  // Step 2: Provision company atomically via RPC
  const { data: companyId, error: rpcError } = await (serviceClient as any).rpc(
    'provision_company',
    {
      p_name: name,
      p_slug: slug,
      p_sektor: sektor,
      p_plan: plan,
      p_admin_user_id: authUserId,
      p_admin_email: adminEmail,
      p_trial_days: 14,
    }
  )

  if (rpcError || !companyId) {
    // Compensating transaction: delete the auth user that was just created
    await serviceClient.auth.admin.deleteUser(authUserId)
    return {
      error:
        'Firma oluşturulamadı: ' + (rpcError?.message ?? 'Bilinmeyen hata'),
    }
  }

  // Step 3: Generate invite token and insert into onboarding_invites
  const { tokenHash, deepLink, expiresAt } = await generateInviteTokenAndLink(
    companyId,
    actorId
  )

  await (serviceClient as any).from('onboarding_invites').insert({
    company_id: companyId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    created_by: actorId,
  })

  // Step 4: Audit log — company creation
  await (serviceClient as any).from('superadmin_audit_log').insert({
    actor_id: actorId,
    action: 'create_company',
    target_table: 'companies',
    target_id: companyId,
    old_value: null,
    new_value: { name, sektor, plan, admin_email: adminEmail },
  })

  // Step 5: Audit log — invite generation
  await (serviceClient as any).from('superadmin_audit_log').insert({
    actor_id: actorId,
    action: 'generate_invite',
    target_table: 'onboarding_invites',
    target_id: companyId,
    old_value: null,
    new_value: { company_id: companyId, expires_at: expiresAt },
  })

  return {
    success: true,
    data: {
      companyId,
      tempPassword,
      deepLink,
    },
  }
}

// ─── generateInviteLink ───────────────────────────────────────────────────────

/**
 * Generates a new single-use Telegram invite link for an existing company.
 *
 * Creates a SHA-256 hashed token with 7-day expiry in onboarding_invites.
 * The raw token is returned in the deep link URL (never stored in DB).
 * Writes an audit log entry for every invocation.
 */
export async function generateInviteLink(
  companyId: string
): Promise<InviteLinkState> {
  // Guard — throws 'FORBIDDEN' if not superadmin
  let actorId: string
  try {
    actorId = await assertSuperadmin()
  } catch {
    return { error: 'Bu işlem için yetkiniz yok', status: 403 }
  }

  if (!companyId) {
    return { error: 'Firma ID gereklidir' }
  }

  const serviceClient = createServiceClient()

  // Generate invite token and deep link
  const { tokenHash, deepLink, expiresAt } = await generateInviteTokenAndLink(
    companyId,
    actorId
  )

  // Insert into onboarding_invites
  const { error: insertError } = await (serviceClient as any)
    .from('onboarding_invites')
    .insert({
      company_id: companyId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: actorId,
    })

  if (insertError) {
    return {
      error: 'Davet linki oluşturulamadı: ' + insertError.message,
    }
  }

  // Audit log — invite generation
  await (serviceClient as any).from('superadmin_audit_log').insert({
    actor_id: actorId,
    action: 'generate_invite',
    target_table: 'onboarding_invites',
    target_id: companyId,
    old_value: null,
    new_value: { company_id: companyId, expires_at: expiresAt },
  })

  return {
    success: true,
    data: { deepLink },
  }
}
