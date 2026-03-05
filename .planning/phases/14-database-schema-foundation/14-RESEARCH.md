# Phase 14: Database Schema Foundation - Research

**Researched:** 2026-03-06
**Domain:** Supabase PostgreSQL schema migrations, RLS policies, idempotency patterns
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DB-01 | onboarding_sessions tablosu olusturulur (wizard state, collected_data JSONB, deep_link_token, telegram_chat_id) | Session state table pattern — service role only, JSONB for flexible wizard data, deep_link_token for Telegram deep link routing |
| DB-02 | subscriptions tablosu olusturulur (company_id, plan, status, trial_ends_at, mollie_subscription_id) | Company-scoped billing table — superadmin + service role access, status enum, nullable Mollie ID during trial |
| DB-03 | agent_marketplace tablosu olusturulur (agent_role, display_name, description, monthly_price, minimum_plan) | Global catalog table (no company_id) — superadmin only writes, all authenticated can read, 12 seed rows |
| DB-04 | payment_webhook_events tablosu olusturulur (mollie_event_id, payload JSONB, processed_at — idempotency) | UNIQUE(mollie_event_id) constraint for idempotency — reject duplicate before application code runs |
| DB-05 | superadmin_audit_log tablosu olusturulur (actor_id, action, target_table, old_value, new_value JSONB) | Append-only audit log — superadmin SELECT only, service role INSERT only, no UPDATE/DELETE |
| DB-06 | companies tablosuna trial_ends_at kolonu eklenir | ALTER TABLE ADD COLUMN TIMESTAMPTZ NULL — does not break existing queries; NULL means no trial active |
| DB-07 | agent_definitions tablosuna subscription_tier kolonu eklenir | ALTER TABLE ADD COLUMN TEXT NULL with CHECK constraint — existing rows get NULL, application handles NULL as 'starter' |
| DB-08 | onboarding_invites tablosu olusturulur (token hash, used_at, expires_at — tek kullanimlik) | UNIQUE(token_hash) enforced at DB level — prevents double-use before application code can check |
</phase_requirements>

---

## Summary

Phase 14 creates the complete database foundation for all v4.0 features: 6 new tables, 2 column additions to existing tables, seed data for the agent marketplace, and RLS policies. Every subsequent phase (15-19) reads from or writes to these tables — no mocking is acceptable. The migration must be executed in Supabase Dashboard SQL Editor (no CLI access), which means the SQL must be split into clear, independently executable blocks.

The existing project uses a well-established migration pattern: numbered files in `supabase/migrations/`, each with `-- BLOCK N:` comments separating logical units for Dashboard execution. The security model already has `is_superadmin()`, `is_company_admin()`, and `current_company_id()` SECURITY DEFINER functions. All new policies follow the `(SELECT is_superadmin())` wrapper pattern (confirmed as project convention in migration 009 — 30+ policies use this form for performance).

Two tables require special handling: `payment_webhook_events` must enforce idempotency via `UNIQUE(mollie_event_id)` so duplicate Mollie webhook deliveries are rejected before reaching application code; `onboarding_invites` must enforce single-use via `UNIQUE(token_hash)` so a token cannot be consumed twice even under concurrent requests. The `agent_marketplace` table acts as a global catalog (no `company_id`) seeded with exactly 12 rows at migration time.

**Primary recommendation:** Create a single migration file `012_v4_schema_foundation.sql` split into 10 labeled blocks, executed sequentially in Dashboard SQL Editor, followed by TypeScript type additions to `database.types.ts`.

---

## Standard Stack

### Core (no new npm packages required)
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| PostgreSQL (via Supabase) | 15.x | Database | Already in use |
| Supabase Dashboard SQL Editor | Current | Migration execution | No CLI token available |
| `@supabase/supabase-js` | 2.91+ | Client library | Already in use |

### No New Libraries Needed
This phase is pure SQL + TypeScript type updates. All tooling is already installed.

---

## Architecture Patterns

### Recommended Migration File Structure
```
supabase/migrations/
└── 012_v4_schema_foundation.sql   # New migration (next after 011)
```

```
src/types/
└── database.types.ts              # Add Row/Insert/Update for 6 new tables
```

### Pattern 1: Block-Based Dashboard Execution
**What:** Split the migration into numbered `-- BLOCK N:` sections, each independently pasteable into Supabase Dashboard SQL Editor.
**When to use:** Always — project has no Supabase CLI access token, all migrations are executed manually via Dashboard.
**Example (from migration 009):**
```sql
-- ============================================
-- BLOCK 1: onboarding_sessions table
-- Paste this block first in Supabase Dashboard SQL Editor
-- ============================================

CREATE TABLE onboarding_sessions (
  ...
);
```

### Pattern 2: Company-Scoped Tables (RLS with superadmin bypass)
**What:** Tables with `company_id NOT NULL REFERENCES companies(id) ON DELETE CASCADE`, two RLS policies: superadmin full access + company member access.
**When to use:** subscriptions, onboarding_invites (company-scoped)
**Example (from migration 009, confirmed pattern):**
```sql
-- Superadmin unrestricted (with SELECT wrapper for performance)
CREATE POLICY "Superadmin full access on subscriptions"
  ON subscriptions FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

-- Company members read own company data
CREATE POLICY "Company admins can read own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (company_id = current_company_id() AND is_company_admin());
```

### Pattern 3: Service-Role-Only Tables (no authenticated user policies)
**What:** Tables with no user-visible RLS policies — only service role can read/write. RLS is enabled but no `TO authenticated` policies exist.
**When to use:** onboarding_sessions (wizard state managed by bot), payment_webhook_events (webhook handler runs as service role), superadmin_audit_log (append-only by service role)
**Example (from migration 010, agent_conversations pattern):**
```sql
ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;
-- No authenticated policies — service role bypasses RLS entirely
-- Superadmin can SELECT via service role or explicit policy
CREATE POLICY "Superadmin can read onboarding sessions"
  ON onboarding_sessions FOR SELECT
  TO authenticated
  USING ((SELECT is_superadmin()));
```

### Pattern 4: Global Catalog Table (no company_id)
**What:** Tables that are platform-wide with no tenant scoping — readable by all authenticated, writable only by superadmin.
**When to use:** agent_marketplace (one catalog for all tenants)
**Example:**
```sql
CREATE TABLE agent_marketplace (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_role    TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  description   TEXT NOT NULL,
  monthly_price NUMERIC(8,2) NOT NULL,
  minimum_plan  TEXT NOT NULL DEFAULT 'starter' CHECK (minimum_plan IN ('starter', 'pro', 'enterprise')),
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_marketplace ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read the catalog
CREATE POLICY "Authenticated users can read agent marketplace"
  ON agent_marketplace FOR SELECT
  TO authenticated
  USING (true);

-- Only superadmin can manage
CREATE POLICY "Superadmin manages agent marketplace"
  ON agent_marketplace FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));
```

### Pattern 5: Idempotency via UNIQUE Constraint
**What:** Use a database-level UNIQUE constraint on the event identifier column. The application attempts INSERT; if the event was already processed, PostgreSQL raises error 23505 (unique violation), which the application catches and treats as success.
**When to use:** payment_webhook_events (Mollie event ID), onboarding_invites (token hash)
**Example:**
```sql
CREATE TABLE payment_webhook_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mollie_event_id TEXT NOT NULL UNIQUE,   -- UNIQUE enforces idempotency at DB level
  payload        JSONB NOT NULL DEFAULT '{}',
  processed_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```
**Application side:**
```typescript
// Source: standard PostgreSQL idempotency pattern
const { error } = await serviceClient
  .from('payment_webhook_events')
  .insert({ mollie_event_id: event.id, payload: event })

if (error?.code === '23505') {
  // Already processed — return 200 without reprocessing
  return NextResponse.json({ ok: true, duplicate: true })
}
```

### Pattern 6: ALTER TABLE ADD COLUMN (non-breaking)
**What:** Adding nullable columns to existing tables does not break existing queries or running application code.
**When to use:** DB-06 (companies.trial_ends_at), DB-07 (agent_definitions.subscription_tier)
**Key rule:** Always add as nullable first. Never add NOT NULL without a DEFAULT or existing data backfill.
**Example:**
```sql
-- Safe: nullable column, no default required
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Safe: nullable with check constraint
ALTER TABLE agent_definitions
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT
    CHECK (subscription_tier IN ('starter', 'pro', 'enterprise'));
```
**Note:** `ADD COLUMN IF NOT EXISTS` prevents error if run twice accidentally.

### Pattern 7: Append-Only Audit Log
**What:** superadmin_audit_log should never be UPDATEd or DELETEd — only INSERT (by service role) and SELECT (by superadmin).
**Example:**
```sql
CREATE TABLE superadmin_audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action       TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id    UUID,
  old_value    JSONB,
  new_value    JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
  -- NO updated_at: audit logs are append-only
);

ALTER TABLE superadmin_audit_log ENABLE ROW LEVEL SECURITY;

-- Superadmin can read all audit entries
CREATE POLICY "Superadmin can read audit log"
  ON superadmin_audit_log FOR SELECT
  TO authenticated
  USING ((SELECT is_superadmin()));
-- INSERT is service role only (no authenticated INSERT policy)
```

### Pattern 8: TypeScript Types for New Tables
**What:** Extend `src/types/database.types.ts` with Row/Insert/Update types for each new table, then export convenience aliases.
**When to use:** Every migration that adds tables.
**Example (following project convention):**
```typescript
// Inside Database['public']['Tables']:
onboarding_sessions: {
  Row: {
    id: string
    company_id: string | null      // nullable: session may exist before company is created
    telegram_chat_id: number | null
    deep_link_token: string
    status: 'pending' | 'in_progress' | 'completed' | 'expired'
    collected_data: Json
    created_at: string
    updated_at: string
  }
  Insert: {
    id?: string
    company_id?: string | null
    telegram_chat_id?: number | null
    deep_link_token: string
    status?: 'pending' | 'in_progress' | 'completed' | 'expired'
    collected_data?: Json
    created_at?: string
    updated_at?: string
  }
  Update: {
    id?: string
    company_id?: string | null
    telegram_chat_id?: number | null
    deep_link_token?: string
    status?: 'pending' | 'in_progress' | 'completed' | 'expired'
    collected_data?: Json
    updated_at?: string
  }
  Relationships: []
}

// After the Database type, export convenience aliases:
export type OnboardingSession = Database['public']['Tables']['onboarding_sessions']['Row']
export type OnboardingSessionInsert = Database['public']['Tables']['onboarding_sessions']['Insert']
```

### Anti-Patterns to Avoid
- **NOT NULL without DEFAULT on ALTER TABLE:** Adding NOT NULL to an existing table with data will fail unless all rows have a value or a DEFAULT is provided.
- **Missing `IF NOT EXISTS` on new tables:** In Dashboard execution, if a block is run twice, `CREATE TABLE` without `IF NOT EXISTS` will error.
- **Pasting the entire migration at once:** Dashboard SQL Editor times out on large scripts. Use blocks.
- **Missing `(SELECT ...)` wrapper on RLS functions:** `USING (is_superadmin())` calls the function once per row. `USING ((SELECT is_superadmin()))` calls it once per query. Always wrap.
- **Placing global catalog rows in the wrong table:** `agent_marketplace` rows are NOT per-company. Do not add `company_id` to this table — it is a platform-wide catalog.
- **Forgetting the `-- BLOCK N:` comment:** Dashboard SQL Editor has no undo. The numbered blocks let the human executor know which block failed and where to resume.

---

## Complete Table Specifications

### DB-01: onboarding_sessions

```sql
CREATE TABLE onboarding_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID REFERENCES companies(id) ON DELETE CASCADE,  -- nullable until company provisioned
  deep_link_token  TEXT NOT NULL UNIQUE,                              -- Telegram deep link parameter
  telegram_chat_id BIGINT,                                            -- resolved when user starts bot
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'in_progress', 'completed', 'expired')),
  collected_data   JSONB NOT NULL DEFAULT '{}',                       -- wizard answers accumulate here
  step             INTEGER NOT NULL DEFAULT 0,                        -- which wizard step we are on
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS:** Superadmin SELECT (via authenticated), all other access via service role only.
**Index:** `idx_onboarding_sessions_token ON onboarding_sessions(deep_link_token)` for fast token lookup.
**Index:** `idx_onboarding_sessions_chat ON onboarding_sessions(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL` for chat-id lookup when bot receives a message.

### DB-02: subscriptions

```sql
CREATE TABLE subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan                  TEXT NOT NULL DEFAULT 'starter'
                        CHECK (plan IN ('starter', 'pro', 'enterprise')),
  status                TEXT NOT NULL DEFAULT 'trialing'
                        CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'paused')),
  trial_ends_at         TIMESTAMPTZ,                                  -- NULL means no trial period
  mollie_subscription_id TEXT,                                        -- NULL during trial, set on activation
  mollie_customer_id    TEXT,                                         -- Mollie customer reference
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id)                                                 -- one subscription per company
);
```

**RLS:** Superadmin full access. Company admins read own. Service role writes.

### DB-03: agent_marketplace

```sql
CREATE TABLE agent_marketplace (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_role    TEXT NOT NULL UNIQUE,                                 -- matches agent_definitions.role
  display_name  TEXT NOT NULL,                                        -- Turkish display name
  description   TEXT NOT NULL,                                        -- Turkish short description
  monthly_price NUMERIC(8,2) NOT NULL DEFAULT 0,
  minimum_plan  TEXT NOT NULL DEFAULT 'starter'
                CHECK (minimum_plan IN ('starter', 'pro', 'enterprise')),
  is_active     BOOLEAN DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,                           -- display order in UI
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS:** All authenticated can SELECT. Superadmin FOR ALL.
**Seed data required:** Exactly 12 rows (one per agent role) with Turkish display names, descriptions, and monthly prices. See Code Examples section.

### DB-04: payment_webhook_events

```sql
CREATE TABLE payment_webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mollie_event_id TEXT NOT NULL UNIQUE,                               -- UNIQUE enforces idempotency
  event_type      TEXT,                                               -- e.g. 'payment.paid', 'subscription.updated'
  payload         JSONB NOT NULL DEFAULT '{}',
  processed_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS:** Service role only. Superadmin SELECT for debugging.
**No `updated_at`:** Events are immutable once written.

### DB-05: superadmin_audit_log

```sql
CREATE TABLE superadmin_audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action       TEXT NOT NULL,                                         -- e.g. 'create_company', 'extend_trial'
  target_table TEXT NOT NULL,                                         -- e.g. 'companies', 'subscriptions'
  target_id    UUID,                                                  -- the row that was affected
  old_value    JSONB,                                                 -- state before action (NULL for creates)
  new_value    JSONB,                                                 -- state after action (NULL for deletes)
  created_at   TIMESTAMPTZ DEFAULT NOW()
  -- No updated_at: audit logs are append-only
);
```

**RLS:** Superadmin SELECT only. Service role INSERT only (no authenticated INSERT policy).
**Index:** `idx_superadmin_audit_log_actor ON superadmin_audit_log(actor_id, created_at DESC)`.
**Index:** `idx_superadmin_audit_log_target ON superadmin_audit_log(target_table, target_id)`.

### DB-06: companies.trial_ends_at (column addition)

```sql
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
```

**Impact:** Zero breaking change. All existing queries that SELECT companies continue to work. NULL means no trial period set (or trial not applicable). The `database.types.ts` companies Row type gains `trial_ends_at: string | null`.

### DB-07: agent_definitions.subscription_tier (column addition)

```sql
ALTER TABLE agent_definitions
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT
    CHECK (subscription_tier IN ('starter', 'pro', 'enterprise'));
```

**Impact:** Zero breaking change. All existing rows get NULL. The planner (Phase 18) uses this to gate agent access. The `database.types.ts` agent_definitions Row type gains `subscription_tier: string | null`.

### DB-08: onboarding_invites

```sql
CREATE TABLE onboarding_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,                                  -- SHA-256 of the raw token
  expires_at   TIMESTAMPTZ NOT NULL,                                  -- set to NOW() + interval '7 days'
  used_at      TIMESTAMPTZ,                                           -- NULL means not yet used
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

**Why hash, not raw token?** Storing the raw Telegram deep link token in the database means any DB read (leaked query log, backup restore, misconfigured RLS) exposes a live invite link. Hashing with SHA-256 means the DB only stores the hash; the raw token lives only in the deep link URL sent to the recipient.
**UNIQUE(token_hash) enforces single-use at DB level:** Even if the application checks `used_at IS NULL` before marking used, a race condition could allow two concurrent requests to both pass the check. The UNIQUE constraint prevents this — only one INSERT per hash value ever succeeds.

**RLS:** Superadmin full access. Company admins INSERT (to create invites for their company). Service role for token validation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotency for webhooks | Custom "check then insert" application logic | `UNIQUE(mollie_event_id)` constraint | Race condition: two concurrent requests can both pass the check before either has inserted. DB constraint is atomic. |
| Token uniqueness | UUID token without hashing | SHA-256 hash stored in `token_hash` | Raw token in DB = live invite in DB. Leak/backup exposes all pending invites. Hash is safe. |
| Audit logging | Application-level array or JSON file | `superadmin_audit_log` table | Application crashes lose buffered logs. DB table is transactional — log entry and data change commit together. |
| RLS performance | Inline function calls in USING clause | `(SELECT is_superadmin())` wrapper | Inline call evaluates per-row. SELECT wrapper evaluates once per query. On 1000-row table: ~1000x difference. |
| Multiple subscriptions per company | No UNIQUE constraint | `UNIQUE(company_id)` on subscriptions | Billing logic depends on exactly one subscription per company. Multiple rows cause double-charges. |

**Key insight:** In this domain, correctness under concurrent access requires database-level enforcement (UNIQUE constraints, FK constraints). Application-level checks are always subject to race conditions.

---

## Common Pitfalls

### Pitfall 1: Running Full Migration as One Block
**What goes wrong:** Supabase Dashboard SQL Editor has a 30-second execution timeout. A migration with 6 CREATE TABLEs + 12 INSERT statements + 20 RLS policies will timeout or partially execute, leaving the schema in an inconsistent state.
**Why it happens:** Dashboard is designed for interactive queries, not large migrations.
**How to avoid:** Split into 10+ blocks. Execute and verify each block before proceeding to the next. The `-- BLOCK N:` comment convention from earlier migrations makes this clear.
**Warning signs:** Dashboard shows "Query runner timed out" or "Cannot read property of undefined."

### Pitfall 2: Missing `(SELECT ...)` Wrapper on RLS Functions
**What goes wrong:** Policies like `USING (is_superadmin())` call the function once per row. On a 500-row audit log query, this is 500 function calls.
**Why it happens:** The no-wrapper form looks correct and passes testing with small datasets.
**How to avoid:** Always write `USING ((SELECT is_superadmin()))`. Check existing project migrations — 009 uses the wrapped form on all 30+ superadmin policies.
**Warning signs:** Superadmin panel loads slowly on tables with many rows.

### Pitfall 3: `onboarding_sessions.company_id` Must Be Nullable
**What goes wrong:** Making `company_id NOT NULL` on `onboarding_sessions` means the session must reference an existing company before the wizard starts. But the wizard's purpose IS to create the company — it doesn't exist yet.
**Why it happens:** Applying the standard "every company-scoped table needs company_id NOT NULL" rule without thinking about the temporal ordering.
**How to avoid:** `company_id UUID REFERENCES companies(id) ON DELETE CASCADE` with no NOT NULL. The session links to a company only when the wizard completes and the company is provisioned.
**Warning signs:** Application cannot create onboarding sessions without first creating a company.

### Pitfall 4: Storing Raw Token Instead of Hash in onboarding_invites
**What goes wrong:** Raw token in DB = any DB exposure (backup, misconfigured RLS, query log) leaks live invite links. An attacker who reads the DB can impersonate any pending invitee.
**Why it happens:** Simpler to store the raw token for comparison.
**How to avoid:** `token_hash TEXT` column stores `SHA-256(token)`. Application generates raw token, sends it in URL, stores only the hash. On validation: hash the incoming token and compare to stored hash.
**Warning signs:** `token TEXT NOT NULL UNIQUE` in the schema — raw token storage.

### Pitfall 5: Not Testing the UNIQUE Constraint on Duplicate Invites
**What goes wrong:** Success criterion 5 (deliberate duplicate insert rejected) is never tested during execution. The plan says "insert a duplicate token_hash — verify it fails." If this step is skipped, the constraint may have been written incorrectly (`UNIQUE(id)` instead of `UNIQUE(token_hash)`).
**Why it happens:** UNIQUE constraint correctness is easy to typo and hard to notice without a deliberate failure test.
**How to avoid:** Include a verification block that INSERTs two rows with the same token_hash and confirms the second fails with error code 23505.

### Pitfall 6: agent_marketplace Seed Data Count Mismatch
**What goes wrong:** Phase 14 success criterion 3 requires exactly 12 rows. If a row is duplicated or skipped, downstream phases (18 — "Dijital Ekibim") that expect exactly 12 agents will silently break.
**Why it happens:** Hand-counting 12 INSERT statements is error-prone.
**How to avoid:** End the seed block with a verification: `SELECT COUNT(*) FROM agent_marketplace;` — expected 12. Include this as a comment prompt in the migration.

### Pitfall 7: Skipping IF NOT EXISTS on ALTER TABLE Columns
**What goes wrong:** If the ALTER TABLE blocks are run twice (e.g., Dashboard connection drops mid-execution), the second run fails with "column already exists."
**Why it happens:** PostgreSQL does not have `IF NOT EXISTS` for ALTER TABLE ADD COLUMN in older versions. PostgreSQL 9.6+ supports it.
**How to avoid:** Use `ALTER TABLE companies ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;`. Supabase runs PostgreSQL 15.x — IF NOT EXISTS is fully supported.

---

## Code Examples

### Agent Marketplace Seed Data (12 required rows)
```sql
-- Source: v4.0 REQUIREMENTS.md agent role definitions + v3.0 agent names
INSERT INTO agent_marketplace (agent_role, display_name, description, monthly_price, minimum_plan, sort_order)
VALUES
  ('trainer',       'Egitimci',               'Urun bilgisi ve sik sorulan sorulara aninda yanit verir',                    99.00,  'starter',    1),
  ('sales',         'Satis Temsilcisi',        'Siparis alir, stok kontrol eder, kampanyalari tanitir',                     129.00, 'starter',    2),
  ('accountant',    'Muhasebeci',              'Cari hesap, fatura ve odeme gecmisi sorgular',                              129.00, 'starter',    3),
  ('warehouse',     'Depo Sorumlusu',          'Envanter takibi yapar, stok gunceller, bekleyen siparisleri yonetir',       129.00, 'starter',    4),
  ('executive',     'Genel Mudur Danismani',   'Tum ajanlarin verilerini birlestirerek stratejik analiz yapar',             199.00, 'pro',        5),
  ('collections',   'Tahsilat Uzmani',         'Vadesi gecen alacaklari takip eder, hatirlatma gonderir',                   129.00, 'starter',    6),
  ('distribution',  'Dagitim Koordinatoru',    'Teslimat durumu sorgular, kargo takibi yapar, rut yonetir',                 129.00, 'starter',    7),
  ('field_sales',   'Saha Satis Sorumlusu',    'Bayi ziyaret planlar, saha sonuclarini kaydeder',                          129.00, 'pro',        8),
  ('marketing',     'Pazarlamaci',             'Kampanya analizi yapar, bayi segmentasyonu olusturur',                      149.00, 'pro',        9),
  ('product',       'Urun Yoneticisi',         'Katalog analizi, fiyat stratejisi ve urun talep analizi yapar',             149.00, 'pro',       10),
  ('procurement',   'Satin Alma Sorumlusu',    'Tedarikci siparisi olusturur, stok yenileme onerir',                        129.00, 'starter',   11),
  ('returns',       'Iade Kalite Sorumlusu',   'Iade taleplerini yonetir, sikayet takibi yapar',                            99.00,  'starter',   12);
```

### Idempotency Check in Application Code
```typescript
// Source: PostgreSQL idempotency pattern — error code 23505 = unique_violation
// Used by: Mollie webhook handler (Phase 17)
import { createServiceClient } from '@/lib/supabase/service-client'

export async function recordWebhookEvent(mollieEventId: string, payload: unknown) {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('payment_webhook_events')
    .insert({
      mollie_event_id: mollieEventId,
      payload: payload as Json,
    })

  if (error) {
    if (error.code === '23505') {
      // Duplicate event — already processed. Safe to return success.
      return { duplicate: true }
    }
    throw error
  }

  return { duplicate: false }
}
```

### Token Hash Pattern for onboarding_invites
```typescript
// Source: standard crypto best practice
// Used by: Phase 15 superadmin company creation
import { createHash } from 'crypto'

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

// To create an invite:
const rawToken = crypto.randomUUID() + crypto.randomUUID() // 72 chars of entropy
const tokenHash = hashToken(rawToken)
const deepLinkUrl = `https://t.me/BayiOnboardingBot?start=${rawToken}`

await supabase.from('onboarding_invites').insert({
  company_id: companyId,
  token_hash: tokenHash,
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  created_by: actorId,
})

// To validate an invite:
const incomingToken = telegramDeepLinkParam
const hash = hashToken(incomingToken)
const { data: invite } = await supabase
  .from('onboarding_invites')
  .select('*')
  .eq('token_hash', hash)
  .is('used_at', null)
  .gt('expires_at', new Date().toISOString())
  .single()
```

### Verification Query (runs after seed data block)
```sql
-- Verify exactly 12 marketplace rows
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM agent_marketplace;
  IF v_count != 12 THEN
    RAISE EXCEPTION 'agent_marketplace has % rows, expected 12', v_count;
  END IF;
END $$;

-- Verify token uniqueness (must fail on second insert)
-- Run this to confirm UNIQUE constraint is active:
-- INSERT INTO onboarding_invites (company_id, token_hash, expires_at)
-- VALUES ('<valid_company_id>', 'test-hash-value', NOW() + INTERVAL '7 days');
-- INSERT INTO onboarding_invites (company_id, token_hash, expires_at)
-- VALUES ('<valid_company_id>', 'test-hash-value', NOW() + INTERVAL '7 days');
-- ^ Second INSERT must fail with: duplicate key value violates unique constraint
```

### TypeScript Types for New Tables
```typescript
// Add to Database['public']['Tables']:

agent_marketplace: {
  Row: {
    id: string
    agent_role: string
    display_name: string
    description: string
    monthly_price: number
    minimum_plan: 'starter' | 'pro' | 'enterprise'
    is_active: boolean
    sort_order: number
    created_at: string
  }
  Insert: {
    id?: string
    agent_role: string
    display_name: string
    description: string
    monthly_price: number
    minimum_plan?: 'starter' | 'pro' | 'enterprise'
    is_active?: boolean
    sort_order?: number
    created_at?: string
  }
  Update: {
    id?: string
    agent_role?: string
    display_name?: string
    description?: string
    monthly_price?: number
    minimum_plan?: 'starter' | 'pro' | 'enterprise'
    is_active?: boolean
    sort_order?: number
  }
  Relationships: []
}

subscriptions: {
  Row: {
    id: string
    company_id: string
    plan: 'starter' | 'pro' | 'enterprise'
    status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'
    trial_ends_at: string | null
    mollie_subscription_id: string | null
    mollie_customer_id: string | null
    current_period_start: string | null
    current_period_end: string | null
    created_at: string
    updated_at: string
  }
  Insert: {
    id?: string
    company_id: string
    plan?: 'starter' | 'pro' | 'enterprise'
    status?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'
    trial_ends_at?: string | null
    mollie_subscription_id?: string | null
    mollie_customer_id?: string | null
    current_period_start?: string | null
    current_period_end?: string | null
    created_at?: string
    updated_at?: string
  }
  Update: {
    id?: string
    company_id?: string
    plan?: 'starter' | 'pro' | 'enterprise'
    status?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'
    trial_ends_at?: string | null
    mollie_subscription_id?: string | null
    mollie_customer_id?: string | null
    current_period_start?: string | null
    current_period_end?: string | null
    updated_at?: string
  }
  Relationships: []
}

onboarding_sessions: {
  Row: {
    id: string
    company_id: string | null
    deep_link_token: string
    telegram_chat_id: number | null
    status: 'pending' | 'in_progress' | 'completed' | 'expired'
    collected_data: Json
    step: number
    created_at: string
    updated_at: string
  }
  Insert: {
    id?: string
    company_id?: string | null
    deep_link_token: string
    telegram_chat_id?: number | null
    status?: 'pending' | 'in_progress' | 'completed' | 'expired'
    collected_data?: Json
    step?: number
    created_at?: string
    updated_at?: string
  }
  Update: {
    id?: string
    company_id?: string | null
    deep_link_token?: string
    telegram_chat_id?: number | null
    status?: 'pending' | 'in_progress' | 'completed' | 'expired'
    collected_data?: Json
    step?: number
    updated_at?: string
  }
  Relationships: []
}

onboarding_invites: {
  Row: {
    id: string
    company_id: string
    token_hash: string
    expires_at: string
    used_at: string | null
    created_by: string | null
    created_at: string
  }
  Insert: {
    id?: string
    company_id: string
    token_hash: string
    expires_at: string
    used_at?: string | null
    created_by?: string | null
    created_at?: string
  }
  Update: {
    id?: string
    company_id?: string
    token_hash?: string
    expires_at?: string
    used_at?: string | null
    created_by?: string | null
  }
  Relationships: []
}

payment_webhook_events: {
  Row: {
    id: string
    mollie_event_id: string
    event_type: string | null
    payload: Json
    processed_at: string
    created_at: string
  }
  Insert: {
    id?: string
    mollie_event_id: string
    event_type?: string | null
    payload?: Json
    processed_at?: string
    created_at?: string
  }
  Update: {
    id?: string
    mollie_event_id?: string
    event_type?: string | null
    payload?: Json
    processed_at?: string
  }
  Relationships: []
}

superadmin_audit_log: {
  Row: {
    id: string
    actor_id: string
    action: string
    target_table: string
    target_id: string | null
    old_value: Json | null
    new_value: Json | null
    created_at: string
  }
  Insert: {
    id?: string
    actor_id: string
    action: string
    target_table: string
    target_id?: string | null
    old_value?: Json | null
    new_value?: Json | null
    created_at?: string
  }
  Update: {
    id?: string
    actor_id?: string
    action?: string
    target_table?: string
    target_id?: string | null
    old_value?: Json | null
    new_value?: Json | null
  }
  Relationships: []
}

// Also add trial_ends_at to companies Row/Insert/Update:
// companies.Row.trial_ends_at: string | null
// companies.Insert.trial_ends_at?: string | null
// companies.Update.trial_ends_at?: string | null

// Also add subscription_tier to agent_definitions Row/Insert/Update:
// agent_definitions.Row.subscription_tier: string | null
// agent_definitions.Insert.subscription_tier?: string | null
// agent_definitions.Update.subscription_tier?: string | null
```

---

## Migration Block Sequence (Recommended Order)

The migration file `012_v4_schema_foundation.sql` should be organized as 10 blocks:

| Block | Content | Reason for Order |
|-------|---------|-----------------|
| 1 | ALTER TABLE companies ADD COLUMN trial_ends_at | Must exist before subscriptions seeds or trial logic |
| 2 | ALTER TABLE agent_definitions ADD COLUMN subscription_tier | Independent, safe to do early |
| 3 | CREATE TABLE subscriptions | References companies(id) — companies must exist (already does) |
| 4 | CREATE TABLE agent_marketplace | No FK dependencies — global catalog |
| 5 | INSERT agent_marketplace seed data (12 rows) | After table exists |
| 6 | DO $$ verify COUNT(*) = 12 $$ | Immediate verification of seed |
| 7 | CREATE TABLE onboarding_sessions | References companies(id) optionally |
| 8 | CREATE TABLE onboarding_invites | References companies(id) required |
| 9 | CREATE TABLE payment_webhook_events | No FK dependencies |
| 10 | CREATE TABLE superadmin_audit_log | References users(id) — users must exist (already does) |

Each block includes: table CREATE, ALTER TABLE ENABLE ROW LEVEL SECURITY, CREATE POLICY statements, CREATE INDEX statements, and an updated_at trigger if applicable.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `ADD COLUMN NOT NULL` with data | `ADD COLUMN IF NOT EXISTS` + separate backfill | Non-blocking schema change |
| Inline `USING (is_superadmin())` | `USING ((SELECT is_superadmin()))` | 99.94% query speedup on large tables |
| Raw token storage for invites | SHA-256 hash stored, raw token in URL only | DB leak doesn't expose live invite links |
| Application-level duplicate check | `UNIQUE(mollie_event_id)` constraint | Race-condition-proof idempotency |

---

## Open Questions

1. **agent_marketplace monthly_price values**
   - What we know: The requirements mention "monthly_price" but don't specify exact amounts.
   - What's unclear: Exact EUR prices per agent type.
   - Recommendation: Use placeholder values (99/129/149/199 EUR based on agent complexity) in seed data. Actual pricing can be updated via UPDATE statements before v4.0 launch — the schema supports it.

2. **onboarding_sessions.company_id — nullable or required?**
   - What we know: Wizard creates company during onboarding, so company may not exist when session starts.
   - What's unclear: Does the session always exist before or after company creation?
   - Recommendation: Make nullable (`REFERENCES companies(id) ON DELETE CASCADE` without `NOT NULL`). Phase 15 will clarify the exact ordering of company creation vs. session creation.

3. **subscriptions table vs companies.plan column**
   - What we know: `companies.plan` already exists (starter/pro/enterprise) from migration 009. `subscriptions.plan` would store the same info plus billing state.
   - What's unclear: Should companies.plan be deprecated in favor of subscriptions.plan as the authoritative source?
   - Recommendation: Keep both for now. `subscriptions.plan` is the billing source of truth; `companies.plan` can be kept in sync by a trigger or application code. Phase 17 (Billing) will resolve the authoritative field question.

---

## Sources

### Primary (HIGH confidence)
- Existing migrations 009-011 — confirmed RLS patterns, table conventions, column types
- `src/types/database.types.ts` — confirmed TypeScript type structure, Row/Insert/Update conventions
- `supabase/migrations/009_multi_tenant.sql` — confirmed `(SELECT is_superadmin())` is the project standard (30+ policies)
- `supabase/migrations/010_agent_tables.sql` — confirmed JSONB, BIGINT, service-role-only patterns
- `supabase/migrations/011_phase12_domain_tables.sql` — confirmed company-scoped table pattern

### Secondary (MEDIUM confidence)
- Supabase RLS docs (fetched) — confirmed `(SELECT fn())` wrapper recommendation and performance numbers
- Supabase RLS docs (fetched) — confirmed SECURITY DEFINER function placement guidance

### Tertiary (LOW confidence — verify independently)
- Mollie API error code documentation — confirmed mollie_event_id string type (not UUID); exact field name from Mollie API should be verified before Phase 17

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all tooling already in use
- Architecture patterns: HIGH — derived directly from project's own existing migrations 009-011
- RLS patterns: HIGH — `(SELECT is_superadmin())` confirmed in 30+ existing policies
- Table designs: HIGH — derived from REQUIREMENTS.md + cross-referenced with downstream phase needs
- Seed data (agent_marketplace prices): MEDIUM — placeholder values; exact prices not in requirements
- onboarding_sessions.company_id nullability: MEDIUM — temporal ordering with Phase 15 not fully specified

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable PostgreSQL/Supabase patterns — unlikely to change)
