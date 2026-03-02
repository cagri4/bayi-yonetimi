---
phase: 11-financial-operations-agents
plan: 03
subsystem: api
tags: [anthropic-sdk, supabase, agent, tool-use, typescript, multi-tenant]

# Dependency graph
requires:
  - phase: 11-01
    provides: muhasebeci-tools.ts with individually-exported read-only tool definitions
  - phase: 11-02
    provides: satis-tools.ts with individually-exported read-only tool definitions
provides:
  - genel-mudur-tools.ts with genelMudurTools array (10 read-only tools)
  - createGenelMudurHandlers factory merging cross-domain handlers
  - get_any_dealer_balance tool with company isolation enforcement
  - get_dashboard_summary tool using direct queries (no unscoped RPCs)
  - export_report tool with company-wide plain-text output
affects:
  - 11-04 (dispatcher wiring — registers genel_mudur_danismani in TOOL_REGISTRY)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Composite tool set via whitelist import (not inheritance/extension) — re-export individual tool definitions, cherry-pick handlers from domain factories
    - Cross-domain handler merge: call each domain factory, cherry-pick only read-only entries from returned Map
    - company_id isolation in cross-dealer balance lookup — verify dealer ownership before RPC call
    - Dashboard KPI via direct table queries (avoid RPCs that lack company_id scope)

key-files:
  created:
    - src/lib/agents/tools/genel-mudur-tools.ts
  modified:
    - src/lib/agents/tools/muhasebeci-tools.ts

key-decisions:
  - "GM handler factory cherry-picks handlers from createMuhasebeciHandlers and createSatisHandlers by key — does not inherit full handler maps (avoids leaking write tools)"
  - "get_any_dealer_balance verifies target dealer belongs to context.companyId before RPC call — tenant isolation enforced at handler level"
  - "get_dashboard_summary uses direct from('orders').select() + from('order_items').select().in('order_id', ...) — avoids get_top_products and get_dealer_performance RPCs which lack company_id scope"
  - "export_report GM implementation is company-wide (all dealers); Muhasebeci export_report is dealer-scoped — same tool name, different scope per agent"
  - "GM-04 satisfied by existing AGENT_MODELS assignment — no new code needed in this plan"

patterns-established:
  - "Composite tool pattern: individual named exports from each domain tool file + whitelist import in composite"
  - "Handler cherry-picking: instantiate domain factory, use Map.get() for each read-only handler — never spread entire handler map"

requirements-completed: [GM-01, GM-02, GM-03, GM-04, GM-05]

# Metrics
duration: 10min
completed: 2026-03-02
---

# Phase 11 Plan 03: Genel Mudur Danismani Tools Summary

**Composite 10-tool read-only agent for GM: 3 financial tools from Muhasebeci, 4 sales tools from Satis, plus 3 GM-specific tools (cross-dealer balance, company KPI dashboard, company-wide export)**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-02T08:48:10Z
- **Completed:** 2026-03-02T08:58:10Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Created `genel-mudur-tools.ts` with composite 10-tool read-only array — imports and re-exports individual tool definitions from `muhasebeci-tools.ts` and `satis-tools.ts`
- `createGenelMudurHandlers` factory instantiates both domain factories and cherry-picks 7 read-only handlers; adds 3 GM-specific handlers (total 10)
- `get_any_dealer_balance` enforces company isolation by verifying target dealer belongs to `context.companyId` before calling the `get_dealer_balance_breakdown` RPC
- `get_dashboard_summary` uses direct Supabase table queries (NOT `get_top_products` or `get_dealer_performance` RPCs which lack `company_id` scope)
- `export_report` produces company-wide plain-text KPI report (active dealers, order count, revenue, top 5 products)
- GM-04 confirmed: `AGENT_MODELS['genel_mudur_danismani'] = SONNET_MODEL` already in `types.ts` — no new code needed

## Task Commits

Each task was committed atomically:

1. **Task 1: Create genel-mudur-tools.ts with composite cross-domain tool set** - `7bc727c` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/lib/agents/tools/genel-mudur-tools.ts` - Composite GM tool set (10 read-only tools) + createGenelMudurHandlers factory
- `src/lib/agents/tools/muhasebeci-tools.ts` - Fixed pre-existing TS2352 type assertion errors (cast through `unknown`)

## Decisions Made

- GM handler factory cherry-picks handlers from `createMuhasebeciHandlers` and `createSatisHandlers` by key — does not inherit full handler maps (avoids leaking write tools like `create_order`)
- `get_any_dealer_balance` verifies target dealer belongs to `context.companyId` before RPC call — tenant isolation enforced at handler level
- `get_dashboard_summary` uses `from('orders').select()` + `from('order_items').select().in('order_id', ...)` — avoids `get_top_products` and `get_dealer_performance` RPCs (no `company_id` scope per Pitfall 2 in research)
- `export_report` in GM file is company-wide scope (all dealers in `companyId`); `export_report` in Muhasebeci is dealer-scoped — same tool name, different implementation per agent role
- GM-04 satisfied by existing `AGENT_MODELS['genel_mudur_danismani'] = SONNET_MODEL` in `types.ts` — no new code needed in this plan

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing TypeScript TS2352 type assertion errors in muhasebeci-tools.ts**
- **Found during:** Task 1 (TypeScript compilation verification)
- **Issue:** `muhasebeci-tools.ts` had `TS2352` errors on three `as TransactionRow[]` casts — Supabase inferred `SelectQueryError<"could not find the relation between dealer_transactions and transaction_types">` for the joined `transaction_type` field (missing FK in auto-generated types). TypeScript rejected the direct cast since types don't sufficiently overlap.
- **Fix:** Changed three type assertions from `as TransactionRow[]` to `as unknown as TransactionRow[]` (standard TypeScript workaround when types don't overlap but runtime shape is correct)
- **Files modified:** `src/lib/agents/tools/muhasebeci-tools.ts` (lines 252, 297, 419)
- **Verification:** `npx tsc --noEmit` exits 0 after fix
- **Committed in:** `7bc727c` (included in Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug fix)
**Impact on plan:** Type assertion fix required for TypeScript compilation to pass. Not a behavioral change — Supabase JS query returns correct data at runtime; the FK relationship just isn't reflected in auto-generated types.

## Issues Encountered

- Supabase auto-generated types don't reflect the `dealer_transactions → transaction_types` foreign key relationship, causing `SelectQueryError` in TypeScript. Resolved via `as unknown as TransactionRow[]` cast pattern (same approach as other tool files using `(supabase as any)` for RPC type gaps).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `genel-mudur-tools.ts` complete and TypeScript-verified
- Ready for Plan 11-04 (dispatcher wiring): register `genel_mudur_danismani` in `TOOL_REGISTRY` with `genelMudurTools` and `createGenelMudurHandlers`
- All three domain tool files (muhasebeci, depo-sorumlusu, genel-mudur) are ready for registration

---
*Phase: 11-financial-operations-agents*
*Completed: 2026-03-02*
