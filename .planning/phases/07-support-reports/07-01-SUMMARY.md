---
phase: 07-support-reports
plan: 01
subsystem: database-schema
tags: [database, migration, typescript, rls, realtime, support, faq, product-requests]
dependency_graph:
  requires: [05-financial-backbone, 06-dashboard-campaigns-docs]
  provides: [support_messages table, faq_categories table, faq_items table, product_requests table]
  affects: [07-02-support-ui, 07-03-faq-product-requests, 07-04-reports]
tech_stack:
  added: []
  patterns: [supabase-rls-wrapped-auth-uid, realtime-publication, updated-at-trigger]
key_files:
  created:
    - supabase/migrations/008_support_reports.sql
  modified:
    - src/types/database.types.ts
decisions:
  - "replied_by references users(id) not auth.users(id) — consistent with existing project pattern (support_messages.replied_by)"
  - "RLS for FAQ: active-only SELECT policy for dealers; admin ALL policy for management"
  - "product_id nullable on product_requests — handles both in-catalog (out-of-stock) and new-catalog requests"
  - "Realtime publication uses idempotent DO block pattern from migration 002"
  - "Composite types (FaqCategoryWithItems, SupportMessageWithDealer) added as named exports for query ergonomics"
metrics:
  duration_seconds: 186
  completed_date: "2026-03-01"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 7 Plan 01: Support & Reports Database Schema Summary

**One-liner:** Support messaging, FAQ, and product request tables with RLS, realtime publication, and TypeScript literal union types.

## What Was Built

Migration `008_support_reports.sql` establishes the complete data layer for Phase 7:

- **support_messages**: Async dealer-admin messaging with `category` text-CHECK enum (`siparis|urun|odeme|teknik|diger`), `status` (`pending|answered`), and atomic reply columns (`reply_body`, `replied_at`, `replied_by`)
- **faq_categories**: Global FAQ groupings (no dealer_id) with `display_order` and `is_active`
- **faq_items**: Individual Q&A items linked to categories via FK, with `display_order` and `is_active`
- **product_requests**: Dealer requests for out-of-stock/new-catalog products; `product_id` is nullable so requests survive product deletion

All tables have:
- RLS enabled with wrapped `(SELECT auth.uid())` pattern
- `updated_at` triggers using the existing `update_updated_at_column()` function
- Indexes on the primary query columns (dealer_id, status, created_at, display_order)

`support_messages` is added to the `supabase_realtime` publication (required for Plan 07-02 admin realtime hook), using the idempotent DO-block pattern from migration 002.

Seed data: 3 FAQ categories (Siparis, Odeme, Urun) with 4 example FAQ items for admin to replace.

TypeScript types in `database.types.ts`:
- Full `Row/Insert/Update/Relationships` blocks for all 4 tables following exact existing file pattern
- Literal union types on `category` (`'siparis' | 'urun' | 'odeme' | 'teknik' | 'diger'`) and `status` fields
- Named convenience aliases: `SupportMessage`, `FaqCategory`, `FaqItem`, `ProductRequest`
- Composite types: `FaqCategoryWithItems`, `SupportMessageWithDealer`

## Verification

- `npx tsc --noEmit` passes with zero errors
- Migration contains all 4 `CREATE TABLE` statements
- `ALTER PUBLICATION supabase_realtime ADD TABLE support_messages` present
- `GRANT SELECT ON support_messages TO supabase_realtime` present
- All RLS policies use `(SELECT auth.uid())` wrapped pattern

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | b588356 | feat(07-01): create Phase 7 database schema migration |
| 2 | 2d27758 | feat(07-01): add TypeScript types for Phase 7 support and reports tables |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `supabase/migrations/008_support_reports.sql` exists
- [x] `src/types/database.types.ts` updated with all 4 table types
- [x] Commits b588356 and 2d27758 exist in git log
- [x] `npx tsc --noEmit` passes
