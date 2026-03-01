-- ============================================
-- Phase 07-01: Support & Reports - Database Schema
-- Dealer Support Messaging, FAQ, Product Requests
-- ============================================

-- ============================================
-- SUPPORT MESSAGES
-- ============================================
-- Purpose: Async dealer-admin messaging with category and reply tracking
-- Pattern: Single-level messaging (not threaded); admin replies atomically update status

CREATE TABLE support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,

  -- Message content
  subject TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('siparis', 'urun', 'odeme', 'teknik', 'diger')),
  body TEXT NOT NULL,

  -- Status and admin reply (atomic update: status + reply_body set together)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered')),
  reply_body TEXT,                         -- nullable until admin replies
  replied_at TIMESTAMPTZ,                  -- nullable, set when admin replies
  replied_by UUID REFERENCES users(id),    -- nullable, admin user who replied

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FAQ CATEGORIES
-- ============================================
-- Purpose: Organize FAQ items into browsable sections
-- Pattern: Global content, no dealer_id — all dealers see same FAQ

CREATE TABLE faq_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FAQ ITEMS
-- ============================================
-- Purpose: Individual Q&A items organized under categories

CREATE TABLE faq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES faq_categories(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRODUCT REQUESTS
-- ============================================
-- Purpose: Dealers request out-of-stock or new catalog products
-- Pattern: product_id nullable — dealer may request item not yet in catalog

CREATE TABLE product_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL, -- nullable: product may not exist in catalog yet

  -- Captured at request time so records survive product deletion
  product_name TEXT NOT NULL,
  product_code TEXT,                       -- nullable

  requested_quantity INT NOT NULL DEFAULT 1,
  notes TEXT,                              -- nullable, dealer's additional context

  -- Status workflow: open -> in_review -> fulfilled | rejected
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'fulfilled', 'rejected')),
  admin_notes TEXT,                        -- nullable, admin response

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES (Critical for query performance)
-- ============================================

-- support_messages: dealer message history (primary dealer access pattern)
CREATE INDEX idx_support_messages_dealer_date
  ON support_messages(dealer_id, created_at DESC);

-- support_messages: admin inbox filtered by status (primary admin access pattern)
CREATE INDEX idx_support_messages_status_date
  ON support_messages(status, created_at DESC);

-- faq_categories: active categories ordered for display
CREATE INDEX idx_faq_categories_active_order
  ON faq_categories(is_active, display_order)
  WHERE is_active = true;

-- faq_items: items per category ordered for display
CREATE INDEX idx_faq_items_category_order
  ON faq_items(category_id, display_order);

-- product_requests: dealer request history
CREATE INDEX idx_product_requests_dealer_date
  ON product_requests(dealer_id, created_at DESC);

-- product_requests: admin review queue filtered by status
CREATE INDEX idx_product_requests_status_date
  ON product_requests(status, created_at DESC);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
-- Reuse update_updated_at_column() function established in earlier migrations

CREATE TRIGGER update_support_messages_updated_at
  BEFORE UPDATE ON support_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_faq_items_updated_at
  BEFORE UPDATE ON faq_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_requests_updated_at
  BEFORE UPDATE ON product_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SUPPORT MESSAGES RLS POLICIES
-- ============================================

-- Dealers can read own messages (filtered by their dealer record)
CREATE POLICY "Dealers can read own support messages"
  ON support_messages FOR SELECT
  TO authenticated
  USING (
    dealer_id IN (
      SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
    )
  );

-- Dealers can insert own messages
CREATE POLICY "Dealers can insert own support messages"
  ON support_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    dealer_id IN (
      SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
    )
  );

-- Admins can read all messages
CREATE POLICY "Admins can read all support messages"
  ON support_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- Admins can update messages (for replying and status changes)
CREATE POLICY "Admins can update support messages"
  ON support_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- ============================================
-- FAQ CATEGORIES RLS POLICIES
-- ============================================

-- All authenticated users can read active FAQ categories
CREATE POLICY "Authenticated can read active faq categories"
  ON faq_categories FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admins can manage all FAQ categories
CREATE POLICY "Admins can manage faq categories"
  ON faq_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- ============================================
-- FAQ ITEMS RLS POLICIES
-- ============================================

-- All authenticated users can read active FAQ items
CREATE POLICY "Authenticated can read active faq items"
  ON faq_items FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admins can manage all FAQ items
CREATE POLICY "Admins can manage faq items"
  ON faq_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- ============================================
-- PRODUCT REQUESTS RLS POLICIES
-- ============================================

-- Dealers can read own product requests
CREATE POLICY "Dealers can read own product requests"
  ON product_requests FOR SELECT
  TO authenticated
  USING (
    dealer_id IN (
      SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
    )
  );

-- Dealers can insert own product requests
CREATE POLICY "Dealers can insert own product requests"
  ON product_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    dealer_id IN (
      SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
    )
  );

-- Admins can read all product requests
CREATE POLICY "Admins can read all product requests"
  ON product_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- Admins can update product requests (status, admin_notes)
CREATE POLICY "Admins can update product requests"
  ON product_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- ============================================
-- REALTIME PUBLICATION FOR SUPPORT MESSAGES
-- ============================================
-- Required for SUP-05: admin receives real-time INSERT events when dealer submits a message
-- Pattern: Same as orders table in migration 002_realtime_setup.sql

-- Grant SELECT permissions to supabase_realtime role
DO $$
BEGIN
  EXECUTE 'GRANT SELECT ON support_messages TO supabase_realtime';
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'supabase_realtime role not found, skipping grant';
END $$;

-- Add support_messages to supabase_realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'support_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
  END IF;
END $$;

-- ============================================
-- SEED DATA: FAQ Categories and Example Items
-- ============================================
-- Placeholder FAQ content for admin to replace with actual content

INSERT INTO faq_categories (name, display_order) VALUES
  ('Siparis', 1),
  ('Odeme', 2),
  ('Urun', 3);

INSERT INTO faq_items (category_id, question, answer, display_order)
SELECT
  c.id,
  'Siparisim ne zaman teslim edilir?',
  'Siparisler genellikle 2-3 is gunu icinde teslim edilir. Kargo takip bilgisi siparis sayfanizda gorunecektir.',
  1
FROM faq_categories c WHERE c.name = 'Siparis';

INSERT INTO faq_items (category_id, question, answer, display_order)
SELECT
  c.id,
  'Siparis iptal edebilir miyim?',
  'Siparis onaylanmadan once iptal edilebilir. Onaylanan siparisler icin lutfen bizimle iletisime gecin.',
  2
FROM faq_categories c WHERE c.name = 'Siparis';

INSERT INTO faq_items (category_id, question, answer, display_order)
SELECT
  c.id,
  'Hangi odeme yontemlerini kabul ediyorsunuz?',
  'Banka havalesi ve EFT ile odeme kabul ediyoruz. Hesap bilgileri fatura ile birlikte gonderilmektedir.',
  1
FROM faq_categories c WHERE c.name = 'Odeme';

INSERT INTO faq_items (category_id, question, answer, display_order)
SELECT
  c.id,
  'Stokta olmayan urun icin ne yapmaliyim?',
  'Urun talebi formu araciligiyla stok talebinizi iletebilirsiniz. En kisa surede bilgilendirme yapilacaktir.',
  1
FROM faq_categories c WHERE c.name = 'Urun';

-- ============================================
-- COMMENTS (Documentation for future maintenance)
-- ============================================

COMMENT ON TABLE support_messages IS
  'Async dealer-admin support messaging. Single-level (not threaded).
   Reply: admin updates reply_body + replied_at + replied_by + status atomically.
   Realtime: added to supabase_realtime publication for admin INSERT notifications.';

COMMENT ON TABLE faq_categories IS
  'Global FAQ category groupings. No dealer_id — all dealers see the same FAQ.
   Admin manages content; dealers read-only.';

COMMENT ON TABLE faq_items IS
  'Individual Q&A items linked to faq_categories.
   Ordered by display_order within each category.';

COMMENT ON TABLE product_requests IS
  'Dealer requests for out-of-stock or new catalog products.
   product_id is nullable: dealer may request a product not yet in catalog.
   product_name captures the requested product name even if product is later deleted.';

COMMENT ON COLUMN support_messages.reply_body IS
  'Admin reply content. Set atomically with status=answered, replied_at, and replied_by in a single UPDATE.
   NULL when status=pending.';

COMMENT ON COLUMN product_requests.product_id IS
  'Optional FK to products table. NULL when dealer requests an item not yet in catalog.
   ON DELETE SET NULL preserves request history if product is later removed.';
