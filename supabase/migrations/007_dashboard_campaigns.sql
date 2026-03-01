-- ============================================
-- Phase 06-01: Dashboard, Campaigns & Order Documents
-- Dealer Dashboard, Content Management, Enhanced Order Documentation
-- ============================================

-- ============================================
-- CAMPAIGNS
-- ============================================
-- Purpose: Marketing campaigns with date-based activation
-- Pattern: Campaign-to-products many-to-many relationship

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign-Product Junction Table (many-to-many)
CREATE TABLE campaign_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  discount_percent DECIMAL(5,2),  -- Optional per-product discount
  UNIQUE(campaign_id, product_id)
);

-- ============================================
-- ANNOUNCEMENTS
-- ============================================
-- Purpose: Admin announcements with read receipt tracking
-- Pattern: Announcement-to-dealer reads junction table

CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority INTEGER DEFAULT 0,  -- Higher = more prominent
  is_active BOOLEAN DEFAULT true,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Announcement Read Receipts Junction Table
CREATE TABLE announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(announcement_id, dealer_id)
);

-- ============================================
-- ORDER DOCUMENTS
-- ============================================
-- Purpose: Store invoice/irsaliye PDF metadata linked to orders
-- Pattern: File storage reference with metadata tracking

CREATE TABLE order_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'irsaliye')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,  -- Supabase Storage path
  file_size INTEGER NOT NULL,
  mime_type TEXT DEFAULT 'application/pdf',
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORDERS TABLE ENHANCEMENTS (Cargo Tracking)
-- ============================================
-- Purpose: Add cargo/shipment tracking fields to existing orders table

ALTER TABLE orders ADD COLUMN vehicle_plate TEXT;
ALTER TABLE orders ADD COLUMN driver_name TEXT;
ALTER TABLE orders ADD COLUMN driver_phone TEXT;
ALTER TABLE orders ADD COLUMN cargo_notes TEXT;

-- ============================================
-- MATERIALIZED VIEW: Dealer Spending Summary
-- ============================================
-- Purpose: Pre-computed monthly spending aggregations for dashboard performance
-- Pattern: Aggregates from Phase 5 dealer_transactions table

CREATE MATERIALIZED VIEW dealer_spending_summary AS
SELECT
  d.id as dealer_id,
  d.company_name,
  DATE_TRUNC('month', dt.transaction_date)::date as month,
  COALESCE(SUM(dt.amount) FILTER (WHERE tt.balance_effect = 'debit'), 0) as total_debit,
  COALESCE(SUM(dt.amount) FILTER (WHERE tt.balance_effect = 'credit'), 0) as total_credit,
  COALESCE(SUM(
    CASE
      WHEN tt.balance_effect = 'debit' THEN dt.amount
      ELSE -dt.amount
    END
  ), 0) as net_balance
FROM dealers d
LEFT JOIN dealer_transactions dt ON dt.dealer_id = d.id
LEFT JOIN transaction_types tt ON tt.id = dt.transaction_type_id
GROUP BY d.id, d.company_name, DATE_TRUNC('month', dt.transaction_date);

-- ============================================
-- RPC FUNCTION: Get Top Products for Dealer
-- ============================================
-- Purpose: Aggregates most-ordered products for dealer dashboard widget
-- Returns: product details with order statistics

CREATE OR REPLACE FUNCTION get_top_products_for_dealer(
  p_dealer_id UUID,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  product_code TEXT,
  total_quantity BIGINT,
  order_count BIGINT
) AS $$
  SELECT
    p.id as product_id,
    p.name as product_name,
    p.code as product_code,
    SUM(oi.quantity) as total_quantity,
    COUNT(DISTINCT oi.order_id) as order_count
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  JOIN orders o ON o.id = oi.order_id
  WHERE o.dealer_id = p_dealer_id
  GROUP BY p.id, p.name, p.code
  ORDER BY total_quantity DESC
  LIMIT p_limit;
$$ LANGUAGE sql STABLE;

-- ============================================
-- INDEXES (Critical for query performance)
-- ============================================

-- Campaign active date filtering (composite index for date range queries)
CREATE INDEX idx_campaigns_active_dates
  ON campaigns(is_active, start_date, end_date)
  WHERE is_active = true;

-- Campaign-product junction lookups
CREATE INDEX idx_campaign_products_campaign
  ON campaign_products(campaign_id);
CREATE INDEX idx_campaign_products_product
  ON campaign_products(product_id);

-- Active announcements with publication date ordering
CREATE INDEX idx_announcements_active_published
  ON announcements(is_active, published_at DESC)
  WHERE is_active = true;

-- Announcement read receipts by dealer and announcement
CREATE INDEX idx_announcement_reads_dealer
  ON announcement_reads(dealer_id);
CREATE INDEX idx_announcement_reads_announcement
  ON announcement_reads(announcement_id);

-- Order documents by order
CREATE INDEX idx_order_documents_order
  ON order_documents(order_id);

-- Materialized view index for fast dealer lookup
CREATE UNIQUE INDEX idx_dealer_spending_dealer_month
  ON dealer_spending_summary(dealer_id, month DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_documents ENABLE ROW LEVEL SECURITY;

-- Campaigns: All authenticated users can view active campaigns
CREATE POLICY "Authenticated can read active campaigns"
  ON campaigns FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admins can manage all campaigns
CREATE POLICY "Admins can manage campaigns"
  ON campaigns FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- Campaign Products: All authenticated users can view
CREATE POLICY "Authenticated can read campaign products"
  ON campaign_products FOR SELECT
  TO authenticated
  USING (true);

-- Admins can manage campaign products
CREATE POLICY "Admins can manage campaign products"
  ON campaign_products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- Announcements: All authenticated users can view active, non-expired announcements
CREATE POLICY "Authenticated can read active announcements"
  ON announcements FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND published_at IS NOT NULL
    AND published_at <= NOW()
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- Admins can manage all announcements
CREATE POLICY "Admins can manage announcements"
  ON announcements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- Announcement Reads: Dealers can view and insert own read receipts
CREATE POLICY "Dealers can read own announcement reads"
  ON announcement_reads FOR SELECT
  TO authenticated
  USING (
    dealer_id IN (
      SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Dealers can insert own announcement reads"
  ON announcement_reads FOR INSERT
  TO authenticated
  WITH CHECK (
    dealer_id IN (
      SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
    )
  );

-- Order Documents: Dealers can view own order documents
CREATE POLICY "Dealers can read own order documents"
  ON order_documents FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE dealer_id IN (
        SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
      )
    )
  );

-- Admins can manage all order documents
CREATE POLICY "Admins can manage order documents"
  ON order_documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- ============================================
-- STORAGE BUCKET RLS POLICIES
-- ============================================
-- Note: Storage bucket 'order-documents' must be created via Supabase Dashboard or CLI
-- Configuration: Private bucket, 5MB limit per file, PDF only

-- Dealers can read own order document files (path structure: order-docs/{order_id}/{filename})
CREATE POLICY "Dealers can read own order document files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'order-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT o.id::text
      FROM orders o
      JOIN dealers d ON d.id = o.dealer_id
      WHERE d.user_id = (SELECT auth.uid())
    )
  );

-- Admins can upload/update/delete all order document files
CREATE POLICY "Admins can manage order document files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'order-documents'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update order document files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'order-documents'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete order document files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'order-documents'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Apply updated_at trigger to campaigns
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to announcements
CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS (Documentation for future maintenance)
-- ============================================

COMMENT ON MATERIALIZED VIEW dealer_spending_summary IS
  'Pre-computed monthly spending aggregations for dealer dashboard.
   Refresh strategy: Use pg_cron every 10 minutes OR trigger refresh after transaction INSERT.
   Refresh command: REFRESH MATERIALIZED VIEW CONCURRENTLY dealer_spending_summary;';

COMMENT ON FUNCTION get_top_products_for_dealer IS
  'Returns top N most-ordered products for a dealer, aggregated from order_items.
   Used for dealer dashboard "Top Products" widget.';

COMMENT ON TABLE order_documents IS
  'Metadata for order-related PDF documents (invoices, irsaliye).
   Actual files stored in Supabase Storage bucket "order-documents".
   Path pattern: order-docs/{order_id}/{timestamp}-{document_type}.pdf';
