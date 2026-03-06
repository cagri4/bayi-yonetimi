# Requirements: Bayi Yonetimi

**Defined:** 2026-03-01 (v3.0), 2026-03-05 (v4.0)
**Core Value:** Bayilerin mesai saatlerinden bagimsiz, anlik stok ve fiyat bilgisiyle siparis verebilmesi — AI agent'lar ile 7/24 otonom is surecleri.

## v3.0 Requirements

### Multi-Tenant Altyapi

- [x] **MT-01**: Sistem birden fazla firmayi tek deployment uzerinden bagimsiz olarak destekler (company_id izolasyonu)
- [x] **MT-02**: Her firma kendi bayilerini, urunlerini ve siparislerini yalnizca kendisi gorebilir (RLS ile izolasyon)
- [x] **MT-03**: Mevcut 20+ tabloya company_id eklenir ve tum veriler backfill edilir (zero downtime)
- [x] **MT-04**: Admin kullanicisi yalnizca kendi firmasinin verilerini yonetebilir (is_company_admin)
- [x] **MT-05**: Platform operatoru (superadmin) tum firmalari gorebilir ve yonetebilir
- [x] **MT-06**: JWT claim injection ile tenant izolasyonu saglanan current_company_id() fonksiyonu calisir
- [x] **MT-07**: Materialized view (dealer_spending_summary) company_id ile yeniden olusturulur ve RPC ile sarmalanir
- [x] **MT-08**: Composite index'ler (company_id, dealer_id) tum tenant-scoped tablolara eklenir

### Ajan Altyapisi

- [x] **AI-01**: AgentRunner sinifi Claude API tool-calling loop ile calisir (max 10 iterasyon, model secimi per rol)
- [x] **AI-02**: ToolRegistry her ajan rolu icin 4-7 tool yukler (tum tool'lar degil, sadece ilgili olanlar)
- [x] **AI-03**: ConversationManager DB-backed mesaj gecmisi tutar (rolling window 50 mesaj + otomatik ozet)
- [x] **AI-04**: Telegram webhook route immediate 200 response + after() ile background processing yapar
- [x] **AI-05**: update_id idempotency ile duplicate mesaj isleme engellenir
- [x] **AI-06**: AgentBridge cross-agent tool call yapar (direkt DB sorgusu, Claude invocation olmadan)
- [x] **AI-07**: Per-dealer gunluk token budget tracking (50K soft / 100K hard limit) calisir
- [x] **AI-08**: Agent-to-agent deadlock korumasi (depth limit 5, cycle detection, 10 tool call cap)
- [x] **AI-09**: agent_definitions, agent_conversations, agent_messages, agent_calls tablolari olusturulur
- [x] **AI-10**: Prompt caching konfigurasyonu (system prompt + tool definition uzerine cache_control)
- [x] **AI-11**: Service role client (createServiceClient) sadece agent layer icin olusturulur

### Egitimci (Trainer Agent)

- [x] **TR-01**: Egitimci ajani urun bilgisi sorgusuna yanitlar verir (get_product_info tool)
- [x] **TR-02**: Egitimci ajani FAQ sorularina yanitlar verir (get_faq tool)
- [x] **TR-03**: Egitimci ajani Telegram uzerinden bayilerle Turkce konusur
- [x] **TR-04**: Egitimci ajani read-only calisir, hicbir veriyi degistirmez

### Satis Temsilcisi (Sales Agent)

- [x] **SR-01**: Satis temsilcisi urun katalogu sorgular (get_catalog tool)
- [x] **SR-02**: Satis temsilcisi siparis olusturur (create_order tool)
- [x] **SR-03**: Satis temsilcisi siparis durumu sorgular (get_order_status tool)
- [x] **SR-04**: Satis temsilcisi kampanya bilgisi verir (get_campaigns tool)
- [x] **SR-05**: Satis temsilcisi stok kontrolu yapar (check_stock tool)
- [x] **SR-06**: Satis temsilcisi bayi profil bilgisi sorgular (get_dealer_profile tool)
- [x] **SR-07**: Satis temsilcisi Telegram uzerinden siparis akisini yonetir

### Muhasebeci (Accountant Agent)

- [x] **MH-01**: Muhasebeci cari hesap bilgisi sorgular (get_financials tool)
- [x] **MH-02**: Muhasebeci odeme gecmisi sorgular (get_payment_history tool)
- [x] **MH-03**: Muhasebeci fatura bilgisi sorgular (get_invoices tool)
- [x] **MH-04**: Muhasebeci bayi bakiyesi sorgular (get_dealer_balance tool)
- [x] **MH-05**: Muhasebeci finansal rapor export eder (export_report tool)
- [x] **MH-06**: Muhasebeci tool olmadan asla finansal rakam soylemez (hallucination prevention)

### Depo Sorumlusu (Warehouse Agent)

- [x] **DS-01**: Depo sorumlusu envanter durumu sorgular (get_inventory_status tool)
- [x] **DS-02**: Depo sorumlusu bekleyen siparisleri listeler (get_pending_orders tool)
- [x] **DS-03**: Depo sorumlusu stok gunceller (update_stock tool — write operation)
- [x] **DS-04**: Depo sorumlusu yeniden siparis seviyesi kontrol eder (check_reorder_level tool)
- [x] **DS-05**: Depo sorumlusu sevkiyat bilgisi sorgular (get_shipments tool)

### Genel Mudur Danismani (Executive Advisor Agent)

- [x] **GM-01**: GM danismani tum ajanlarin read-only tool'larini kullanir (cross-domain sorgu)
- [x] **GM-02**: GM danismani dashboard ozeti sunar (get_dashboard_summary tool)
- [x] **GM-03**: GM danismani rapor export eder (export_report tool)
- [x] **GM-04**: GM danismani Sonnet 4.6 ile karmasik analiz yapar (complex reasoning)
- [x] **GM-05**: GM danismani KPI ve trend analizi sunar

### Tahsilat Uzmani (Collections Agent)

- [x] **TU-01**: Tahsilat uzmani vadesi gecen alacaklari listeler (get_overdue_payments tool)
- [x] **TU-02**: Tahsilat uzmani odeme hatirlatmasi gonderir (send_reminder tool)
- [x] **TU-03**: Tahsilat uzmani tahsilat aktivitesi kaydeder (log_collection_activity tool)
- [x] **TU-04**: Tahsilat uzmani icin collection_activities tablosu olusturulur

### Dagitim Koordinatoru (Distribution Agent)

- [x] **DK-01**: Dagitim koordinatoru teslimat durumu sorgular (get_delivery_status tool)
- [x] **DK-02**: Dagitim koordinatoru rut bilgisi yonetir (manage_routes tool)
- [x] **DK-03**: Dagitim koordinatoru kargo takibi yapar (track_shipment tool)

### Saha Satis Sorumlusu (Field Sales Agent)

- [x] **SS-01**: Saha satis sorumlusu bayi ziyaret plani olusturur (plan_visit tool)
- [x] **SS-02**: Saha satis sorumlusu ziyaret kaydeder (log_visit tool)
- [x] **SS-03**: Saha satis sorumlusu icin dealer_visits ve sales_targets tablolari olusturulur

### Pazarlamaci (Marketing Agent)

- [x] **PZ-01**: Pazarlamaci kampanya analizi yapar (analyze_campaigns tool)
- [x] **PZ-02**: Pazarlamaci bayi segmentasyonu olusturur (segment_dealers tool)
- [x] **PZ-03**: Pazarlamaci kampanya onerisi sunar (suggest_campaign tool)

### Urun Yoneticisi (Product Manager Agent)

- [x] **UY-01**: Urun yoneticisi katalog analizi yapar (analyze_catalog tool)
- [x] **UY-02**: Urun yoneticisi fiyat stratejisi onerir (suggest_pricing tool)
- [x] **UY-03**: Urun yoneticisi urun talep analizi yapar (analyze_requests tool)

### Satin Alma Sorumlusu (Procurement Agent)

- [x] **SA-01**: Satin alma sorumlusu tedarikci siparisi olusturur (create_purchase_order tool)
- [x] **SA-02**: Satin alma sorumlusu stok yenileme onerir (suggest_restock tool)
- [x] **SA-03**: Satin alma sorumlusu icin suppliers ve purchase_orders tablolari olusturulur

### Iade Kalite Sorumlusu (Returns/Quality Agent)

- [x] **IK-01**: Iade sorumlusu iade talebi yonetir (manage_return tool)
- [x] **IK-02**: Iade sorumlusu sikayet takibi yapar (track_complaint tool)
- [x] **IK-03**: Iade sorumlusu icin return_requests ve quality_complaints tablolari olusturulur

### Ajan Orkestrasyon

- [x] **AO-01**: Tum 12 ajanin Telegram bot'lari kayitli ve webhook'lari aktif
- [x] **AO-02**: Agent-to-agent handoff workflow'lari calisir (Sales -> Warehouse stok kontrolu vb.)
- [x] **AO-03**: Proaktif bildirim sistemi calisir (gunluk brifing per ajan)

## v4.0 Requirements

### Superadmin Panel

- [x] **SA-01**: Superadmin yeni firma olusturabilir (firma adi, sektor, admin email, plan secimi)
- [x] **SA-02**: Superadmin firma olusturunca tek kullanimlik Telegram davet linki uretilir (UUID token, 7 gun gecerlilik)
- [ ] **SA-03**: Superadmin tum firmalari dashboard'da gorebilir (firma adi, trial durumu, aktif agent sayisi, son aktivite)
- [ ] **SA-04**: Superadmin firma deneme suresini tek tikla uzatabilir (trial_ends_at guncelleme + kullaniciya bildirim)
- [x] **SA-05**: Superadmin tum islemleri audit log'a kaydedilir (kim, ne, ne zaman, eski/yeni deger)
- [x] **SA-06**: Superadmin paneli is_superadmin() kontrolu ile korunur (normal admin erisemez)

### Kurulum Sihirbazi (Onboarding Wizard)

- [ ] **KS-01**: Firma sahibi davet linkine tikladiginda Telegram'da Kurulum Sihirbazi botu acilir
- [ ] **KS-02**: Sihirbaz davet tokenini dogrular (tek kullanimlik, suresi gecmemis) ve Telegram chat_id'yi firmaya baglar
- [ ] **KS-03**: Sihirbaz firma bilgilerini conversational olarak toplar (firma adi, sektor, urun sayisi, bayi sayisi, beklentiler)
- [ ] **KS-04**: Sihirbaz 12 dijital calisani sirayla tanitir (her biri icin kisa Turkce aciklama — canli demo yok)
- [x] **KS-05**: Sihirbaz toplanan bilgilerle sistemi tek atomik islemde kurar (company + users + agent_definitions + subscription)
- [x] **KS-06**: Kurulum tamamlaninca firma sahibine web panel linki ve gecici sifre gonderilir
- [ ] **KS-07**: Sihirbaz durumu onboarding_sessions tablosunda tutar (kullanici Telegram'i kapatip acsa bile devam edebilir)
- [x] **KS-08**: Sihirbaz ayri bir Telegram botu olarak calisir (kendi token'i, kendi webhook route'u)

### Agent Aktivasyon ve Marketplace

- [ ] **AM-01**: Her firma icin 12 agent_definitions satiri olusturulur (secili olanlar aktif, digerleri pasif)
- [ ] **AM-02**: Firma admini "Dijital Ekibim" sayfasinda 12 ajanin durumunu gorebilir (aktif/pasif, aylik ucret, kullanim istatistigi)
- [ ] **AM-03**: Firma admini agent'lari aktif/pasif toggle ile yonetebilir ("Ise Al" / "Cikart" metaforu)
- [ ] **AM-04**: Aylik maliyet hesaplayici aktif agent'larin toplam ucretini gosterir
- [ ] **AM-05**: Pasif agent'a mesaj gonderildiginde Turkce uyari mesaji doner ("Bu dijital calisan aktif degil. Aktif etmek icin: [link]")
- [ ] **AM-06**: Agent devre disi birakilirken aktif konusma kontrolu yapilir (son 5 dk icerisinde mesaj varsa uyari)

### Billing ve Abonelik

- [ ] **BL-01**: Her firma icin subscriptions tablosunda abonelik kaydi olusturulur (plan, durum, trial_ends_at, aktif agent sayisi)
- [ ] **BL-02**: Mollie ile aylik otomatik odeme sistemi calisir (aktif agent sayisi x birim fiyat = aylik tutar)
- [ ] **BL-03**: Mollie webhook'lari idempotent sekilde islenir (ayni webhook 2 kez gelse bile tek islem yapilir)
- [ ] **BL-04**: Basarisiz odeme durumunda 3 gun grace period uygulanir (agent'lar hemen kapanmaz, uyari gonderilir)
- [ ] **BL-05**: Grace period sonunda odenmeyen firmanin agent'lari otomatik devre disi birakilir
- [ ] **BL-06**: Billing webhook agent_definitions.is_active uzerinde tek yetkili yazicidir (marketplace UI desired state yazar, billing sync eder)

### Deneme Suresi

- [ ] **TR-01**: Yeni firma 14 gun ucretsiz deneme suresiyle baslar (tum 12 agent aktif)
- [ ] **TR-02**: Deneme suresi T-7, T-3 ve T-1 gunlerinde Telegram uzerinden uyari bildirimi gonderilir
- [ ] **TR-03**: Deneme suresi bittiginde firma sahibine "Hangi elemanlari tutmak istiyorsunuz?" secim akisi sunulur
- [ ] **TR-04**: Secilen agent'larin toplam ucreti hesaplanarak aylik abonelik baslatilir
- [ ] **TR-05**: Deneme suresi bildirimleri Vercel Cron job ile gunluk kontrol edilir

### Veritabani Altyapisi

- [x] **DB-01**: onboarding_sessions tablosu olusturulur (wizard state, collected_data JSONB, deep_link_token, telegram_chat_id)
- [x] **DB-02**: subscriptions tablosu olusturulur (company_id, plan, status, trial_ends_at, mollie_subscription_id)
- [x] **DB-03**: agent_marketplace tablosu olusturulur (agent_role, display_name, description, monthly_price, minimum_plan)
- [x] **DB-04**: payment_webhook_events tablosu olusturulur (mollie_event_id, payload JSONB, processed_at — idempotency)
- [x] **DB-05**: superadmin_audit_log tablosu olusturulur (actor_id, action, target_table, old_value, new_value JSONB)
- [x] **DB-06**: companies tablosuna trial_ends_at kolonu eklenir
- [x] **DB-07**: agent_definitions tablosuna subscription_tier kolonu eklenir
- [x] **DB-08**: onboarding_invites tablosu olusturulur (token hash, used_at, expires_at — tek kullanimlik)

## v4.1+ Requirements (Deferred)

### Gelismis Onboarding

- **ADV-08**: Wizard'da her bot canli demo yapar (Ali'yle 1-2 mesaj konusmasi)
- **ADV-09**: Domain-specific veri toplama per agent (her bot kendi kurulum verisini toplar)
- **ADV-10**: Wizard interrupted state'den resume (kullanici gidip gelince kaldigi yerden devam)
- **ADV-11**: Outcome-based pricing (agent basari metrigi bazli ucretlendirme — 6+ ay kullanim verisi gerektirir)
- **ADV-12**: Self-service tenant signup (davet linksiz, herkesin kayit olabilmesi)

### Gelismis Ozellikler

- **ADV-01**: WhatsApp Business API entegrasyonu
- **ADV-02**: ERP real-time sync (Logo/Netsis)
- **ADV-03**: Sesli asistan (voice interface)
- **ADV-04**: Predictive ML modelleri (talep tahmini)
- **ADV-05**: Web chat interface (Telegram'a ek olarak)
- **ADV-06**: Per-company agent customization admin UI
- **ADV-07**: pgvector semantic product search

## Out of Scope

| Feature | Reason |
|---------|--------|
| WhatsApp Business API | Telegram oncelikli, WhatsApp v5.0'da |
| ERP entegrasyonu (Logo/Netsis) | API baglantisi v5.0'da |
| Sesli asistan | Text-based oncelikli |
| Mobil uygulama agent | Web + Telegram oncelikli |
| Coklu dil destegi | Sadece Turkce |
| Schema-per-tenant | Overkill for <50 tenants |
| Redis/separate queue | after() + prompt caching yeterli |
| LangChain/LangGraph | Over-engineered for 12 fixed roles |
| A2A cross-vendor protocol | Internal tool calls yeterli |
| iyzico/PayTR | Mollie secildi — Turkiye disinda da calisan global cozum |
| Odeme sistemi entegrasyonu | Mollie ile v4.0'da cozuldu |
| Odeme sistemi entegrasyonu | Mevcut odeme surecleri devam |

## Traceability

| Requirement | Milestone | Phase | Status |
|-------------|-----------|-------|--------|
| MT-01 | v3.0 | Phase 8 | Complete |
| MT-02 | v3.0 | Phase 8 | Complete |
| MT-03 | v3.0 | Phase 8 | Complete |
| MT-04 | v3.0 | Phase 8 | Complete |
| MT-05 | v3.0 | Phase 8 | Complete |
| MT-06 | v3.0 | Phase 8 | Complete |
| MT-07 | v3.0 | Phase 8 | Complete |
| MT-08 | v3.0 | Phase 8 | Complete |
| AI-01 | v3.0 | Phase 9 | Complete |
| AI-02 | v3.0 | Phase 9 | Complete |
| AI-03 | v3.0 | Phase 9 | Complete |
| AI-04 | v3.0 | Phase 9 | Complete |
| AI-05 | v3.0 | Phase 9 | Complete |
| AI-06 | v3.0 | Phase 9 | Complete |
| AI-07 | v3.0 | Phase 9 | Complete |
| AI-08 | v3.0 | Phase 9 | Complete |
| AI-09 | v3.0 | Phase 9 | Complete |
| AI-10 | v3.0 | Phase 9 | Complete |
| AI-11 | v3.0 | Phase 9 | Complete |
| TR-01 (v3.0) | v3.0 | Phase 10 | Complete |
| TR-02 (v3.0) | v3.0 | Phase 10 | Complete |
| TR-03 (v3.0) | v3.0 | Phase 10 | Complete |
| TR-04 (v3.0) | v3.0 | Phase 10 | Complete |
| SR-01 | v3.0 | Phase 10 | Complete |
| SR-02 | v3.0 | Phase 10 | Complete |
| SR-03 | v3.0 | Phase 10 | Complete |
| SR-04 | v3.0 | Phase 10 | Complete |
| SR-05 | v3.0 | Phase 10 | Complete |
| SR-06 | v3.0 | Phase 10 | Complete |
| SR-07 | v3.0 | Phase 10 | Complete |
| MH-01 | v3.0 | Phase 11 | Complete |
| MH-02 | v3.0 | Phase 11 | Complete |
| MH-03 | v3.0 | Phase 11 | Complete |
| MH-04 | v3.0 | Phase 11 | Complete |
| MH-05 | v3.0 | Phase 11 | Complete |
| MH-06 | v3.0 | Phase 11 | Complete |
| DS-01 | v3.0 | Phase 11 | Complete |
| DS-02 | v3.0 | Phase 11 | Complete |
| DS-03 | v3.0 | Phase 11 | Complete |
| DS-04 | v3.0 | Phase 11 | Complete |
| DS-05 | v3.0 | Phase 11 | Complete |
| GM-01 | v3.0 | Phase 11 | Complete |
| GM-02 | v3.0 | Phase 11 | Complete |
| GM-03 | v3.0 | Phase 11 | Complete |
| GM-04 | v3.0 | Phase 11 | Complete |
| GM-05 | v3.0 | Phase 11 | Complete |
| TU-01 | v3.0 | Phase 12 | Complete |
| TU-02 | v3.0 | Phase 12 | Complete |
| TU-03 | v3.0 | Phase 12 | Complete |
| TU-04 | v3.0 | Phase 12 | Complete |
| DK-01 | v3.0 | Phase 12 | Complete |
| DK-02 | v3.0 | Phase 12 | Complete |
| DK-03 | v3.0 | Phase 12 | Complete |
| SS-01 | v3.0 | Phase 12 | Complete |
| SS-02 | v3.0 | Phase 12 | Complete |
| SS-03 | v3.0 | Phase 12 | Complete |
| PZ-01 | v3.0 | Phase 12 | Complete |
| PZ-02 | v3.0 | Phase 12 | Complete |
| PZ-03 | v3.0 | Phase 12 | Complete |
| UY-01 | v3.0 | Phase 12 | Complete |
| UY-02 | v3.0 | Phase 12 | Complete |
| UY-03 | v3.0 | Phase 12 | Complete |
| SA-01 (v3.0 Satin Alma) | v3.0 | Phase 12 | Complete |
| SA-02 (v3.0 Satin Alma) | v3.0 | Phase 12 | Complete |
| SA-03 (v3.0 Satin Alma) | v3.0 | Phase 12 | Complete |
| IK-01 | v3.0 | Phase 12 | Complete |
| IK-02 | v3.0 | Phase 12 | Complete |
| IK-03 | v3.0 | Phase 12 | Complete |
| AO-01 | v3.0 | Phase 12 | Complete |
| AO-02 | v3.0 | Phase 12 | Complete |
| AO-03 | v3.0 | Phase 12 | Complete |
| DB-01 | v4.0 | Phase 14 | Complete |
| DB-02 | v4.0 | Phase 14 | Complete |
| DB-03 | v4.0 | Phase 14 | Complete |
| DB-04 | v4.0 | Phase 14 | Complete |
| DB-05 | v4.0 | Phase 14 | Complete |
| DB-06 | v4.0 | Phase 14 | Complete |
| DB-07 | v4.0 | Phase 14 | Complete |
| DB-08 | v4.0 | Phase 14 | Complete |
| SA-01 (v4.0 Superadmin) | v4.0 | Phase 15 | Pending |
| SA-02 (v4.0 Superadmin) | v4.0 | Phase 15 | Pending |
| SA-05 (v4.0 Superadmin) | v4.0 | Phase 15 | Pending |
| SA-06 (v4.0 Superadmin) | v4.0 | Phase 15 | Pending |
| KS-05 | v4.0 | Phase 15 | Pending |
| KS-06 | v4.0 | Phase 15 | Pending |
| KS-08 | v4.0 | Phase 15 | Pending |
| KS-01 | v4.0 | Phase 16 | Pending |
| KS-02 | v4.0 | Phase 16 | Pending |
| KS-03 | v4.0 | Phase 16 | Pending |
| KS-04 | v4.0 | Phase 16 | Pending |
| KS-07 | v4.0 | Phase 16 | Pending |
| BL-01 | v4.0 | Phase 17 | Pending |
| BL-02 | v4.0 | Phase 17 | Pending |
| BL-03 | v4.0 | Phase 17 | Pending |
| BL-04 | v4.0 | Phase 17 | Pending |
| BL-05 | v4.0 | Phase 17 | Pending |
| BL-06 | v4.0 | Phase 17 | Pending |
| TR-01 (v4.0) | v4.0 | Phase 17 | Pending |
| TR-02 (v4.0) | v4.0 | Phase 17 | Pending |
| TR-03 (v4.0) | v4.0 | Phase 17 | Pending |
| TR-04 (v4.0) | v4.0 | Phase 17 | Pending |
| TR-05 (v4.0) | v4.0 | Phase 17 | Pending |
| AM-01 | v4.0 | Phase 18 | Pending |
| AM-02 | v4.0 | Phase 18 | Pending |
| AM-03 | v4.0 | Phase 18 | Pending |
| AM-04 | v4.0 | Phase 18 | Pending |
| AM-05 | v4.0 | Phase 18 | Pending |
| AM-06 | v4.0 | Phase 18 | Pending |
| SA-03 (v4.0 Superadmin) | v4.0 | Phase 19 | Pending |
| SA-04 (v4.0 Superadmin) | v4.0 | Phase 19 | Pending |

**Coverage:**
- v3.0 requirements: 71 total (8 MT + 11 AI + 4 TR + 7 SR + 6 MH + 5 DS + 5 GM + 4 TU + 3 DK + 3 SS + 3 PZ + 3 UY + 3 SA + 3 IK + 3 AO)
- v3.0 mapped to phases: 71/71
- v4.0 requirements: 39 total (6 SA + 8 KS + 6 AM + 6 BL + 5 TR + 8 DB)
- v4.0 mapped to phases: 39/39
- Total unmapped: 0

| Phase | Milestone | Requirements | Count |
|-------|-----------|-------------|-------|
| Phase 8 — Multi-Tenant Database Migration | v3.0 | MT-01 through MT-08 | 8 |
| Phase 9 — Agent Infrastructure Foundation | v3.0 | AI-01 through AI-11 | 11 |
| Phase 10 — First Agent Group (Trainer + Sales) | v3.0 | TR-01..04, SR-01..07 | 11 |
| Phase 11 — Financial and Operations Agents | v3.0 | MH-01..06, DS-01..05, GM-01..05 | 16 |
| Phase 12 — Extended Agent Ecosystem | v3.0 | TU-01..04, DK-01..03, SS-01..03, PZ-01..03, UY-01..03, SA-01..03, IK-01..03, AO-01..03 | 25 |
| Phase 14 — Database Schema Foundation | v4.0 | DB-01..08 | 8 |
| Phase 15 — Company Creation Infrastructure | v4.0 | SA-01, SA-02, SA-05, SA-06, KS-05, KS-06, KS-08 | 7 |
| Phase 16 — Kurulum Sihirbazi | v4.0 | KS-01, KS-02, KS-03, KS-04, KS-07 | 5 |
| Phase 17 — Billing + Deneme Suresi | v4.0 | BL-01..06, TR-01..05 | 11 |
| Phase 18 — Agent Access Gating + Dijital Ekibim | v4.0 | AM-01..06 | 6 |
| Phase 19 — Superadmin Panel Dashboard + Trial Notifications | v4.0 | SA-03, SA-04 | 2 |

---
*Requirements defined: 2026-03-01*
*Last updated: 2026-03-05 — v4.0 traceability mapped to Phases 14-19*
