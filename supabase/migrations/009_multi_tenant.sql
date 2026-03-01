-- ============================================
-- 009_multi_tenant.sql
-- Multi-Tenant Foundation Migration
-- B2B Bayi Yonetimi — v3.0 Phase 8
--
-- EXECUTION: Paste each BLOCK separately in Supabase Dashboard SQL Editor.
-- Blocks must be executed in order (1 → 10).
-- Verify each block succeeds before proceeding to the next.
-- ============================================


-- ============================================
-- BLOCK 1: companies table (root tenant anchor)
-- Paste this block first in Supabase Dashboard SQL Editor
-- ============================================

CREATE TABLE companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
  is_active   BOOLEAN DEFAULT true,
  settings    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;


-- ============================================
-- BLOCK 2: Core security functions
-- current_company_id(), is_company_admin(), is_superadmin()
-- ============================================

-- Reads company_id from JWT (injected by Custom Access Token Hook)
-- Returns NULL for superadmin (no company scoping)
CREATE OR REPLACE FUNCTION current_company_id()
RETURNS UUID AS $$
  SELECT NULLIF(auth.jwt() ->> 'company_id', '')::UUID
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION current_company_id() TO authenticated;

-- True if current user is role='admin' AND has a company claim (not superadmin)
CREATE OR REPLACE FUNCTION is_company_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
  ) AND current_company_id() IS NOT NULL
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_company_admin() TO authenticated;

-- True if current user is role='superadmin' (platform operator, bypasses company scoping)
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = (SELECT auth.uid())
      AND role = 'superadmin'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_superadmin() TO authenticated;


-- ============================================
-- BLOCK 3: JWT injection hook function
-- inject_company_claim() — registered in Supabase Dashboard > Auth > Hooks
-- ============================================

CREATE OR REPLACE FUNCTION public.inject_company_claim(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id UUID;
  v_user_role  TEXT;
  v_claims     JSONB;
BEGIN
  -- Get the user's role
  SELECT role INTO v_user_role
  FROM users u
  WHERE u.id = (event->>'user_id')::UUID;

  -- Resolve company_id: first from users.company_id (admins), then from dealers table
  SELECT u.company_id INTO v_company_id
  FROM users u
  WHERE u.id = (event->>'user_id')::UUID
    AND u.company_id IS NOT NULL;

  IF v_company_id IS NULL THEN
    -- Fallback: find company via dealers table (dealer users)
    SELECT d.company_id INTO v_company_id
    FROM dealers d
    JOIN users u ON d.user_id = u.id
    WHERE u.id = (event->>'user_id')::UUID
    LIMIT 1;
  END IF;

  v_claims := event->'claims';

  -- Inject company_id (NULL for superadmin — no claim set, bypasses company scoping)
  IF v_company_id IS NOT NULL THEN
    v_claims := jsonb_set(v_claims, '{company_id}', to_jsonb(v_company_id::TEXT));
  END IF;

  -- Inject user_role for client-side role detection
  IF v_user_role IS NOT NULL THEN
    v_claims := jsonb_set(v_claims, '{user_role}', to_jsonb(v_user_role));
  END IF;

  RETURN jsonb_set(event, '{claims}', v_claims);
END;
$$;

-- Required grants so Supabase auth system can call this function
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.inject_company_claim(JSONB) TO supabase_auth_admin;

-- Revoke from regular roles (security hardening)
REVOKE EXECUTE ON FUNCTION public.inject_company_claim(JSONB) FROM anon, authenticated, public;


-- ============================================
-- BLOCK 4: users table extensions
-- Add superadmin role + direct company_id for admin users
-- ============================================

-- Update role constraint to include superadmin
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'dealer', 'superadmin'));

-- Add company_id directly on users (for admin users who have no dealers record)
ALTER TABLE users
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;


-- ============================================
-- BLOCK 5: companies table RLS policies
-- ============================================

CREATE POLICY "Superadmin can manage all companies"
  ON companies FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

CREATE POLICY "Company admins can read own company"
  ON companies FOR SELECT
  TO authenticated
  USING (id = current_company_id());


-- ============================================
-- BLOCK 6: Create seed company + backfill dealers (anchor table)
-- dealers is the root — all other dealer-scoped tables reference dealers.company_id
-- ============================================

-- Step 1: Add nullable company_id to dealers
ALTER TABLE dealers
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;

-- Step 2: Create the seed company (represents the original single tenant)
-- All existing data will be assigned to this company
INSERT INTO companies (id, name, slug, plan, is_active)
VALUES (
  gen_random_uuid(),
  'Default Company',
  'default',
  'pro',
  true
);

-- Step 3: Backfill dealers with seed company
UPDATE dealers
SET company_id = (SELECT id FROM companies WHERE slug = 'default')
WHERE company_id IS NULL;

-- Step 4: Verify zero NULLs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM dealers WHERE company_id IS NULL) THEN
    RAISE EXCEPTION 'Backfill incomplete: dealers has NULL company_id rows';
  END IF;
END $$;

-- Step 5: Set NOT NULL constraint
ALTER TABLE dealers ALTER COLUMN company_id SET NOT NULL;

-- Also assign existing admin users to the seed company
UPDATE users
SET company_id = (SELECT id FROM companies WHERE slug = 'default')
WHERE role = 'admin' AND company_id IS NULL;


-- ============================================
-- BLOCK 7: orders, order_items, order_status_history backfill
-- Must run AFTER Block 6 (dealers.company_id must be populated first)
-- ============================================

-- orders
ALTER TABLE orders
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;

UPDATE orders o
SET company_id = d.company_id
FROM dealers d
WHERE o.dealer_id = d.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM orders WHERE company_id IS NULL) THEN
    RAISE EXCEPTION 'Backfill incomplete: orders has NULL company_id rows';
  END IF;
END $$;

ALTER TABLE orders ALTER COLUMN company_id SET NOT NULL;

-- order_items (no dealer_id — backfill via orders.company_id)
ALTER TABLE order_items
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;

UPDATE order_items oi
SET company_id = o.company_id
FROM orders o
WHERE oi.order_id = o.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM order_items WHERE company_id IS NULL) THEN
    RAISE EXCEPTION 'Backfill incomplete: order_items has NULL company_id rows';
  END IF;
END $$;

ALTER TABLE order_items ALTER COLUMN company_id SET NOT NULL;

-- order_status_history (no dealer_id — backfill via orders.company_id)
ALTER TABLE order_status_history
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;

UPDATE order_status_history osh
SET company_id = o.company_id
FROM orders o
WHERE osh.order_id = o.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM order_status_history WHERE company_id IS NULL) THEN
    RAISE EXCEPTION 'Backfill incomplete: order_status_history has NULL company_id rows';
  END IF;
END $$;

ALTER TABLE order_status_history ALTER COLUMN company_id SET NOT NULL;


-- ============================================
-- BLOCK 8: dealer_prices, dealer_transactions, dealer_invoices,
--          dealer_favorites, announcement_reads, support_messages, product_requests
-- All backfilled via dealers.company_id
-- ============================================

-- dealer_prices
ALTER TABLE dealer_prices
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;
UPDATE dealer_prices dp SET company_id = d.company_id FROM dealers d WHERE dp.dealer_id = d.id;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM dealer_prices WHERE company_id IS NULL) THEN RAISE EXCEPTION 'Backfill incomplete: dealer_prices'; END IF; END $$;
ALTER TABLE dealer_prices ALTER COLUMN company_id SET NOT NULL;

-- dealer_transactions
ALTER TABLE dealer_transactions
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;
UPDATE dealer_transactions dt SET company_id = d.company_id FROM dealers d WHERE dt.dealer_id = d.id;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM dealer_transactions WHERE company_id IS NULL) THEN RAISE EXCEPTION 'Backfill incomplete: dealer_transactions'; END IF; END $$;
ALTER TABLE dealer_transactions ALTER COLUMN company_id SET NOT NULL;

-- dealer_invoices
ALTER TABLE dealer_invoices
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;
UPDATE dealer_invoices di SET company_id = d.company_id FROM dealers d WHERE di.dealer_id = d.id;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM dealer_invoices WHERE company_id IS NULL) THEN RAISE EXCEPTION 'Backfill incomplete: dealer_invoices'; END IF; END $$;
ALTER TABLE dealer_invoices ALTER COLUMN company_id SET NOT NULL;

-- dealer_favorites
ALTER TABLE dealer_favorites
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;
UPDATE dealer_favorites df SET company_id = d.company_id FROM dealers d WHERE df.dealer_id = d.id;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM dealer_favorites WHERE company_id IS NULL) THEN RAISE EXCEPTION 'Backfill incomplete: dealer_favorites'; END IF; END $$;
ALTER TABLE dealer_favorites ALTER COLUMN company_id SET NOT NULL;

-- announcement_reads
ALTER TABLE announcement_reads
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;
UPDATE announcement_reads ar SET company_id = d.company_id FROM dealers d WHERE ar.dealer_id = d.id;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM announcement_reads WHERE company_id IS NULL) THEN RAISE EXCEPTION 'Backfill incomplete: announcement_reads'; END IF; END $$;
ALTER TABLE announcement_reads ALTER COLUMN company_id SET NOT NULL;

-- support_messages
ALTER TABLE support_messages
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;
UPDATE support_messages sm SET company_id = d.company_id FROM dealers d WHERE sm.dealer_id = d.id;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM support_messages WHERE company_id IS NULL) THEN RAISE EXCEPTION 'Backfill incomplete: support_messages'; END IF; END $$;
ALTER TABLE support_messages ALTER COLUMN company_id SET NOT NULL;

-- product_requests
ALTER TABLE product_requests
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;
UPDATE product_requests pr SET company_id = d.company_id FROM dealers d WHERE pr.dealer_id = d.id;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM product_requests WHERE company_id IS NULL) THEN RAISE EXCEPTION 'Backfill incomplete: product_requests'; END IF; END $$;
ALTER TABLE product_requests ALTER COLUMN company_id SET NOT NULL;


-- ============================================
-- BLOCK 9: Direct-assign tables — backfill to seed company
-- These have no dealer_id; assign all rows to the seed company
-- ============================================

-- dealer_groups
ALTER TABLE dealer_groups
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;
UPDATE dealer_groups SET company_id = (SELECT id FROM companies WHERE slug = 'default') WHERE company_id IS NULL;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM dealer_groups WHERE company_id IS NULL) THEN RAISE EXCEPTION 'Backfill incomplete: dealer_groups'; END IF; END $$;
ALTER TABLE dealer_groups ALTER COLUMN company_id SET NOT NULL;

-- categories (company-scoped for full isolation)
ALTER TABLE categories
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;
UPDATE categories SET company_id = (SELECT id FROM companies WHERE slug = 'default') WHERE company_id IS NULL;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM categories WHERE company_id IS NULL) THEN RAISE EXCEPTION 'Backfill incomplete: categories'; END IF; END $$;
ALTER TABLE categories ALTER COLUMN company_id SET NOT NULL;

-- brands (company-scoped for full isolation)
ALTER TABLE brands
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;
UPDATE brands SET company_id = (SELECT id FROM companies WHERE slug = 'default') WHERE company_id IS NULL;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM brands WHERE company_id IS NULL) THEN RAISE EXCEPTION 'Backfill incomplete: brands'; END IF; END $$;
ALTER TABLE brands ALTER COLUMN company_id SET NOT NULL;

-- products
ALTER TABLE products
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;
UPDATE products SET company_id = (SELECT id FROM companies WHERE slug = 'default') WHERE company_id IS NULL;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM products WHERE company_id IS NULL) THEN RAISE EXCEPTION 'Backfill incomplete: products'; END IF; END $$;
ALTER TABLE products ALTER COLUMN company_id SET NOT NULL;

-- campaigns
ALTER TABLE campaigns
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;
UPDATE campaigns SET company_id = (SELECT id FROM companies WHERE slug = 'default') WHERE company_id IS NULL;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM campaigns WHERE company_id IS NULL) THEN RAISE EXCEPTION 'Backfill incomplete: campaigns'; END IF; END $$;
ALTER TABLE campaigns ALTER COLUMN company_id SET NOT NULL;

-- campaign_products (via campaigns.company_id — must run after campaigns block)
ALTER TABLE campaign_products
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;
UPDATE campaign_products cp SET company_id = c.company_id FROM campaigns c WHERE cp.campaign_id = c.id;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM campaign_products WHERE company_id IS NULL) THEN RAISE EXCEPTION 'Backfill incomplete: campaign_products'; END IF; END $$;
ALTER TABLE campaign_products ALTER COLUMN company_id SET NOT NULL;

-- announcements
ALTER TABLE announcements
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;
UPDATE announcements SET company_id = (SELECT id FROM companies WHERE slug = 'default') WHERE company_id IS NULL;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM announcements WHERE company_id IS NULL) THEN RAISE EXCEPTION 'Backfill incomplete: announcements'; END IF; END $$;
ALTER TABLE announcements ALTER COLUMN company_id SET NOT NULL;

-- order_documents (via orders.company_id — must run after orders block)
ALTER TABLE order_documents
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;
UPDATE order_documents od SET company_id = o.company_id FROM orders o WHERE od.order_id = o.id;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM order_documents WHERE company_id IS NULL) THEN RAISE EXCEPTION 'Backfill incomplete: order_documents'; END IF; END $$;
ALTER TABLE order_documents ALTER COLUMN company_id SET NOT NULL;


-- ============================================
-- BLOCK 10: Materialized view rebuild with company_id + RPC wrapper
-- PostgreSQL does not support RLS on materialized views — must use RPC wrapper
-- ============================================

-- Drop existing materialized view and index
DROP INDEX IF EXISTS idx_dealer_spending_dealer_month;
DROP MATERIALIZED VIEW IF EXISTS dealer_spending_summary;

-- Rebuild with company_id in SELECT and GROUP BY
CREATE MATERIALIZED VIEW dealer_spending_summary AS
SELECT
  d.company_id,
  d.id AS dealer_id,
  d.company_name,
  DATE_TRUNC('month', dt.transaction_date)::date AS month,
  COALESCE(SUM(dt.amount) FILTER (WHERE tt.balance_effect = 'debit'), 0) AS total_debit,
  COALESCE(SUM(dt.amount) FILTER (WHERE tt.balance_effect = 'credit'), 0) AS total_credit,
  COALESCE(SUM(
    CASE
      WHEN tt.balance_effect = 'debit' THEN dt.amount
      ELSE -dt.amount
    END
  ), 0) AS net_balance
FROM dealers d
LEFT JOIN dealer_transactions dt ON dt.dealer_id = d.id
LEFT JOIN transaction_types tt ON tt.id = dt.transaction_type_id
GROUP BY d.company_id, d.id, d.company_name, DATE_TRUNC('month', dt.transaction_date);

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_dealer_spending_company_dealer_month
  ON dealer_spending_summary(company_id, dealer_id, month DESC NULLS LAST);

-- RPC wrapper — ONLY safe access point for this view
-- NEVER expose dealer_spending_summary directly to the API
CREATE OR REPLACE FUNCTION get_dealer_spending_summary(p_dealer_id UUID)
RETURNS TABLE (
  dealer_id    UUID,
  company_name TEXT,
  month        DATE,
  total_debit  DECIMAL,
  total_credit DECIMAL,
  net_balance  DECIMAL
) AS $$
  SELECT
    dealer_id,
    company_name,
    month,
    total_debit,
    total_credit,
    net_balance
  FROM dealer_spending_summary
  WHERE dealer_id = p_dealer_id
    AND company_id = current_company_id()
$$ LANGUAGE sql STABLE SECURITY INVOKER;

GRANT EXECUTE ON FUNCTION get_dealer_spending_summary(UUID) TO authenticated;


-- ============================================
-- BLOCK 11: Composite indexes for company_id scoping
-- CRITICAL: Paste EACH statement INDIVIDUALLY in Supabase Dashboard SQL Editor
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block
-- Run them one at a time — each takes a few seconds on a small dataset
-- ============================================

-- dealers
CREATE INDEX CONCURRENTLY idx_dealers_company_id
  ON dealers(company_id);

-- orders (compound: company_id + dealer_id for admin queries by dealer within company)
CREATE INDEX CONCURRENTLY idx_orders_company_dealer
  ON orders(company_id, dealer_id);

-- order_items (company_id only — no dealer_id column on this table)
CREATE INDEX CONCURRENTLY idx_order_items_company_id
  ON order_items(company_id);

-- order_status_history (company_id only — no dealer_id column on this table)
CREATE INDEX CONCURRENTLY idx_order_status_history_company_id
  ON order_status_history(company_id);

-- dealer_prices
CREATE INDEX CONCURRENTLY idx_dealer_prices_company_dealer
  ON dealer_prices(company_id, dealer_id);

-- dealer_transactions
CREATE INDEX CONCURRENTLY idx_dealer_transactions_company_dealer
  ON dealer_transactions(company_id, dealer_id);

-- dealer_invoices
CREATE INDEX CONCURRENTLY idx_dealer_invoices_company_dealer
  ON dealer_invoices(company_id, dealer_id);

-- dealer_favorites
CREATE INDEX CONCURRENTLY idx_dealer_favorites_company_dealer
  ON dealer_favorites(company_id, dealer_id);

-- announcement_reads
CREATE INDEX CONCURRENTLY idx_announcement_reads_company_dealer
  ON announcement_reads(company_id, dealer_id);

-- support_messages
CREATE INDEX CONCURRENTLY idx_support_messages_company_dealer
  ON support_messages(company_id, dealer_id);

-- product_requests
CREATE INDEX CONCURRENTLY idx_product_requests_company_dealer
  ON product_requests(company_id, dealer_id);

-- dealer_groups (company-scoped, no dealer_id)
CREATE INDEX CONCURRENTLY idx_dealer_groups_company_id
  ON dealer_groups(company_id);

-- categories (company-scoped)
CREATE INDEX CONCURRENTLY idx_categories_company_id
  ON categories(company_id);

-- brands (company-scoped)
CREATE INDEX CONCURRENTLY idx_brands_company_id
  ON brands(company_id);

-- products (company-scoped)
CREATE INDEX CONCURRENTLY idx_products_company_id
  ON products(company_id);

-- campaigns (company-scoped)
CREATE INDEX CONCURRENTLY idx_campaigns_company_id
  ON campaigns(company_id);

-- campaign_products (company-scoped)
CREATE INDEX CONCURRENTLY idx_campaign_products_company_id
  ON campaign_products(company_id);

-- announcements (company-scoped)
CREATE INDEX CONCURRENTLY idx_announcements_company_id
  ON announcements(company_id);

-- order_documents (company-scoped via orders)
CREATE INDEX CONCURRENTLY idx_order_documents_company_id
  ON order_documents(company_id);

-- users (company_id for admin lookup in hook + admin RLS)
CREATE INDEX CONCURRENTLY idx_users_company_id
  ON users(company_id);


-- ============================================
-- BLOCK 12: Replace all RLS policies with company-scoped versions
-- Can be pasted as a single block in Supabase Dashboard SQL Editor
-- Must run AFTER Block 2 (functions must exist)
-- ============================================

-- ============================================
-- 12a: users table
-- ============================================
DROP POLICY IF EXISTS "Users can read own record" ON users;
DROP POLICY IF EXISTS "Admins can manage users" ON users;

CREATE POLICY "Users can read own record"
  ON users FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Company admins can manage own company users"
  ON users FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (SELECT is_company_admin())
  );

CREATE POLICY "Superadmin can manage all users"
  ON users FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

-- ============================================
-- 12b: companies table
-- (policies already created in Block 5 — drop and recreate to be idempotent)
-- ============================================
DROP POLICY IF EXISTS "Superadmin can manage all companies" ON companies;
DROP POLICY IF EXISTS "Company admins can read own company" ON companies;

CREATE POLICY "Superadmin can manage all companies"
  ON companies FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

CREATE POLICY "Company admins can read own company"
  ON companies FOR SELECT
  TO authenticated
  USING (id = current_company_id());

-- ============================================
-- 12c: dealer_groups table
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read dealer groups" ON dealer_groups;
DROP POLICY IF EXISTS "Admins can manage dealer groups" ON dealer_groups;

CREATE POLICY "Company members can read own company dealer groups"
  ON dealer_groups FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "Company admins can manage dealer groups"
  ON dealer_groups FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (SELECT is_company_admin())
  );

CREATE POLICY "Superadmin can manage all dealer groups"
  ON dealer_groups FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

-- ============================================
-- 12d: dealers table
-- ============================================
DROP POLICY IF EXISTS "Dealers can read own record" ON dealers;
DROP POLICY IF EXISTS "Admins can manage dealers" ON dealers;

CREATE POLICY "Dealers can read own record"
  ON dealers FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND company_id = current_company_id()
  );

CREATE POLICY "Company admins can manage own company dealers"
  ON dealers FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (SELECT is_company_admin())
  );

CREATE POLICY "Superadmin can manage all dealers"
  ON dealers FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

-- ============================================
-- 12e: categories table
-- (old policies: "Anyone can read categories", "Admins can manage categories")
-- ============================================
DROP POLICY IF EXISTS "Anyone can read categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can read categories" ON categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;

CREATE POLICY "Company members can read own company categories"
  ON categories FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "Company admins can manage categories"
  ON categories FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (SELECT is_company_admin())
  );

CREATE POLICY "Superadmin can manage all categories"
  ON categories FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

-- ============================================
-- 12f: brands table
-- (old policies: "Anyone can read brands", "Admins can manage brands")
-- ============================================
DROP POLICY IF EXISTS "Anyone can read brands" ON brands;
DROP POLICY IF EXISTS "Authenticated users can read brands" ON brands;
DROP POLICY IF EXISTS "Admins can manage brands" ON brands;

CREATE POLICY "Company members can read own company brands"
  ON brands FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "Company admins can manage brands"
  ON brands FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (SELECT is_company_admin())
  );

CREATE POLICY "Superadmin can manage all brands"
  ON brands FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

-- ============================================
-- 12g: products table
-- (old policies: "Authenticated can read active products", "Admins can manage products")
-- ============================================
DROP POLICY IF EXISTS "Authenticated can read active products" ON products;
DROP POLICY IF EXISTS "Authenticated users can read active products" ON products;
DROP POLICY IF EXISTS "Admins can manage products" ON products;

CREATE POLICY "Company members can read own company products"
  ON products FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "Company admins can manage products"
  ON products FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (SELECT is_company_admin())
  );

CREATE POLICY "Superadmin can manage all products"
  ON products FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

-- ============================================
-- 12h: dealer_prices table
-- ============================================
DROP POLICY IF EXISTS "Dealers can read own prices" ON dealer_prices;
DROP POLICY IF EXISTS "Admins can manage dealer prices" ON dealer_prices;

CREATE POLICY "Dealers can read own prices"
  ON dealer_prices FOR SELECT
  TO authenticated
  USING (
    dealer_id IN (
      SELECT id FROM dealers
      WHERE user_id = (SELECT auth.uid())
        AND company_id = current_company_id()
    )
  );

CREATE POLICY "Company admins can manage dealer prices"
  ON dealer_prices FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (SELECT is_company_admin())
  );

CREATE POLICY "Superadmin can manage all dealer prices"
  ON dealer_prices FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

-- ============================================
-- 12i: orders table
-- ============================================
DROP POLICY IF EXISTS "Dealers can read own orders" ON orders;
DROP POLICY IF EXISTS "Dealers can create orders" ON orders;
DROP POLICY IF EXISTS "Admins can manage orders" ON orders;

CREATE POLICY "Dealers can read own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    dealer_id IN (
      SELECT id FROM dealers
      WHERE user_id = (SELECT auth.uid())
        AND company_id = current_company_id()
    )
  );

CREATE POLICY "Dealers can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    dealer_id IN (
      SELECT id FROM dealers
      WHERE user_id = (SELECT auth.uid())
        AND company_id = current_company_id()
    )
  );

CREATE POLICY "Company admins can manage orders"
  ON orders FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (SELECT is_company_admin())
  );

CREATE POLICY "Superadmin can manage all orders"
  ON orders FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

-- ============================================
-- 12j: order_items table
-- ============================================
DROP POLICY IF EXISTS "Dealers can read own order items" ON order_items;
DROP POLICY IF EXISTS "Dealers can create order items" ON order_items;
DROP POLICY IF EXISTS "Admins can manage order items" ON order_items;

CREATE POLICY "Dealers can read own order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    company_id = current_company_id()
    AND order_id IN (
      SELECT id FROM orders
      WHERE dealer_id IN (
        SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Dealers can create order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = current_company_id()
    AND order_id IN (
      SELECT id FROM orders
      WHERE dealer_id IN (
        SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Company admins can manage order items"
  ON order_items FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (SELECT is_company_admin())
  );

CREATE POLICY "Superadmin can manage all order items"
  ON order_items FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

-- ============================================
-- 12k: order_status_history table
-- (old policies: "Dealers can read own order history", "Admins can manage order history")
-- ============================================
DROP POLICY IF EXISTS "Dealers can read own order history" ON order_status_history;
DROP POLICY IF EXISTS "Dealers can read own order status history" ON order_status_history;
DROP POLICY IF EXISTS "Admins can manage order history" ON order_status_history;
DROP POLICY IF EXISTS "Admins can manage order status history" ON order_status_history;

CREATE POLICY "Dealers can read own order status history"
  ON order_status_history FOR SELECT
  TO authenticated
  USING (
    company_id = current_company_id()
    AND order_id IN (
      SELECT id FROM orders
      WHERE dealer_id IN (
        SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Company admins can manage order status history"
  ON order_status_history FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (SELECT is_company_admin())
  );

CREATE POLICY "Superadmin can manage all order status history"
  ON order_status_history FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

-- ============================================
-- 12l: Global lookup tables (no company_id — same for all companies)
-- order_statuses, order_status_transitions, transaction_types
-- (old policy names differ from plan: "Authenticated can read ..." not "Authenticated users can read ...")
-- ============================================
DROP POLICY IF EXISTS "Authenticated can read order statuses" ON order_statuses;
DROP POLICY IF EXISTS "Authenticated users can read order statuses" ON order_statuses;
DROP POLICY IF EXISTS "Admins can manage order statuses" ON order_statuses;
DROP POLICY IF EXISTS "Authenticated can read transitions" ON order_status_transitions;
DROP POLICY IF EXISTS "Authenticated users can read transitions" ON order_status_transitions;
DROP POLICY IF EXISTS "Admins can manage transitions" ON order_status_transitions;
DROP POLICY IF EXISTS "Authenticated can read transaction types" ON transaction_types;
DROP POLICY IF EXISTS "Authenticated users can read transaction types" ON transaction_types;
DROP POLICY IF EXISTS "Admins can manage transaction types" ON transaction_types;

CREATE POLICY "Authenticated users can read order statuses"
  ON order_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Superadmin can manage order statuses"
  ON order_statuses FOR ALL TO authenticated USING ((SELECT is_superadmin()));

CREATE POLICY "Authenticated users can read transitions"
  ON order_status_transitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Superadmin can manage transitions"
  ON order_status_transitions FOR ALL TO authenticated USING ((SELECT is_superadmin()));

CREATE POLICY "Authenticated users can read transaction types"
  ON transaction_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Superadmin can manage transaction types"
  ON transaction_types FOR ALL TO authenticated USING ((SELECT is_superadmin()));

-- ============================================
-- 12m: dealer_transactions table
-- ============================================
DROP POLICY IF EXISTS "Dealers can read own transactions" ON dealer_transactions;
DROP POLICY IF EXISTS "Admins can manage dealer transactions" ON dealer_transactions;

CREATE POLICY "Dealers can read own transactions"
  ON dealer_transactions FOR SELECT
  TO authenticated
  USING (
    dealer_id IN (
      SELECT id FROM dealers
      WHERE user_id = (SELECT auth.uid())
        AND company_id = current_company_id()
    )
  );

CREATE POLICY "Company admins can manage dealer transactions"
  ON dealer_transactions FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (SELECT is_company_admin())
  );

CREATE POLICY "Superadmin can manage all dealer transactions"
  ON dealer_transactions FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

-- ============================================
-- 12n: dealer_invoices table
-- ============================================
DROP POLICY IF EXISTS "Dealers can read own invoices" ON dealer_invoices;
DROP POLICY IF EXISTS "Admins can manage dealer invoices" ON dealer_invoices;

CREATE POLICY "Dealers can read own invoices"
  ON dealer_invoices FOR SELECT
  TO authenticated
  USING (
    dealer_id IN (
      SELECT id FROM dealers
      WHERE user_id = (SELECT auth.uid())
        AND company_id = current_company_id()
    )
  );

CREATE POLICY "Company admins can manage dealer invoices"
  ON dealer_invoices FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (SELECT is_company_admin())
  );

CREATE POLICY "Superadmin can manage all dealer invoices"
  ON dealer_invoices FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

-- ============================================
-- 12o: dealer_favorites table
-- (old policies: "Dealers can view own favorites", "Dealers can add favorites",
--  "Dealers can remove favorites", "Admins can manage favorites")
-- ============================================
DROP POLICY IF EXISTS "Dealers can view own favorites" ON dealer_favorites;
DROP POLICY IF EXISTS "Dealers can add favorites" ON dealer_favorites;
DROP POLICY IF EXISTS "Dealers can remove favorites" ON dealer_favorites;
DROP POLICY IF EXISTS "Admins can manage favorites" ON dealer_favorites;
DROP POLICY IF EXISTS "Dealers can manage own favorites" ON dealer_favorites;
DROP POLICY IF EXISTS "Admins can read dealer favorites" ON dealer_favorites;

CREATE POLICY "Dealers can manage own favorites"
  ON dealer_favorites FOR ALL
  TO authenticated
  USING (
    dealer_id IN (
      SELECT id FROM dealers
      WHERE user_id = (SELECT auth.uid())
        AND company_id = current_company_id()
    )
  );

CREATE POLICY "Company admins can read dealer favorites"
  ON dealer_favorites FOR SELECT
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (SELECT is_company_admin())
  );

CREATE POLICY "Superadmin can manage all dealer favorites"
  ON dealer_favorites FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

-- ============================================
-- 12p: campaigns + campaign_products tables
-- (old policies: "Authenticated can read active campaigns", "Admins can manage campaigns",
--  "Authenticated can read campaign products", "Admins can manage campaign products")
-- ============================================
DROP POLICY IF EXISTS "Authenticated can read active campaigns" ON campaigns;
DROP POLICY IF EXISTS "Authenticated users can read active campaigns" ON campaigns;
DROP POLICY IF EXISTS "Admins can manage campaigns" ON campaigns;
DROP POLICY IF EXISTS "Authenticated can read campaign products" ON campaign_products;
DROP POLICY IF EXISTS "Authenticated users can read campaign products" ON campaign_products;
DROP POLICY IF EXISTS "Admins can manage campaign products" ON campaign_products;

CREATE POLICY "Company members can read own company campaigns"
  ON campaigns FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "Company admins can manage campaigns"
  ON campaigns FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (SELECT is_company_admin())
  );

CREATE POLICY "Superadmin can manage all campaigns"
  ON campaigns FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

CREATE POLICY "Company members can read own company campaign products"
  ON campaign_products FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "Company admins can manage campaign products"
  ON campaign_products FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (SELECT is_company_admin())
  );

CREATE POLICY "Superadmin can manage all campaign products"
  ON campaign_products FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

-- ============================================
-- 12q: announcements + announcement_reads tables
-- (old policies: "Authenticated can read active announcements", "Admins can manage announcements",
--  "Dealers can read own announcement reads", "Dealers can insert own announcement reads")
-- ============================================
DROP POLICY IF EXISTS "Authenticated can read active announcements" ON announcements;
DROP POLICY IF EXISTS "Authenticated users can read active announcements" ON announcements;
DROP POLICY IF EXISTS "Admins can manage announcements" ON announcements;
DROP POLICY IF EXISTS "Dealers can read own announcement reads" ON announcement_reads;
DROP POLICY IF EXISTS "Dealers can insert own announcement reads" ON announcement_reads;
DROP POLICY IF EXISTS "Dealers can manage own announcement reads" ON announcement_reads;
DROP POLICY IF EXISTS "Admins can read announcement reads" ON announcement_reads;

CREATE POLICY "Company members can read own company announcements"
  ON announcements FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "Company admins can manage announcements"
  ON announcements FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (SELECT is_company_admin())
  );

CREATE POLICY "Superadmin can manage all announcements"
  ON announcements FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

CREATE POLICY "Dealers can manage own announcement reads"
  ON announcement_reads FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND dealer_id IN (
      SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Company admins can read announcement reads"
  ON announcement_reads FOR SELECT
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (SELECT is_company_admin())
  );

CREATE POLICY "Superadmin can manage all announcement reads"
  ON announcement_reads FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

-- ============================================
-- 12r: order_documents table
-- ============================================
DROP POLICY IF EXISTS "Dealers can read own order documents" ON order_documents;
DROP POLICY IF EXISTS "Admins can manage order documents" ON order_documents;

CREATE POLICY "Dealers can read own order documents"
  ON order_documents FOR SELECT
  TO authenticated
  USING (
    company_id = current_company_id()
    AND order_id IN (
      SELECT id FROM orders
      WHERE dealer_id IN (
        SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Company admins can manage order documents"
  ON order_documents FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (SELECT is_company_admin())
  );

CREATE POLICY "Superadmin can manage all order documents"
  ON order_documents FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

-- ============================================
-- 12s: support_messages table
-- (old policies: "Dealers can read own support messages", "Dealers can insert own support messages",
--  "Admins can read all support messages", "Admins can update support messages")
-- ============================================
DROP POLICY IF EXISTS "Dealers can read own support messages" ON support_messages;
DROP POLICY IF EXISTS "Dealers can insert own support messages" ON support_messages;
DROP POLICY IF EXISTS "Admins can read all support messages" ON support_messages;
DROP POLICY IF EXISTS "Admins can update support messages" ON support_messages;
DROP POLICY IF EXISTS "Dealers can manage own support messages" ON support_messages;
DROP POLICY IF EXISTS "Admins can manage support messages" ON support_messages;

CREATE POLICY "Dealers can manage own support messages"
  ON support_messages FOR ALL
  TO authenticated
  USING (
    dealer_id IN (
      SELECT id FROM dealers
      WHERE user_id = (SELECT auth.uid())
        AND company_id = current_company_id()
    )
  );

CREATE POLICY "Company admins can manage support messages"
  ON support_messages FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (SELECT is_company_admin())
  );

CREATE POLICY "Superadmin can manage all support messages"
  ON support_messages FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

-- ============================================
-- 12t: product_requests table
-- (old policies: "Dealers can read own product requests", "Dealers can insert own product requests",
--  "Admins can read all product requests", "Admins can update product requests")
-- ============================================
DROP POLICY IF EXISTS "Dealers can read own product requests" ON product_requests;
DROP POLICY IF EXISTS "Dealers can insert own product requests" ON product_requests;
DROP POLICY IF EXISTS "Admins can read all product requests" ON product_requests;
DROP POLICY IF EXISTS "Admins can update product requests" ON product_requests;
DROP POLICY IF EXISTS "Dealers can manage own product requests" ON product_requests;
DROP POLICY IF EXISTS "Admins can manage product requests" ON product_requests;

CREATE POLICY "Dealers can manage own product requests"
  ON product_requests FOR ALL
  TO authenticated
  USING (
    dealer_id IN (
      SELECT id FROM dealers
      WHERE user_id = (SELECT auth.uid())
        AND company_id = current_company_id()
    )
  );

CREATE POLICY "Company admins can manage product requests"
  ON product_requests FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (SELECT is_company_admin())
  );

CREATE POLICY "Superadmin can manage all product requests"
  ON product_requests FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()));

-- ============================================
-- 12u: FAQ tables (global content — readable by all authenticated)
-- faq_categories, faq_items are platform-level, not company-scoped
-- (old policies: "Authenticated can read active faq categories", "Admins can manage faq categories",
--  "Authenticated can read active faq items", "Admins can manage faq items")
-- ============================================
DROP POLICY IF EXISTS "Authenticated can read active faq categories" ON faq_categories;
DROP POLICY IF EXISTS "Authenticated users can read faq categories" ON faq_categories;
DROP POLICY IF EXISTS "Admins can manage faq categories" ON faq_categories;
DROP POLICY IF EXISTS "Authenticated can read active faq items" ON faq_items;
DROP POLICY IF EXISTS "Authenticated users can read faq items" ON faq_items;
DROP POLICY IF EXISTS "Admins can manage faq items" ON faq_items;

CREATE POLICY "Authenticated users can read faq categories"
  ON faq_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Superadmin can manage faq categories"
  ON faq_categories FOR ALL TO authenticated USING ((SELECT is_superadmin()));
-- Company admins can also manage FAQ for their company UX
CREATE POLICY "Company admins can manage faq categories"
  ON faq_categories FOR ALL TO authenticated
  USING ((SELECT is_company_admin()));

CREATE POLICY "Authenticated users can read faq items"
  ON faq_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Superadmin can manage faq items"
  ON faq_items FOR ALL TO authenticated USING ((SELECT is_superadmin()));
CREATE POLICY "Company admins can manage faq items"
  ON faq_items FOR ALL TO authenticated
  USING ((SELECT is_company_admin()));
