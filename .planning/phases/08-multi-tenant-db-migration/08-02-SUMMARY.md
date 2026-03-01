---
phase: 08-multi-tenant-db-migration
plan: "02"
subsystem: database
tags: [postgres, indexes, rls, multi-tenant, concurrently, supabase]

# Dependency graph
requires:
  - phase: 08-multi-tenant-db-migration
    plan: "01"
    provides: "009_multi_tenant.sql with BLOCKS 1-10, company_id columns on all 20 tables"
provides:
  - "BLOCK 11 in 009_multi_tenant.sql: 20 CREATE INDEX CONCURRENTLY statements"
  - "20 composite/single-column company_id indexes for RLS performance"
affects:
  - 08-03
  - 08-04
  - 08-05

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CREATE INDEX CONCURRENTLY for zero-downtime index creation (no table write-lock)"
    - "Composite (company_id, dealer_id) on dealer-scoped tables for compound predicate queries"
    - "Single-column (company_id) on direct-assign tables without dealer_id"

key-files:
  created: []
  modified:
    - supabase/migrations/009_multi_tenant.sql

key-decisions:
  - "Each CREATE INDEX CONCURRENTLY must be run as a standalone Dashboard statement — cannot batch inside a transaction block"
  - "11 dealer-scoped tables get composite (company_id, dealer_id) indexes for compound predicate efficiency"
  - "9 direct-assign tables get single-column (company_id) indexes (no dealer_id present)"
  - "users.company_id indexed for JWT hook lookup and admin RLS"

patterns-established:
  - "Index naming: idx_{table}_{scope} for single-column, idx_{table}_{scope}_{field} for compound"
  - "CONCURRENTLY indexes cannot be inside transactions — always run separately"

requirements-completed:
  - MT-08

# Metrics
duration: 5min
completed: 2026-03-01
---

# Phase 08 Plan 02: Composite Indexes (CONCURRENTLY) Summary

**20 CREATE INDEX CONCURRENTLY statements appended as BLOCK 11 to 009_multi_tenant.sql, covering all 20 tenant-scoped tables with company_id composite or single-column indexes for RLS query performance.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-01T15:13:42Z
- **Completed:** 2026-03-01T15:18:00Z
- **Tasks:** 1/2 auto-completed (Task 2 is human-action checkpoint)
- **Files modified:** 1

## Accomplishments

- Appended BLOCK 11 (20 CREATE INDEX CONCURRENTLY statements) to 009_multi_tenant.sql
- 11 composite (company_id, dealer_id) indexes for dealer-scoped tables: orders, dealer_prices, dealer_transactions, dealer_invoices, dealer_favorites, announcement_reads, support_messages, product_requests
- 9 single-column (company_id) indexes for direct-assign tables: dealers, order_items, order_status_history, dealer_groups, categories, brands, products, campaigns, campaign_products, announcements, order_documents, users
- Block header documents that each statement must be run separately (CONCURRENTLY cannot run inside a transaction)

## Task Commits

Each task was committed atomically:

1. **Task 1: Append BLOCK 11 to 009_multi_tenant.sql** - `bc90280` (chore)
2. **Task 2: Execute indexes in Supabase Dashboard** - human-action checkpoint (awaiting execution)

**Plan metadata:** (created at checkpoint — final commit pending Task 2 completion)

## Files Created/Modified

- `/home/cagr/Masaüstü/bayi-yönetimi/supabase/migrations/009_multi_tenant.sql` - BLOCK 11 appended with 20 CREATE INDEX CONCURRENTLY statements

## Decisions Made

- Each of the 20 index statements must be run individually in Supabase Dashboard SQL Editor because `CREATE INDEX CONCURRENTLY` cannot execute inside a transaction block
- Composite (company_id, dealer_id) chosen for tables with dealer_id column to support compound queries (e.g., "all orders for dealer X in company Y")
- Single-column (company_id) for tables without dealer_id (e.g., order_items, categories, brands)
- Index naming convention: `idx_{table}_company_id` or `idx_{table}_company_dealer`

## Deviations from Plan

None - plan executed exactly as written.

Note: The verify command `grep -c "CREATE INDEX CONCURRENTLY"` returns 21 instead of the expected 20 because one comment line also contains the string "CREATE INDEX CONCURRENTLY". The actual executable CREATE INDEX statements are exactly 20, matching the plan requirement.

## Issues Encountered

None.

## User Setup Required

**Task 2 is a blocking human-action checkpoint.** The user must:

1. Open Supabase Dashboard SQL Editor: https://supabase.com/dashboard/project/neqcuhejmornybmbclwt/sql/new
2. Open `supabase/migrations/009_multi_tenant.sql` and locate BLOCK 11
3. Copy and run each of the 20 CREATE INDEX CONCURRENTLY statements **one at a time** (each must be run alone — not batched)
4. Wait for "Success" before proceeding to the next statement
5. Verify all indexes exist with:

```sql
SELECT indexname, tablename
FROM pg_indexes
WHERE indexname LIKE 'idx_%_company%'
ORDER BY tablename, indexname;
```

Expected: 20 rows returned.

After confirming all 20 indexes exist, type "indexes created" to resume execution.

## Next Phase Readiness

- BLOCK 11 documented in migration file — ready for Dashboard execution
- Once indexes are created (Task 2 complete), Plan 08-02 is fully done
- Plan 08-03 (RLS policies) can begin after Task 2 is confirmed

---
*Phase: 08-multi-tenant-db-migration*
*Completed: 2026-03-01*
