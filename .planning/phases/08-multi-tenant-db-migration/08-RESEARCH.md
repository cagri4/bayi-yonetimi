# Phase 8: Multi-Tenant Database Migration - Research

**Researched:** 2026-03-01
**Domain:** PostgreSQL multi-tenancy via shared-schema with company_id + Supabase RLS + Custom Access Token Hook
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MT-01 | Sistem birden fazla firmayi tek deployment uzerinden bagimsiz olarak destekler (company_id izolasyonu) | companies table + company_id FK on all 20+ tables + RLS policies |
| MT-02 | Her firma kendi bayilerini, urunlerini ve siparislerini yalnizca kendisi gorebilir (RLS ile izolasyon) | current_company_id() SECURITY DEFINER + updated RLS policies on all dealer-scoped tables |
| MT-03 | Mevcut 20+ tabloya company_id eklenir ve tum veriler backfill edilir (zero downtime) | 3-step nullable -> backfill -> NOT NULL pattern; CONCURRENTLY index creation |
| MT-04 | Admin kullanicisi yalnizca kendi firmasinin verilerini yonetebilir (is_company_admin) | is_company_admin() SECURITY DEFINER replaces is_admin() in admin RLS policies |
| MT-05 | Platform operatoru (superadmin) tum firmalari gorebilir ve yonetebilir | users.role = 'superadmin' + bypass-company RLS policies + /superadmin route group |
| MT-06 | JWT claim injection ile tenant izolasyonu saglanan current_company_id() fonksiyonu calisir | Supabase Custom Access Token Hook injects company_id; current_company_id() reads auth.jwt() ->> 'company_id' |
| MT-07 | Materialized view (dealer_spending_summary) company_id ile yeniden olusturulur ve RPC ile sarmalanir | DROP + recreate with company_id column; wrapper RPC function with current_company_id() filter |
| MT-08 | Composite index'ler (company_id, dealer_id) tum tenant-scoped tablolara eklenir | CREATE INDEX CONCURRENTLY on (company_id, dealer_id) for every dealer-scoped table |
</phase_requirements>

---

## Summary

Phase 8 converts an existing single-tenant B2B dealer management system into a multi-tenant platform where multiple companies can share one database and one deployment without any data leakage. The system currently has 8 applied migrations and 20+ tables, all of which use dealer-level RLS but have no company concept whatsoever.

The core technical work is: (1) create a `companies` table as the root tenant anchor, (2) add `company_id` to every dealer-scoped table using a 3-step nullable/backfill/constrain pattern to achieve zero downtime, (3) replace the existing admin check pattern with `current_company_id()` SECURITY DEFINER + Supabase Custom Access Token Hook for JWT injection, and (4) rebuild the `dealer_spending_summary` materialized view — which PostgreSQL cannot protect with RLS — behind a wrapper RPC function.

The most dangerous failure modes are: running a NOT NULL migration without backfill (causes immediate failure on live data), leaving the materialized view directly accessible via API (cross-company data leak), and failing to update admin RLS policies to include company scoping (privilege escalation where Company A admin reads Company B data). All three are addressed by the research patterns below.

**Primary recommendation:** Migrate as a single atomic SQL file (migration 009) that follows the exact 3-step backfill pattern for every table, seeds a default company for all existing data, rebuilds the materialized view, and establishes the JWT hook before deploying any company-scoped RLS changes.

---

## Complete Table Inventory (20+ tables requiring company_id)

Derived from reading all 8 migration files (001-008). These are every table in the database that must receive `company_id`:

### Tables with dealer_id — company_id backfilled via dealers.company_id
| Table | Migration | Backfill Path |
|-------|-----------|---------------|
| `dealers` | 001 | Direct (anchor table — gets company_id first) |
| `dealer_prices` | 001 | `dealer_prices.dealer_id -> dealers.company_id` |
| `orders` | 001 | `orders.dealer_id -> dealers.company_id` |
| `order_items` | 001 | `order_items.order_id -> orders.company_id` |
| `order_status_history` | 001 | `order_status_history.order_id -> orders.company_id` |
| `dealer_favorites` | 005 | `dealer_favorites.dealer_id -> dealers.company_id` |
| `dealer_transactions` | 006 | `dealer_transactions.dealer_id -> dealers.company_id` |
| `dealer_invoices` | 006 | `dealer_invoices.dealer_id -> dealers.company_id` |
| `announcement_reads` | 007 | `announcement_reads.dealer_id -> dealers.company_id` |
| `support_messages` | 008 | `support_messages.dealer_id -> dealers.company_id` |
| `product_requests` | 008 | `product_requests.dealer_id -> dealers.company_id` |

### Tables with company ownership but no dealer_id — backfill to seed company
| Table | Migration | Backfill Strategy |
|-------|-----------|-------------------|
| `dealer_groups` | 001 | Assign to seed company (single company system historically) |
| `categories` | 001 | Assign to seed company (or keep as global — see Open Questions) |
| `brands` | 001 | Assign to seed company (or keep as global — see Open Questions) |
| `products` | 001 | Assign to seed company |
| `campaigns` | 007 | Assign to seed company |
| `campaign_products` | 007 | Via `campaign_products.campaign_id -> campaigns.company_id` |
| `announcements` | 007 | Assign to seed company |
| `order_documents` | 007 | `order_documents.order_id -> orders.company_id` |

### Tables that are GLOBAL (no company_id needed)
| Table | Reason |
|-------|--------|
| `order_statuses` | Platform-level lookup — same for all companies |
| `order_status_transitions` | Platform-level state machine — same for all companies |
| `transaction_types` | Platform-level lookup — same for all companies |
| `faq_categories` | Global content managed by superadmin |
| `faq_items` | Global content managed by superadmin |

**Note on categories/brands:** These could be global (platform-owned) OR company-scoped (each company has own catalog). Decision has downstream implications for product scoping. Research recommends company-scoped for true multi-tenancy isolation (Company A's product catalog hidden from Company B).

---

## Standard Stack

### Core (no new packages required for this phase)
| Component | Version | Purpose | Why |
|-----------|---------|---------|-----|
| Supabase PostgreSQL | ~PG 15 (managed) | Database with RLS | Already in use — migrations extend existing schema |
| `@supabase/ssr` | ^0.8.0 | Supabase server client | Already in use — no change |
| `@supabase/supabase-js` | ^2.91.1 | Supabase anon/admin client | Already in use |
| Next.js Server Actions | 16.1.4 | Application data layer | Admin UI built on Server Actions — no change |
| Supabase Dashboard SQL Editor | (web UI) | Manual migration execution | Key constraint: no CLI access token |

**Installation:** No new packages. This phase is pure SQL + TypeScript types.

---

## Architecture Patterns

### Pattern 1: companies Table as Root Tenant Anchor

The `companies` table is the root of the multi-tenant hierarchy. Every other table points to it via FK.

```sql
-- Source: ARCHITECTURE.md research + Supabase multi-tenant guide
CREATE TABLE companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,       -- used for admin routing: /admin/{slug}
  plan        TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
  is_active   BOOLEAN DEFAULT true,
  settings    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: only superadmin sees all companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin can manage all companies"
  ON companies FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'superadmin')
  );

CREATE POLICY "Company admins can read own company"
  ON companies FOR SELECT
  TO authenticated
  USING (id = current_company_id());
```

### Pattern 2: current_company_id() SECURITY DEFINER (JWT-based)

This function is the anchor for ALL company-scoped RLS policies. It reads the `company_id` claim injected by the Custom Access Token Hook.

```sql
-- Source: ARCHITECTURE.md research + official Supabase JWT claim docs
CREATE OR REPLACE FUNCTION current_company_id()
RETURNS UUID AS $$
  SELECT NULLIF(auth.jwt() ->> 'company_id', '')::UUID
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION current_company_id() TO authenticated;
```

**Why SECURITY DEFINER:** The function reads `auth.jwt()` which is safe and does not query any table, so the SECURITY DEFINER context is benign and prevents accidental override by application code.

**Why not a table lookup in RLS:** A per-query table lookup (e.g., `SELECT company_id FROM company_members WHERE user_id = auth.uid()`) would execute on every row evaluation — catastrophic at scale. JWT claim reading is O(1).

### Pattern 3: Supabase Custom Access Token Hook for JWT Injection

The hook must be registered in the Supabase Dashboard at Authentication > Hooks. It fires before every JWT is issued (on login and token refresh).

```sql
-- Source: Official Supabase Custom Access Token Hook docs
-- https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook

CREATE OR REPLACE FUNCTION public.inject_company_claim(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id UUID;
  v_user_role TEXT;
  v_claims JSONB;
BEGIN
  -- Get the user's role and company_id from our users + dealers tables
  SELECT u.role INTO v_user_role
  FROM users u
  WHERE u.id = (event->>'user_id')::UUID;

  -- For dealer/admin users: find their company through dealers table
  SELECT d.company_id INTO v_company_id
  FROM dealers d
  JOIN users u ON d.user_id = u.id
  WHERE u.id = (event->>'user_id')::UUID
  LIMIT 1;

  -- Build claims from event
  v_claims := event->'claims';

  -- Inject company_id claim (NULL for superadmin — bypasses company scoping)
  IF v_company_id IS NOT NULL THEN
    v_claims := jsonb_set(v_claims, '{company_id}', to_jsonb(v_company_id::TEXT));
  END IF;

  -- Inject role claim for superadmin detection
  IF v_user_role IS NOT NULL THEN
    v_claims := jsonb_set(v_claims, '{user_role}', to_jsonb(v_user_role));
  END IF;

  RETURN jsonb_set(event, '{claims}', v_claims);
END;
$$;

-- Required grants for hook to work
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.inject_company_claim(JSONB) TO supabase_auth_admin;

-- Revoke from other roles (security)
REVOKE EXECUTE ON FUNCTION public.inject_company_claim(JSONB) FROM anon, authenticated, public;
```

**Registration (manual Dashboard step):**
1. Navigate to Supabase Dashboard > Authentication > Hooks
2. Select "Custom Access Token Hook"
3. Select function type: "Postgres function"
4. Select function: `public.inject_company_claim`
5. Save

**Critical caveat:** JWT is stale until refreshed. Token TTL is 1 hour (Supabase default). If a user's company changes, they must re-login for the new company_id to appear in their JWT.

### Pattern 4: 3-Step Zero-Downtime Backfill

This is the mandatory pattern for every table. Deviating causes either a live migration failure (NOT NULL on existing rows) or silent data integrity bugs.

```sql
-- Source: PITFALLS.md research + Citus multi-tenant migration guide
-- Applied identically for each of the ~18 tenant-scoped tables

-- STEP 1: Add nullable column (non-breaking, no table rewrite on PG 15+)
ALTER TABLE [table_name]
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;

-- STEP 2: Backfill from related table (all rows get assigned)
UPDATE [table_name] t
SET company_id = d.company_id
FROM dealers d
WHERE t.dealer_id = d.id;
-- For tables without dealer_id, assign to seed company UUID directly:
-- UPDATE [table_name] SET company_id = '[seed_company_uuid]';

-- STEP 3: Verify zero NULLs before constraining (RAISES EXCEPTION if any remain)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM [table_name] WHERE company_id IS NULL) THEN
    RAISE EXCEPTION 'Backfill incomplete: [table_name] has NULL company_id rows';
  END IF;
END $$;

-- STEP 4: Add NOT NULL constraint + composite index (in same transaction)
ALTER TABLE [table_name] ALTER COLUMN company_id SET NOT NULL;
-- Index created CONCURRENTLY outside transaction to avoid lock
```

```sql
-- Index created AFTER the NOT NULL constraint (outside transaction for CONCURRENTLY)
-- Source: Postgres CONCURRENTLY docs — cannot run inside transaction block
CREATE INDEX CONCURRENTLY idx_[table_name]_company_dealer
  ON [table_name](company_id, dealer_id);
```

**Important:** `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block. In Supabase Dashboard SQL Editor, run the NOT NULL constraint in one statement and each `CREATE INDEX CONCURRENTLY` as a separate statement.

### Pattern 5: RLS Policy Replacement Pattern

Every existing admin RLS policy that uses `EXISTS (SELECT 1 FROM users WHERE ... AND role = 'admin')` must be replaced with a company-scoped version.

**Before (existing pattern in all 8 migrations):**
```sql
CREATE POLICY "Admins can manage dealers"
  ON dealers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );
```

**After (company-scoped admin):**
```sql
-- Company admin can only manage their own company's dealers
CREATE POLICY "Company admins can manage own company dealers"
  ON dealers FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- Superadmin can manage all dealers across all companies
CREATE POLICY "Superadmin can manage all dealers"
  ON dealers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'superadmin'
    )
  );
```

### Pattern 6: Materialized View Rebuild (MT-07)

PostgreSQL does not support RLS on materialized views. The existing `dealer_spending_summary` in migration 007 must be dropped and rebuilt with `company_id`, then wrapped in an RPC function.

```sql
-- Source: PITFALLS.md research + Supabase Discussion #17790

-- Step 1: Drop existing materialized view and its index
DROP INDEX IF EXISTS idx_dealer_spending_dealer_month;
DROP MATERIALIZED VIEW IF EXISTS dealer_spending_summary;

-- Step 2: Rebuild with company_id in SELECT and GROUP BY
CREATE MATERIALIZED VIEW dealer_spending_summary AS
SELECT
  d.company_id,                                              -- NEW: tenant column
  d.id as dealer_id,
  d.company_name,
  DATE_TRUNC('month', dt.transaction_date)::date as month,
  COALESCE(SUM(dt.amount) FILTER (WHERE tt.balance_effect = 'debit'), 0) as total_debit,
  COALESCE(SUM(dt.amount) FILTER (WHERE tt.balance_effect = 'credit'), 0) as total_credit,
  COALESCE(SUM(
    CASE
      WHEN tt.balance_effect = 'debit' THEN dt.amount
      ELSE -dt.amount
    END
  ), 0) as net_balance
FROM dealers d
LEFT JOIN dealer_transactions dt ON dt.dealer_id = d.id
LEFT JOIN transaction_types tt ON tt.id = dt.transaction_type_id
GROUP BY d.company_id, d.id, d.company_name, DATE_TRUNC('month', dt.transaction_date);

-- Step 3: Rebuild unique index (required for REFRESH CONCURRENTLY)
CREATE UNIQUE INDEX idx_dealer_spending_company_dealer_month
  ON dealer_spending_summary(company_id, dealer_id, month DESC);

-- Step 4: Wrapper RPC function that enforces company isolation
-- This is the ONLY safe way to expose the materialized view to the API
CREATE OR REPLACE FUNCTION get_dealer_spending_summary(p_dealer_id UUID)
RETURNS TABLE (
  dealer_id UUID,
  company_name TEXT,
  month DATE,
  total_debit DECIMAL,
  total_credit DECIMAL,
  net_balance DECIMAL
) AS $$
  SELECT
    dealer_id,
    company_name,
    month,
    total_debit,
    total_credit,
    net_balance
  FROM dealer_spending_summary
  WHERE dealer_id = p_dealer_id
    AND company_id = current_company_id()   -- enforces company isolation
$$ LANGUAGE sql STABLE SECURITY INVOKER;   -- INVOKER: runs as caller, respects their JWT

GRANT EXECUTE ON FUNCTION get_dealer_spending_summary(UUID) TO authenticated;
```

**Never expose the materialized view directly to the Supabase API.** The view must NOT appear as a table in Supabase Table Editor with anon/authenticated access.

### Pattern 7: users.role Extension for Superadmin

The existing `users` table has `role TEXT NOT NULL CHECK (role IN ('admin', 'dealer'))`. This constraint must be updated to include `'superadmin'`.

```sql
-- Source: Analysis of 001_initial_schema.sql CHECK constraint

-- Update the CHECK constraint to include superadmin
ALTER TABLE users
  DROP CONSTRAINT users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'dealer', 'superadmin'));

-- Update TypeScript Database types accordingly (see Code Examples)
```

### Pattern 8: Seed Company for All Existing Data

All existing rows belong to an implicit single company. Migration must create a seed company and assign all existing rows to it before adding NOT NULL constraints.

```sql
-- Create the seed company (represents the original single tenant)
INSERT INTO companies (id, name, slug, plan, is_active)
VALUES (
  gen_random_uuid(),
  'Default Company',     -- Admin updates this in UI after migration
  'default',
  'pro',
  true
) RETURNING id;

-- IMPORTANT: The migration must capture this UUID and use it for all backfill operations
-- Pattern: Use a variable within the migration script
DO $$
DECLARE
  v_seed_company_id UUID;
BEGIN
  SELECT id INTO v_seed_company_id FROM companies WHERE slug = 'default';

  -- Backfill all non-dealer tables directly
  UPDATE dealer_groups SET company_id = v_seed_company_id WHERE company_id IS NULL;
  UPDATE categories    SET company_id = v_seed_company_id WHERE company_id IS NULL;
  UPDATE brands        SET company_id = v_seed_company_id WHERE company_id IS NULL;
  UPDATE products      SET company_id = v_seed_company_id WHERE company_id IS NULL;
  UPDATE campaigns     SET company_id = v_seed_company_id WHERE company_id IS NULL;
  UPDATE announcements SET company_id = v_seed_company_id WHERE company_id IS NULL;
  -- dealers table is backfilled separately (anchor table) before other tables
END $$;
```

### Recommended Project Structure

No new directories needed. This phase is exclusively SQL migrations and TypeScript type updates:

```
supabase/
└── migrations/
    └── 009_multi_tenant.sql      # Single migration file for entire phase

src/
└── types/
    └── database.types.ts         # Updated to include companies table + company_id fields
```

Optional (if superadmin UI is implemented):
```
src/
└── app/
    └── (superadmin)/
        └── superadmin/
            └── companies/        # Company management UI for platform operator
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT claim reading in RLS | Custom session table | `auth.jwt() ->> 'company_id'` via Custom Access Token Hook | O(1) vs O(N) per-row table join |
| Admin role checking | Application-level role check in every action | `is_company_admin()` SECURITY DEFINER + RLS policy | RLS enforces at DB level; app-level checks can be bypassed |
| Tenant isolation function | Query `company_members` table per request | `current_company_id()` SECURITY DEFINER reading JWT | Single function, cached per statement, no table lookup |
| Materialized view RLS | Trying to add RLS to the materialized view | Wrapper RPC function with `current_company_id()` filter | PostgreSQL does not support RLS on materialized views (PG 15) |
| Zero-downtime migration | `ALTER TABLE ... ADD COLUMN company_id UUID NOT NULL` in one shot | 3-step nullable/backfill/constrain pattern | One-shot NOT NULL fails immediately on rows with existing data |
| Index on live table | `CREATE INDEX` (locks table) | `CREATE INDEX CONCURRENTLY` | Standard CREATE INDEX takes a write lock; CONCURRENTLY does not |

**Key insight:** Multi-tenant isolation is a database concern, not an application concern. The application should never be responsible for filtering by company — every query is automatically scoped by RLS reading the JWT claim.

---

## Common Pitfalls

### Pitfall 1: NOT NULL Migration Without Backfill
**What goes wrong:** Running `ALTER TABLE dealers ADD COLUMN company_id UUID NOT NULL` fails immediately on a table with existing rows because NULL constraint fails for all existing rows.

**How to avoid:** Always use the 3-step pattern: ADD NULLABLE → BACKFILL → VERIFY ZERO NULLS → SET NOT NULL. See Pattern 4 above.

**Warning signs:** Migration script has `ADD COLUMN company_id UUID NOT NULL` without a preceding UPDATE statement.

### Pitfall 2: Materialized View Cross-Company Data Leak
**What goes wrong:** After adding `company_id` to `dealers` and `dealer_transactions`, the `dealer_spending_summary` materialized view still returns ALL companies' data because PostgreSQL RLS does not apply to materialized views (as of PG 15, which Supabase uses).

**How to avoid:** Drop and rebuild the materialized view before writing any company-scoped RLS policies. Wrap it in an RPC function (`get_dealer_spending_summary`) that calls `current_company_id()`. Never expose the view directly to the Supabase API.

**Warning signs:** `SELECT * FROM dealer_spending_summary` returns rows from multiple company_ids.

### Pitfall 3: Admin Policies Become Cross-Company Privilege Escalation
**What goes wrong:** After adding `company_id`, the existing admin RLS policy `EXISTS (SELECT 1 FROM users WHERE ... AND role = 'admin')` matches ANY admin user in the database — including Company B's admin querying Company A's data.

**How to avoid:** Every admin policy must also check `company_id = current_company_id()`. Introduce `role = 'superadmin'` for the platform operator as a separate role with its own policies that bypass company scoping.

**Warning signs:** Admin user from Company A can SELECT rows from Company B via Supabase API.

### Pitfall 4: Hook Not Registered Before Deploying Company-Scoped RLS
**What goes wrong:** `current_company_id()` returns NULL (because `auth.jwt() ->> 'company_id'` is NULL) causing every company-scoped RLS policy to deny all queries. All authenticated users are locked out.

**How to avoid:** Register the Custom Access Token Hook in Supabase Dashboard BEFORE deploying company-scoped RLS policies. Test by logging in as a dealer and verifying the JWT contains `company_id` claim.

**Verification:** `SELECT auth.jwt()` in Supabase SQL Editor shows the claims object — confirm `company_id` is present.

### Pitfall 5: CREATE INDEX CONCURRENTLY Inside Transaction Block
**What goes wrong:** `CREATE INDEX CONCURRENTLY` errors with "ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block" when the Supabase Dashboard SQL Editor wraps statements in a transaction.

**How to avoid:** Run `CREATE INDEX CONCURRENTLY` as standalone statements, not within a `DO $$` block or explicit `BEGIN/COMMIT`. In Supabase SQL Editor, paste each `CREATE INDEX CONCURRENTLY` separately.

**Warning signs:** Error message "cannot run inside a transaction block" in migration output.

### Pitfall 6: JWT Stale Company_id After Role/Company Change
**What goes wrong:** A user is moved from Company A to Company B, but their JWT still contains Company A's `company_id` until token expiry (up to 1 hour). They continue to see Company A's data.

**How to avoid:** Keep Supabase token TTL at 1 hour (default). For critical company changes, invalidate the user's session server-side using the Supabase admin API: `supabase.auth.admin.signOut(userId)`.

**Warning signs:** User reports seeing stale company data after admin moves their account.

### Pitfall 7: Missing company_id on order_items (Cascading Problem)
**What goes wrong:** The `order_items` table has no `dealer_id` — it only has `order_id`. Backfill via `order_items.order_id -> orders.company_id` is correct but must happen AFTER `orders` is already backfilled. Running order_items backfill before orders backfill assigns NULL company_id.

**How to avoid:** Follow the strict dependency order for backfill:
1. `dealers` (anchor — backfill to seed company)
2. `orders` (via `orders.dealer_id -> dealers.company_id`)
3. `order_items` (via `order_items.order_id -> orders.company_id`)
4. `order_status_history` (via `order_status_history.order_id -> orders.company_id`)
5. All other tables with direct `dealer_id`

### Pitfall 8: dealer_spending_summary REFRESH CONCURRENTLY Requires Unique Index
**What goes wrong:** After rebuilding the materialized view, calling `REFRESH MATERIALIZED VIEW CONCURRENTLY dealer_spending_summary` fails with "ERROR: cannot refresh materialized view concurrently without at least one unique index" if the unique index was not recreated.

**How to avoid:** Always recreate the unique index on `(company_id, dealer_id, month DESC)` immediately after creating the materialized view (before any REFRESH call). See Pattern 6.

---

## Code Examples

### current_company_id() — The Core RLS Anchor Function
```sql
-- Source: ARCHITECTURE.md research + official Supabase JWT docs
-- This single function is used in EVERY company-scoped RLS policy
CREATE OR REPLACE FUNCTION current_company_id()
RETURNS UUID AS $$
  SELECT NULLIF(auth.jwt() ->> 'company_id', '')::UUID
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION current_company_id() TO authenticated;
```

### is_company_admin() — Company-Scoped Admin Check
```sql
-- Source: PITFALLS.md research pattern
-- Replaces raw role check in all admin RLS policies
CREATE OR REPLACE FUNCTION is_company_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
  ) AND current_company_id() IS NOT NULL
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_company_admin() TO authenticated;
```

### is_superadmin() — Platform Operator Check
```sql
-- Source: PITFALLS.md research pattern
-- Used in policies that bypass company scoping
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = (SELECT auth.uid())
      AND role = 'superadmin'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_superadmin() TO authenticated;
```

### Dealer-Scoped RLS Policy Template
```sql
-- Source: Analysis of existing RLS patterns + company_id extension
-- Template used for all 11 dealer-scoped tables

-- Dealer reads own data (same as before, plus company_id guard)
CREATE POLICY "Dealers can read own [table]"
  ON [table_name] FOR SELECT
  TO authenticated
  USING (
    dealer_id IN (
      SELECT id FROM dealers
      WHERE user_id = (SELECT auth.uid())
        AND company_id = current_company_id()   -- company guard
    )
  );

-- Company admin reads all data within their company
CREATE POLICY "Company admins can manage [table]"
  ON [table_name] FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (SELECT is_company_admin())
  );

-- Superadmin reads across all companies
CREATE POLICY "Superadmin can access all [table]"
  ON [table_name] FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));
```

### TypeScript Type Update Pattern
```typescript
// src/types/database.types.ts — add to relevant table Row/Insert/Update types
// Example for dealers table:
dealers: {
  Row: {
    id: string
    user_id: string | null
    company_name: string
    email: string
    phone: string | null
    address: string | null
    dealer_group_id: string | null
    company_id: string          // NEW: required after migration
    is_active: boolean
    created_at: string
    updated_at: string
  }
  Insert: {
    // ... same fields
    company_id: string          // NEW: required on insert
  }
  Update: {
    // ... same fields
    company_id?: string         // NEW: optional on update
  }
}

// NEW: companies table type
companies: {
  Row: {
    id: string
    name: string
    slug: string
    plan: 'starter' | 'pro' | 'enterprise'
    is_active: boolean
    settings: Json
    created_at: string
    updated_at: string
  }
  Insert: {
    id?: string
    name: string
    slug: string
    plan?: 'starter' | 'pro' | 'enterprise'
    is_active?: boolean
    settings?: Json
    created_at?: string
    updated_at?: string
  }
  Update: {
    id?: string
    name?: string
    slug?: string
    plan?: 'starter' | 'pro' | 'enterprise'
    is_active?: boolean
    settings?: Json
    updated_at?: string
  }
  Relationships: []
}

// UPDATED: users table role to include superadmin
users: {
  Row: {
    id: string
    email: string
    role: 'admin' | 'dealer' | 'superadmin'  // UPDATED: added superadmin
    // ...
  }
}
```

### Server Action Pattern for Company-Aware Admin
```typescript
// src/lib/actions/admin-orders.ts — example of how admin actions work post-migration
// No changes needed in application code — RLS handles company scoping at DB level
// This is the power of the JWT injection approach: app code stays identical

export async function getAdminOrders() {
  const supabase = await createClient()
  // This query automatically returns only the admin's company's orders
  // because RLS policy checks company_id = current_company_id() which reads JWT
  const { data, error } = await supabase
    .from('orders')
    .select('*, dealers(*), order_statuses(*)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}
```

### Migration Execution Order for Supabase Dashboard
```
-- Paste each block separately in Supabase Dashboard SQL Editor

-- Block 1: companies table + core functions
-- Block 2: users.role constraint update (add 'superadmin')
-- Block 3: dealers table — add nullable + backfill + NOT NULL
-- Block 4: orders table — add nullable + backfill + NOT NULL
-- Block 5: order_items — add nullable + backfill + NOT NULL
-- Block 6: All remaining dealer_id tables (dealer_prices, dealer_transactions, etc.)
-- Block 7: All direct-assign tables (categories, brands, products, etc.)
-- Block 8: Drop + rebuild dealer_spending_summary + wrapper RPC
-- Block 9: Drop all existing admin RLS policies + create company-scoped replacements
-- Block 10: Register Custom Access Token Hook in Supabase Dashboard (manual UI step)
-- Block 11: Run CONCURRENTLY indexes as separate statements (not in transaction)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Schema-per-tenant (separate DB schema per company) | Shared schema with company_id column + RLS | PostgreSQL 9.5+ (RLS introduced) | Dramatically simpler to operate and migrate; recommended for <1000 tenants |
| Application-level tenant filtering (WHERE company_id = $1 in every query) | Database-level RLS with JWT claim | Supabase production pattern (2021+) | Eliminates entire class of data leakage bugs from missing WHERE clauses |
| Synchronous `company_id` lookup in every RLS policy | JWT claim injection via Custom Access Token Hook | Supabase Custom Access Token Hook GA (2023) | O(1) claim read vs O(N) table lookup per row evaluation |
| Separate admin tables per tenant | Single `companies` table + superadmin role in `users` | Multi-tenant SaaS standard | Simpler user management, unified auth |

**Deprecated/outdated for this project:**
- `role = 'admin'` check without company scoping: replaced by `is_company_admin()` + `company_id = current_company_id()`
- Direct `dealer_spending_summary` table access via API: replaced by `get_dealer_spending_summary()` RPC

---

## Migration Execution Constraint (Critical for Planning)

**The Supabase Dashboard SQL Editor is the only execution path.** There is no CLI access token. This has direct implications for planning:

1. Each PLAN task that involves SQL must specify the exact SQL to paste into the Dashboard
2. `CREATE INDEX CONCURRENTLY` statements must be listed as separate Dashboard executions (cannot be inside a transaction block or DO $$ block)
3. The Custom Access Token Hook registration is a manual UI step (navigate to Auth > Hooks) — it cannot be scripted via SQL
4. Verification queries (SELECT COUNT(*) WHERE company_id IS NULL) must be run manually after each block

The planner should structure tasks so each sub-step that requires Dashboard execution is clearly delimited with the exact SQL content.

---

## Open Questions

1. **Should categories/brands be company-scoped or global?**
   - What we know: Currently categories and brands have no company ownership. In single-tenant, this was fine.
   - What's unclear: If Company A and Company B both sell different product lines, they'd need separate categories. If they sell the same products, global categories make sense.
   - Recommendation: Make them company-scoped (add `company_id`). This gives full isolation and allows companies to customize their catalog taxonomy. Global categories can be seeded to the default company and cloned for new companies at onboarding. This is safer than leaving a cross-company table.

2. **Should users.company_id be added directly, or resolved via dealers table?**
   - What we know: The current JWT hook design reads `company_id` from the `dealers` table (a user is a dealer who belongs to a company). Admin users also have dealer records (or would need one).
   - What's unclear: Admin users might not have a `dealers` record today. The hook lookup `JOIN dealers d ON d.user_id = u.id` would return NULL for admins without dealer records.
   - Recommendation: Add `company_id` directly to the `users` table as well. Populate it for admin users when they are assigned to a company. The hook then reads from `users.company_id` directly — simpler and covers admins without dealer records.

3. **How does the first admin user get assigned to the seed company?**
   - What we know: The migration creates a seed company. Existing admin users need to be assigned to it.
   - Recommendation: The migration script includes an UPDATE that assigns all existing admins to the seed company: `UPDATE users SET company_id = v_seed_company_id WHERE role = 'admin'`.

4. **What happens to the superadmin's JWT company_id?**
   - What we know: Superadmin should bypass company scoping and see all companies.
   - Recommendation: The hook sets `company_id = NULL` in the JWT for superadmin users. The `is_superadmin()` check takes precedence in RLS policies. `current_company_id()` returns NULL for superadmins, which is safe because superadmin policies don't check `current_company_id()`.

---

## Sources

### Primary (HIGH confidence)
- Migration files 001-008 read directly — tables, RLS policies, exact column names
- `PITFALLS.md` project research — backfill pattern, materialized view leak, admin RLS scope
- `ARCHITECTURE.md` project research — companies table design, current_company_id() function
- `STACK.md` project research — Supabase Custom Access Token Hook confirmed
- [Supabase Custom Access Token Hook docs](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) — function signature, grant requirements, Dashboard registration steps
- [Supabase RLS Guide](https://supabase.com/docs/guides/database/postgres/row-level-security) — SECURITY DEFINER patterns, JWT claim reading, performance best practices

### Secondary (MEDIUM confidence)
- [Supabase database advisors — 0016_materialized_view_in_api](https://supabase.com/docs/guides/database/database-advisors) — confirms materialized views have no RLS protection
- [Supabase Discussion #17790](https://github.com/orgs/supabase/discussions/17790) — confirms RLS not supported on materialized views in PG 15

### Tertiary (LOW confidence)
- Community patterns for hook registration UI steps (verified against official docs structure but UI may vary)

---

## Metadata

**Confidence breakdown:**
- Table inventory (which tables need company_id): HIGH — read directly from all 8 migration files
- 3-step backfill pattern: HIGH — verified in PITFALLS.md + Citus migration guide
- current_company_id() via JWT: HIGH — verified in official Supabase JWT docs
- Custom Access Token Hook registration: HIGH — verified in official Supabase Hook docs
- Materialized view rebuild pattern: HIGH — verified in PITFALLS.md + Supabase discussion
- Superadmin role design: MEDIUM — pattern is standard but exact role naming is a project decision
- categories/brands scoping decision: LOW — open question with recommendation, not definitive

**Research date:** 2026-03-01
**Valid until:** 2026-06-01 (Supabase APIs are stable; hook API unlikely to change)
