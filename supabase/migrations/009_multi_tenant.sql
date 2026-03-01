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
