# Phase 5: Financial Backbone - Research

**Researched:** 2026-02-09
**Domain:** B2B dealer financial tracking system (cari hesap), ERP-ready schema design
**Confidence:** HIGH

## Summary

This research establishes the architecture for a comprehensive dealer financial tracking system ("cari hesap") in a Turkish B2B dealer management context. The system enables dealers to view their account balance, transaction history, and download invoices, while admins can manually enter financial transactions and upload invoice PDFs.

The standard approach builds on existing v1 patterns: Supabase RLS for multi-tenant isolation, Server Actions for mutations, and Supabase Storage for PDF files. The database requires two new tables (`dealer_transactions` for the financial ledger, `dealer_invoices` for invoice metadata/storage) with proper indexing for balance calculations and date-range queries.

Critical findings include: balance calculation should use a database function for performance and consistency, transaction types must align with Turkish accounting terminology (fatura/invoice, odeme/payment, duzeltme/adjustment), and the schema must be ERP-ready for future automated synchronization.

**Primary recommendation:** Implement a double-entry-inspired ledger table with debit/credit balance effects, Supabase Storage for invoice PDFs with dealer-scoped RLS, and database functions for balance calculations to ensure consistency across all queries.

## Standard Stack

The established libraries/tools for this domain (all already present in v1):

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase | 2.91.1 | Database with RLS for multi-tenant financials | v1 established pattern, RLS provides database-level isolation |
| Supabase Storage | 2.91.1 | PDF storage for invoices | Built-in, RLS-compatible, signed URL support |
| Next.js Server Actions | 16.1.4 | Mutations for transactions and file uploads | v1 established pattern, type-safe, integrates with caching |
| Zod | 3.24.2 | Validation for financial data entry | v1 has it, essential for monetary validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.0.0 | Date formatting and filtering | v1 uses for order dates |
| react-hook-form | 7.54.2 | Admin transaction entry forms | v1 uses for forms |
| lucide-react | 0.563.0 | Icons for transaction types, download buttons | Already in v1 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase Storage | S3 + CloudFront | Storage is simpler, RLS integrated, no CDN needed for private PDFs |
| Database function for balance | Application-level calculation | Function ensures consistency, single source of truth |
| DECIMAL(12,2) | DECIMAL(10,2) | 12,2 supports up to 9,999,999,999.99 TL for future-proofing |

**Installation:**
```bash
# No new dependencies needed - all libraries already in v1
```

## Architecture Patterns

### Recommended Database Schema

#### dealer_transactions (Financial Ledger)
```sql
-- ============================================
-- DEALER TRANSACTIONS (Cari Hesap Hareketleri)
-- ============================================
-- Purpose: ERP-ready financial transaction ledger for dealer accounts
-- Pattern: Double-entry inspired with debit/credit balance effects

-- Transaction type lookup table for extensibility
CREATE TABLE transaction_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,        -- Turkish name for display
  balance_effect TEXT NOT NULL CHECK (balance_effect IN ('debit', 'credit')),
  display_order INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert standard transaction types
INSERT INTO transaction_types (code, name, balance_effect, display_order) VALUES
  ('invoice', 'Fatura', 'debit', 1),         -- Invoice = borç (dealer owes)
  ('payment', 'Odeme', 'credit', 2),         -- Payment = alacak (dealer paid)
  ('credit_note', 'Alacak Dekontu', 'credit', 3),  -- Credit adjustment
  ('debit_note', 'Borc Dekontu', 'debit', 4),      -- Debit adjustment
  ('opening_balance', 'Acilis Bakiyesi', 'debit', 5); -- Opening balance entry

-- Main transactions table
CREATE TABLE dealer_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  transaction_type_id UUID NOT NULL REFERENCES transaction_types(id),

  -- Amount (always positive, balance_effect determines +/-)
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),

  -- Reference fields for ERP integration
  reference_number TEXT,          -- Fatura no, makbuz no, etc.
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,  -- Link to order if applicable

  -- Descriptive fields
  description TEXT NOT NULL,
  notes TEXT,                     -- Admin notes

  -- Temporal fields
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,                  -- Vade tarihi (for invoices)

  -- Audit trail
  created_by UUID REFERENCES users(id),   -- Admin who entered
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Primary query pattern: dealer's transactions by date
CREATE INDEX idx_dealer_transactions_dealer_date
  ON dealer_transactions(dealer_id, transaction_date DESC);

-- Filter by type
CREATE INDEX idx_dealer_transactions_type
  ON dealer_transactions(transaction_type_id);

-- Find transactions for an order
CREATE INDEX idx_dealer_transactions_order
  ON dealer_transactions(order_id)
  WHERE order_id IS NOT NULL;

-- Reference number lookup (for ERP sync)
CREATE INDEX idx_dealer_transactions_reference
  ON dealer_transactions(reference_number)
  WHERE reference_number IS NOT NULL;

-- ============================================
-- BALANCE CALCULATION FUNCTION
-- ============================================
-- Returns: positive = dealer owes (borç), negative = dealer has credit (alacak)

CREATE OR REPLACE FUNCTION get_dealer_balance(p_dealer_id UUID)
RETURNS DECIMAL AS $$
  SELECT COALESCE(
    SUM(
      CASE
        WHEN tt.balance_effect = 'debit' THEN dt.amount
        ELSE -dt.amount
      END
    ),
    0
  )
  FROM dealer_transactions dt
  JOIN transaction_types tt ON dt.transaction_type_id = tt.id
  WHERE dt.dealer_id = p_dealer_id;
$$ LANGUAGE sql STABLE;

-- Balance breakdown function (for dashboard)
CREATE OR REPLACE FUNCTION get_dealer_balance_breakdown(p_dealer_id UUID)
RETURNS TABLE (
  total_debit DECIMAL,
  total_credit DECIMAL,
  net_balance DECIMAL
) AS $$
  SELECT
    COALESCE(SUM(CASE WHEN tt.balance_effect = 'debit' THEN dt.amount ELSE 0 END), 0) as total_debit,
    COALESCE(SUM(CASE WHEN tt.balance_effect = 'credit' THEN dt.amount ELSE 0 END), 0) as total_credit,
    COALESCE(SUM(
      CASE WHEN tt.balance_effect = 'debit' THEN dt.amount ELSE -dt.amount END
    ), 0) as net_balance
  FROM dealer_transactions dt
  JOIN transaction_types tt ON dt.transaction_type_id = tt.id
  WHERE dt.dealer_id = p_dealer_id;
$$ LANGUAGE sql STABLE;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE dealer_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_types ENABLE ROW LEVEL SECURITY;

-- Transaction types readable by all authenticated
CREATE POLICY "Authenticated can read transaction types"
  ON transaction_types FOR SELECT
  TO authenticated
  USING (true);

-- Dealers can read own transactions
CREATE POLICY "Dealers can read own transactions"
  ON dealer_transactions FOR SELECT
  TO authenticated
  USING (
    dealer_id IN (
      SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
    )
  );

-- Admins can manage all transactions
CREATE POLICY "Admins can manage dealer transactions"
  ON dealer_transactions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_dealer_transactions_updated_at
  BEFORE UPDATE ON dealer_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### dealer_invoices (Invoice Documents)
```sql
-- ============================================
-- DEALER INVOICES (Fatura PDF Dosyalari)
-- ============================================
-- Purpose: Store invoice PDF metadata, link to transactions and storage

CREATE TABLE dealer_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES dealer_transactions(id) ON DELETE SET NULL,

  -- Invoice identification
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,

  -- Amount (for reference, actual financials in transactions)
  total_amount DECIMAL(12,2) NOT NULL,

  -- File storage
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,          -- Supabase Storage path
  file_size INT NOT NULL,           -- bytes
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',

  -- Audit
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Dealer's invoices by date
CREATE INDEX idx_dealer_invoices_dealer_date
  ON dealer_invoices(dealer_id, invoice_date DESC);

-- Find invoice by number
CREATE INDEX idx_dealer_invoices_number
  ON dealer_invoices(invoice_number);

-- Link to transaction
CREATE INDEX idx_dealer_invoices_transaction
  ON dealer_invoices(transaction_id)
  WHERE transaction_id IS NOT NULL;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE dealer_invoices ENABLE ROW LEVEL SECURITY;

-- Dealers can read own invoices
CREATE POLICY "Dealers can read own invoices"
  ON dealer_invoices FOR SELECT
  TO authenticated
  USING (
    dealer_id IN (
      SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
    )
  );

-- Admins can manage all invoices
CREATE POLICY "Admins can manage dealer invoices"
  ON dealer_invoices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );
```

### Supabase Storage Configuration
```sql
-- ============================================
-- STORAGE BUCKET FOR INVOICES
-- ============================================

-- Create bucket (run via Supabase dashboard or CLI)
-- Name: dealer-invoices
-- Public: false (private bucket)
-- File size limit: 10MB
-- Allowed MIME types: application/pdf

-- Storage RLS Policies (applied to storage.objects)

-- Dealers can read their own invoice files
CREATE POLICY "Dealers can read own invoice files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'dealer-invoices'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM dealers WHERE user_id = (SELECT auth.uid())
    )
  );

-- Admins can manage all invoice files
CREATE POLICY "Admins can manage invoice files"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'dealer-invoices'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );
```

### Recommended Project Structure
```
src/
├── lib/actions/
│   └── financials.ts           # Server Actions for financials
├── components/financials/
│   ├── balance-summary.tsx     # Balance widget (toplam borc/alacak/net)
│   ├── transaction-list.tsx    # Transaction history table
│   ├── transaction-filters.tsx # Date range and type filters
│   ├── invoice-list.tsx        # Invoice list with download
│   └── payment-history.tsx     # Payment-specific view
├── components/admin/
│   └── financial/
│       ├── transaction-form.tsx    # Admin: create transaction
│       ├── invoice-upload.tsx      # Admin: upload invoice PDF
│       └── dealer-balance-card.tsx # Admin: dealer balance overview
└── app/
    ├── (dealer)/
    │   └── financials/
    │       ├── page.tsx            # Main financials page
    │       └── invoices/
    │           └── page.tsx        # Invoice list page
    └── (admin)/
        └── admin/
            └── dealers/
                └── [id]/
                    └── financials/
                        └── page.tsx  # Admin: dealer financials
```

### Pattern 1: Balance Calculation with Database Function
**What:** Use database function for balance calculation to ensure consistency across all queries.
**When to use:** Anywhere balance needs to be displayed (dashboard, financials page, admin view).
**Example:**
```typescript
// Source: Supabase RPC pattern from v1
// src/lib/actions/financials.ts
'use server'

import { createClient } from '@/lib/supabase/server'

interface DealerBalance {
  totalDebit: number   // Toplam Borc
  totalCredit: number  // Toplam Alacak
  netBalance: number   // Net Bakiye (positive = owes, negative = credit)
}

export async function getDealerBalance(): Promise<DealerBalance> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Get dealer ID
  const { data: dealer } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!dealer) throw new Error('Dealer not found')

  // Use database function for consistency
  const { data, error } = await supabase
    .rpc('get_dealer_balance_breakdown', { p_dealer_id: dealer.id })
    .single()

  if (error) throw new Error('Failed to fetch balance')

  return {
    totalDebit: data?.total_debit ?? 0,
    totalCredit: data?.total_credit ?? 0,
    netBalance: data?.net_balance ?? 0,
  }
}
```

### Pattern 2: Transaction History with Filtering
**What:** Fetch transactions with date range and type filters, paginated for performance.
**When to use:** Transaction list page with filters.
**Example:**
```typescript
// src/lib/actions/financials.ts
'use server'

import { createClient } from '@/lib/supabase/server'

export interface DealerTransaction {
  id: string
  amount: number
  description: string
  referenceNumber: string | null
  transactionDate: string
  dueDate: string | null
  notes: string | null
  createdAt: string
  transactionType: {
    code: string
    name: string
    balanceEffect: 'debit' | 'credit'
  }
  order: {
    id: string
    orderNumber: string
  } | null
}

interface TransactionFilters {
  startDate?: string
  endDate?: string
  typeCode?: string
  page?: number
  pageSize?: number
}

export async function getDealerTransactions(
  filters: TransactionFilters = {}
): Promise<{ transactions: DealerTransaction[]; totalCount: number }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: dealer } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!dealer) throw new Error('Dealer not found')

  const page = filters.page || 1
  const pageSize = filters.pageSize || 20
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('dealer_transactions')
    .select(`
      id,
      amount,
      description,
      reference_number,
      transaction_date,
      due_date,
      notes,
      created_at,
      transaction_type:transaction_types(
        code,
        name,
        balance_effect
      ),
      order:orders(
        id,
        order_number
      )
    `, { count: 'exact' })
    .eq('dealer_id', dealer.id)
    .order('transaction_date', { ascending: false })
    .range(offset, offset + pageSize - 1)

  // Apply date filters
  if (filters.startDate) {
    query = query.gte('transaction_date', filters.startDate)
  }
  if (filters.endDate) {
    query = query.lte('transaction_date', filters.endDate)
  }

  // Apply type filter (join query)
  if (filters.typeCode) {
    const { data: typeData } = await supabase
      .from('transaction_types')
      .select('id')
      .eq('code', filters.typeCode)
      .single()

    if (typeData) {
      query = query.eq('transaction_type_id', typeData.id)
    }
  }

  const { data, count, error } = await query

  if (error) throw new Error('Failed to fetch transactions')

  const transactions: DealerTransaction[] = (data || []).map((t: any) => ({
    id: t.id,
    amount: t.amount,
    description: t.description,
    referenceNumber: t.reference_number,
    transactionDate: t.transaction_date,
    dueDate: t.due_date,
    notes: t.notes,
    createdAt: t.created_at,
    transactionType: {
      code: t.transaction_type.code,
      name: t.transaction_type.name,
      balanceEffect: t.transaction_type.balance_effect,
    },
    order: t.order ? {
      id: t.order.id,
      orderNumber: t.order.order_number,
    } : null,
  }))

  return {
    transactions,
    totalCount: count || 0,
  }
}
```

### Pattern 3: Invoice PDF Upload (Admin)
**What:** Admin uploads invoice PDF to Supabase Storage, creates invoice record linked to transaction.
**When to use:** Admin creating invoice entry for a dealer.
**Example:**
```typescript
// src/lib/actions/financials.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const uploadInvoiceSchema = z.object({
  dealerId: z.string().uuid(),
  invoiceNumber: z.string().min(1),
  invoiceDate: z.string(), // ISO date string
  totalAmount: z.number().positive(),
  description: z.string().min(1),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
})

export async function uploadInvoice(
  formData: FormData
): Promise<{ success: boolean; error?: string; invoiceId?: string }> {
  const supabase = await createClient()

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum acmaniz gerekiyor' }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Bu islem icin yetkiniz yok' }
  }

  // Parse form data
  const file = formData.get('file') as File | null
  const rawData = {
    dealerId: formData.get('dealerId') as string,
    invoiceNumber: formData.get('invoiceNumber') as string,
    invoiceDate: formData.get('invoiceDate') as string,
    totalAmount: parseFloat(formData.get('totalAmount') as string),
    description: formData.get('description') as string,
    dueDate: formData.get('dueDate') as string | undefined,
    notes: formData.get('notes') as string | undefined,
  }

  // Validate
  const parsed = uploadInvoiceSchema.safeParse(rawData)
  if (!parsed.success) {
    return { success: false, error: 'Gecersiz veri: ' + parsed.error.message }
  }

  if (!file || file.type !== 'application/pdf') {
    return { success: false, error: 'Lutfen PDF dosyasi yukleyin' }
  }

  const data = parsed.data

  // Get invoice transaction type
  const { data: invoiceType } = await supabase
    .from('transaction_types')
    .select('id')
    .eq('code', 'invoice')
    .single()

  if (!invoiceType) {
    return { success: false, error: 'Islem tipi bulunamadi' }
  }

  // 1. Create transaction record
  const { data: transaction, error: txError } = await supabase
    .from('dealer_transactions')
    .insert({
      dealer_id: data.dealerId,
      transaction_type_id: invoiceType.id,
      amount: data.totalAmount,
      reference_number: data.invoiceNumber,
      description: data.description,
      transaction_date: data.invoiceDate,
      due_date: data.dueDate || null,
      notes: data.notes || null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (txError || !transaction) {
    return { success: false, error: 'Islem kaydi olusturulamadi' }
  }

  // 2. Upload file to storage
  const fileName = `${data.invoiceNumber}_${Date.now()}.pdf`
  const filePath = `${data.dealerId}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('dealer-invoices')
    .upload(filePath, file, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadError) {
    // Rollback transaction
    await supabase
      .from('dealer_transactions')
      .delete()
      .eq('id', transaction.id)
    return { success: false, error: 'Dosya yuklenemedi' }
  }

  // 3. Create invoice record
  const { data: invoice, error: invoiceError } = await supabase
    .from('dealer_invoices')
    .insert({
      dealer_id: data.dealerId,
      transaction_id: transaction.id,
      invoice_number: data.invoiceNumber,
      invoice_date: data.invoiceDate,
      total_amount: data.totalAmount,
      file_name: fileName,
      file_path: filePath,
      file_size: file.size,
      mime_type: 'application/pdf',
      uploaded_by: user.id,
    })
    .select('id')
    .single()

  if (invoiceError || !invoice) {
    // Rollback: delete file and transaction
    await supabase.storage.from('dealer-invoices').remove([filePath])
    await supabase.from('dealer_transactions').delete().eq('id', transaction.id)
    return { success: false, error: 'Fatura kaydi olusturulamadi' }
  }

  revalidatePath(`/admin/dealers/${data.dealerId}/financials`)

  return { success: true, invoiceId: invoice.id }
}
```

### Pattern 4: Invoice PDF Download with Signed URL
**What:** Generate signed URL for secure PDF download.
**When to use:** Dealer downloading their invoice.
**Example:**
```typescript
// src/lib/actions/financials.ts
'use server'

import { createClient } from '@/lib/supabase/server'

export async function getInvoiceDownloadUrl(
  invoiceId: string
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Get dealer ID
  const { data: dealer } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!dealer) return { error: 'Dealer not found' }

  // Get invoice (RLS will ensure dealer ownership)
  const { data: invoice, error } = await supabase
    .from('dealer_invoices')
    .select('file_path, file_name')
    .eq('id', invoiceId)
    .eq('dealer_id', dealer.id) // Extra safety check
    .single()

  if (error || !invoice) {
    return { error: 'Fatura bulunamadi' }
  }

  // Generate signed URL (valid for 1 hour)
  const { data: signedUrl, error: urlError } = await supabase.storage
    .from('dealer-invoices')
    .createSignedUrl(invoice.file_path, 3600) // 1 hour

  if (urlError || !signedUrl) {
    return { error: 'Download link olusturulamadi' }
  }

  return { url: signedUrl.signedUrl }
}
```

### Pattern 5: Admin Transaction Entry
**What:** Admin creates any transaction type (payment, adjustment) for a dealer.
**When to use:** Recording payments, credit/debit adjustments.
**Example:**
```typescript
// src/lib/actions/financials.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createTransactionSchema = z.object({
  dealerId: z.string().uuid(),
  transactionTypeCode: z.enum(['payment', 'credit_note', 'debit_note', 'opening_balance']),
  amount: z.number().positive(),
  description: z.string().min(1),
  referenceNumber: z.string().optional(),
  transactionDate: z.string(),
  notes: z.string().optional(),
})

export async function createDealerTransaction(
  input: z.infer<typeof createTransactionSchema>
): Promise<{ success: boolean; error?: string; transactionId?: string }> {
  const supabase = await createClient()

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum acmaniz gerekiyor' }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Bu islem icin yetkiniz yok' }
  }

  // Validate input
  const parsed = createTransactionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Gecersiz veri' }
  }

  const data = parsed.data

  // Get transaction type
  const { data: txType } = await supabase
    .from('transaction_types')
    .select('id')
    .eq('code', data.transactionTypeCode)
    .single()

  if (!txType) {
    return { success: false, error: 'Gecersiz islem tipi' }
  }

  // Create transaction
  const { data: transaction, error } = await supabase
    .from('dealer_transactions')
    .insert({
      dealer_id: data.dealerId,
      transaction_type_id: txType.id,
      amount: data.amount,
      description: data.description,
      reference_number: data.referenceNumber || null,
      transaction_date: data.transactionDate,
      notes: data.notes || null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !transaction) {
    return { success: false, error: 'Islem olusturulamadi' }
  }

  revalidatePath(`/admin/dealers/${data.dealerId}/financials`)

  return { success: true, transactionId: transaction.id }
}
```

### Anti-Patterns to Avoid
- **Storing balance as a column on dealers table:** Violates single source of truth, leads to sync issues. Use `get_dealer_balance()` function.
- **Using FLOAT for monetary values:** Always use DECIMAL(12,2) for financial data to avoid rounding errors.
- **Missing invoice_number uniqueness:** Add unique constraint within dealer scope if required by business rules.
- **Allowing negative amounts in transactions:** Amount should always be positive; balance_effect determines direction.
- **Hardcoding transaction types:** Use lookup table for extensibility and Turkish localization.
- **Not linking invoices to transactions:** Every invoice should have a corresponding transaction for accurate balance.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Balance calculation | Application-level SUM with conditionals | Database function `get_dealer_balance()` | Single source of truth, consistent across all queries |
| PDF signed URLs | Custom token generation | Supabase Storage `createSignedUrl()` | Handles expiration, security, URL signing |
| File upload validation | Manual size/type checks | Supabase Storage policies + Zod validation | Server-side enforcement, no bypass possible |
| Date range queries | Application-level filtering | PostgreSQL date comparisons with indexes | Index-optimized, handles timezone properly |
| Decimal formatting | Manual number formatting | Intl.NumberFormat with 'tr-TR' locale | Handles Turkish number formatting correctly |

**Key insight:** Financial data requires strict consistency. Database functions ensure balance calculations are identical everywhere. Supabase Storage handles file security without custom code.

## Common Pitfalls

### Pitfall 1: Balance Inconsistency Between Views
**What goes wrong:** Dashboard shows different balance than financials page due to different calculation logic.
**Why it happens:** Multiple application-level balance calculations with slight differences.
**How to avoid:**
- Always use `get_dealer_balance()` or `get_dealer_balance_breakdown()` database functions
- Never calculate balance in application code
- Use single Server Action that calls the function
**Warning signs:** User reports "balance doesn't match", different amounts in different places

### Pitfall 2: Floating Point Errors in Monetary Calculations
**What goes wrong:** Transaction of 1000.10 TL + 2000.20 TL = 3000.299999999 TL
**Why it happens:** Using FLOAT or JavaScript number for monetary values.
**How to avoid:**
- Use DECIMAL(12,2) in database
- Store amounts in cents (integer) if doing JS calculations
- Use Intl.NumberFormat for display only
**Warning signs:** Penny discrepancies, balances off by small amounts

### Pitfall 3: Storage RLS Bypass via Direct URL
**What goes wrong:** Dealer shares invoice URL, another dealer can access it.
**Why it happens:** Using public URLs instead of signed URLs.
**How to avoid:**
- Always use `createSignedUrl()` with short expiration (1 hour)
- Never store or share raw storage paths
- Verify ownership before generating signed URL
**Warning signs:** Public bucket warning in Supabase, URLs work without auth

### Pitfall 4: Missing Audit Trail
**What goes wrong:** Cannot determine who entered a transaction or when it was modified.
**Why it happens:** Not storing `created_by` or not having `updated_at` triggers.
**How to avoid:**
- Always populate `created_by` with admin user ID
- Use `updated_at` trigger (already exists from v1)
- Consider adding `updated_by` for modifications
**Warning signs:** Disputes about transaction entries, no way to investigate

### Pitfall 5: Transaction Rollback Failures
**What goes wrong:** File uploaded but transaction creation fails, orphaned file in storage.
**Why it happens:** Not implementing proper rollback when multi-step operation fails.
**How to avoid:**
- Create database record first
- Upload file second
- Create metadata record third
- Rollback in reverse order on failure (see Pattern 3)
**Warning signs:** Files in storage without database records, failed uploads leaving partial data

### Pitfall 6: Date Timezone Issues
**What goes wrong:** Transaction entered on Feb 9 appears on Feb 8 or Feb 10.
**Why it happens:** Mixing timezones between client, server, and database.
**How to avoid:**
- Use DATE type for transaction_date (no time component)
- Use TIMESTAMPTZ for created_at (includes timezone)
- Always display dates in user's locale with date-fns
**Warning signs:** Transactions appearing on wrong dates, end-of-month reports missing items

## Code Examples

### Balance Summary Component
```typescript
// src/components/financials/balance-summary.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react'

interface BalanceSummaryProps {
  totalDebit: number
  totalCredit: number
  netBalance: number
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(amount)
}

export function BalanceSummary({
  totalDebit,
  totalCredit,
  netBalance,
}: BalanceSummaryProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Toplam Borc</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(totalDebit)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Toplam Alacak</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(totalCredit)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Net Bakiye</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${
            netBalance > 0 ? 'text-red-600' : netBalance < 0 ? 'text-green-600' : ''
          }`}>
            {formatCurrency(Math.abs(netBalance))}
            {netBalance > 0 && <span className="text-sm ml-1">(Borc)</span>}
            {netBalance < 0 && <span className="text-sm ml-1">(Alacak)</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Transaction List Component
```typescript
// src/components/financials/transaction-list.tsx
'use client'

import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { Download, FileText, Receipt, CreditCard } from 'lucide-react'
import { DealerTransaction } from '@/lib/actions/financials'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(amount)
}

const formatDate = (dateString: string) => {
  return format(new Date(dateString), 'dd MMM yyyy', { locale: tr })
}

const getTransactionIcon = (code: string) => {
  switch (code) {
    case 'invoice':
      return <FileText className="h-4 w-4" />
    case 'payment':
      return <CreditCard className="h-4 w-4" />
    default:
      return <Receipt className="h-4 w-4" />
  }
}

const getTransactionBadge = (
  code: string,
  name: string,
  balanceEffect: 'debit' | 'credit'
) => {
  const variant = balanceEffect === 'debit' ? 'destructive' : 'default'
  return <Badge variant={variant}>{name}</Badge>
}

interface TransactionListProps {
  transactions: DealerTransaction[]
  onDownloadInvoice?: (transactionId: string) => void
}

export function TransactionList({
  transactions,
  onDownloadInvoice,
}: TransactionListProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tarih</TableHead>
          <TableHead>Tip</TableHead>
          <TableHead>Aciklama</TableHead>
          <TableHead>Referans</TableHead>
          <TableHead className="text-right">Tutar</TableHead>
          <TableHead className="text-center">Islem</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((tx) => (
          <TableRow key={tx.id}>
            <TableCell className="font-medium">
              {formatDate(tx.transactionDate)}
              {tx.dueDate && (
                <div className="text-xs text-muted-foreground">
                  Vade: {formatDate(tx.dueDate)}
                </div>
              )}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {getTransactionIcon(tx.transactionType.code)}
                {getTransactionBadge(
                  tx.transactionType.code,
                  tx.transactionType.name,
                  tx.transactionType.balanceEffect
                )}
              </div>
            </TableCell>
            <TableCell>
              <div>{tx.description}</div>
              {tx.order && (
                <div className="text-xs text-muted-foreground">
                  Siparis: {tx.order.orderNumber}
                </div>
              )}
            </TableCell>
            <TableCell className="font-mono text-sm">
              {tx.referenceNumber || '-'}
            </TableCell>
            <TableCell className={`text-right font-medium ${
              tx.transactionType.balanceEffect === 'debit'
                ? 'text-red-600'
                : 'text-green-600'
            }`}>
              {tx.transactionType.balanceEffect === 'debit' ? '+' : '-'}
              {formatCurrency(tx.amount)}
            </TableCell>
            <TableCell className="text-center">
              {tx.transactionType.code === 'invoice' && onDownloadInvoice && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDownloadInvoice(tx.id)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Balance column on dealer table | Calculated balance via DB function | Standard practice | Eliminates sync issues, single source of truth |
| FLOAT for money | DECIMAL(12,2) | Always | Prevents rounding errors |
| Public file URLs | Signed URLs with expiration | Supabase Storage standard | Security, access control |
| Manual file handling | Supabase Storage with RLS | Supabase 2.0 | Integrated auth, automatic policies |

**Deprecated/outdated:**
- **Storing PDFs as base64 in database:** Use dedicated storage (Supabase Storage)
- **Application-level balance tracking:** Use database functions for consistency
- **Manual RLS implementation:** Supabase RLS handles multi-tenant isolation

## Open Questions

Things that couldn't be fully resolved:

1. **Should orders automatically create invoice transactions?**
   - What we know: Current order system doesn't create financial entries
   - What's unclear: Business process - when does invoice get issued?
   - Recommendation: Keep manual for v2.0, consider automation trigger in v3 with ERP sync

2. **Multiple currencies support?**
   - What we know: Current schema assumes TRY only
   - What's unclear: Will dealers ever have USD/EUR transactions?
   - Recommendation: Add optional `currency` column as TEXT DEFAULT 'TRY' for future-proofing

3. **Invoice PDF generation vs upload?**
   - What we know: FIN-06 specifies admin uploads PDF
   - What's unclear: Should system generate standardized invoices?
   - Recommendation: Keep upload-only for v2.0, auto-generation is Phase 8+ feature

4. **Integration with existing orders for debt tracking?**
   - What we know: Orders have total_amount that represents dealer debt
   - What's unclear: Should completing an order auto-create transaction?
   - Recommendation: Manual transaction creation for now, allows flexible timing (invoice after shipment)

## Sources

### Primary (HIGH confidence)
- **Supabase RLS Official Docs:** https://supabase.com/docs/guides/database/postgres/row-level-security - RLS patterns, policy examples
- **Supabase Storage Docs:** https://supabase.com/docs/guides/storage - Signed URLs, RLS policies
- **PostgreSQL DECIMAL Docs:** https://www.postgresql.org/docs/current/datatype-numeric.html - Numeric precision for financial data
- **v1 Codebase:** Verified existing patterns in supabase/migrations/, src/lib/actions/

### Secondary (MEDIUM confidence)
- **.planning/research/ARCHITECTURE.md:** v2.0 architecture research with dealer_transactions schema
- **Turkish Accounting Terminology:** Standard B2B terminology (fatura, odeme, cari hesap)
- **Supabase Storage Access Control:** https://supabase.com/docs/guides/storage/security/access-control

### Tertiary (LOW confidence)
- **ERP Integration Patterns:** General double-entry accounting principles applied to B2B context

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in v1, Supabase Storage well-documented
- Architecture: HIGH - Based on existing v1 patterns and ARCHITECTURE.md research
- Pitfalls: HIGH - Financial data handling well-documented, common issues known
- Code examples: HIGH - Based on v1 existing patterns, verified against Supabase docs

**Research date:** 2026-02-09
**Valid until:** 2026-03-11 (30 days, stable ecosystem)

**Notes:**
- Schema designed to be ERP-ready for future automated sync (reference_number, transaction types)
- All transaction types use Turkish names for UI display (Fatura, Odeme, etc.)
- Storage bucket uses dealer-scoped folders for RLS efficiency
- Balance always calculated via database function for consistency
