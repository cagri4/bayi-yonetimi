-- ============================================
-- Phase 05-01: Financial Backbone - Database Schema
-- B2B Dealer Financial Tracking (Cari Hesap)
-- ============================================

-- ============================================
-- LOOKUP TABLES
-- ============================================

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

-- Insert standard transaction types (Turkish terminology)
INSERT INTO transaction_types (code, name, balance_effect, display_order) VALUES
  ('invoice', 'Fatura', 'debit', 1),              -- Invoice = borc (dealer owes)
  ('payment', 'Odeme', 'credit', 2),              -- Payment = alacak (dealer paid)
  ('credit_note', 'Alacak Dekontu', 'credit', 3), -- Credit adjustment
  ('debit_note', 'Borc Dekontu', 'debit', 4),     -- Debit adjustment
  ('opening_balance', 'Acilis Bakiyesi', 'debit', 5); -- Opening balance entry

-- ============================================
-- DEALER TRANSACTIONS (Cari Hesap Hareketleri)
-- ============================================
-- Purpose: ERP-ready financial transaction ledger for dealer accounts
-- Pattern: Double-entry inspired with debit/credit balance effects

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
-- INDEXES (Critical for query performance)
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
-- BALANCE CALCULATION FUNCTIONS
-- ============================================
-- Returns: positive = dealer owes (borc), negative = dealer has credit (alacak)

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

ALTER TABLE transaction_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_invoices ENABLE ROW LEVEL SECURITY;

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

-- ============================================
-- TRIGGERS
-- ============================================

-- Apply updated_at trigger to dealer_transactions
CREATE TRIGGER update_dealer_transactions_updated_at
  BEFORE UPDATE ON dealer_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STORAGE BUCKET POLICIES
-- ============================================
-- Note: Bucket 'dealer-invoices' must be created via Supabase Dashboard or CLI
-- Configuration: Private bucket, 10MB limit, PDF only

-- Dealers can read own invoice files (folder structure: {dealer_id}/filename.pdf)
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
