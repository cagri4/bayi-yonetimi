---
status: diagnosed
trigger: "all 3 admin report pages crash with server error - /admin/reports/sales, /admin/reports/products, /admin/reports/dealers"
created: 2026-03-05T00:00:00Z
updated: 2026-03-05T15:30:00Z
---

## Current Focus

hypothesis: CONFIRMED - inline async closures passed to client component without "use server" marker
test: accessed /admin/reports/sales via authenticated curl, observed server error
expecting: Next.js 16 error about function serialization
next_action: report root cause

## Symptoms

expected: Admin report pages render correctly showing sales, products, and dealers reports
actual: "Yonetim panelinde bir hata olustu - An error occurred in the Server Components render" on all 3 pages
errors: Server Components render error (HTTP 500)
reproduction: Visit /admin/reports/sales, /admin/reports/products, or /admin/reports/dealers while logged in as admin
started: likely since Next.js 16 upgrade or since pages were created

## Eliminated

- hypothesis: RPC function errors cause crash
  evidence: Query functions in src/lib/queries/reports.ts catch errors and return []. Pages handle empty arrays gracefully. RPC errors alone would result in empty reports, not a crash.
  timestamp: 2026-03-05T15:20:00Z

- hypothesis: Import/dependency failures (csv-stringify, recharts, date-fns)
  evidence: All modules load correctly in Node.js. Build succeeds with no errors. All report pages compile to dynamic routes.
  timestamp: 2026-03-05T15:22:00Z

- hypothesis: searchParams typing issue
  evidence: All 3 pages correctly type searchParams as Promise<SearchParams> and await it, consistent with Next.js 15+/16 requirements.
  timestamp: 2026-03-05T15:23:00Z

## Evidence

- timestamp: 2026-03-05T15:15:00Z
  checked: All 3 report page server components
  found: All import from @/lib/queries/reports (RPC queries) and @/lib/actions/export-reports (server actions). All pass an inline async () => closure wrapping a server action to ExportButton client component.
  implication: Common pattern across all 3 pages is the ExportButton + inline function prop.

- timestamp: 2026-03-05T15:18:00Z
  checked: Supabase RPC functions via service role key
  found: get_sales_report, get_top_products, get_dealer_performance ALL return "Could not find the function" (PGRST202). Functions defined in migration 003_reporting_functions.sql were never applied to the database.
  implication: RPCs are missing, but query code handles errors gracefully (returns []). This is a secondary data issue, not the crash cause.

- timestamp: 2026-03-05T15:25:00Z
  checked: Next.js dev server error logs after authenticated page access
  found: |
    Error: Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server". Or maybe you meant to call this function rather than return it.
      <... exportFn={function exportFn} filename=...>
  implication: This is the CRASH cause. Next.js 16 rejects inline closures passed as props from Server Components to Client Components unless explicitly marked with "use server".

- timestamp: 2026-03-05T15:26:00Z
  checked: next build output
  found: Build succeeds (no compile errors). All report routes listed as dynamic (f). The error only manifests at runtime when the server component actually renders.
  implication: This is a runtime serialization error, not a build error.

## Resolution

root_cause: |
  PRIMARY: All 3 report pages pass an inline `async () =>` closure as `exportFn` prop to the `ExportButton` client component. In Next.js 16, functions passed from Server Components to Client Components MUST be explicitly marked with "use server". The wrapper closures are not marked and Next.js throws:
  "Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with 'use server'."

  Affected lines:
  - src/app/(admin)/admin/reports/sales/page.tsx:65 - async () => exportSalesReportCSV(period, startDate, endDate)
  - src/app/(admin)/admin/reports/products/page.tsx:48 - async () => exportTopProductsCSV(startDate, endDate)
  - src/app/(admin)/admin/reports/dealers/page.tsx:48 - async () => exportDealerPerformanceCSV(startDate, endDate)

  SECONDARY: The 3 Supabase RPC functions (get_sales_report, get_top_products, get_dealer_performance) do not exist in the database. Migration 003_reporting_functions.sql was never applied. Even after fixing the primary crash, the reports would show empty data until these RPCs are created.

fix:
verification:
files_changed: []
