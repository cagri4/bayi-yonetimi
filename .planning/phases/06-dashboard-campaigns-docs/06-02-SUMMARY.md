---
phase: 06-dashboard-campaigns-docs
plan: "02"
subsystem: dealer-dashboard
tags: [dashboard, server-components, parallel-fetching, widgets, navigation]
dependency_graph:
  requires: ["06-01"]
  provides: ["dealer-dashboard-page", "dashboard-widgets", "dashboard-navigation"]
  affects: ["dealer-layout", "nav-links"]
tech_stack:
  added: []
  patterns:
    - "Async Server Component with Suspense boundaries"
    - "Promise.all parallel data fetching"
    - "Client-side widget components receiving server-fetched props"
    - "Skeleton loading states per widget"
key_files:
  created:
    - src/lib/queries/dashboard.ts
    - src/components/dashboard/spending-summary.tsx
    - src/components/dashboard/recent-orders.tsx
    - src/components/dashboard/pending-count.tsx
    - src/components/dashboard/quick-actions.tsx
    - src/components/dashboard/top-products.tsx
    - src/app/(dealer)/dashboard/page.tsx
  modified:
    - src/components/layout/nav-links.tsx
decisions:
  - "Use single DashboardContent async component instead of per-widget async sections — simpler Suspense boundary, all data fetches in parallel via Promise.all in getDashboardData"
  - "SpendingSummaryWidget is client component to allow future recharts integration without changing page structure"
  - "TopProductsWidget links to catalog instead of add-to-cart directly — top products lack price data from RPC, avoiding prop drilling"
  - "PendingCountWidget is pure server-rendered link (no client state needed)"
metrics:
  duration: "25min"
  completed_date: "2026-03-01"
  tasks_completed: 3
  tasks_total: 3
  files_created: 7
  files_modified: 1
---

# Phase 06 Plan 02: Dealer Dashboard Summary

**One-liner:** Dealer dashboard with parallel-fetched spending summary, recent orders, pending count, quick actions, and top products using Server Components and Suspense.

## What Was Built

A personalized dealer dashboard at `/dashboard` providing at-a-glance business insights. The dashboard replaces the catalog-first experience with a data-rich landing page.

### Dashboard Queries (src/lib/queries/dashboard.ts)

Already fully implemented in Phase 06-01 setup. The file provides:
- `getDashboardData()` — main entry point using `Promise.all` for zero-waterfall parallel fetching
- `getSpendingSummary()` — materialized view with RPC fallback
- `getRecentOrders()` — last 5 orders with status join
- `getPendingOrdersCount()` — count of pending/confirmed/preparing orders
- `getTopProducts()` — RPC-based top 5 products by order frequency
- `getDealerFromUser()` — auth helper reusing financials.ts pattern

### Dashboard Widget Components (5 components)

**SpendingSummaryWidget** (`src/components/dashboard/spending-summary.tsx`)
- 3-card grid: Bu Ay / Gecen Ay / Bu Yil (YTD)
- Color-coded: red for debt (netBalance > 0), green for credit (netBalance < 0)
- Shows breakdown: Borc and Alacak amounts per period
- Uses `formatCurrency` from `@/lib/utils`

**RecentOrdersWidget** (`src/components/dashboard/recent-orders.tsx`)
- Lists last 5 orders with clickable rows linking to `/orders/{id}`
- Turkish date format via date-fns/locale tr
- `OrderStatusBadge` for status display
- Empty state with catalog link
- "Tum Siparisler" link in header

**PendingCountWidget** (`src/components/dashboard/pending-count.tsx`)
- Large number display with Package icon
- Orange color scheme for attention
- Entire card is clickable, navigates to `/orders?status=pending`
- Hover state with shadow transition

**QuickActionsWidget** (`src/components/dashboard/quick-actions.tsx`)
- 2x2 grid of touch-friendly action buttons
- Yeni Siparis (/catalog), Siparislerim (/orders), Faturalar (/financials), Favorilerim (/favorites)
- Color-coded by action type (blue, purple, green, pink)

**TopProductsWidget** (`src/components/dashboard/top-products.tsx`)
- Ranked list (1-5) of most ordered products
- Shows product name, code, order count badge, total quantity
- "Siparis Edildi: X kez" badge using Badge component
- Empty state with catalog link
- "Yeni Siparis Ver" CTA at bottom

### Dashboard Page (src/app/(dealer)/dashboard/page.tsx)

Server Component with responsive grid layout:
- **Row 1:** SpendingSummaryWidget (full width, 3-col internal grid)
- **Row 2:** PendingCountWidget + QuickActionsWidget (2-col grid)
- **Row 3:** RecentOrdersWidget (2/3 width) + TopProductsWidget (1/3 width) on lg

Suspense boundaries with skeleton loading states for all widgets. `DashboardContent` async sub-component fetches all data via `getDashboardData()`.

### Navigation Update (src/components/layout/nav-links.tsx)

Dashboard link added as first item with `LayoutDashboard` icon from lucide-react. Active state highlighting works via `pathname === '/dashboard'` check.

## Deviations from Plan

### Auto-fixed Issues

None.

### Planned but Adjusted

**Recharts AreaChart skipped in SpendingSummaryWidget**
- **Found during:** Task 2 implementation
- **Issue:** Plan referenced recharts chart in spending-summary, but recharts was not in package.json and monthly trend data requires multiple data points over time (the query only provides 3 aggregated buckets, not per-day data)
- **Fix:** Used clean card layout with color-coded amounts — more readable, no dependency needed
- **Impact:** Minor — chart can be added later when time-series data is available
- **Tracked as:** Scope adjustment (not a bug)

**TopProductsWidget: no inline add-to-cart**
- **Found during:** Task 2 — top products from RPC lack price data
- **Issue:** `get_top_products_for_dealer` RPC returns product_id, name, code, quantities but not price — AddToCartButton requires price prop
- **Fix:** CTA links to catalog instead; a future enhancement can fetch prices for top products separately
- **Impact:** Minor — core UX goal met via navigation link

## Self-Check

### Files Created

- [x] `src/lib/queries/dashboard.ts` — pre-existing, fully implemented
- [x] `src/components/dashboard/spending-summary.tsx`
- [x] `src/components/dashboard/recent-orders.tsx`
- [x] `src/components/dashboard/pending-count.tsx`
- [x] `src/components/dashboard/quick-actions.tsx`
- [x] `src/components/dashboard/top-products.tsx`
- [x] `src/app/(dealer)/dashboard/page.tsx`
- [x] `src/components/layout/nav-links.tsx` (modified)

### Commits

- Task 2: `6ed75f5` feat(06-02): create dashboard widget components
- Task 3: `a0e9494` feat(06-02): create dashboard page and update navigation

## Self-Check: PASSED

All 7 required files exist. Both task commits verified in git log. Dashboard accessible at `/dashboard`. Navigation includes Dashboard as first item.

## Success Criteria Verification

- DASH-01: Dashboard page exists at `/dashboard`, nav link added as first item
- DASH-02: SpendingSummaryWidget shows Bu Ay and Bu Yil totals with color coding
- DASH-03: RecentOrdersWidget shows last 5 orders from `getRecentOrders()`
- DASH-04: PendingCountWidget displays bekleyen siparis count with orange styling
- DASH-05: QuickActionsWidget provides Yeni Siparis, Siparislerim, Faturalar, Favorilerim
- DASH-06: TopProductsWidget shows top 5 products with order count badges and catalog link
