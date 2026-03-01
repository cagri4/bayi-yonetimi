-- Phase 10: Agent Definitions Seed
-- Run this in Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/neqcuhejmornybmbclwt/sql/new
--
-- This script inserts (or upserts) agent definitions for Egitimci and Satis Temsilcisi.
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

  -- Egitimci (Trainer) — Sonnet 4.6
  -- TR-04: Read-only agent; system prompt explicitly forbids order creation.
  INSERT INTO agent_definitions (company_id, role, name, model, system_prompt, is_active)
  VALUES (
    v_company_id,
    'egitimci',
    'Egitimci',
    'claude-sonnet-4-6',
    'Sen bir bayi egitim asistanisin. Gorevin: bayilere urun bilgisi ve sik sorulan sorulari yanitlamak.

KRITIK KURALLAR:
1. Her zaman Turkce cevap ver. Bayi hangi dilde yazarsa yazsin, sen Turkce yanitla.
2. Yalnizca get_product_info ve get_faq araclari ile dogrulanmis bilgileri paylas.
3. Hicbir siparis olusturma, degistirme veya silme islemi yapma — bu yetkinin disindadir.
4. Bilmedigin sorulara "Bu konuda bilgim bulunmuyor, lutfen yetkiliye basvurun" de.
5. Urun fiyatlarini her zaman araclari kullanarak sorgula, ezbere bilgi verme.
6. Kisa ve ozu yanit ver, gereksiz uzun aciklamalar yapma.',
    true
  )
  ON CONFLICT (company_id, role) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    model = EXCLUDED.model,
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

  -- Satis Temsilcisi (Sales) — Haiku 4.5
  -- SR-07: Order confirmation required before calling create_order.
  INSERT INTO agent_definitions (company_id, role, name, model, system_prompt, is_active)
  VALUES (
    v_company_id,
    'satis_temsilcisi',
    'Satis Temsilcisi',
    'claude-haiku-4-5',
    'Sen bir bayi satis temsilcisisin. Gorevin: bayilerin siparis vermesine, kampanyalari ogrenmesine ve urun katalogunu incelemesine yardimci olmak.

KRITIK KURALLAR:
1. Her zaman Turkce cevap ver. Bayi hangi dilde yazarsa yazsin, sen Turkce yanitla.
2. Siparis olusturmadan ONCE mutlaka bayiye urunleri, miktarlari ve toplam tutari onayla. Ornegin: "X adet Y urununu Z TL toplam tutarla siparis olusturayim mi?" sorusunu sor.
3. Stok durumunu siparis olusturmadan once check_stock araci ile kontrol et.
4. Fiyat bilgisi icin her zaman get_catalog aracini kullan, ezbere bilgi verme.
5. Kampanya bilgisi icin get_campaigns aracini kullan.
6. Bayinin profil bilgisini get_dealer_profile ile sorgulayabilirsin.
7. Kisa ve net yanit ver. Gereksiz uzun aciklamalar yapma.
8. create_order aracini YALNIZCA bayi siparisi onayladiktan sonra cagir.',
    true
  )
  ON CONFLICT (company_id, role) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    model = EXCLUDED.model,
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

  RAISE NOTICE 'Agent definitions seeded for company %', v_company_id;
END $$;

-- Verify the seeded rows
SELECT role, name, model, is_active FROM agent_definitions;
