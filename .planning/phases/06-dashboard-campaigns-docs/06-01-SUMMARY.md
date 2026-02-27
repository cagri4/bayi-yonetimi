# 06-01 Summary: Database Schema for Phase 6

## What Was Built

Created comprehensive database schema for Phase 6 features: campaigns, announcements, order documents, cargo tracking, and dashboard materialized views.

## Artifacts Created

| File | Purpose |
|------|---------|
| supabase/migrations/007_dashboard_campaigns.sql | Complete Phase 6 schema |
| src/types/database.types.ts | TypeScript types for new tables |

## Schema Details

### Tables Created

1. **campaigns** - Marketing campaigns with date-based activation
   - id, title, description, image_url, start_date, end_date, is_active, timestamps

2. **campaign_products** - Campaign-product junction (many-to-many)
   - campaign_id, product_id, discount_percent (optional per-product discount)

3. **announcements** - Admin announcements with priority and expiration
   - id, title, content, priority, is_active, published_at, expires_at, timestamps

4. **announcement_reads** - Read receipt tracking per dealer
   - announcement_id, dealer_id, read_at

5. **order_documents** - Invoice/irsaliye PDF metadata
   - order_id, document_type (invoice|irsaliye), file_name, file_path, file_size, mime_type, uploaded_by

### Orders Table Enhancements

Added cargo tracking columns:
- vehicle_plate, driver_name, driver_phone, cargo_notes

### Materialized View

**dealer_spending_summary** - Pre-computed monthly spending aggregations
- dealer_id, company_name, month, total_debit, total_credit, net_balance
- Aggregates from Phase 5 dealer_transactions table

### RPC Function

**get_top_products_for_dealer(p_dealer_id, p_limit)** - Returns top N most-ordered products for dashboard widget

### Indexes

- `idx_campaigns_active_dates` - Campaign date filtering
- `idx_announcements_active_published` - Active announcements query
- `idx_announcement_reads_dealer` - Dealer read lookups
- `idx_order_documents_order` - Order document lookups
- `idx_dealer_spending_dealer_month` - Materialized view fast lookup

### RLS Policies

All tables have RLS enabled with:
- Wrapped `(SELECT auth.uid())` pattern for performance
- Dealers: SELECT own data only
- Admins: Full CRUD on all tables
- Storage policies for order-documents bucket

## Commits

| Hash | Message |
|------|---------|
| a4cab9c | feat(06-01): create Phase 6 database schema migration |
| 3f521cf | feat(06-01): add TypeScript types for Phase 6 tables |

## Verification

- [x] Migration file exists with complete schema
- [x] TypeScript types added for all tables
- [x] RLS policies use wrapped auth.uid() pattern
- [x] Indexes on all query-critical columns
- [x] Triggers for updated_at on campaigns, announcements

## Next Steps

Wave 2 plans can now build on this schema:
- 06-02: Dashboard widgets using dealer_spending_summary and get_top_products_for_dealer
- 06-03: Campaigns and announcements UI
- 06-04: Order documents upload/download

---
*Completed: 2026-02-12*
