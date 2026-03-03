-- Phase 12 Domain Tables Migration
-- Run in Supabase Dashboard SQL Editor (neqcuhejmornybmbclwt)
-- Tables: collection_activities, dealer_visits, sales_targets, suppliers, purchase_orders, return_requests, quality_complaints
--
-- EXECUTION: Paste the full script in Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/neqcuhejmornybmbclwt/sql/new
-- ============================================


-- ============================================
-- TABLE 1: collection_activities
-- Tahsilat Uzmani agent — tracks collection actions per dealer
-- ============================================

CREATE TABLE collection_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  dealer_id       UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  activity_type   TEXT NOT NULL CHECK (activity_type IN ('reminder_sent','call_made','visit','payment_received','note')),
  notes           TEXT,
  amount_expected NUMERIC(12,2),
  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE collection_activities ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_collection_activities_company
  ON collection_activities(company_id, created_at DESC);


-- ============================================
-- TABLE 2: dealer_visits
-- Saha Satis Sorumlusu agent — field visit planning and outcomes
-- ============================================

CREATE TABLE dealer_visits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  dealer_id    UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  planned_date DATE NOT NULL,
  actual_date  DATE,
  visit_type   TEXT NOT NULL DEFAULT 'routine' CHECK (visit_type IN ('routine','sales','complaint','delivery')),
  outcome      TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dealer_visits ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_dealer_visits_company
  ON dealer_visits(company_id, created_at DESC);


-- ============================================
-- TABLE 3: sales_targets
-- Saha Satis Sorumlusu agent — dealer sales targets per period
-- ============================================

CREATE TABLE sales_targets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  dealer_id       UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  target_amount   NUMERIC(12,2) NOT NULL,
  achieved_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sales_targets ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_sales_targets_company
  ON sales_targets(company_id, created_at DESC);


-- ============================================
-- TABLE 4: suppliers
-- Satin Alma agent — supplier master data
-- Must be created before purchase_orders (FK dependency)
-- ============================================

CREATE TABLE suppliers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  contact_name TEXT,
  email        TEXT,
  phone        TEXT,
  notes        TEXT,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_suppliers_company
  ON suppliers(company_id, created_at DESC);


-- ============================================
-- TABLE 5: purchase_orders
-- Satin Alma agent — purchase orders from suppliers
-- Depends on suppliers (FK: supplier_id)
-- ============================================

CREATE TABLE purchase_orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id  UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','confirmed','received','cancelled')),
  items        JSONB NOT NULL DEFAULT '[]',
  total_amount NUMERIC(12,2),
  notes        TEXT,
  ordered_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_purchase_orders_company
  ON purchase_orders(company_id, created_at DESC);


-- ============================================
-- TABLE 6: return_requests
-- Iade/Kalite agent — dealer return requests for orders
-- Depends on orders (FK: order_id, nullable)
-- ============================================

CREATE TABLE return_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  dealer_id   UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  reason      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed')),
  items       JSONB NOT NULL DEFAULT '[]',
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_return_requests_company
  ON return_requests(company_id, created_at DESC);


-- ============================================
-- TABLE 7: quality_complaints
-- Iade/Kalite agent — dealer quality complaints
-- ============================================

CREATE TABLE quality_complaints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  dealer_id       UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  complaint_type  TEXT NOT NULL CHECK (complaint_type IN ('product_quality','delivery','packaging','other')),
  description     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','resolved','closed')),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quality_complaints ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_quality_complaints_company
  ON quality_complaints(company_id, created_at DESC);
