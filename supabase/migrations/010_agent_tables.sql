-- ============================================
-- 010_agent_tables.sql
-- Agent Infrastructure Migration
-- B2B Bayi Yonetimi — v3.0 Phase 9
--
-- EXECUTION: Paste each BLOCK separately in Supabase Dashboard SQL Editor.
-- Blocks must be executed in order (1 → 9).
-- Verify each block succeeds before proceeding to the next.
-- ============================================


-- ============================================
-- BLOCK 1: agent_definitions table
-- Role catalog — one row per company+role pair
-- ============================================

CREATE TABLE agent_definitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role          TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  model         TEXT NOT NULL DEFAULT 'claude-haiku-4-5',
  system_prompt TEXT NOT NULL DEFAULT '',
  is_active     BOOLEAN DEFAULT true,
  settings      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, role)
);

ALTER TABLE agent_definitions ENABLE ROW LEVEL SECURITY;


-- ============================================
-- BLOCK 2: agent_conversations table
-- One per dealer-bot thread
-- ============================================

CREATE TABLE agent_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  dealer_id       UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  agent_role      TEXT NOT NULL,
  telegram_chat_id BIGINT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'error')),
  summary         TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;


-- ============================================
-- BLOCK 3: agent_messages table
-- Individual messages in a conversation
-- ============================================

CREATE TABLE agent_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;


-- ============================================
-- BLOCK 4: agent_calls table
-- Cross-agent call audit log
-- ============================================

CREATE TABLE agent_calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  caller_role     TEXT NOT NULL,
  callee_role     TEXT NOT NULL,
  depth           INTEGER NOT NULL DEFAULT 0,
  success         BOOLEAN NOT NULL DEFAULT true,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_calls ENABLE ROW LEVEL SECURITY;


-- ============================================
-- BLOCK 5: processed_telegram_updates table
-- Idempotency log — prevents duplicate processing
-- update_id is provided by Telegram (not auto-generated)
-- ============================================

CREATE TABLE processed_telegram_updates (
  update_id    BIGINT PRIMARY KEY,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE processed_telegram_updates ENABLE ROW LEVEL SECURITY;


-- ============================================
-- BLOCK 6: daily_token_usage table
-- Per-dealer daily budget tracking
-- ============================================

CREATE TABLE daily_token_usage (
  dealer_id   UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (dealer_id, date)
);

ALTER TABLE daily_token_usage ENABLE ROW LEVEL SECURITY;


-- ============================================
-- BLOCK 7: RLS Policies
-- agent_definitions: company admins manage; service role full access; superadmin full access
-- agent_conversations, agent_messages, daily_token_usage: service role only
-- agent_calls: service role full; company admins can SELECT (audit)
-- processed_telegram_updates: service role only
-- ============================================

-- agent_definitions: company admins can manage their own definitions
CREATE POLICY "Company admins manage agent definitions"
  ON agent_definitions FOR ALL
  TO authenticated
  USING (company_id = current_company_id() AND is_company_admin())
  WITH CHECK (company_id = current_company_id() AND is_company_admin());

-- agent_definitions: superadmin full access
CREATE POLICY "Superadmin full access on agent_definitions"
  ON agent_definitions FOR ALL
  TO authenticated
  USING (is_superadmin());

-- agent_conversations: service role full access only
-- (agents run via service role, not user sessions — no user-facing policy needed)

-- agent_messages: service role full access only

-- agent_calls: service role full access
-- agent_calls: company admins can SELECT for audit viewing
CREATE POLICY "Company admins select agent calls"
  ON agent_calls FOR SELECT
  TO authenticated
  USING (company_id = current_company_id() AND is_company_admin());

CREATE POLICY "Superadmin select agent calls"
  ON agent_calls FOR SELECT
  TO authenticated
  USING (is_superadmin());

-- processed_telegram_updates: no user-facing RLS needed (service role only, no company_id)

-- daily_token_usage: no user-facing RLS needed (service role only)


-- ============================================
-- BLOCK 8: Indexes
-- ============================================

CREATE INDEX idx_agent_conversations_dealer
  ON agent_conversations(company_id, dealer_id);

CREATE INDEX idx_agent_conversations_chat
  ON agent_conversations(telegram_chat_id);

CREATE INDEX idx_agent_messages_conversation
  ON agent_messages(conversation_id, created_at);

CREATE INDEX idx_agent_calls_company
  ON agent_calls(company_id, created_at DESC);

CREATE INDEX idx_daily_token_usage_dealer
  ON daily_token_usage(dealer_id, date DESC);


-- ============================================
-- BLOCK 9: RPC function + dealers telegram column
-- increment_daily_token_usage: atomic upsert for token budget
-- dealers.telegram_chat_id: links dealer to Telegram chat
-- ============================================

-- Atomic upsert for daily token usage tracking
CREATE OR REPLACE FUNCTION increment_daily_token_usage(
  p_dealer_id UUID,
  p_date      DATE,
  p_tokens    INTEGER
) RETURNS VOID
LANGUAGE sql
AS $$
  INSERT INTO daily_token_usage (dealer_id, date, tokens_used, updated_at)
  VALUES (p_dealer_id, p_date, p_tokens, NOW())
  ON CONFLICT (dealer_id, date)
  DO UPDATE SET
    tokens_used = daily_token_usage.tokens_used + EXCLUDED.tokens_used,
    updated_at  = NOW();
$$;

-- Add telegram_chat_id to dealers for webhook dispatcher identity resolution
ALTER TABLE dealers ADD COLUMN telegram_chat_id BIGINT UNIQUE;

CREATE INDEX idx_dealers_telegram_chat_id
  ON dealers(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;
