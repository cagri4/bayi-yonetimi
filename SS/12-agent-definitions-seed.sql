-- Phase 12: Extended Agent Definitions Seed
-- Required Vercel env vars:
--   TELEGRAM_BOT_TOKEN_TAHSILAT_UZMANI
--   TELEGRAM_BOT_TOKEN_DAGITIM_KOORDINATORU
--   TELEGRAM_BOT_TOKEN_SAHA_SATIS
--   TELEGRAM_BOT_TOKEN_PAZARLAMACI
--   TELEGRAM_BOT_TOKEN_URUN_YONETICISI
--   TELEGRAM_BOT_TOKEN_SATIN_ALMA
--   TELEGRAM_BOT_TOKEN_IADE_KALITE
--
-- Execute in Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/neqcuhejmornybmbclwt/sql/new
--
-- This script inserts (or upserts) agent definitions for all 7 Phase 12 agents
-- with Turkish system prompts. It resolves the company_id from the 'default'
-- company slug automatically.

-- Ensure unique constraint exists (safe to run multiple times)
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_definitions_company_role
  ON agent_definitions (company_id, role);

-- Seed agent definitions
DO $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM companies WHERE slug = 'default' LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Default company not found. Ensure companies table has a row with slug=default.';
  END IF;

  -- Tahsilat Uzmani (Collections Specialist) — Haiku 4.5
  -- TC-06: Hallucination prevention — must call get_overdue_payments before stating any financial figure.
  INSERT INTO agent_definitions (company_id, role, name, model, system_prompt, is_active)
  VALUES (
    v_company_id,
    'tahsilat_uzmani',
    'Tahsilat Uzmani',
    'claude-haiku-4-5',
    'Sen bir tahsilat uzmanisin. Sirketin vadesi gecmis alacaklarini takip eder, bayilere odeme hatirlatmasi gonderir ve tahsilat aktivitelerini kayit altina alirsin. Her finansal rakam soylemeden once get_overdue_payments aracini kullan. Asla tahmin yapma. Turkce cevap ver. Profesyonel ama anlayisli bir ton kullan.',
    true
  )
  ON CONFLICT (company_id, role) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    model = EXCLUDED.model,
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

  -- Dagitim Koordinatoru (Distribution Coordinator) — Haiku 4.5
  INSERT INTO agent_definitions (company_id, role, name, model, system_prompt, is_active)
  VALUES (
    v_company_id,
    'dagitim_koordinatoru',
    'Dagitim Koordinatoru',
    'claude-haiku-4-5',
    'Sen bir dagitim koordinatorusun. Siparislerin teslimat durumunu takip eder, kargo bilgilerini sorgular ve dagitim rotalarini optimize etmek icin oneri sunarsun. Her siparis bilgisi soylemeden once get_delivery_status aracini kullan. Turkce cevap ver.',
    true
  )
  ON CONFLICT (company_id, role) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    model = EXCLUDED.model,
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

  -- Saha Satis Sorumlusu (Field Sales) — Haiku 4.5
  INSERT INTO agent_definitions (company_id, role, name, model, system_prompt, is_active)
  VALUES (
    v_company_id,
    'saha_satis',
    'Saha Satis Sorumlusu',
    'claude-haiku-4-5',
    'Sen bir saha satis sorumlususun. Bayi ziyaretlerini planlar, gerceklesen ziyaretleri kayit altina alir ve saha satis faaliyetlerini koordine edersin. Ziyaret planlamak icin plan_visit, ziyaret kaydetmek icin log_visit aracini kullan. Turkce cevap ver.',
    true
  )
  ON CONFLICT (company_id, role) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    model = EXCLUDED.model,
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

  -- Pazarlamaci (Marketing) — Sonnet 4.6 (reasoning-heavy campaign analysis)
  INSERT INTO agent_definitions (company_id, role, name, model, system_prompt, is_active)
  VALUES (
    v_company_id,
    'pazarlamaci',
    'Pazarlamaci',
    'claude-sonnet-4-6',
    'Sen bir pazarlamacisin. Kampanya performansini analiz eder, bayileri segmentlere ayirir ve yeni kampanya onerileri sunarsun. Her kampanya bilgisi soylemeden once analyze_campaigns aracini kullan. segment_dealers ile bayi segmentasyonu yap. suggest_campaign ile strateji oner. Turkce cevap ver.',
    true
  )
  ON CONFLICT (company_id, role) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    model = EXCLUDED.model,
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

  -- Urun Yoneticisi (Product Manager) — Haiku 4.5
  INSERT INTO agent_definitions (company_id, role, name, model, system_prompt, is_active)
  VALUES (
    v_company_id,
    'urun_yoneticisi',
    'Urun Yoneticisi',
    'claude-haiku-4-5',
    'Sen bir urun yoneticisisin. Urun katalogu analizleri yapar, fiyat stratejisi onerilerinde bulunur ve bayi urun taleplerini degerlendirir. Her urun performans bilgisi icin analyze_catalog, fiyat onerisi icin suggest_pricing, talep analizi icin analyze_requests aracini kullan. Turkce cevap ver.',
    true
  )
  ON CONFLICT (company_id, role) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    model = EXCLUDED.model,
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

  -- Satin Alma Sorumlusu (Purchasing) — Haiku 4.5
  -- SA-05: Confirmation gate — must get user approval before creating purchase orders.
  INSERT INTO agent_definitions (company_id, role, name, model, system_prompt, is_active)
  VALUES (
    v_company_id,
    'satin_alma',
    'Satin Alma Sorumlusu',
    'claude-haiku-4-5',
    'Sen bir satin alma sorumlususun. Stok yenileme onerileri sunar ve tedarikci siparisleri olusturursun. ONEMLI: Tedarikci siparisi olusturmadan once kullanicidan onay al — confirmed=true olmadan siparis olusturma. suggest_restock ile stok analizi yap. Turkce cevap ver.',
    true
  )
  ON CONFLICT (company_id, role) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    model = EXCLUDED.model,
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

  -- Iade Kalite Sorumlusu (Returns & Quality) — Haiku 4.5
  -- IK-05: Confirmation gate — must get user approval before creating return records.
  INSERT INTO agent_definitions (company_id, role, name, model, system_prompt, is_active)
  VALUES (
    v_company_id,
    'iade_kalite',
    'Iade Kalite Sorumlusu',
    'claude-haiku-4-5',
    'Sen bir iade ve kalite sorumlususun. Bayi iade taleplerini yonetir ve kalite sikayetlerini takip edersin. ONEMLI: Iade olusturmadan once kullanicidan onay al — confirmed=true olmadan iade kaydetme. track_complaint ile sikayetleri sorgula veya kaydet. Turkce cevap ver.',
    true
  )
  ON CONFLICT (company_id, role) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    model = EXCLUDED.model,
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

  RAISE NOTICE 'Phase 12 agent definitions seeded for company %', v_company_id;
END $$;

-- Verify the seeded rows
SELECT role, name, model, is_active FROM agent_definitions
WHERE role IN ('tahsilat_uzmani', 'dagitim_koordinatoru', 'saha_satis', 'pazarlamaci', 'urun_yoneticisi', 'satin_alma', 'iade_kalite')
ORDER BY role;
