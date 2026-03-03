---
phase: 12-extended-agent-ecosystem
plan: "03"
subsystem: api
tags: [agents, tools, supabase, typescript, field-sales, marketing, dealer-visits, campaigns]

# Dependency graph
requires:
  - phase: 10-first-agents
    provides: HandlerFn type alias and createXxxHandlers factory pattern
  - phase: 11-financial-ops-agents
    provides: (supabase as any) INSERT pattern for tables not in Database types

provides:
  - saha-satis-tools.ts with plan_visit (SS-01) and log_visit (SS-02) tools
  - pazarlamaci-tools.ts with analyze_campaigns (PZ-01), segment_dealers (PZ-02), suggest_campaign (PZ-03) tools
  - sahaSatisTools Tool[] export and createSahaSatisHandlers factory
  - pazarlamaciTools Tool[] export and createPazarlamaciHandlers factory

affects:
  - 12-06 (wire tools + dispatcher for Saha Satis and Pazarlamaci agents)
  - 12-07 (TOOL_REGISTRY entries for saha_satis_sorumlusu and pazarlamaci roles)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "(supabase as any) INSERT pattern for dealer_visits table (not in DB types)"
    - "Advisory-only handler pattern: suggest_campaign makes no DB reads or writes"
    - "as unknown as CampaignRow[] for Supabase SelectQueryError on unregistered column selects"
    - "JS-side dealer segmentation: group orders by dealer_id, compute totals, bucket into yuksek/orta/dusuk/aktif degil"

key-files:
  created:
    - src/lib/agents/tools/saha-satis-tools.ts
    - src/lib/agents/tools/pazarlamaci-tools.ts
  modified: []

key-decisions:
  - "suggest_campaign (PZ-03) is advisory-only — NO DB reads or writes; returns formatted Turkish string based on inputs only"
  - "(supabase as any) on dealer_visits INSERT — table not in auto-generated Database types, same pattern as orders/order_items in Phase 10"
  - "log_visit sets planned_date = actual_date — visit already happened, planned_date column required by table schema"
  - "as unknown as CampaignRow[] cast for analyze_campaigns — campaigns.name column not in Supabase TS types, same TS2352 pattern from Phase 11"
  - "segment_dealers uses client-side grouping — Supabase JS client does not support column-to-column WHERE or GROUP BY, consistent with Phase 11 check_reorder_level pattern"
  - "Inactive dealers: query all dealers then subtract those with orders — two-step approach avoids LEFT JOIN complexity in JS client"

patterns-established:
  - "Advisory tool pattern: handlers with no DB interaction return formatted strings based purely on inputs — useful for LLM guidance without DB cost"
  - "Segmentation pattern: fetch flat order rows, group by key in JS Map, apply threshold buckets — scalable to any dimension"

requirements-completed: [SS-01, SS-02, PZ-01, PZ-02, PZ-03]

# Metrics
duration: 7min
completed: 2026-03-03
---

# Phase 12 Plan 03: Saha Satis and Pazarlamaci Agent Tools Summary

**Field sales visit tracking (plan_visit + log_visit) and marketing analytics (analyze_campaigns + segment_dealers + suggest_campaign) tools for two independent Wave 1 agents**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-03T15:00:43Z
- **Completed:** 2026-03-03T15:07:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created saha-satis-tools.ts with plan_visit (SS-01) and log_visit (SS-02) tools, both writing to dealer_visits via (supabase as any) pattern
- Created pazarlamaci-tools.ts with analyze_campaigns (PZ-01), segment_dealers (PZ-02), and advisory-only suggest_campaign (PZ-03) tools
- Both files compile with zero TypeScript errors; pre-existing errors in unrelated Phase 12 plan files are out of scope

## Task Commits

Each task was committed atomically:

1. **Task 1: Create saha-satis-tools.ts** - `0884fde` (feat)
2. **Task 2: Create pazarlamaci-tools.ts** - `3eed380` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/lib/agents/tools/saha-satis-tools.ts` - Field sales tools: plan_visit and log_visit for dealer_visits table
- `src/lib/agents/tools/pazarlamaci-tools.ts` - Marketing tools: campaign analysis, dealer segmentation, advisory campaign suggestions

## Decisions Made
- suggest_campaign (PZ-03) is advisory-only with NO DB reads or writes — handler signature accepts supabase but does not use it, returns formatted Turkish string based on inputs only
- (supabase as any) on dealer_visits INSERT — table not in auto-generated Database types, same pattern as orders/order_items from Phase 10
- log_visit sets planned_date = actual_date — visit already happened, planned_date column is required by table schema
- as unknown as CampaignRow[] cast for analyze_campaigns — campaigns.name not surfaced in Supabase TS types, consistent with Phase 11 muhasebeci-tools TS2352 fix pattern
- segment_dealers uses client-side grouping in JavaScript Map — Supabase JS client does not support GROUP BY, consistent with Phase 11 check_reorder_level pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed CampaignRow cast in analyze_campaigns**
- **Found during:** Task 2 (pazarlamaci-tools.ts TypeScript verification)
- **Issue:** `campaigns as CampaignRow[]` produced TS2352 SelectQueryError because campaigns.name is not in Supabase's generated DB types for the campaigns table
- **Fix:** Changed to `campaigns as unknown as CampaignRow[]` — consistent with muhasebeci-tools.ts TransactionRow cast pattern from Phase 11
- **Files modified:** src/lib/agents/tools/pazarlamaci-tools.ts
- **Verification:** npx tsc --noEmit shows zero errors for pazarlamaci-tools.ts
- **Committed in:** 3eed380 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type cast bug)
**Impact on plan:** Single-line fix required for TypeScript correctness. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in dagitim-koordinatoru-tools.ts and tool-registry.ts from incomplete Phase 12 plans (12-04, 12-06) — out of scope per deviation rules boundary

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- saha-satis-tools.ts and pazarlamaci-tools.ts are ready for wiring in Phase 12 Plan 06 (dispatcher + webhook routes)
- TOOL_REGISTRY entries for saha_satis_sorumlusu and pazarlamaci roles will be added in Plan 07

---
*Phase: 12-extended-agent-ecosystem*
*Completed: 2026-03-03*
