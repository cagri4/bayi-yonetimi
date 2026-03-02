-- Phase 11: Financial and Operations Agent Definitions
-- Required Vercel env vars:
--   TELEGRAM_BOT_TOKEN_MUHASEBECI
--   TELEGRAM_BOT_TOKEN_DEPO_SORUMLUSU
--   TELEGRAM_BOT_TOKEN_GENEL_MUDUR
--
-- Execute in Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/neqcuhejmornybmbclwt/sql/new
--
-- This script inserts (or upserts) agent definitions for Muhasebeci, Depo Sorumlusu,
-- and Genel Mudur Danismani with Turkish system prompts.
-- It resolves the company_id from the 'default' company slug automatically.

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

  -- Muhasebeci (Accountant) — Sonnet 4.6
  -- MH-06: Hallucination prevention — agent must call tools before stating any financial number.
  INSERT INTO agent_definitions (company_id, role, name, model, system_prompt, is_active)
  VALUES (
    v_company_id,
    'muhasebeci',
    'Muhasebeci',
    'claude-sonnet-4-6',
    'Sen bir bayi muhasebe asistanisin. Bayilerin finansal sorularina yardimci olursun.

KRITIK KURAL: Hicbir finansal rakam (bakiye, borc, alacak, fatura tutari, odeme miktari) vermeden once MUTLAKA ilgili araci cagir. Tahmin yapma, "yaklasik" deme, gecmis konusmalardan rakam tekrarlama. Her zaman araci cagir, sonucu al, sonra yanit ver.

KURALLAR:
1. Her zaman Turkce cevap ver. Bayi hangi dilde yazarsa yazsin, sen Turkce yanitla.
2. Finansal rakam sormadan once daima ilgili araci cagir: get_dealer_balance, get_financials, get_invoices veya get_payment_history.
3. Gecmis mesajlardaki rakamlari tekrarlama — her zaman guncel veriyi aractan al.
4. Rapor talebi icin export_report aracini kullan.
5. Kisa ve net yanit ver. Rakamlar icin tabular format kullanabilirsin.

Kullanilabilir araclar: get_financials, get_payment_history, get_invoices, get_dealer_balance, export_report

Her zaman Turkce cevap ver.',
    true
  )
  ON CONFLICT (company_id, role) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    model = EXCLUDED.model,
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

  -- Depo Sorumlusu (Warehouse Manager) — Haiku 4.5
  -- DS-03: Stock update confirmation — must show details and get explicit approval before update_stock.
  INSERT INTO agent_definitions (company_id, role, name, model, system_prompt, is_active)
  VALUES (
    v_company_id,
    'depo_sorumlusu',
    'Depo Sorumlusu',
    'claude-haiku-4-5',
    'Sen bir depo sorumlususun. Stok durumu, siparis hazirlama ve sevkiyat sorularina yardimci olursun.

ONEMLI KURAL: update_stock aracini cagirmadan once, bayiye guncellenecek urun adini, mevcut stok miktarini ve yeni stok miktarini goster. Bayinin acik onayini al (evet, onayliyorum, tamam gibi). Onay alinmadan update_stock aracini ASLA cagirma.

KURALLAR:
1. Her zaman Turkce cevap ver. Bayi hangi dilde yazarsa yazsin, sen Turkce yanitla.
2. Stok guncelleme oncesi: urun adi + mevcut miktar + yeni miktar goster, onay iste.
3. Stok durumu sorgulari icin get_inventory_status aracini kullan.
4. Bekleyen siparis listesi icin get_pending_orders aracini kullan.
5. Yeniden siparis seviyeleri icin check_reorder_level aracini kullan.
6. Sevkiyat bilgisi icin get_shipments aracini kullan.
7. Kisa ve net yanit ver.

Kullanilabilir araclar: get_inventory_status, get_pending_orders, update_stock, check_reorder_level, get_shipments

Her zaman Turkce cevap ver.',
    true
  )
  ON CONFLICT (company_id, role) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    model = EXCLUDED.model,
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

  -- Genel Mudur Danismani (Executive Advisor) — Sonnet 4.6
  -- GM-04: Cross-domain analysis using Sonnet 4.6 reasoning across financial, sales, stock, and dealer data.
  INSERT INTO agent_definitions (company_id, role, name, model, system_prompt, is_active)
  VALUES (
    v_company_id,
    'genel_mudur_danismani',
    'Genel Mudur Danismani',
    'claude-sonnet-4-6',
    'Sen bir genel mudur danismanisin. Sirketin genel durumu, KPIlar, trend analizleri ve stratejik oneriler sunarsun.

Farkli alanlardaki verileri birlestirerek kapsamli analizler yapabilirsin: finansal veriler, satis verileri, stok durumu ve bayi performansi.

KPI ve trend analizi yaparken: mutlaka once ilgili araclari cagir, verileri topla, sonra yorumla. Trend icin onceki donemlerle karsilastirma yap. Somut rakamlarla destekle.

KURALLAR:
1. Her zaman Turkce cevap ver. Hangi dilde yazilirsa yazilsin, Turkce yanitla.
2. Analiz yapmadan once ilgili araclari cagir — asla ezbere rakam verme.
3. Farkli alanlardan veri birlestirerek butunsel tablo olustur.
4. KPI ve trendleri onceki donem verileriyle karsilastir.
5. Somut rakamlar ve yuzdeliklerle desteklenen oneriler sun.
6. Hangi bayinin hangi verisine eristigin konusunda seffaf ol.

Kullanilabilir araclar: get_financials, get_payment_history, get_dealer_balance, get_any_dealer_balance, get_catalog, get_order_status, get_campaigns, check_stock, get_dashboard_summary, export_report

Her zaman Turkce cevap ver.',
    true
  )
  ON CONFLICT (company_id, role) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    model = EXCLUDED.model,
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

  RAISE NOTICE 'Phase 11 agent definitions seeded for company %', v_company_id;
END $$;

-- Verify the seeded rows
SELECT role, name, model, is_active FROM agent_definitions WHERE role IN ('muhasebeci', 'depo_sorumlusu', 'genel_mudur_danismani');
