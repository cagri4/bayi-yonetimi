-- Phase 14 v4.0 Schema Foundation Migration
-- Run in Supabase Dashboard SQL Editor (neqcuhejmornybmbclwt)
-- Project: https://supabase.com/dashboard/project/neqcuhejmornybmbclwt/sql/new
--
-- EXECUTION INSTRUCTIONS:
--   Paste each numbered BLOCK separately into the Dashboard SQL Editor.
--   Execute and verify each block before proceeding to the next.
--   Each block is independently idempotent (safe to re-run if it fails mid-way).
-- ============================================


-- ============================================
-- BLOCK 1: ALTER TABLE companies — add trial_ends_at column (DB-06)
-- Paste and run this block first.
-- ============================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Verify:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'companies' AND column_name = 'trial_ends_at';


-- ============================================
-- BLOCK 2: ALTER TABLE agent_definitions — add subscription_tier column (DB-07)
-- Paste and run after BLOCK 1.
-- ============================================

ALTER TABLE agent_definitions
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT
    CHECK (subscription_tier IN ('starter', 'pro', 'enterprise'));

-- Verify:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'agent_definitions' AND column_name = 'subscription_tier';


-- ============================================
-- BLOCK 3: CREATE TABLE subscriptions (DB-02)
-- Company billing record. One row per company (UNIQUE company_id).
-- Paste and run after BLOCK 2.
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan                   TEXT NOT NULL DEFAULT 'starter'
                           CHECK (plan IN ('starter', 'pro', 'enterprise')),
  status                 TEXT NOT NULL DEFAULT 'trialing'
                           CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'paused')),
  trial_ends_at          TIMESTAMPTZ,
  mollie_subscription_id TEXT,
  mollie_customer_id     TEXT,
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id)
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Superadmin unrestricted access
CREATE POLICY "Superadmin full access on subscriptions"
  ON subscriptions FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()))
  WITH CHECK ((SELECT is_superadmin()));

-- Company admins can read their own subscription
CREATE POLICY "Company admins can read own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (company_id = current_company_id() AND (SELECT is_company_admin()));

DROP TRIGGER IF EXISTS set_updated_at ON subscriptions;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_subscriptions_company
  ON subscriptions(company_id);

-- Verify:
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'subscriptions';


-- ============================================
-- BLOCK 4: CREATE TABLE agent_marketplace (DB-03)
-- Global catalog — no company_id. All authenticated users can read.
-- Paste and run after BLOCK 3.
-- ============================================

CREATE TABLE IF NOT EXISTS agent_marketplace (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_role    TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  description   TEXT NOT NULL,
  monthly_price NUMERIC(8,2) NOT NULL DEFAULT 0,
  minimum_plan  TEXT NOT NULL DEFAULT 'starter'
                  CHECK (minimum_plan IN ('starter', 'pro', 'enterprise')),
  is_active     BOOLEAN DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_marketplace ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read the catalog
CREATE POLICY "Authenticated users can read agent marketplace"
  ON agent_marketplace FOR SELECT
  TO authenticated
  USING (true);

-- Superadmin can manage catalog (INSERT/UPDATE/DELETE)
CREATE POLICY "Superadmin manages agent marketplace"
  ON agent_marketplace FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()))
  WITH CHECK ((SELECT is_superadmin()));

CREATE INDEX IF NOT EXISTS idx_agent_marketplace_sort
  ON agent_marketplace(sort_order);

-- Verify:
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'agent_marketplace';


-- ============================================
-- BLOCK 5: INSERT agent_marketplace seed data — 12 rows
-- Agent roles match AgentRole enum in src/lib/agents/types.ts (excluding 'destek').
-- Uses ON CONFLICT DO NOTHING for idempotency.
-- Paste and run after BLOCK 4.
-- ============================================

INSERT INTO agent_marketplace (agent_role, display_name, description, monthly_price, minimum_plan, sort_order)
VALUES
  ('egitimci',              'Egitimci',              'Urun bilgisi ve sik sorulan sorulara aninda yanit verir',                  99.00,  'starter',    1),
  ('satis_temsilcisi',      'Satis Temsilcisi',      'Siparis alir, stok kontrol eder, kampanyalari tanitir',                   129.00, 'starter',    2),
  ('muhasebeci',            'Muhasebeci',            'Cari hesap, fatura ve odeme gecmisi sorgular',                            129.00, 'starter',    3),
  ('depo_sorumlusu',        'Depo Sorumlusu',        'Envanter takibi yapar, stok gunceller, bekleyen siparisleri yonetir',     129.00, 'starter',    4),
  ('genel_mudur_danismani', 'Genel Mudur Danismani', 'Tum ajanlarin verilerini birlestirerek stratejik analiz yapar',           199.00, 'pro',        5),
  ('tahsilat_uzmani',       'Tahsilat Uzmani',       'Vadesi gecen alacaklari takip eder, hatirlatma gonderir',                 129.00, 'starter',    6),
  ('dagitim_koordinatoru',  'Dagitim Koordinatoru',  'Teslimat durumu sorgular, kargo takibi yapar, rut yonetir',               129.00, 'starter',    7),
  ('saha_satis',            'Saha Satis Sorumlusu',  'Bayi ziyaret planlar, saha sonuclarini kaydeder',                         129.00, 'pro',        8),
  ('pazarlamaci',           'Pazarlamaci',           'Kampanya analizi yapar, bayi segmentasyonu olusturur',                    149.00, 'pro',        9),
  ('urun_yoneticisi',       'Urun Yoneticisi',       'Katalog analizi, fiyat stratejisi ve urun talep analizi yapar',           149.00, 'pro',       10),
  ('satin_alma',            'Satin Alma Sorumlusu',  'Tedarikci siparisi olusturur, stok yenileme onerir',                      129.00, 'starter',   11),
  ('iade_kalite',           'Iade Kalite Sorumlusu', 'Iade taleplerini yonetir, sikayet takibi yapar',                          99.00,  'starter',   12)
ON CONFLICT (agent_role) DO NOTHING;

-- Verify:
-- SELECT agent_role, display_name, monthly_price, minimum_plan FROM agent_marketplace ORDER BY sort_order;


-- ============================================
-- BLOCK 6: Verify agent_marketplace has exactly 12 rows
-- Raises exception if count is wrong — safe to run after BLOCK 5.
-- ============================================

DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM agent_marketplace;
  IF v_count != 12 THEN
    RAISE EXCEPTION 'agent_marketplace has % rows, expected 12', v_count;
  END IF;
  RAISE NOTICE 'agent_marketplace verification passed: % rows', v_count;
END $$;


-- ============================================
-- BLOCK 7: CREATE TABLE onboarding_sessions (DB-01)
-- Wizard FSM state. company_id nullable — company may not exist when wizard starts.
-- Paste and run after BLOCK 6.
-- ============================================

CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID REFERENCES companies(id) ON DELETE CASCADE,
  deep_link_token  TEXT NOT NULL UNIQUE,
  telegram_chat_id BIGINT,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'in_progress', 'completed', 'expired')),
  collected_data   JSONB NOT NULL DEFAULT '{}',
  step             INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;

-- Superadmin can read all onboarding sessions for debugging
CREATE POLICY "Superadmin can read onboarding sessions"
  ON onboarding_sessions FOR SELECT
  TO authenticated
  USING ((SELECT is_superadmin()));

-- All other access (INSERT, UPDATE) is via service role only (bypasses RLS)

DROP TRIGGER IF EXISTS set_updated_at ON onboarding_sessions;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON onboarding_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_token
  ON onboarding_sessions(deep_link_token);

CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_chat
  ON onboarding_sessions(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

-- Verify:
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'onboarding_sessions';


-- ============================================
-- BLOCK 8: CREATE TABLE onboarding_invites (DB-08)
-- Single-use invite tokens (stored as SHA-256 hash). UNIQUE(token_hash) enforces DB-level single-use.
-- Paste and run after BLOCK 7.
-- ============================================

CREATE TABLE IF NOT EXISTS onboarding_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE onboarding_invites ENABLE ROW LEVEL SECURITY;

-- Superadmin unrestricted access
CREATE POLICY "Superadmin full access on onboarding invites"
  ON onboarding_invites FOR ALL
  TO authenticated
  USING ((SELECT is_superadmin()))
  WITH CHECK ((SELECT is_superadmin()));

-- Company admins can create invites for their own company
CREATE POLICY "Company admins can insert own onboarding invites"
  ON onboarding_invites FOR INSERT
  TO authenticated
  WITH CHECK (company_id = current_company_id() AND (SELECT is_company_admin()));

-- Company admins can read their own company invites
CREATE POLICY "Company admins can read own onboarding invites"
  ON onboarding_invites FOR SELECT
  TO authenticated
  USING (company_id = current_company_id() AND (SELECT is_company_admin()));

CREATE INDEX IF NOT EXISTS idx_onboarding_invites_company
  ON onboarding_invites(company_id, created_at DESC);

-- Verify:
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'onboarding_invites';


-- ============================================
-- BLOCK 9: CREATE TABLE payment_webhook_events (DB-04)
-- Idempotency table for Mollie webhook events. UNIQUE(mollie_event_id) prevents double-processing.
-- Immutable — no updated_at. All writes via service role only.
-- Paste and run after BLOCK 8.
-- ============================================

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mollie_event_id TEXT NOT NULL UNIQUE,
  event_type      TEXT,
  payload         JSONB NOT NULL DEFAULT '{}',
  processed_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- Superadmin can read webhook events for debugging
CREATE POLICY "Superadmin can read payment webhook events"
  ON payment_webhook_events FOR SELECT
  TO authenticated
  USING ((SELECT is_superadmin()));

-- INSERT is via service role only (webhook handler runs as service role, bypasses RLS)

-- Verify:
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'payment_webhook_events';


-- ============================================
-- BLOCK 10: CREATE TABLE superadmin_audit_log (DB-05)
-- Append-only audit log for all superadmin write operations.
-- No UPDATE/DELETE policies — only service role can INSERT, superadmin can SELECT.
-- Paste and run after BLOCK 9.
-- ============================================

CREATE TABLE IF NOT EXISTS superadmin_audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action       TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id    UUID,
  old_value    JSONB,
  new_value    JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
  -- No updated_at: audit logs are append-only
);

ALTER TABLE superadmin_audit_log ENABLE ROW LEVEL SECURITY;

-- Superadmin can read audit log entries
CREATE POLICY "Superadmin can read audit log"
  ON superadmin_audit_log FOR SELECT
  TO authenticated
  USING ((SELECT is_superadmin()));

-- No INSERT/UPDATE/DELETE policies for authenticated users:
-- INSERT is via service role only (bypasses RLS)
-- UPDATE and DELETE are intentionally prohibited

CREATE INDEX IF NOT EXISTS idx_superadmin_audit_actor
  ON superadmin_audit_log(actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_superadmin_audit_target
  ON superadmin_audit_log(target_table, target_id);

-- Verify:
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'superadmin_audit_log';
-- SELECT COUNT(*) FROM agent_marketplace; -- should be 12
