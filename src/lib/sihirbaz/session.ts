/**
 * Kurulum Sihirbazi — Session Management
 *
 * Handles loading, creating, and updating onboarding_sessions rows.
 * Used by the step dispatcher to persist wizard FSM state across Telegram messages.
 *
 * Key behaviors:
 * - /start {token}: Validates invite token via SHA-256 hash, creates or resumes session
 * - Any other message: Looks up active session by telegram_chat_id
 * - Resume-after-disconnect: Session survives bot restarts via DB-backed state
 *
 * Session lookup order for /start (CRITICAL — do not reorder):
 * 1. Hash the raw token (SHA-256, hex string)
 * 2. Check for existing session by deep_link_token (resume case — invite may be used)
 * 3. Only if no session: validate invite (token_hash, used_at IS NULL, not expired)
 * 4. Create new session + mark invite as used
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type WizardSession = {
  id: string
  company_id: string | null
  deep_link_token: string
  telegram_chat_id: number | null
  status: 'pending' | 'in_progress' | 'completed' | 'expired'
  collected_data: Record<string, unknown>
  step: number
}

// ─── loadOrCreateSession ──────────────────────────────────────────────────────

/**
 * Load an existing session or create a new one from a valid /start invite token.
 *
 * Returns null if:
 * - /start with invalid/used/expired invite token and no existing session
 * - Non-/start message with no active session for this chat_id
 */
export async function loadOrCreateSession(
  supabase: SupabaseClient,
  chatId: number,
  text: string
): Promise<WizardSession | null> {
  // ── Case 1: /start command — validate token or resume ──────────────────────
  if (text.startsWith('/start ') || text === '/start') {
    const rawToken = text.startsWith('/start ')
      ? text.slice('/start '.length).trim()
      : ''

    // /start with no token — ignore (Telegram can send bare /start)
    if (!rawToken) return null

    // Step 1: SHA-256 hash the raw token for invite lookup
    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(rawToken)
    )
    const tokenHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // Step 2: Resume check FIRST — look for existing session by raw token
    // (invite.used_at may already be set for returning users; session lookup
    //  bypasses the used_at check entirely)
    const { data: existingSession } = await (supabase as any)
      .from('onboarding_sessions')
      .select('*')
      .eq('deep_link_token', rawToken)
      .maybeSingle()

    if (existingSession) {
      // Session exists — update telegram_chat_id if it was null (new device)
      if (existingSession.telegram_chat_id === null) {
        await updateSession(supabase, existingSession.id, {
          telegram_chat_id: chatId,
        })
      }
      return existingSession as WizardSession
    }

    // Step 3: No existing session — validate the invite
    const { data: invite } = await (supabase as any)
      .from('onboarding_invites')
      .select('id, company_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    // Reject if invite not found, already used, or expired
    if (!invite || invite.used_at || new Date(invite.expires_at) < new Date()) {
      return null
    }

    // Step 4: Create new session + mark invite as used
    const { data: newSession, error: insertError } = await (supabase as any)
      .from('onboarding_sessions')
      .insert({
        company_id: invite.company_id,
        deep_link_token: rawToken,
        telegram_chat_id: chatId,
        status: 'in_progress',
        collected_data: {},
        step: 0,
      })
      .select()
      .single()

    if (insertError || !newSession) {
      console.error('[sihirbaz/session] Failed to create session:', insertError)
      return null
    }

    // Mark invite as used (prevents double-use even if idempotency dedup fails)
    await (supabase as any)
      .from('onboarding_invites')
      .update({ used_at: new Date().toISOString() })
      .eq('id', invite.id)

    return newSession as WizardSession
  }

  // ── Case 2: Non-/start message — look up active session by chat_id ─────────
  const { data: session } = await (supabase as any)
    .from('onboarding_sessions')
    .select('*')
    .eq('telegram_chat_id', chatId)
    .in('status', ['pending', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (session as WizardSession | null) ?? null
}

// ─── updateSession ────────────────────────────────────────────────────────────

/**
 * Updates fields on an existing onboarding_sessions row.
 * Caller is responsible for spreading collected_data to preserve existing keys.
 */
export async function updateSession(
  supabase: SupabaseClient,
  sessionId: string,
  patch: Partial<
    Pick<
      WizardSession,
      'step' | 'collected_data' | 'status' | 'company_id' | 'telegram_chat_id'
    >
  >
): Promise<void> {
  const { error } = await (supabase as any)
    .from('onboarding_sessions')
    .update(patch)
    .eq('id', sessionId)

  if (error) {
    console.error('[sihirbaz/session] updateSession error:', error)
  }
}
