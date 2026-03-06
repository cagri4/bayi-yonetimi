# Phase 15: Company Creation Infrastructure - Research

**Researched:** 2026-03-06
**Domain:** Supabase Admin Auth API, atomic tenant provisioning, superadmin guard pattern, Telegram deep links
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SA-01 | Superadmin yeni firma olusturabilir (firma adi, sektor, admin email, plan secimi) | Server Action pattern: validate input with Zod, guard with is_superadmin() check, call atomic provisioning, write audit log |
| SA-02 | Superadmin firma olusturunca tek kullanimlik Telegram davet linki uretilir (UUID token, 7 gun gecerlilik) | `crypto.randomUUID()` for raw token, `crypto.subtle.digest("SHA-256")` for hash stored in onboarding_invites, deep link format `https://t.me/{BotUsername}?start={token}` |
| SA-05 | Superadmin tum islemleri audit log'a kaydedilir (kim, ne, ne zaman, eski/yeni deger) | superadmin_audit_log table already created in Phase 14 — service role INSERT after every write; old_value null for creates |
| SA-06 | Superadmin paneli is_superadmin() kontrolu ile korunur (normal admin erisemez) | DB-level guard via is_superadmin() SECURITY DEFINER in every Server Action; middleware /superadmin/* protection; return `{ error: 'Forbidden' }` with HTTP 403 semantics |
| KS-05 | Sihirbaz toplanan bilgilerle sistemi tek atomik islemde kurar (company + users + agent_definitions + subscription) | supabase-js has NO transaction support — must use PostgreSQL function (RPC) for atomic multi-table creation; auth.users creation must happen in application layer BEFORE the RPC, with rollback on failure |
| KS-06 | Kurulum tamamlaninca firma sahibine web panel linki ve gecici sifre gonderilir | sendTelegramMessage pattern already exists in dispatcher.ts — Phase 15 creates standalone sendTelegramMessage() util callable from Server Actions |
| KS-08 | Sihirbaz ayri bir Telegram botu olarak calisir (kendi token'i, kendi webhook route'u) | New file: /api/telegram/sihirbaz/route.ts; new env var: TELEGRAM_BOT_TOKEN_SIHIRBAZ; exact same route pattern as egitimci/route.ts but calls Sihirbaz handler not dispatchAgentUpdate |
</phase_requirements>

---

## Summary

Phase 15 builds the server-side infrastructure that the future Kurulum Sihirbazi wizard calls when it finishes collecting information. Three distinct problems must be solved: (1) atomically provisioning a full tenant (company + auth user + users row + 12 agent_definitions + subscription) in a way that leaves no orphaned records on failure, (2) generating and storing a single-use Telegram invite token securely, and (3) protecting all superadmin actions behind a consistent `is_superadmin()` guard that returns a structured 403 rather than a redirect.

The critical finding is that **supabase-js has no transaction support** — PostgREST does not expose BEGIN/COMMIT. The only way to make the multi-table DB writes atomic is a PostgreSQL RPC function. However, `auth.users` creation via `auth.admin.createUser()` happens at the application layer (not inside PostgreSQL), so the provisioning sequence must be: (1) create auth user via service role, (2) call RPC for the remaining tables, (3) on RPC failure, call `auth.admin.deleteUser()` to rollback. This two-phase compensating transaction is the established pattern for Supabase.

The Sihirbaz Telegram webhook route is trivial to add — it follows the exact same pattern as the 12 existing agent routes (`after()` + immediate 200), but dispatches to a Sihirbaz-specific handler instead of `dispatchAgentUpdate`. Phase 15 only needs the route skeleton; the full wizard FSM is Phase 16's job.

**Primary recommendation:** Use a compensating transaction approach (auth.createUser → RPC provision_company → on failure: auth.deleteUser) rather than a pure PostgreSQL function. The RPC handles the 5 DB tables atomically; auth creation is wrapped in try/catch with cleanup.

---

## Standard Stack

### Core (no new npm packages required)
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.91+ | `auth.admin.createUser()`, service role DB writes | Already installed |
| `zod` | 4.3.6 | Server Action input validation | Already installed — project standard |
| `crypto` (Node.js built-in) | Node 20 | `randomUUID()` for token, `subtle.digest` for SHA-256 | Available in all Next.js server contexts |
| Next.js Server Actions | 16.1.4 | Form mutation pattern — already used for all admin operations | Project pattern |

### No New Libraries Needed
This phase is pure TypeScript + Server Actions + SQL (one new RPC function). All tooling is already installed.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Compensating transaction (app-layer) | Pure Postgres function for all 5 tables | Postgres cannot call auth.admin.createUser — auth.users is auth schema, accessible only via admin API |
| `crypto.randomUUID()` + SHA-256 hash | UUID v4 stored as plaintext | Token stored as hash prevents token leakage from DB access; raw token only ever exists in memory and the invite URL |
| Separate `/superadmin/*` route group layout | Middleware-only guard | Layout provides fail-fast at page level; middleware provides defense in depth |

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (superadmin)/
│   │   ├── layout.tsx           # is_superadmin() guard — redirect if fails
│   │   └── superadmin/
│   │       ├── page.tsx         # Placeholder (full UI in Phase 19)
│   │       └── companies/
│   │           └── new/
│   │               └── page.tsx # Create-company form
│   ├── api/
│   │   └── telegram/
│   │       └── sihirbaz/
│   │           └── route.ts     # Sihirbaz webhook (KS-08)
├── lib/
│   ├── actions/
│   │   └── superadmin.ts        # createCompany(), generateInviteLink() Server Actions
│   ├── superadmin/
│   │   └── guard.ts             # assertSuperadmin() helper
│   └── telegram/
│       └── send.ts              # Standalone sendTelegramMessage() (reusable outside agent layer)
└── components/
    └── superadmin/
        └── create-company-form.tsx  # Client component
```

### Pattern 1: is_superadmin() Guard in Server Actions
**What:** Every Server Action that performs a superadmin write must verify the caller's role before doing anything else.
**When to use:** Every function in `src/lib/actions/superadmin.ts`.
**Example:**
```typescript
// src/lib/superadmin/guard.ts
'use server'

import { createClient } from '@/lib/supabase/server'

export async function assertSuperadmin(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('FORBIDDEN')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'superadmin') throw new Error('FORBIDDEN')
  return user.id
}
```

**Calling pattern in Server Action:**
```typescript
export async function createCompany(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let actorId: string
  try {
    actorId = await assertSuperadmin()
  } catch {
    return { error: 'Forbidden', status: 403 }
  }
  // ... rest of action
}
```

**Note:** `forbidden()` from `next/navigation` is experimental (requires `authInterrupts: true` in next.config.ts). The project uses the established pattern of returning an error state from Server Actions rather than throwing. Use the `throw new Error('FORBIDDEN')` + catch pattern above.

### Pattern 2: Compensating Transaction for Atomic Tenant Provisioning
**What:** auth.users is in a separate schema not accessible via PostgreSQL RPC. The sequence is: (1) create auth user, (2) call RPC for all other tables inside a PG transaction, (3) on step 2 failure, delete auth user.
**When to use:** createCompany() Server Action in `src/lib/actions/superadmin.ts`.

```typescript
// Compensating transaction pattern
const serviceClient = createServiceClient()

// Step 1: Create auth user (outside Postgres transaction)
const tempPassword = generateSecurePassword()
const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
  email: adminEmail,
  password: tempPassword,
  email_confirm: true,  // Skip email verification — superadmin-provisioned
})
if (authError || !authData.user) {
  return { error: 'Auth user creation failed: ' + authError?.message }
}

const authUserId = authData.user.id

// Step 2: Atomic DB provisioning via RPC (BEGIN/COMMIT inside PG function)
const { data: companyId, error: rpcError } = await serviceClient.rpc(
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

if (rpcError) {
  // Step 3: Compensating rollback — delete auth user if RPC failed
  await serviceClient.auth.admin.deleteUser(authUserId)
  return { error: 'Company provisioning failed: ' + rpcError.message }
}

// Step 4: Write audit log
await serviceClient.from('superadmin_audit_log').insert({
  actor_id: actorId,
  action: 'create_company',
  target_table: 'companies',
  target_id: companyId,
  old_value: null,
  new_value: { name, sektor, plan, admin_email: adminEmail },
})

return { success: true, companyId, tempPassword }
```

### Pattern 3: PostgreSQL provision_company() RPC Function
**What:** A single PostgreSQL function that runs companies + users + agent_definitions + subscription inserts inside an implicit transaction. Any failure auto-rollbacks all 4 table writes.
**When to use:** Called from Step 2 of the compensating transaction above.

```sql
-- New migration: 013_provision_company_rpc.sql
CREATE OR REPLACE FUNCTION provision_company(
  p_name          TEXT,
  p_slug          TEXT,
  p_sektor        TEXT,
  p_plan          TEXT,
  p_admin_user_id UUID,
  p_admin_email   TEXT,
  p_trial_days    INTEGER DEFAULT 14
)
RETURNS UUID  -- returns company_id
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id UUID;
  v_trial_end  TIMESTAMPTZ;
  v_role       TEXT;
BEGIN
  v_trial_end := NOW() + (p_trial_days || ' days')::INTERVAL;

  -- 1. Insert company
  INSERT INTO companies (name, slug, plan, is_active, trial_ends_at)
  VALUES (p_name, p_slug, p_plan, true, v_trial_end)
  RETURNING id INTO v_company_id;

  -- 2. Insert admin user row
  INSERT INTO users (id, email, role, company_id)
  VALUES (p_admin_user_id, p_admin_email, 'admin', v_company_id);

  -- 3. Insert subscription (trialing)
  INSERT INTO subscriptions (company_id, plan, status, trial_ends_at)
  VALUES (v_company_id, p_plan, 'trialing', v_trial_end);

  -- 4. Insert 12 agent_definitions (all active for trial)
  FOR v_role IN
    SELECT unnest(ARRAY[
      'egitimci','satis_temsilcisi','muhasebeci','depo_sorumlusu',
      'genel_mudur_danismani','tahsilat_uzmani','dagitim_koordinatoru',
      'saha_satis','pazarlamaci','urun_yoneticisi','satin_alma','iade_kalite'
    ])
  LOOP
    INSERT INTO agent_definitions (company_id, role, is_active, system_prompt, model)
    SELECT v_company_id, v_role, true, ad.system_prompt, ad.model
    FROM agent_definitions ad
    WHERE ad.role = v_role
      AND ad.company_id = (SELECT id FROM companies WHERE slug = 'default' LIMIT 1)
    LIMIT 1;
    -- If no template exists, insert minimal definition
    IF NOT FOUND THEN
      INSERT INTO agent_definitions (company_id, role, is_active, system_prompt, model)
      VALUES (v_company_id, v_role, true, '', 'claude-haiku-4-5');
    END IF;
  END LOOP;

  RETURN v_company_id;
END;
$$;

-- Grant execution only to service role (not authenticated users)
REVOKE EXECUTE ON FUNCTION provision_company FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION provision_company FROM authenticated;
-- Service role has BYPASSRLS and implicit EXECUTE on all functions
```

**Note on agent_definitions template:** The project uses a 'default' company slug as template seed (documented in Phase 8 decisions: "Seed company slug='default' used as stable subquery key for direct-assign table backfill"). The RPC should copy system_prompt and model from the default company's agent_definitions, falling back to empty string/haiku defaults if the default company lacks a template for a role.

### Pattern 4: Invite Token Generation
**What:** Generate a cryptographically random UUID token, SHA-256 hash it for DB storage, return raw token for URL inclusion.
**When to use:** `generateInviteLink()` Server Action after company creation.

```typescript
// Token generation — Server Action context (Node.js runtime, not Edge)
async function generateInviteToken(): Promise<{ raw: string; hash: string }> {
  const raw = crypto.randomUUID()  // Node.js built-in, available in Next.js server context

  // SHA-256 hash using Web Crypto API (works in both Node.js and Edge runtime)
  const encoder = new TextEncoder()
  const data = encoder.encode(raw)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return { raw, hash }
}

// Usage in generateInviteLink() action:
const { raw: token, hash: tokenHash } = await generateInviteToken()
const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

const { error } = await serviceClient.from('onboarding_invites').insert({
  company_id: companyId,
  token_hash: tokenHash,
  expires_at: expiresAt,
  created_by: actorId,
})

const botUsername = 'SihirbazBot'  // From env: TELEGRAM_BOT_USERNAME_SIHIRBAZ or hardcoded
const deepLink = `https://t.me/${botUsername}?start=${token}`

// Audit log
await serviceClient.from('superadmin_audit_log').insert({
  actor_id: actorId,
  action: 'generate_invite',
  target_table: 'onboarding_invites',
  target_id: companyId,
  old_value: null,
  new_value: { company_id: companyId, expires_at: expiresAt },
})

return { success: true, deepLink }
```

**Telegram deep link format:** `https://t.me/{BotUsername}?start={parameter}`
- Max 64 characters for parameter
- Allowed chars: A-Z, a-z, 0-9, _, -
- UUID is 36 chars with hyphens, within limit
- UUID chars (hex + hyphens) are all allowed

### Pattern 5: Sihirbaz Telegram Webhook Route (KS-08)
**What:** New route `/api/telegram/sihirbaz/route.ts` following the exact established pattern.
**When to use:** Phase 15 creates the route skeleton; Phase 16 implements the wizard handler.

```typescript
// src/app/api/telegram/sihirbaz/route.ts
import { after } from 'next/server'
import type { Update } from 'grammy/types'
import { createServiceClient } from '@/lib/supabase/service-client'
// import { dispatchSihirbazUpdate } from '@/lib/sihirbaz/dispatcher'  — Phase 16

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  let update: Update
  try {
    update = (await request.json()) as Update
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  // Idempotency (same pattern as all 12 agent routes)
  const supabase = createServiceClient()
  const { error: idempotencyError } = await supabase
    .from('processed_telegram_updates')
    .insert({ update_id: update.update_id })

  if (idempotencyError) {
    if (idempotencyError.code === '23505') {
      return new Response('OK', { status: 200 })
    }
    console.error('[telegram/sihirbaz] idempotency insert error:', idempotencyError)
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN_SIHIRBAZ || ''

  after(async () => {
    try {
      // Phase 15: Stub — logs receipt, sends placeholder reply
      // Phase 16: dispatchSihirbazUpdate(update, botToken)
      console.log('[sihirbaz] received update, wizard not yet implemented')
    } catch (err) {
      console.error('[telegram/sihirbaz] dispatch error:', err)
    }
  })

  return new Response('OK', { status: 200 })
}
```

### Pattern 6: Superadmin Layout Guard
**What:** Route group `(superadmin)` with `layout.tsx` that checks `is_superadmin()` and redirects if false.
**When to use:** All `/superadmin/*` pages.

```typescript
// src/app/(superadmin)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'superadmin') redirect('/admin')

  return <>{children}</>
}
```

**Note:** Middleware already has `/admin` role check. The `(superadmin)` layout is defense-in-depth since middleware currently only checks for `admin` role, not `superadmin`. The middleware MUST be updated to allow superadmin through `/admin` check (superadmin should NOT be redirected to `/catalog` when visiting `/superadmin`).

### Pattern 7: Standalone Telegram Message Sender
**What:** `sendTelegramMessage()` usable from Server Actions outside the agent dispatcher context. Currently `sendTelegramMessage` is a private function inside `dispatcher.ts`.
**When to use:** KS-06 — sending web panel link + temp password after company creation.

```typescript
// src/lib/telegram/send.ts
export async function sendTelegramMessage(
  chatId: number,
  text: string,
  botToken: string
): Promise<boolean> {
  if (!botToken) {
    console.error('[telegram/send] No bot token provided')
    return false
  }
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      }
    )
    return response.ok
  } catch (err) {
    console.error('[telegram/send] Error:', err)
    return false
  }
}
```

**Note:** This is a simplified version without retry logic. For Phase 15, the use case (KS-06, sending completion message) does not need retry — the wizard context will handle retry if needed in Phase 16. Keep it simple.

### Anti-Patterns to Avoid
- **Performing DB writes in sequence without RPC:** If companies INSERT succeeds but subscription INSERT fails, the company row is orphaned. Always use the RPC for the 4 DB tables.
- **Using authenticated Supabase client for admin provisioning:** `createClient()` (anon key) cannot write to company-scoped tables when RLS requires a JWT company_id claim. Always use `createServiceClient()` for provisioning.
- **Storing raw token in DB:** Store only the SHA-256 hash. Raw token lives only in memory and in the deep link URL. If DB is breached, tokens are not exposed.
- **Missing middleware update:** The existing middleware checks `profile?.role !== 'admin'` and redirects to `/catalog`. A superadmin has role `'superadmin'`, not `'admin'`, so they would be redirected away from `/admin` routes. The `/superadmin/*` paths must be added to middleware public check or the middleware logic updated.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic multi-table inserts | Sequential JS inserts with manual rollback | PostgreSQL RPC function | PG auto-rollbacks on any EXCEPTION; JS rollback is unreliable under concurrent requests |
| Admin user creation | supabase.from('auth.users').insert() | `serviceClient.auth.admin.createUser()` | auth schema is not a regular table; only admin API can create auth users |
| Token hashing | Custom hash scheme | `crypto.subtle.digest('SHA-256', ...)` | Web Crypto API — built in, constant-time safe |
| Role guard logic | Per-action role checks | `assertSuperadmin()` shared helper | DRY; consistent 403 semantics across all superadmin actions |
| Temporary password generation | UUID as password | `crypto.randomUUID()` + format | UUID is 36 chars, all valid password characters; simpler than bcrypt during provisioning |

**Key insight:** The supabase-js client is a PostgREST abstraction — it has no transaction primitives. Any multi-table write that must be atomic MUST use a PG function via `.rpc()`.

---

## Common Pitfalls

### Pitfall 1: Middleware Blocks Superadmin from /admin Routes
**What goes wrong:** The existing middleware has `if (profile?.role !== 'admin') redirect('/catalog')` for `/admin/*` routes. A superadmin user has role `'superadmin'`, not `'admin'`, and gets redirected to `/catalog` when accessing any `/admin/*` or `/superadmin/*` path.
**Why it happens:** The admin guard was written before superadmin role existed.
**How to avoid:** Update middleware to allow `superadmin` role through: `if (profile?.role !== 'admin' && profile?.role !== 'superadmin')`. Also add `/superadmin` as a protected path that requires `superadmin` role.
**Warning signs:** Superadmin user always ends up at `/catalog` — looks like an auth issue but is a role check in middleware.

### Pitfall 2: provision_company RPC Needs SECURITY DEFINER
**What goes wrong:** The RPC is called via service role client (BYPASSRLS), but the function body accesses auth.users indirectly via foreign key. Without SECURITY DEFINER, insert into `users` table may fail if the function's search path doesn't include the right schema.
**Why it happens:** PostgreSQL functions run as the invoker by default. SECURITY DEFINER makes them run as the owner (postgres).
**How to avoid:** Always declare `SECURITY DEFINER` on `provision_company`. Also set `SET search_path = public;` to prevent schema injection.
**Warning signs:** "permission denied for table users" error from RPC call even though service role is used.

### Pitfall 3: agent_definitions Template Copy Fails Silently
**What goes wrong:** The provisioning RPC attempts to copy agent_definitions from the 'default' company. If the 'default' company doesn't have all 12 roles seeded, some INSERT INTO... SELECT returns 0 rows and the IF NOT FOUND fallback inserts a blank system_prompt.
**Why it happens:** The default company seed may have been created before all 12 roles were added to agent_definitions in Phase 12.
**How to avoid:** The RPC's fallback `INSERT...VALUES(v_company_id, v_role, true, '', 'claude-haiku-4-5')` ensures all 12 rows are always created even without a template. Accept blank system prompts — they can be configured later.
**Warning signs:** New company has fewer than 12 agent_definitions rows after provisioning.

### Pitfall 4: Telegram Deep Link Token Length
**What goes wrong:** Telegram's `?start=` parameter has a 64-character maximum. A raw UUID is 36 characters (fine). A SHA-256 hex hash is 64 characters (at the limit). A base64url SHA-256 is 43 characters (safer margin).
**Why it happens:** Storing the hash in the URL would expose it.
**How to avoid:** Store raw UUID token (36 chars) in the URL, hash in DB. Never put the hash in the URL.
**Warning signs:** Telegram silently truncates the start parameter; bot receives empty or truncated token.

### Pitfall 5: auth.admin.createUser() Does Not Trigger JWT Hook
**What goes wrong:** When `auth.admin.createUser()` is called, the JWT hook (`inject_company_claim`) is NOT triggered at creation time. The hook fires on login (token generation), not on user record creation. The new admin user will have the correct `company_id` in JWT only after their first login.
**Why it happens:** The JWT hook runs on token issuance, not on INSERT into auth.users.
**How to avoid:** This is not a problem for Phase 15 — the admin user will log in with their temp credentials, triggering the hook at that point. Just ensure `users.company_id` is set correctly in the provisioning RPC before the user's first login.
**Warning signs:** Admin user has no company_id in JWT claim on first login — would be a bug only if users.company_id was not set in RPC.

### Pitfall 6: Middleware Reads DB on Every Request
**What goes wrong:** The current middleware reads from `users` table to get `role` for every request. Adding superadmin checks increases latency.
**Why it happens:** The project uses DB-backed role checks (not JWT claims) in middleware.
**How to avoid:** The superadmin role IS in the JWT claim via `inject_company_claim` hook (the hook reads `users.role`). Middleware could check JWT claims instead of querying DB. But for now: keep the existing pattern for consistency. The superadmin will rarely access the panel — latency is acceptable.
**Warning signs:** Not a real warning sign — performance concern only, not a correctness issue.

### Pitfall 7: KS-06 Requires Knowing Sihirbaz Bot Username Before Phase 15
**What goes wrong:** The deep link URL requires the bot's username (not token): `t.me/SihirbazBot?start=TOKEN`. The bot username is determined when registering with BotFather, not from the token.
**Why it happens:** Telegram deep links use the bot's public @username, not the bot token.
**How to avoid:** Add `TELEGRAM_BOT_USERNAME_SIHIRBAZ` as a new env var. Alternatively, the Telegram Bot API `getMe` endpoint returns the bot's username given a token: `https://api.telegram.org/bot{TOKEN}/getMe`. Could call this at action time or cache it in env.
**Recommendation:** Use `TELEGRAM_BOT_USERNAME_SIHIRBAZ` env var (simpler, no API call needed). The STATE.md already notes: "Register new Telegram bot with BotFather for Kurulum Sihirbazi before Phase 16" — can be done before Phase 15 is deployed.

---

## Code Examples

Verified patterns from existing codebase and official docs:

### auth.admin.createUser() with email_confirm
```typescript
// Source: https://supabase.com/docs/reference/javascript/auth-admin-createuser
// Requires: serviceClient (service role key)
const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
  email: adminEmail,
  password: tempPassword,
  email_confirm: true,  // Bypass email verification — superadmin-provisioned account
})
// authData.user.id is the UUID to use as p_admin_user_id in the RPC
```

### Existing server createClient() pattern (project standard)
```typescript
// Source: src/lib/supabase/server.ts (already in codebase)
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()  // User-context client (anon key + session)
```

### Existing createServiceClient() pattern (project standard)
```typescript
// Source: src/lib/supabase/service-client.ts (already in codebase)
import { createServiceClient } from '@/lib/supabase/service-client'
const serviceClient = createServiceClient()  // Service role — bypasses RLS
```

### Zod v4 validation (project standard)
```typescript
// Source: src/lib/validations/auth.ts pattern; Note: Zod v4 uses error not errorMap
import { z } from 'zod'

const createCompanySchema = z.object({
  name: z.string().min(2, 'Firma adi en az 2 karakter olmali'),
  sektor: z.string().min(1, 'Sektor secimi zorunlu'),
  admin_email: z.string().email('Gecerli bir email adresi girin'),
  plan: z.enum(['starter', 'pro', 'enterprise'], {
    error: 'Gecerli bir plan secin'  // Zod v4: error, not errorMap
  }),
})
```

### audit log insert (table from Phase 14)
```typescript
// superadmin_audit_log schema: id, actor_id, action, target_table, target_id, old_value, new_value
await serviceClient.from('superadmin_audit_log').insert({
  actor_id: actorId,          // string (user UUID)
  action: 'create_company',   // string
  target_table: 'companies',  // string
  target_id: companyId,       // string | null
  old_value: null,            // Json | null (null for creates)
  new_value: { name, plan },  // Json | null
})
```

### Slug generation from company name
```typescript
// No library needed — simple normalization
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 63)
}
// Collision handling: add DB UNIQUE constraint on slug; return error if slug exists
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct auth schema inserts | `auth.admin.createUser()` admin API | Supabase v2+ | Only admin API can create auth users |
| `uuid_generate_v4()` | `gen_random_uuid()` | Phase 8 decision | New Supabase projects don't have uuid-ossp by default |
| `forbidden()` from next/navigation | `return { error: 'Forbidden' }` from Server Action | experimental in Next.js 15.1 | Project standard: structured error state returns |

**Deprecated/outdated:**
- `uuid_generate_v4()`: Use `gen_random_uuid()` — project decision documented in STATE.md and multiple plans
- Client-side auth.signUp() for admin user creation: admin API (`auth.admin.createUser`) required for server-side provisioning without email verification

---

## Open Questions

1. **Agent definitions template source for new companies**
   - What we know: The `provision_company` RPC should copy system_prompt from the 'default' company's agent_definitions
   - What's unclear: Whether the 'default' company's agent_definitions have up-to-date system prompts for all 12 roles (they were seeded in Phases 10-12)
   - Recommendation: Check in Task 1 of Plan 15-01 by querying `SELECT role, system_prompt FROM agent_definitions WHERE company_id = (SELECT id FROM companies WHERE slug = 'default')`. If missing or blank, insert minimal system prompts. Accept the risk — Phase 16+ can configure prompts.

2. **Bot username for deep link URL**
   - What we know: Deep link requires bot @username (not token). Telegram API's getMe returns it.
   - What's unclear: Whether the superadmin has registered the Sihirbaz bot with BotFather before Phase 15 runs.
   - Recommendation: Add `TELEGRAM_BOT_USERNAME_SIHIRBAZ` env var (e.g., `SihirbazBot`). If missing, return the token only and show instructions in the UI. The STATE.md note ("Register new Telegram bot with BotFather for Kurulum Sihirbazi before Phase 16") implies Phase 15 can proceed without it registered yet.

3. **Slug uniqueness strategy**
   - What we know: companies.slug has UNIQUE constraint (implied by search query pattern from Phase 8).
   - What's unclear: Whether there's an existing UNIQUE INDEX on companies.slug.
   - Recommendation: Verify in Plan 15-01 via Dashboard. If no unique constraint, add one in the RPC migration. Generate slug from name, catch 23505 error, return "Slug already taken — choose different name" error to user.

4. **KS-06 timing — when to send temp password**
   - What we know: KS-06 says "after wizard completes" — but Phase 15 is about the create-company action in isolation before the wizard exists.
   - What's unclear: Should Phase 15 implement KS-06 now (send temp password from Server Action) or defer it to Phase 16 (wizard sends it at completion)?
   - Recommendation: Phase 15 implements the Server Action that returns `{ tempPassword, deepLink }` to the superadmin UI. The UI displays both. KS-06 (sending to company owner via Telegram) is deferred to Phase 16 when the wizard has the owner's chat_id.

---

## Sources

### Primary (HIGH confidence)
- `/home/cagr/Masaüstü/bayi-yönetimi/src/types/database.types.ts` — confirmed onboarding_invites, subscriptions, superadmin_audit_log, agent_marketplace schemas from Phase 14
- `/home/cagr/Masaüstü/bayi-yönetimi/src/lib/supabase/service-client.ts` — existing service client pattern
- `/home/cagr/Masaüstü/bayi-yönetimi/src/lib/agents/dispatcher.ts` — sendTelegramMessage pattern
- `/home/cagr/Masaüstü/bayi-yönetimi/src/app/(admin)/layout.tsx` — existing admin guard pattern to model superadmin guard on
- `/home/cagr/Masaüstü/bayi-yönetimi/src/middleware.ts` — confirmed middleware role check needs update for superadmin
- `/home/cagr/Masaüstü/bayi-yönetimi/.planning/STATE.md` — v4.0 decisions including "create-company: Single atomic Postgres transaction"
- https://supabase.com/docs/reference/javascript/auth-admin-createuser — `email_confirm: true`, server-only requirement
- https://nextjs.org/docs/app/api-reference/functions/forbidden — confirmed `forbidden()` is experimental, requires `authInterrupts: true`
- https://core.telegram.org/bots/features#deep-linking — deep link format, 64-char limit, allowed chars

### Secondary (MEDIUM confidence)
- https://github.com/orgs/supabase/discussions/4562 — confirmed supabase-js has no transaction support; RPC is the solution
- https://marmelab.com/blog/2025/12/08/supabase-edge-function-transaction-rls.html — transaction patterns in Supabase

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, verified against existing package.json
- Architecture: HIGH — patterns verified against existing codebase (dispatcher.ts, middleware.ts, agent routes)
- Pitfalls: HIGH — confirmed against STATE.md decisions, migration files, middleware code
- Telegram deep link: HIGH — verified against official Telegram docs
- Atomic provisioning: HIGH — confirmed via official Supabase discussions and existing code patterns

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable technologies — supabase-js API, Telegram deep links, Next.js Server Actions)
