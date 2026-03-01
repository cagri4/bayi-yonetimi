---
phase: "06"
plan: "05"
subsystem: "catalog-filter-nav"
tags: ["catalog", "filter", "navigation", "new-products", "favorites"]
dependency_graph:
  requires: ["06-01", "04-01"]
  provides: ["yeni-urunler-filter", "catalog-tabs", "complete-nav"]
  affects: ["dealer-catalog", "admin-nav", "dealer-nav"]
tech_stack:
  added: []
  patterns: ["url-search-params-filter", "suspense-streaming", "server-action-filtering"]
key_files:
  created:
    - src/components/catalog/catalog-filter-tabs.tsx
  modified:
    - src/app/(dealer)/catalog/page.tsx
    - src/components/catalog/product-grid.tsx
    - src/components/catalog/product-card.tsx
    - src/components/layout/nav-links.tsx
    - src/app/(admin)/layout.tsx
    - src/lib/actions/catalog.ts
    - src/lib/actions/favorites.ts
decisions:
  - "Made created_at optional on CatalogProduct to maintain backward compat with FavoriteProduct consumers"
  - "Favorites tab in catalog uses getFavoriteProducts inline (no separate page redirect)"
  - "isProductNew helper lives in product-grid (server component) not client ProductCard"
metrics:
  duration: "18min"
  completed: "2026-03-01T10:01:26Z"
  tasks_completed: 2
  files_changed: 8
---

# Phase 06 Plan 05: New Products Filter and Nav Verification Summary

**One-liner:** Yeni Urunler filter using created_at date range with Yeni badge on product cards, plus complete nav audit fixing Katalog/Sepetim labels and adding admin Siparisler link.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add Yeni Urunler filter to catalog | ed57a18 | catalog.ts, catalog/page.tsx, product-grid.tsx, product-card.tsx, catalog-filter-tabs.tsx, favorites.ts |
| 2 | Verify and fix all navigation links | ed57a18 | nav-links.tsx, admin/layout.tsx |

## What Was Built

### Task 1: Yeni Urunler Filter

**CatalogFilterTabs component** (`src/components/catalog/catalog-filter-tabs.tsx`):
- Client component with three tabs: Tumu | Yeni Urunler | Favorilerim
- Uses URL search param `filter=new` / `filter=favorites` / no param (all)
- Active tab highlighted with `bg-primary text-white`
- Switching to Favorites tab clears category/brand params automatically

**Catalog action update** (`src/lib/actions/catalog.ts`):
- Added `is_new?: boolean` to `CatalogFilters` interface
- Added `created_at` to product select query
- When `is_new` is true: filters `created_at >= now - 30 days` via Supabase `.gte()`
- Added `created_at?: string` to `CatalogProduct` interface (optional for compat)

**ProductGrid update** (`src/components/catalog/product-grid.tsx`):
- Added `isNew` and `favoritesOnly` props
- `favoritesOnly` calls `getFavoriteProducts()` instead of `getCatalogProducts()`
- Passes `showNewBadge` to `ProductCard` based on `isProductNew()` helper (30-day check)
- Empty state message varies by filter mode

**ProductCard update** (`src/components/catalog/product-card.tsx`):
- Added `showNewBadge?: boolean` prop
- Renders `<span className="bg-green-500 text-white text-xs px-2 py-1 rounded">Yeni</span>` when true
- Badge stacks with discount badge in top-right corner

**FavoriteProduct update** (`src/lib/actions/favorites.ts`):
- Added `created_at` to `FavoriteProduct` interface and `ProductFromDB` interface
- Updated select query to include `created_at` from products join

### Task 2: Navigation Audit and Fixes

**Dealer nav** (`src/components/layout/nav-links.tsx`):
- Fixed: `/catalog` label changed from "Urunler" to "Katalog"
- Fixed: `/cart` label changed from "Sepet" to "Sepetim"
- All required links confirmed present: Dashboard, Katalog, Favorilerim, Kampanyalar, Duyurular, Cari Hesap, Siparislerim, Sepetim (+ Hizli Siparis bonus)

**Admin nav** (`src/app/(admin)/layout.tsx`):
- Added: `/admin/orders` "Siparisler" link with `ClipboardList` icon (was missing)
- All required links now present: Dashboard, Urunler, Bayiler, Siparisler, Kampanyalar, Duyurular, Raporlar

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FavoriteProduct missing created_at caused TypeScript error**
- **Found during:** Task 1, after updating CatalogProduct interface
- **Issue:** `favorites/page.tsx` passes `FavoriteProduct` to `ProductCard` which expects `CatalogProduct`; `created_at` was required in `CatalogProduct` but absent in `FavoriteProduct`
- **Fix:** Added `created_at` to `FavoriteProduct` interface and updated the products select query in `getFavoriteProducts()`; made `created_at` optional on `CatalogProduct` for backward compatibility
- **Files modified:** `src/lib/actions/favorites.ts`, `src/lib/actions/catalog.ts`
- **Commit:** ed57a18

## Verification

- `npx tsc --noEmit` - passed with 0 errors
- All 8 files staged and committed atomically

## Self-Check: PASSED

Files confirmed present:
- src/components/catalog/catalog-filter-tabs.tsx - FOUND
- src/app/(dealer)/catalog/page.tsx - FOUND
- src/components/catalog/product-grid.tsx - FOUND
- src/components/catalog/product-card.tsx - FOUND
- src/components/layout/nav-links.tsx - FOUND
- src/app/(admin)/layout.tsx - FOUND
- src/lib/actions/catalog.ts - FOUND
- src/lib/actions/favorites.ts - FOUND

Commit confirmed: ed57a18 - feat(06-05): add Yeni Urunler filter to catalog and verify nav links
