---
phase: 10-first-agent-group-trainer-sales
plan: "02"
subsystem: api
tags: [anthropic-sdk, supabase, agents, telegram, orders, catalog, campaigns]

requires:
  - phase: 10-first-agent-group-trainer-sales
    provides: "Egitimci tools pattern (Tool type, createXHandlers factory, HandlerFn type)"
  - phase: 09-agent-infrastructure-foundation
    provides: "AgentContext interface, AgentRole types, service-role Supabase client pattern"

provides:
  - "satisTools: Tool[] — 6 tool definitions for Satis Temsilcisi"
  - "createSatisHandlers factory — Map<string, HandlerFn> with full implementations"
  - "create_order with stock validation, dealer pricing, RPC order number, rollback"
  - "get_catalog with dealer-specific pricing (custom price or group discount)"
  - "get_order_status, get_campaigns, check_stock, get_dealer_profile read-only handlers"

affects:
  - "Phase 10 agent wiring (dispatcher, AgentRunner integration)"
  - "Phase 11+ any agent that needs to cross-call Satis Temsilcisi"

tech-stack:
  added: []
  patterns:
    - "HandlerFn = (input, context) => Promise<string> — all handlers return strings"
    - "createXHandlers(supabase) pattern — factory receives service-role client, closes over it"
    - "Every multi-tenant query includes .eq('company_id', context.companyId)"
    - "(supabase as any).from(...).insert() — type assertion for strict Insert types"
    - "Rollback pattern: delete order if order_items insert fails"

key-files:
  created:
    - src/lib/agents/tools/satis-tools.ts
  modified: []

key-decisions:
  - "create_order validates stock inline before any DB writes — prevents partial order states"
  - "generate_order_number RPC used with ORD-${Date.now()} fallback — consistent with createOrder server action"
  - "order_status_history inserted without changed_by (null) — agent has no user UUID, companyId context used instead"
  - "(supabase as any) type assertion on orders/order_items/order_status_history inserts — matches existing server action pattern"
  - "Dealer group min_order_amount defaults to 0 if no group — always passes minimum check"
  - "Campaigns table queried with .lte('start_date', now).gte('end_date', now) — mirrors getActiveCampaigns action exactly"

patterns-established:
  - "Satis Temsilcisi handlers return Turkish error messages in [bracket] format"
  - "Stock check loop runs before any DB write — Rule: validate before mutate"
  - "Price calculation: customPrice ?? base_price * (1 - discountPercent/100), rounded to 2 decimals"

requirements-completed: [SR-01, SR-02, SR-03, SR-04, SR-05, SR-06]

duration: 3min
completed: 2026-03-01
---

# Phase 10 Plan 02: Satis Temsilcisi Tools Summary

**Satis Temsilcisi (Sales Rep) agent with 6 tools: transactional create_order with stock validation + rollback, and 5 read-only handlers for catalog, orders, campaigns, stock, and dealer profile — all company_id scoped.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-01T19:28:58Z
- **Completed:** 2026-03-01T19:31:37Z
- **Tasks:** 2 (Tasks 1+2 implemented in single file pass)
- **Files modified:** 1

## Accomplishments

- Created `src/lib/agents/tools/satis-tools.ts` (598 lines) with all 6 tool definitions and handler implementations
- `create_order` handler: validates items array, resolves products by code, checks stock inline before any DB write, applies dealer-specific pricing, enforces minimum order amount, generates order number via `supabase.rpc('generate_order_number')`, inserts to orders + order_items + order_status_history, and rolls back the order if order_items insert fails
- `get_catalog` resolves category name to ID via subquery, applies dealer pricing (custom_price override or group discount), returns structured product data with `low_stock` boolean
- All 5 read-only handlers (get_catalog, get_order_status, get_campaigns, check_stock, get_dealer_profile) scoped by both `company_id` and `dealer_id` on every query

## Task Commits

1. **Tasks 1+2: Satis Temsilcisi tool definitions + all 6 handlers** - `8d37371` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified

- `src/lib/agents/tools/satis-tools.ts` — Tool definitions (satisTools array of 6) + createSatisHandlers factory with all 6 handler implementations

## Decisions Made

- `create_order` validates stock inline before any DB writes — prevents partial order states where order exists but stock was insufficient
- `order_status_history` inserted without `changed_by` (null) — agent has no user UUID; notes field carries "Siparis Telegram uzerinden olusturuldu" for audit trail
- `(supabase as any)` type assertion on orders/order_items/order_status_history inserts — matches existing `createOrder` server action pattern; Database types have strict Insert types that conflict with optional company_id
- Campaigns query uses `.lte('start_date', now).gte('end_date', now)` — exact mirror of `getActiveCampaigns` action
- Dealer group min_order_amount defaults to 0 if dealer has no group — always passes minimum check (safe fallback)

## Deviations from Plan

None — plan executed exactly as written. Tasks 1 and 2 were implemented in a single file write pass (both are part of the same file `satis-tools.ts`), which is semantically correct: the factory function and handlers are one cohesive unit.

## Issues Encountered

None — TypeScript compiled cleanly on first attempt. The `(supabase as any)` type assertion pattern was already specified in the plan (per existing `createOrder` server action precedent) so no type errors occurred.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `satis-tools.ts` exports `satisTools` (Tool[]) and `createSatisHandlers(supabase)` — ready to wire into AgentRunner/dispatcher
- Pattern mirrors Plan 01 (egitimci-tools) — Phase 10 Plans 03+ can use same factory pattern for remaining agents
- create_order is fully transactional with rollback — safe to expose to dealers via Telegram

---
*Phase: 10-first-agent-group-trainer-sales*
*Completed: 2026-03-01*
