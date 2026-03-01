---
phase: 10-first-agent-group-trainer-sales
plan: "01"
subsystem: api
tags: [anthropic-sdk, supabase, agents, tools, typescript]

# Dependency graph
requires:
  - phase: 09-agent-infrastructure-foundation
    provides: AgentContext type, HandlerFn pattern, ToolRegistry, Tool type from @anthropic-ai/sdk

provides:
  - egitimciTools array (2 read-only Tool definitions: get_product_info, get_faq)
  - createEgitimciHandlers factory returning Map<string, HandlerFn>
  - TR-04 read-only enforcement at tool level for Egitimci agent

affects:
  - 10-02 (satis_temsilcisi tools — mirrors HandlerFn factory pattern)
  - tool-registry.ts (Phase 10 will wire egitimciTools into TOOL_REGISTRY)
  - dispatcher (Phase 10 will replace placeholder handlers with createEgitimciHandlers)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HandlerFn type: (input: Record<string, unknown>, context: AgentContext) => Promise<string>"
    - "Handler factory pattern: createXxxHandlers(supabase) returns Map<string, HandlerFn>"
    - "SQL injection prevention: safeQuery = query.replace(/[%_]/g, '') before ilike"
    - "Type-safe join extraction: cast dealer_group as { discount_percent: number } | null"
    - "context.companyId for tenant isolation on company-scoped tables"
    - "No company_id filter on faq_items (global table — verified from database.types.ts)"

key-files:
  created:
    - src/lib/agents/tools/egitimci-tools.ts
  modified: []

key-decisions:
  - "TR-04 enforced at file level: ONLY SELECT-based tools; no INSERT/UPDATE/DELETE code paths exist"
  - "safeQuery sanitization strips % and _ from user input before ilike to prevent wildcard injection"
  - "dealer_group join typed as { discount_percent: number } | null via explicit cast (SupabaseClient returns Json for nested joins)"
  - "void context in handleGetFaq to suppress unused variable warning while preserving parameter for future audit logging"
  - "createEgitimciHandlers uses closure over supabase client — handlers do not receive supabase directly (matches Phase 9 dispatcher pattern)"

patterns-established:
  - "Tool file structure: tool constants → egitimciTools export → handler functions → createHandlers factory"
  - "HandlerFn factory pattern: Phase 10+ tool files follow this exact shape"

requirements-completed: [TR-01, TR-02, TR-03, TR-04]

# Metrics
duration: 3min
completed: 2026-03-01
---

# Phase 10 Plan 01: Egitimci Tools Summary

**Read-only Egitimci agent tools with company-scoped product search and global FAQ lookup using dealer-specific pricing (custom price or group discount)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-01T19:28:52Z
- **Completed:** 2026-03-01T19:31:17Z
- **Tasks:** 2 (executed together — same file)
- **Files modified:** 1

## Accomplishments
- Created `egitimci-tools.ts` with 2 read-only tool definitions (`get_product_info`, `get_faq`)
- Implemented `get_product_info` handler with company_id tenant isolation, dealer custom price lookup, and group discount fallback
- Implemented `get_faq` handler querying global `faq_items` table (no company_id column)
- TR-04 read-only enforcement: zero INSERT/UPDATE/DELETE operations in the file
- SQL injection prevention via `safeQuery.replace(/[%_]/g, '')` on all ilike queries
- All tool descriptions and error messages in Turkish (TR-03)

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Egitimci tool definitions + both handlers** - `e8f9331` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/lib/agents/tools/egitimci-tools.ts` — Egitimci tool definitions (`getProductInfoTool`, `getFaqTool`), `egitimciTools` export, `createEgitimciHandlers` factory, `handleGetProductInfo` and `handleGetFaq` implementations (221 lines)

## Decisions Made
- TR-04 enforced at file level — only SELECT-based tools exist; no code paths for mutations
- `safeQuery` sanitization prevents wildcard abuse in ilike queries
- `dealer_group` join result cast explicitly to `{ discount_percent: number } | null` because Supabase's TypeScript builder returns `Json` for nested join results
- `void context` in `handleGetFaq` preserves parameter for future audit logging while suppressing TS unused variable warning
- `createEgitimciHandlers` closes over `supabase` client — handlers do not receive `supabase` directly, matching Phase 9 dispatcher's closure pattern

## Deviations from Plan

None - plan executed exactly as written. Tasks 1 and 2 were combined in one commit as noted in the plan (both handlers belong to the same factory function).

## Issues Encountered

None. TypeScript compiled cleanly on first attempt. All 7 verification criteria passed:
1. `npx tsc --noEmit` — zero errors
2. `egitimciTools` contains exactly 2 tools: `get_product_info` and `get_faq`
3. `createEgitimciHandlers` returns Map with exactly 2 entries matching tool names
4. No INSERT, UPDATE, or DELETE operations (TR-04)
5. `get_product_info` uses `.eq('company_id', context.companyId)` for tenant isolation
6. `get_faq` does NOT use company_id (faq_items is global — confirmed from database.types.ts)
7. All descriptions and error messages in Turkish

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `egitimciTools` and `createEgitimciHandlers` ready to wire into `TOOL_REGISTRY` in `tool-registry.ts`
- `egitimciTools` can replace `placeholderTools` for the `egitimci` role in Phase 10-02+
- Handler factory pattern is the established template for `satis_temsilcisi` tools (10-02)

---
*Phase: 10-first-agent-group-trainer-sales*
*Completed: 2026-03-01*
