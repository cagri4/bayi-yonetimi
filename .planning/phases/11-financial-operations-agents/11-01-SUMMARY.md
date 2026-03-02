---
phase: 11-financial-operations-agents
plan: "01"
subsystem: agent-tools
tags: [muhasebeci, financial-agent, tool-definitions, handler-factory, read-only]
dependency_graph:
  requires: []
  provides:
    - src/lib/agents/tools/muhasebeci-tools.ts
  affects:
    - src/lib/agents/tools/index.ts (Plan 04 will register)
    - genel-mudur-tools.ts (Plan 03 will import individual tool exports)
tech_stack:
  added: []
  patterns:
    - HandlerFn factory pattern (createMuhasebeciHandlers closes over supabase)
    - Post-query JS filtering for payment_history (payment/credit_note type codes)
    - Plain-text multi-line report format for Telegram compatibility
    - (supabase as any).rpc() for RPC calls not typed in generated Database types
key_files:
  created:
    - src/lib/agents/tools/muhasebeci-tools.ts
  modified: []
decisions:
  - "dealer_transactions has NO company_id column — all queries scope by dealer_id only (per Pitfall 1 in research)"
  - "get_payment_history filters payment/credit_note via JS post-query (not SQL IN clause) to avoid join-filter complexity"
  - "export_report returns lines.join('\\n') plain text — NOT CSV/JSON — Telegram text-only constraint"
  - "(supabase as any).rpc() type assertion required — get_dealer_balance_breakdown not in generated Database RPC types"
  - "void input in handleGetDealerBalance — no input needed, context provides dealerId; TS unused var suppressed"
  - "MH-06 hallucination prevention via tool description text — no code logic enforcement; system prompt remains authoritative"
metrics:
  duration_minutes: 3
  completed_date: "2026-03-02"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 11 Plan 01: Muhasebeci Tools Summary

**One-liner:** 5 read-only financial tools (dealer_transactions + dealer_invoices + get_dealer_balance_breakdown RPC) with createMuhasebeciHandlers factory for the Muhasebeci (Accountant) agent.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Create muhasebeci-tools.ts with 5 financial tools and handler factory | 29541bb | Complete |

## What Was Built

`src/lib/agents/tools/muhasebeci-tools.ts` — 494 lines implementing:

**5 Tool Definitions (all exported individually for GM reuse in Plan 03):**

1. `getFinancialsTool` (MH-01): `get_financials` — queries `dealer_transactions` JOIN `transaction_types` with optional limit/date filters. Scoped by `dealer_id` (not company_id — column does not exist on dealer_transactions).

2. `getPaymentHistoryTool` (MH-02): `get_payment_history` — queries same table, post-filters to `payment` and `credit_note` type codes in JavaScript, returns up to 20 records.

3. `getInvoicesTool` (MH-03): `get_invoices` — queries `dealer_invoices` for invoice_number, invoice_date, total_amount, file_name, created_at. No signed URL generation — Telegram is text-only.

4. `getDealerBalanceTool` (MH-04): `get_dealer_balance` — calls `get_dealer_balance_breakdown` RPC with `p_dealer_id: context.dealerId`. Returns total_debit, total_credit, net_balance with Turkish interpretation (Borc/Alacak/Sifir bakiye).

5. `exportReportTool` (MH-05): `export_report` — generates `=== FINANSAL RAPOR ===` plain-text summary with balance + transaction list. Defaults to current month if no dates given.

**Handler Factory:** `createMuhasebeciHandlers(supabase)` returns `Map<string, HandlerFn>` with 5 entries matching tool names exactly.

**MH-06 Hallucination Prevention:** All 5 tool descriptions include Turkish instructions ("ONEMLI: ... bu araci cagir. Tahmin yapma."). `get_dealer_balance` uses the exact wording from the plan: "Bakiye bilgisi icin bu araci kullan. Tahmin yapma."

## Verification Results

- `npx tsc --noEmit` — PASSED (zero errors)
- Export count: 7 top-level exports (5 tools + 1 array + 1 factory)
- No INSERT/UPDATE/DELETE code paths — confirmed clean
- All `dealer_transactions` queries use `.eq('dealer_id', context.dealerId)` — NOT company_id
- `get_dealer_balance_breakdown` RPC called in both `get_dealer_balance` and `export_report` handlers
- `export_report` returns `lines.join('\n')` plain text (not JSON, not CSV)

## Decisions Made

1. **dealer_id only scoping** — dealer_transactions has no company_id column (per Pitfall 1 in research); all transaction queries use `.eq('dealer_id', context.dealerId)` exclusively.

2. **Post-query JS filter for payment_history** — The plan offered two approaches for MH-02; chose JS post-filter (simpler implementation, avoids complex SQL IN with subquery, `payment` and `credit_note` type codes unlikely to change).

3. **(supabase as any).rpc() type assertion** — The `get_dealer_balance_breakdown` RPC is not in the auto-generated Database TypeScript types, so `(supabase as any)` is required, consistent with the satis-tools.ts (supabase as any) pattern for insert operations.

4. **export_report plain text** — Returns `lines.join('\n')` string, not JSON or CSV. Header `=== FINANSAL RAPOR ===` matches plan specification exactly. Amounts formatted with `.toFixed(2)`. Effect mapped: `balance_effect === 'debit'` → 'Borc', else 'Odeme'.

5. **void input in getDealerBalance** — `get_dealer_balance` requires no input (context.dealerId provides all needed data). `void input` suppresses TypeScript unused variable warning, consistent with `void context` pattern in egitimci-tools.ts.

## Deviations from Plan

None — plan executed exactly as written.

## Pre-existing Untracked File

Found `src/lib/agents/tools/depo-sorumlusu-tools.ts` already present as untracked (Plan 02 scope). Not staged or modified. Will be handled when Plan 02 executes.

## Self-Check

**Result: PASSED**

| Check | Status |
|-------|--------|
| `src/lib/agents/tools/muhasebeci-tools.ts` exists | FOUND |
| Commit `29541bb` exists | FOUND |
| `11-01-SUMMARY.md` exists | FOUND |
| `npx tsc --noEmit` zero errors | PASSED |
| 7 top-level exports (5 tools + array + factory) | VERIFIED |
| No write operations in file | VERIFIED |
