---
phase: 12-extended-agent-ecosystem
plan: 01
subsystem: database
tags: [postgres, supabase, rls, migration, sql]

# Dependency graph
requires:
  - phase: 11-financial-ops-agents
    provides: Phase 11 agent infrastructure and tool patterns
  - phase: 10-first-agents
    provides: Dealer, order, product tables referenced by FKs
provides:
  - 7 new domain tables for Phase 12 agent tools
  - collection_activities — Tahsilat Uzmani data store
  - dealer_visits — Saha Satis Sorumlusu data store
  - sales_targets — Saha Satis Sorumlusu performance tracking
  - suppliers — Satin Alma agent vendor registry
  - purchase_orders — Satin Alma order management
  - return_requests — Iade agent data store
  - quality_complaints — Kalite agent data store
affects:
  - 12-02 (types.ts must reference new table shapes)
  - 12-03 (saha-satis-tools and pazarlamaci-tools write to dealer_visits)
  - 12-04 (iade-kalite-tools write to return_requests and quality_complaints)
  - 12-05 (satin-alma-tools write to suppliers and purchase_orders)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase 12 domain tables follow 010_agent_tables.sql pattern: UUID PK, company_id NOT NULL FK, RLS enabled, compound index on (company_id, created_at DESC)"
    - "FK dependency order: suppliers before purchase_orders; orders referenced by return_requests with ON DELETE SET NULL"

key-files:
  created:
    - supabase/migrations/011_phase12_domain_tables.sql
  modified: []

key-decisions:
  - "All 7 tables use company_id NOT NULL REFERENCES companies(id) ON DELETE CASCADE for full tenant isolation"
  - "purchase_orders.supplier_id uses ON DELETE SET NULL — supplier deletion should not destroy order history"
  - "return_requests.order_id uses ON DELETE SET NULL (nullable) — returns can exist without a linked order"
  - "RLS enabled on all 7 tables; company-scoped RLS policies added in subsequent plans"
  - "SQL executed via Supabase Dashboard SQL Editor (neqcuhejmornybmbclwt) — no CLI access"

patterns-established:
  - "New domain table pattern: create table → enable RLS → create compound index on (company_id, created_at DESC)"
  - "JSONB columns for array data (items on purchase_orders/return_requests) — avoids separate line-item tables"

requirements-completed: [TU-04, SS-03, SA-03, IK-03]

# Metrics
duration: 10min
completed: 2026-03-04
---

# Phase 12 Plan 01: Domain Tables Migration Summary

**7 company-scoped domain tables created in Supabase via SQL migration — collection_activities, dealer_visits, sales_targets, suppliers, purchase_orders, return_requests, quality_complaints — all with RLS enabled and compound indexes**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-04T09:30:00Z
- **Completed:** 2026-03-04T09:44:22Z
- **Tasks:** 2 (1 auto, 1 checkpoint:human-verify)
- **Files modified:** 1

## Accomplishments

- Created SQL migration file `011_phase12_domain_tables.sql` with all 7 domain tables in correct FK dependency order
- User executed SQL in Supabase Dashboard SQL Editor and confirmed all 7 tables exist
- RLS enabled and compound (company_id, created_at DESC) indexes created on all 7 tables
- FK constraints established: dealers(id) referenced by 5 tables, suppliers(id) by purchase_orders, orders(id) by return_requests

## Task Commits

Each task was committed atomically:

1. **Task 1: Create 011_phase12_domain_tables.sql migration file** - `8fa6817` (feat)
2. **Task 2: Checkpoint — Run migration in Supabase Dashboard** - human action (no code commit; user confirmed "tables created")

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `supabase/migrations/011_phase12_domain_tables.sql` — DDL for all 7 Phase 12 domain tables with RLS and indexes

## Decisions Made

- All 7 tables follow the 010_agent_tables.sql pattern: UUID PK with gen_random_uuid(), company_id NOT NULL FK with ON DELETE CASCADE, created_at TIMESTAMPTZ DEFAULT NOW()
- purchase_orders.supplier_id and return_requests.order_id use ON DELETE SET NULL — deleting a supplier or order should not cascade-delete business records
- JSONB used for items arrays on purchase_orders and return_requests — avoids separate line-item join tables for agent tool simplicity
- SQL executed via Dashboard (no CLI access to neqcuhejmornybmbclwt project)

## Deviations from Plan

None — plan executed exactly as written. SQL file created per spec, user ran it in Dashboard, all 7 tables confirmed present.

## Issues Encountered

None. SQL executed cleanly; user confirmed all 7 tables exist with "tables created".

## User Setup Required

The SQL migration was run manually by the user in Supabase Dashboard SQL Editor. No further setup required — tables are live and ready for Phase 12 tool handlers.

## Next Phase Readiness

- All 7 domain tables exist in `neqcuhejmornybmbclwt` with RLS enabled
- Plans 12-02 through 12-05 can write to these tables via (supabase as any) pattern
- collection_activities ready for tahsilat-uzmani-tools.ts
- dealer_visits and sales_targets ready for saha-satis-tools.ts
- suppliers and purchase_orders ready for satin-alma-tools.ts
- return_requests and quality_complaints ready for iade-kalite-tools.ts

---
*Phase: 12-extended-agent-ecosystem*
*Completed: 2026-03-04*
