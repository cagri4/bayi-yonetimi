-- ============================================
-- Dealer Favorites Feature
-- ============================================
-- Purpose: Enable dealers to save favorite products with multi-tenant isolation
-- Pattern: Extends v1 RLS patterns from 001_initial_schema.sql

-- ============================================
-- TABLES
-- ============================================

-- Dealer favorites junction table
CREATE TABLE dealer_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dealer_id, product_id)
);

-- ============================================
-- INDEXES (Critical for RLS performance)
-- ============================================

-- Composite index for toggle checks and dealer's favorites list queries
CREATE INDEX idx_dealer_favorites_dealer_product ON dealer_favorites(dealer_id, product_id);

-- Index for "most favorited products" queries (future analytics)
CREATE INDEX idx_dealer_favorites_product_id ON dealer_favorites(product_id);

-- Index for sorting by creation time
CREATE INDEX idx_dealer_favorites_created_at ON dealer_favorites(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE dealer_favorites ENABLE ROW LEVEL SECURITY;

-- Dealers can view own favorites
-- Uses wrapped (SELECT auth.uid()) pattern for 94-99% RLS performance improvement
CREATE POLICY "Dealers can view own favorites"
  ON dealer_favorites FOR SELECT
  TO authenticated
  USING (
    dealer_id IN (
      SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
    )
  );

-- Dealers can add favorites
CREATE POLICY "Dealers can add favorites"
  ON dealer_favorites FOR INSERT
  TO authenticated
  WITH CHECK (
    dealer_id IN (
      SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
    )
  );

-- Dealers can remove favorites
CREATE POLICY "Dealers can remove favorites"
  ON dealer_favorites FOR DELETE
  TO authenticated
  USING (
    dealer_id IN (
      SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
    )
  );

-- Admins can manage all favorites (for support/debugging)
CREATE POLICY "Admins can manage favorites"
  ON dealer_favorites FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );
