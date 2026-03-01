---
phase: 07-support-reports
plan: 03
subsystem: dealer-reports
tags: [reports, analytics, recharts, xlsx, route-handler, excel-export]
dependency_graph:
  requires: [07-01, 05-financial-backbone]
  provides: [spending-analytics-page, excel-export-route]
  affects: [dealer-nav, dealer-spending-summary-view]
tech_stack:
  added: [xlsx@0.18.5]
  patterns: [route-handler-binary-response, server-side-xlsx-only, parallel-promise-all]
key_files:
  created:
    - src/lib/queries/spending-reports.ts
    - src/components/reports/spending-trend-chart.tsx
    - src/components/reports/period-comparison.tsx
    - src/components/reports/spending-export-button.tsx
    - src/app/(dealer)/reports/page.tsx
    - src/app/api/reports/spending-export/route.ts
  modified:
    - src/components/layout/nav-links.tsx
    - src/lib/actions/support.ts
    - src/components/admin/support/message-inbox.tsx
    - src/components/admin/support/faq-manager.tsx
    - src/components/admin/support/message-thread.tsx
    - src/components/support/faq-category-list.tsx
    - src/components/support/message-list.tsx
    - package.json
    - package-lock.json
decisions:
  - xlsx-server-only: Import xlsx only in route.ts to avoid ~500KB client bundle addition
  - window-location-download: Use window.location.href for download to trigger native browser dialog (not fetch)
  - direct-type-imports: Import types from @/types/database.types directly instead of re-exporting via 'use server' files
metrics:
  duration: 11min
  completed_date: 2026-03-01
  tasks_completed: 2
  files_created: 6
  files_modified: 9
requirements_satisfied:
  - REP-01
  - REP-02
  - REP-03
---

# Phase 7 Plan 3: Spending Reports and Analytics Summary

**One-liner:** Dealer spending analytics at /reports with recharts BarChart (12-month trend), period comparison cards (Bu Ay/Gecen Ay/Bu Yil/Gecen Yil), and server-side .xlsx download via Route Handler using xlsx (SheetJS) isolated to server bundle.

## What Was Built

### Task 1: xlsx installation and spending query functions
- Installed `xlsx@0.18.5` (SheetJS) as production dependency — used only server-side
- Created `src/lib/queries/spending-reports.ts` with three exports:
  - `getDealerIdFromUser()`: get dealer ID from authenticated user
  - `getDealerMonthlySpending(dealerId, months=12)`: query `dealer_spending_summary` materialized view, return 12 months ascending for chart x-axis
  - `getSpendingComparison(dealerId)`: aggregate 4 periods (thisMonth, lastMonth, thisYear, lastYear) from view, fallback to direct `dealer_transactions` query if view is empty

### Task 2: Components, reports page, and Excel route handler
- `SpendingTrendChart`: recharts `BarChart` with two `Bar` components (totalDebit in chart-1 color, totalCredit in chart-2 color), Turkish month labels via `date-fns/locale/tr`, empty state card
- `PeriodComparison`: 2x2 grid (lg: 4-col) cards with TrendingUp/TrendingDown icons comparing current vs prior period, sub-lines for Alacak and Net
- `SpendingExportButton`: `'use client'` button using `window.location.href = '/api/reports/spending-export'` — no xlsx import here
- Reports page (`/reports`): Server Component, parallel `Promise.all` for monthly + comparison data, `Suspense` with skeleton fallback, SpendingExportButton in page header
- Excel Route Handler (`/api/reports/spending-export`): auth check, dealer lookup, query `dealer_spending_summary`, XLSX.utils.json_to_sheet with Turkish column headers, `Content-Disposition: attachment`, `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Updated nav-links.tsx: added `Raporlar` link with `BarChart2` icon after `Cari Hesap`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Turbopack build failure from `export type {}` in `'use server'` files**
- **Found during:** Task 2 build verification
- **Issue:** Turbopack (used in Next.js 16 production builds) cannot resolve type re-exports from `'use server'` modules. `src/lib/actions/support.ts` had `export type { SupportMessage, SupportMessageWithDealer, FaqCategoryWithItems, FaqItem, ProductRequest }` which caused 16 Turbopack build errors across support pages and components.
- **Fix:** Removed `export type { ... }` block from `support.ts` and updated 5 consuming components to import types directly from `@/types/database.types` (the canonical location where these types were always defined):
  - `src/components/admin/support/message-inbox.tsx`
  - `src/components/admin/support/faq-manager.tsx`
  - `src/components/admin/support/message-thread.tsx`
  - `src/components/support/faq-category-list.tsx`
  - `src/components/support/message-list.tsx`
- **Files modified:** 6 files
- **Commit:** included in 33e6668

**2. [Rule 3 - Blocking] Fixed TypeScript error in spending-reports.ts fallback query**
- **Found during:** Task 1 TypeScript check
- **Issue:** Supabase client's TypeScript inference couldn't handle the `dealer_transactions` cross-table join for the fallback path (SelectQueryError)
- **Fix:** Cast the supabase client to `any` for the fallback query only — consistent with pattern used elsewhere in the codebase (financials.ts, dashboard.ts)
- **Files modified:** `src/lib/queries/spending-reports.ts`
- **Commit:** eefc7f2

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| xlsx server-only | xlsx adds ~500KB. Import only in route.ts (server bundle), never in client components. Component comment explains this explicitly. |
| window.location.href for download | `fetch()` cannot trigger browser download dialog. `window.location.href` navigates the browser to the endpoint which triggers native download behavior. |
| Direct type imports from @/types/database.types | Turbopack cannot process `export type {}` from `'use server'` files. Types should always live in their canonical location (database.types.ts), not re-exported through action files. |
| Promise.all parallel fetch | Zero waterfall — monthly chart data and comparison data fetched simultaneously, same pattern as dashboard page. |
| Fallback to dealer_transactions | If materialized view is empty/stale (e.g., REFRESH MATERIALIZED VIEW hasn't run), the comparison still works by querying raw transactions. |

## Commits

| Hash | Message |
|------|---------|
| eefc7f2 | feat(07-03): install xlsx and create spending-reports query functions |
| 33e6668 | feat(07-03): spending analytics page, chart components, and Excel export route |

## Self-Check: PASSED

Files created:
- src/lib/queries/spending-reports.ts — FOUND
- src/components/reports/spending-trend-chart.tsx — FOUND
- src/components/reports/period-comparison.tsx — FOUND
- src/components/reports/spending-export-button.tsx — FOUND
- src/app/(dealer)/reports/page.tsx — FOUND
- src/app/api/reports/spending-export/route.ts — FOUND

Build: PASSED (both eefc7f2 and 33e6668 in git log, /reports and /api/reports/spending-export present in build output)
TypeScript: PASSED (npx tsc --noEmit exits 0)
xlsx client bundle check: PASSED (xlsx import only in route.ts)
