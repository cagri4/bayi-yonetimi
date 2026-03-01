---
phase: 08-multi-tenant-db-migration
plan: "01"
subsystem: database
tags: [postgresql, supabase, rls, jwt, multi-tenant, migration, company-id]

# Dependency graph
requires:
  - phase: 07-support-reports
    provides: support_messages, product_requests tables (need company_id backfill)
  - phase: 06-dashboard-campaigns-docs
    provides: campaigns, announcements, order_documents, dealer_spending_summary (need company_id + rebuild)
  - phase: 05-financial-backbone
    provides: dealer_transactions, dealer_invoices tables (need company_id backfill)
provides:
  - companies table as root tenant anchor (id/name/slug/plan/is_active/settings)
  - current_company_id() SECURITY DEFINER function reading auth.jwt() ->> 'company_id'
  - is_company_admin() function (role=admin AND company_id NOT NULL)
  - is_superadmin() function (role=superadmin)
  - inject_company_claim() JWT hook function with supabase_auth_admin grants
  - users.role constraint updated to allow 'superadmin'
  - users.company_id column (nullable UUID FK to companies)
  - All 19 tenant-scoped tables with company_id NOT NULL after backfill
  - dealer_spending_summary rebuilt with company_id column and unique index
  - get_dealer_spending_summary() RPC wrapper filtering by current_company_id()
  - supabase/migrations/009_multi_tenant.sql with 10 labeled Dashboard execution blocks
affects:
  - 08-02 (composite indexes — depends on company_id columns existing)
  - 08-03 (RLS policy replacement — depends on current_company_id() + is_company_admin())
  - 08-04 (TypeScript types — needs companies table + company_id on all tables)
  - 08-05 (hook registration — depends on inject_company_claim() function)
  - Phase 9 (Agent Infrastructure — depends on full multi-tenant isolation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "3-step backfill: ADD COLUMN nullable -> UPDATE -> DO $$ RAISE EXCEPTION verify -> SET NOT NULL"
    - "current_company_id() SECURITY DEFINER reads auth.jwt() ->> 'company_id' (O(1) vs table join)"
    - "inject_company_claim() resolves: users.company_id first (admins), dealers.company_id fallback"
    - "Materialized view isolation: RPC wrapper with current_company_id() filter (RLS not supported on matviews)"
    - "Block-labeled SQL file: copy-paste sections in Supabase Dashboard SQL Editor"

key-files:
  created:
    - supabase/migrations/009_multi_tenant.sql
  modified: []

key-decisions:
  - "categories and brands made company-scoped (not global) — full catalog isolation per tenant, seedable on new company onboarding"
  - "users.company_id added directly for admin users (dealers join resolves company but admins may lack dealers record)"
  - "inject_company_claim resolves users.company_id first, falls back to dealers.company_id — covers both admin and dealer paths"
  - "dealer_spending_summary dropped and rebuilt (not added-to) because PostgreSQL matview RLS is unsupported — RPC wrapper is the only safe API path"
  - "REVOKE EXECUTE on inject_company_claim FROM anon, authenticated, public — only supabase_auth_admin may call it"
  - "UNIQUE INDEX on (company_id, dealer_id, month DESC NULLS LAST) — required for REFRESH CONCURRENTLY"
  - "Seed company slug='default' used as stable lookup key for direct-assign table backfill"

patterns-established:
  - "All 19 tenant-scoped tables: ADD COLUMN company_id REFERENCES companies(id) ON DELETE RESTRICT"
  - "users.company_id: ON DELETE SET NULL (users can exist without a company)"
  - "Verification DO block per table: RAISE EXCEPTION before SET NOT NULL"
  - "Block dependency order: dealers -> orders -> order_items/order_status_history -> other dealer_id tables -> direct-assign tables -> matview"

requirements-completed:
  - MT-01
  - MT-03
  - MT-05
  - MT-06
  - MT-07

# Metrics
duration: 8min
completed: 2026-03-01
---

# Phase 8 Plan 01: Multi-Tenant Foundation Summary

**SQL migration 009_multi_tenant.sql with 10 Dashboard execution blocks: companies table, JWT security functions, inject_company_claim hook, users superadmin extension, seed company, and 3-step backfill of all 19 tenant-scoped tables with dealer_spending_summary rebuild**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-01T15:08:16Z
- **Completed:** 2026-03-01T15:16:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Created complete 434-line migration file structured as 10 copy-paste Dashboard blocks
- Foundation functions (current_company_id, is_company_admin, is_superadmin) and JWT hook (inject_company_claim) with correct grants
- All 19 tenant-scoped tables covered with DO $$ RAISE EXCEPTION verification guards (zero-downtime 3-step pattern)
- dealer_spending_summary dropped and rebuilt with company_id, wrapped in get_dealer_spending_summary() RPC

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: Create 009_multi_tenant.sql (all 10 blocks)** - `da0dc7d` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `supabase/migrations/009_multi_tenant.sql` — Complete multi-tenant foundation migration, 434 lines, 10 execution blocks for Supabase Dashboard SQL Editor

## Decisions Made

- categories and brands made company-scoped (not global) — full catalog isolation per tenant; global content can be seeded to default company and cloned during new tenant onboarding
- users.company_id added directly on users table for admin users who may not have a dealers record (inject_company_claim checks users.company_id first, falls back to dealers lookup)
- dealer_spending_summary dropped and fully rebuilt rather than altered — PostgreSQL does not support RLS on materialized views; RPC wrapper get_dealer_spending_summary() with current_company_id() filter is the only safe API exposure path
- REVOKE EXECUTE on inject_company_claim FROM anon, authenticated, public — security hardening so only supabase_auth_admin can invoke the hook function
- Seed company created with slug='default' used as a stable subquery key for direct-assign table backfill (avoiding UUID variable passing between Dashboard blocks)
- UNIQUE INDEX on (company_id, dealer_id, month DESC NULLS LAST) on rebuilt matview — required for REFRESH MATERIALIZED VIEW CONCURRENTLY

## Deviations from Plan

None - plan executed exactly as written. Both tasks were implemented in a single file creation pass covering all 10 blocks simultaneously, which matches the plan's intent (same file, sequential blocks).

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration after executing the migration.**

### Step 1: Execute 009_multi_tenant.sql in Supabase Dashboard

1. Open Supabase Dashboard > SQL Editor
2. Execute blocks 1-10 in order, one block at a time
3. Verify each block succeeds before proceeding to the next
4. After Block 6, verify: `SELECT COUNT(*) FROM dealers WHERE company_id IS NULL` — should return 0

### Step 2: Register Custom Access Token Hook

After Block 3 is executed:
1. Navigate to Supabase Dashboard > Authentication > Hooks
2. Select "Custom Access Token Hook"
3. Select function type: "Postgres function"
4. Select function: `public.inject_company_claim`
5. Save

**Note:** The hook must be registered BEFORE deploying company-scoped RLS policies (Plan 08-03). If the hook is not registered, current_company_id() returns NULL and all company-scoped queries will be denied.

### Step 3: Verify Seed Company Assignment

After all 10 blocks execute:
```sql
SELECT id, name, slug FROM companies WHERE slug = 'default';
SELECT COUNT(*) FROM dealers WHERE company_id IS NULL; -- must be 0
SELECT COUNT(*) FROM orders WHERE company_id IS NULL;  -- must be 0
```

## Next Phase Readiness

- 009_multi_tenant.sql ready for execution in Supabase Dashboard SQL Editor
- After execution: companies table, security functions, users extensions, and all 19 table backfills complete
- Plan 08-02 (composite indexes) can proceed after block execution — indexes use CONCURRENTLY so must run outside transactions as separate Dashboard statements
- Plan 08-03 (RLS replacement) depends on current_company_id() and is_company_admin() existing (Blocks 2+3)
- Plan 08-05 (hook registration) is a manual Dashboard step — no additional SQL needed beyond Block 3

---
*Phase: 08-multi-tenant-db-migration*
*Completed: 2026-03-01*

## Self-Check: PASSED

- FOUND: supabase/migrations/009_multi_tenant.sql (434 lines, 10 blocks, 19 RAISE EXCEPTION guards)
- FOUND: .planning/phases/08-multi-tenant-db-migration/08-01-SUMMARY.md
- FOUND commit: da0dc7d feat(08-01): create 009_multi_tenant.sql
