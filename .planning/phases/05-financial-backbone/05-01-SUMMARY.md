# Phase 05-01: Financial Backbone - Database Schema

**Completed:** 2026-02-09
**Status:** SUCCESS

## Objective

Create ERP-ready database schema for dealer financial tracking (cari hesap).

## What Was Done

### Task 1: Financial Tables Migration

Created `supabase/migrations/006_financial_tables.sql` with:

1. **transaction_types** lookup table:
   - Columns: id, code, name, balance_effect, display_order, is_active
   - Seed data: invoice/Fatura, payment/Odeme, credit_note/Alacak Dekontu, debit_note/Borc Dekontu, opening_balance/Acilis Bakiyesi

2. **dealer_transactions** table:
   - Full financial ledger with ERP-ready fields
   - Columns: id, dealer_id, transaction_type_id, amount (DECIMAL 12,2), reference_number, order_id, description, notes, transaction_date, due_date, created_by, timestamps
   - Indexes for dealer_date, type, order, and reference lookups

3. **dealer_invoices** table:
   - Invoice PDF metadata and storage links
   - Columns: id, dealer_id, transaction_id, invoice_number, invoice_date, total_amount, file_name, file_path, file_size, mime_type, uploaded_by, created_at
   - Indexes for dealer_date, number, and transaction lookups

4. **Database functions**:
   - `get_dealer_balance(p_dealer_id UUID)` - Returns net balance (positive = owes, negative = credit)
   - `get_dealer_balance_breakdown(p_dealer_id UUID)` - Returns total_debit, total_credit, net_balance

5. **RLS policies**:
   - Dealers can SELECT own transactions and invoices
   - Admins have ALL access on transactions and invoices
   - All authenticated can SELECT transaction_types

6. **Triggers**:
   - updated_at trigger on dealer_transactions

### Task 2: Storage Bucket Configuration

Storage RLS policies added to migration for `dealer-invoices` bucket:
- Dealers can read files in their folder: `{dealer_id}/*`
- Admins can manage all files

**Manual step required:** Create bucket via Supabase Dashboard:
- Name: `dealer-invoices`
- Public: false (private)
- File size limit: 10MB
- Allowed MIME types: application/pdf

### Task 3: TypeScript Types Updated

Updated `src/types/database.types.ts` with:
- `transaction_types` table type
- `dealer_transactions` table type
- `dealer_invoices` table type
- `dealer_favorites` table type (from migration 005)
- `get_dealer_balance` function type
- `get_dealer_balance_breakdown` function type

## Verification

- Build passed: `npm run build` completed successfully
- TypeScript types validated
- No type errors

## Files Modified

| File | Action |
|------|--------|
| `supabase/migrations/006_financial_tables.sql` | Created |
| `src/types/database.types.ts` | Updated |

## Next Steps

1. Apply migration to database: `npx supabase db push` or via Dashboard
2. Create `dealer-invoices` storage bucket via Supabase Dashboard
3. Verify tables exist in Supabase Dashboard
4. Test RLS policies by querying as different users
5. Proceed to Phase 05-02: Server Actions for financials

## Notes

- Schema designed to be ERP-ready with reference_number field
- All Turkish names used for display (Fatura, Odeme, etc.)
- Balance calculation via database function ensures consistency
- Storage uses dealer-scoped folders for RLS efficiency
