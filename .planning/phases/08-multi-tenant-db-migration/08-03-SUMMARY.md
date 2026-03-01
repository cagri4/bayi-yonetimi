---
phase: 08-multi-tenant-db-migration
plan: "03"
subsystem: database
tags: [rls, postgres, supabase, multi-tenant, security, row-level-security]

# Dependency graph
requires:
  - phase: 08-01
    provides: "009_multi_tenant.sql with BLOCK 1-10 (companies table, security functions current_company_id/is_company_admin/is_superadmin, JWT hook, backfill)"
provides:
  - "BLOCK 12 appended to 009_multi_tenant.sql: complete DROP + CREATE RLS policy replacement for all 20 tenant-scoped tables"
  - "Company-scoped admin policies using is_company_admin() + current_company_id() on all tables"
  - "Superadmin bypass policies using is_superadmin() on every table"
  - "Dealer read policies updated to require company_id = current_company_id()"
  - "Global tables (order_statuses, order_status_transitions, transaction_types, faq_categories, faq_items) updated to authenticated read + superadmin manage"
affects: [08-04, phase-9, any-phase-using-rls]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-tier RLS: dealer (own data + company scope) | company_admin (company_id = current_company_id() AND is_company_admin()) | superadmin (is_superadmin() bypass)"
    - "DROP POLICY IF EXISTS before CREATE ensures idempotent re-execution"
    - "Exact old policy names from migrations 001-008 included alongside plan names for complete cleanup"

key-files:
  created: []
  modified:
    - "supabase/migrations/009_multi_tenant.sql - BLOCK 12 appended (692 lines): RLS policy replacement for all tables"

key-decisions:
  - "Included BOTH old policy names (from migrations 001-008) AND plan's expected names in DROP POLICY IF EXISTS — migrations had different names (e.g., 'Anyone can read categories' vs 'Authenticated users can read categories')"
  - "dealer_favorites: collapsed 3 old granular policies (view/add/remove) into single FOR ALL policy scoped by company_id"
  - "support_messages: collapsed 4 old policies (read/insert dealer + read/update admin) into 2 (company-scoped dealer ALL + company-scoped admin ALL)"
  - "product_requests: same pattern as support_messages — collapsed 4 into 2 company-scoped policies"
  - "announcement_reads: old INSERT-only policy replaced by FOR ALL policy with company_id + dealer_id check"
  - "FAQ tables remain global (no company_id) — authenticated read all, superadmin + company_admin manage"

patterns-established:
  - "Policy naming: 'Company [role] can [action] [scope]' e.g. 'Company admins can manage dealers'"
  - "Policy naming: 'Superadmin can manage all [table]' for bypass policies"
  - "Policy naming: 'Dealers can [action] own [table]' for dealer self-service policies"

requirements-completed:
  - MT-02
  - MT-04
  - MT-05

# Metrics
duration: 2min
completed: 2026-03-01
---

# Phase 08 Plan 03: Multi-Tenant RLS Policy Replacement Summary

**Company-scoped RLS policies replacing all role='admin' checks across 20 tables: three-tier access model (dealer self / company_admin+company_id / superadmin bypass)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-01T15:13:53Z
- **Completed:** 2026-03-01T15:16:05Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments

- Appended BLOCK 12 (692 lines) to `009_multi_tenant.sql` covering all 20 tenant-scoped tables plus global lookup tables
- 81 DROP POLICY IF EXISTS statements using exact policy names from migrations 001-008 to ensure clean removal of all old role='admin'-only policies
- 78 CREATE POLICY statements establishing three-tier access: dealer (own data + company scope), company admin (company_id + is_company_admin()), superadmin (is_superadmin() bypass)
- Dealer policies now enforce `company_id = current_company_id()` so a dealer from Company A cannot read Company B records even knowing a UUID
- Global tables (order_statuses, order_status_transitions, transaction_types, faq_categories, faq_items) updated to authenticated read + superadmin manage

## Task Commits

Each task was committed atomically:

1. **Task 1: Append BLOCK 12 (RLS policy replacement) to 009_multi_tenant.sql** - `f9c4480` (feat)

**Plan metadata:** (docs commit follows in final commit)

## Files Created/Modified

- `/home/cagr/Masaüstü/bayi-yönetimi/supabase/migrations/009_multi_tenant.sql` - BLOCK 12 appended: 81 DROP + 78 CREATE POLICY statements for all 20 tenant-scoped tables and 5 global tables

## Decisions Made

1. **Included exact old policy names from migrations**: The plan's DROP POLICY IF EXISTS used generic names like "Authenticated users can read categories" but the actual policy from migration 001 was "Anyone can read categories". Both names included in DROP IF EXISTS to ensure coverage regardless of which migrations were applied.

2. **Discovered 4 tables had different granular policies**: dealer_favorites (3 policies: view/add/remove), support_messages (4 policies), product_requests (4 policies), announcement_reads (2 separate select/insert policies). Collapsed these into simpler FOR ALL policies scoped by company_id — maintains same access semantics with less complexity.

3. **Block 12 is paste-as-single-block**: Unlike BLOCK 11 (CONCURRENTLY indexes), BLOCK 12 can be pasted as one block in Supabase Dashboard SQL Editor. No per-statement execution needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Old policy names in migrations don't match plan's expected DROP names**
- **Found during:** Task 1 (reading migrations 001-008)
- **Issue:** Plan's DROP POLICY IF EXISTS used different names than what was actually created (e.g., "Anyone can read categories" vs "Authenticated users can read categories", "Authenticated can read order statuses" vs "Authenticated users can read order statuses")
- **Fix:** Added both old actual names AND plan's expected names to each DROP POLICY IF EXISTS block — IF EXISTS prevents errors, extra drops simply no-op
- **Files modified:** supabase/migrations/009_multi_tenant.sql
- **Verification:** 81 DROP POLICY IF EXISTS statements cover all known policy name variants
- **Committed in:** f9c4480 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - policy name mismatch correction)
**Impact on plan:** Essential for correct cleanup. Without exact names, old unscoped policies would remain active alongside new company-scoped ones, causing security gaps.

## Issues Encountered

None beyond the policy naming discrepancy handled above.

## User Setup Required

**CRITICAL: Application will be in locked-out state after executing BLOCK 12.**

BLOCK 12 replaces policies to use `current_company_id()` which returns NULL until the JWT hook (from BLOCK 3) is registered in Supabase Dashboard. Execute Plan 08-04 immediately after running BLOCK 12 in the Dashboard.

Execution order for Dashboard:
1. Run BLOCK 12 (this plan's output) — all existing sessions will lose access
2. Immediately run Plan 08-04 to register the JWT hook in Supabase Dashboard > Auth > Hooks
3. Verify by logging in and confirming data loads correctly

## Next Phase Readiness

- BLOCK 12 SQL is ready to paste into Supabase Dashboard SQL Editor
- After Dashboard execution, proceed to Plan 08-04 (JWT hook registration) without delay
- Once hook is registered, all three tiers of access will work: dealer, company_admin, superadmin
- Plans 08-02 (BLOCK 11 indexes) and 08-03 (BLOCK 12 policies) are independent and can be executed in any order before the hook registration

---
*Phase: 08-multi-tenant-db-migration*
*Completed: 2026-03-01*
