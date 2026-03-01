---
phase: 08-multi-tenant-db-migration
plan: "05"
subsystem: types
tags: [typescript, multi-tenant, database-types, company-id]
dependency_graph:
  requires:
    - 08-04  # JWT hook registration (database must have company_id columns)
  provides:
    - TypeScript types matching post-migration multi-tenant schema
  affects:
    - All server actions using typed Supabase client
    - Phase 9 agent infrastructure (company_id injection pattern)
tech_stack:
  added: []
  patterns:
    - TypeScript interface extension for multi-tenancy
    - Optional Insert types to preserve backward compatibility
key_files:
  modified:
    - src/types/database.types.ts
decisions:
  - "Insert types use company_id?: string (optional) not company_id: string (required) — lets existing server actions compile without modification; DB enforces NOT NULL at runtime; Phase 9 injects company_id from JWT context"
  - "companies table type added alphabetically between users and dealer_groups blocks"
  - "dealer_spending_summary view left as-is — view company_id field deferred to Phase 9 when RPC wrapper is updated"
metrics:
  duration_seconds: 426
  completed_date: "2026-03-01"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
---

# Phase 8 Plan 05: TypeScript Types for Post-Migration Schema Summary

Updated `database.types.ts` to reflect the post-migration multi-tenant schema: companies table type added, users.role extended to include 'superadmin', users.company_id added as nullable, and all 19 tenant-scoped tables extended with company_id fields. TypeScript compiler and Next.js build both pass clean.

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Add companies table type and update users type | cbb724e | companies Row/Insert/Update/Relationships added; users.role += 'superadmin'; users.company_id added as string \| null |
| 2 | Add company_id to all 19 tenant-scoped table types | ff561f2 | dealers, dealer_groups, dealer_prices, dealer_transactions, dealer_invoices, dealer_favorites, orders, order_items, order_status_history, order_documents, products, categories, brands, campaigns, campaign_products, announcements, announcement_reads, support_messages, product_requests all updated |

## Verification Results

1. `grep -c "company_id" src/types/database.types.ts` — **60 matches** (19 tables x 3 + users x 3)
2. `grep "superadmin" src/types/database.types.ts` — **3 matches** (Row, Insert, Update in users.role)
3. `grep -A 5 "companies:" src/types/database.types.ts` — shows Row type with id, name, slug, plan, is_active, settings
4. `npx tsc --noEmit` — **zero output** (zero errors)
5. `npm run build` — **build succeeded**, all 38 routes compiled

## Tables Updated

| Table | company_id in Row | company_id in Insert | company_id in Update |
|-------|-------------------|---------------------|---------------------|
| dealers | `string` | `string?` | `string?` |
| dealer_groups | `string` | `string?` | `string?` |
| dealer_prices | `string` | `string?` | `string?` |
| dealer_transactions | `string` | `string?` | `string?` |
| dealer_invoices | `string` | `string?` | `string?` |
| dealer_favorites | `string` | `string?` | `string?` |
| orders | `string` | `string?` | `string?` |
| order_items | `string` | `string?` | `string?` |
| order_status_history | `string` | `string?` | `string?` |
| order_documents | `string` | `string?` | `string?` |
| products | `string` | `string?` | `string?` |
| categories | `string` | `string?` | `string?` |
| brands | `string` | `string?` | `string?` |
| campaigns | `string` | `string?` | `string?` |
| campaign_products | `string` | `string?` | `string?` |
| announcements | `string` | `string?` | `string?` |
| announcement_reads | `string` | `string?` | `string?` |
| support_messages | `string` | `string?` | `string?` |
| product_requests | `string` | `string?` | `string?` |

## Global Tables (No company_id — correct)

- `order_statuses` — platform-level lookup
- `order_status_transitions` — platform-level lookup
- `transaction_types` — platform-level lookup
- `faq_categories` — platform-level lookup
- `faq_items` — platform-level lookup

## Deviations from Plan

None — plan executed exactly as written.

The plan noted Insert types should use `company_id?: string` (optional) to avoid breaking existing server actions. This was followed precisely.

## Self-Check: PASSED

- FOUND: src/types/database.types.ts
- FOUND: commit cbb724e (Task 1 — companies table + users update)
- FOUND: commit ff561f2 (Task 2 — 19 tenant-scoped tables)
