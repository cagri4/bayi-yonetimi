---
phase: 12-extended-agent-ecosystem
plan: 02
subsystem: api
tags: [agents, typescript, supabase, collections, distribution, tool-registry]

# Dependency graph
requires:
  - phase: 11-financial-ops-agents
    provides: agent tool file pattern (HandlerFn, (supabase as any), createXxxHandlers factory)
  - phase: 12-01
    provides: AgentRole type foundation — other roles already established in types.ts
provides:
  - iade_kalite role added to AgentRole union and AGENT_MODELS (Haiku 4.5)
  - Tahsilat Uzmani tools (get_overdue_payments, send_reminder, log_collection_activity)
  - Dagitim Koordinatoru tools (get_delivery_status, manage_routes, track_shipment)
affects:
  - 12-05 (TOOL_REGISTRY must add iade_kalite entry)
  - future iade_kalite agent webhook route

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "(supabase as any) pattern for new tables not yet in Database type definitions"
    - "Dealer join pattern for dealer_transactions: scope via dealers.company_id then .in('dealer_id', dealerIds)"
    - "Advisory-only tool: no DB writes, pure read + JS grouping for manage_routes"

key-files:
  created:
    - src/lib/agents/tools/tahsilat-uzmani-tools.ts
    - src/lib/agents/tools/dagitim-koordinatoru-tools.ts
  modified:
    - src/lib/agents/types.ts

key-decisions:
  - "iade_kalite added to AgentRole after satin_alma; TOOL_REGISTRY update deferred to plan 05 (expected TS2741 until then)"
  - "manage_routes is advisory-only — queries dealers then groups by address in JavaScript, no new table, no DB writes"
  - "get_overdue_payments MUST scope via dealer join (dealers.company_id) before querying dealer_transactions — that table has no company_id column"
  - "dealers table has no city column — manage_routes uses first word of address field as region key"

patterns-established:
  - "Dealer join pattern: always fetch dealer IDs from dealers WHERE company_id=X first, then .in('dealer_id', dealerIds) on dealer_transactions"
  - "Advisory tools return formatted plain text strings, not JSON"

requirements-completed: [TU-01, TU-02, TU-03, DK-01, DK-02, DK-03]

# Metrics
duration: 6min
completed: 2026-03-03
---

# Phase 12 Plan 02: Types + Tahsilat/Dagitim Tool Files Summary

**iade_kalite role typed, Tahsilat Uzmani (3 collection tools) and Dagitim Koordinatoru (3 distribution tools) created with correct dealer-join scoping and advisory-only route management**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-03T15:00:35Z
- **Completed:** 2026-03-03T15:06:58Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added `iade_kalite` to AgentRole union and AGENT_MODELS (Haiku 4.5) in types.ts
- Created tahsilat-uzmani-tools.ts with 3 tools: get_overdue_payments (dealer-join scoped), send_reminder, log_collection_activity
- Created dagitim-koordinatoru-tools.ts with 3 tools: get_delivery_status, manage_routes (advisory), track_shipment

## Task Commits

Each task was committed atomically:

1. **Task 1: Add iade_kalite to AgentRole type and AGENT_MODELS** - `b098a8b` (feat)
2. **Task 2: Create tahsilat-uzmani-tools.ts (TU-01, TU-02, TU-03)** - `b876c40` (feat)
3. **Task 3: Create dagitim-koordinatoru-tools.ts (DK-01, DK-02, DK-03)** - `2ac01d2` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `src/lib/agents/types.ts` - Added iade_kalite to AgentRole union and AGENT_MODELS
- `src/lib/agents/tools/tahsilat-uzmani-tools.ts` - Collections Specialist tools (259 lines)
- `src/lib/agents/tools/dagitim-koordinatoru-tools.ts` - Distribution Coordinator tools (258 lines)

## Decisions Made
- `iade_kalite` added to AgentRole after `satin_alma`; TOOL_REGISTRY will be updated in plan 05 (one expected TS2741 error until then — by design)
- `manage_routes` is advisory-only: no DB writes, no new tables. Groups active dealers by address in JavaScript and returns formatted route suggestion text
- `get_overdue_payments` MUST scope via dealers join because `dealer_transactions` has no `company_id` column — same constraint documented in Phase 11 decisions
- `send_reminder` and `log_collection_activity` both use `(supabase as any)` for `collection_activities` table inserts — new table not in Database type definitions yet

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed manage_routes: city column does not exist on dealers table**
- **Found during:** Task 3 (Create dagitim-koordinatoru-tools.ts)
- **Issue:** Plan described querying `city` field on dealers; dealers table only has `address` (no separate city column per database.types.ts)
- **Fix:** Removed `city` from select and DealerRow interface; updated grouping logic to use first word of `address` field as region key
- **Files modified:** src/lib/agents/tools/dagitim-koordinatoru-tools.ts
- **Verification:** `npx tsc --noEmit` shows zero errors for dagitim-koordinatoru-tools.ts
- **Committed in:** `2ac01d2` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Auto-fix necessary for compilation. manage_routes still achieves advisory grouping behavior using available address data. No scope creep.

## Issues Encountered
None beyond the auto-fixed city column bug.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- iade_kalite type is available for plan 05 TOOL_REGISTRY update
- tahsilat-uzmani-tools.ts and dagitim-koordinatoru-tools.ts are ready to be registered in TOOL_REGISTRY (plan 05)
- collection_activities table will need a SQL migration before these tools can write to it at runtime

---
*Phase: 12-extended-agent-ecosystem*
*Completed: 2026-03-03*
