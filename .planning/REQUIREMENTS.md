# Requirements: Bayi Yonetimi v3.0

**Defined:** 2026-03-01
**Core Value:** Bayilerin mesai saatlerinden bagimsiz, anlik stok ve fiyat bilgisiyle siparis verebilmesi — AI agent'lar ile 7/24 otonom is surecleri.

## v3.0 Requirements

### Multi-Tenant Altyapi

- [ ] **MT-01**: Sistem birden fazla firmayi tek deployment uzerinden bagimsiz olarak destekler (company_id izolasyonu)
- [ ] **MT-02**: Her firma kendi bayilerini, urunlerini ve siparislerini yalnizca kendisi gorebilir (RLS ile izolasyon)
- [ ] **MT-03**: Mevcut 20+ tabloya company_id eklenir ve tum veriler backfill edilir (zero downtime)
- [ ] **MT-04**: Admin kullanicisi yalnizca kendi firmasinin verilerini yonetebilir (is_company_admin)
- [ ] **MT-05**: Platform operatoru (superadmin) tum firmalari gorebilir ve yonetebilir
- [ ] **MT-06**: JWT claim injection ile tenant izolasyonu saglanan current_company_id() fonksiyonu calisir
- [ ] **MT-07**: Materialized view (dealer_spending_summary) company_id ile yeniden olusturulur ve RPC ile sarmalanir
- [ ] **MT-08**: Composite index'ler (company_id, dealer_id) tum tenant-scoped tablolara eklenir

### Ajan Altyapisi

- [ ] **AI-01**: AgentRunner sinifi Claude API tool-calling loop ile calisir (max 10 iterasyon, model secimi per rol)
- [ ] **AI-02**: ToolRegistry her ajan rolu icin 4-7 tool yukler (tum tool'lar degil, sadece ilgili olanlar)
- [ ] **AI-03**: ConversationManager DB-backed mesaj gecmisi tutar (rolling window 50 mesaj + otomatik ozet)
- [ ] **AI-04**: Telegram webhook route immediate 200 response + after() ile background processing yapar
- [ ] **AI-05**: update_id idempotency ile duplicate mesaj isleme engellenir
- [ ] **AI-06**: AgentBridge cross-agent tool call yapar (direkt DB sorgusu, Claude invocation olmadan)
- [ ] **AI-07**: Per-dealer gunluk token budget tracking (50K soft / 100K hard limit) calisir
- [ ] **AI-08**: Agent-to-agent deadlock korumasi (depth limit 5, cycle detection, 10 tool call cap)
- [ ] **AI-09**: agent_definitions, agent_conversations, agent_messages, agent_calls tablolari olusturulur
- [ ] **AI-10**: Prompt caching konfigurasyonu (system prompt + tool definition uzerine cache_control)
- [ ] **AI-11**: Service role client (createServiceClient) sadece agent layer icin olusturulur

### Egitimci (Trainer Agent)

- [ ] **TR-01**: Egitimci ajani urun bilgisi sorgusuna yanitlar verir (get_product_info tool)
- [ ] **TR-02**: Egitimci ajani FAQ sorularina yanitlar verir (get_faq tool)
- [ ] **TR-03**: Egitimci ajani Telegram uzerinden bayilerle Turkce konusur
- [ ] **TR-04**: Egitimci ajani read-only calisir, hicbir veriyi degistirmez

### Satis Temsilcisi (Sales Agent)

- [ ] **SR-01**: Satis temsilcisi urun katalogu sorgular (get_catalog tool)
- [ ] **SR-02**: Satis temsilcisi siparis olusturur (create_order tool)
- [ ] **SR-03**: Satis temsilcisi siparis durumu sorgular (get_order_status tool)
- [ ] **SR-04**: Satis temsilcisi kampanya bilgisi verir (get_campaigns tool)
- [ ] **SR-05**: Satis temsilcisi stok kontrolu yapar (check_stock tool)
- [ ] **SR-06**: Satis temsilcisi bayi profil bilgisi sorgular (get_dealer_profile tool)
- [ ] **SR-07**: Satis temsilcisi Telegram uzerinden siparis akisini yonetir

### Muhasebeci (Accountant Agent)

- [ ] **MH-01**: Muhasebeci cari hesap bilgisi sorgular (get_financials tool)
- [ ] **MH-02**: Muhasebeci odeme gecmisi sorgular (get_payment_history tool)
- [ ] **MH-03**: Muhasebeci fatura bilgisi sorgular (get_invoices tool)
- [ ] **MH-04**: Muhasebeci bayi bakiyesi sorgular (get_dealer_balance tool)
- [ ] **MH-05**: Muhasebeci finansal rapor export eder (export_report tool)
- [ ] **MH-06**: Muhasebeci tool olmadan asla finansal rakam soylemez (hallucination prevention)

### Depo Sorumlusu (Warehouse Agent)

- [ ] **DS-01**: Depo sorumlusu envanter durumu sorgular (get_inventory_status tool)
- [ ] **DS-02**: Depo sorumlusu bekleyen siparisleri listeler (get_pending_orders tool)
- [ ] **DS-03**: Depo sorumlusu stok gunceller (update_stock tool — write operation)
- [ ] **DS-04**: Depo sorumlusu yeniden siparis seviyesi kontrol eder (check_reorder_level tool)
- [ ] **DS-05**: Depo sorumlusu sevkiyat bilgisi sorgular (get_shipments tool)

### Genel Mudur Danismani (Executive Advisor Agent)

- [ ] **GM-01**: GM danismani tum ajanlarin read-only tool'larini kullanir (cross-domain sorgu)
- [ ] **GM-02**: GM danismani dashboard ozeti sunar (get_dashboard_summary tool)
- [ ] **GM-03**: GM danismani rapor export eder (export_report tool)
- [ ] **GM-04**: GM danismani Sonnet 4.6 ile karmasik analiz yapar (complex reasoning)
- [ ] **GM-05**: GM danismani KPI ve trend analizi sunar

### Tahsilat Uzmani (Collections Agent)

- [ ] **TU-01**: Tahsilat uzmani vadesi gecen alacaklari listeler (get_overdue_payments tool)
- [ ] **TU-02**: Tahsilat uzmani odeme hatirlatmasi gonderir (send_reminder tool)
- [ ] **TU-03**: Tahsilat uzmani tahsilat aktivitesi kaydeder (log_collection_activity tool)
- [ ] **TU-04**: Tahsilat uzmani icin collection_activities tablosu olusturulur

### Dagitim Koordinatoru (Distribution Agent)

- [ ] **DK-01**: Dagitim koordinatoru teslimat durumu sorgular (get_delivery_status tool)
- [ ] **DK-02**: Dagitim koordinatoru rut bilgisi yonetir (manage_routes tool)
- [ ] **DK-03**: Dagitim koordinatoru kargo takibi yapar (track_shipment tool)

### Saha Satis Sorumlusu (Field Sales Agent)

- [ ] **SS-01**: Saha satis sorumlusu bayi ziyaret plani olusturur (plan_visit tool)
- [ ] **SS-02**: Saha satis sorumlusu ziyaret kaydeder (log_visit tool)
- [ ] **SS-03**: Saha satis sorumlusu icin dealer_visits ve sales_targets tablolari olusturulur

### Pazarlamaci (Marketing Agent)

- [ ] **PZ-01**: Pazarlamaci kampanya analizi yapar (analyze_campaigns tool)
- [ ] **PZ-02**: Pazarlamaci bayi segmentasyonu olusturur (segment_dealers tool)
- [ ] **PZ-03**: Pazarlamaci kampanya onerisi sunar (suggest_campaign tool)

### Urun Yoneticisi (Product Manager Agent)

- [ ] **UY-01**: Urun yoneticisi katalog analizi yapar (analyze_catalog tool)
- [ ] **UY-02**: Urun yoneticisi fiyat stratejisi onerir (suggest_pricing tool)
- [ ] **UY-03**: Urun yoneticisi urun talep analizi yapar (analyze_requests tool)

### Satin Alma Sorumlusu (Procurement Agent)

- [ ] **SA-01**: Satin alma sorumlusu tedarikci siparisi olusturur (create_purchase_order tool)
- [ ] **SA-02**: Satin alma sorumlusu stok yenileme onerir (suggest_restock tool)
- [ ] **SA-03**: Satin alma sorumlusu icin suppliers ve purchase_orders tablolari olusturulur

### Iade Kalite Sorumlusu (Returns/Quality Agent)

- [ ] **IK-01**: Iade sorumlusu iade talebi yonetir (manage_return tool)
- [ ] **IK-02**: Iade sorumlusu sikayet takibi yapar (track_complaint tool)
- [ ] **IK-03**: Iade sorumlusu icin return_requests ve quality_complaints tablolari olusturulur

### Ajan Orkestrasyon

- [ ] **AO-01**: Tum 12 ajanin Telegram bot'lari kayitli ve webhook'lari aktif
- [ ] **AO-02**: Agent-to-agent handoff workflow'lari calisir (Sales -> Warehouse stok kontrolu vb.)
- [ ] **AO-03**: Proaktif bildirim sistemi calisir (gunluk brifing per ajan)

## v3.1 Requirements (Deferred)

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
| WhatsApp Business API | Telegram oncelikli, WhatsApp v4.0'da |
| ERP entegrasyonu (Logo/Netsis) | API baglantisi v4.0'da |
| Sesli asistan | Text-based oncelikli |
| Mobil uygulama agent | Web + Telegram oncelikli |
| Coklu dil destegi | Sadece Turkce |
| Schema-per-tenant | Overkill for <50 tenants |
| Redis/separate queue | after() + prompt caching yeterli |
| LangChain/LangGraph | Over-engineered for 12 fixed roles |
| A2A cross-vendor protocol | Internal tool calls yeterli |
| Odeme sistemi entegrasyonu | Mevcut odeme surecleri devam |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MT-01 | — | Pending |
| MT-02 | — | Pending |
| MT-03 | — | Pending |
| MT-04 | — | Pending |
| MT-05 | — | Pending |
| MT-06 | — | Pending |
| MT-07 | — | Pending |
| MT-08 | — | Pending |
| AI-01 | — | Pending |
| AI-02 | — | Pending |
| AI-03 | — | Pending |
| AI-04 | — | Pending |
| AI-05 | — | Pending |
| AI-06 | — | Pending |
| AI-07 | — | Pending |
| AI-08 | — | Pending |
| AI-09 | — | Pending |
| AI-10 | — | Pending |
| AI-11 | — | Pending |
| TR-01 | — | Pending |
| TR-02 | — | Pending |
| TR-03 | — | Pending |
| TR-04 | — | Pending |
| SR-01 | — | Pending |
| SR-02 | — | Pending |
| SR-03 | — | Pending |
| SR-04 | — | Pending |
| SR-05 | — | Pending |
| SR-06 | — | Pending |
| SR-07 | — | Pending |
| MH-01 | — | Pending |
| MH-02 | — | Pending |
| MH-03 | — | Pending |
| MH-04 | — | Pending |
| MH-05 | — | Pending |
| MH-06 | — | Pending |
| DS-01 | — | Pending |
| DS-02 | — | Pending |
| DS-03 | — | Pending |
| DS-04 | — | Pending |
| DS-05 | — | Pending |
| GM-01 | — | Pending |
| GM-02 | — | Pending |
| GM-03 | — | Pending |
| GM-04 | — | Pending |
| GM-05 | — | Pending |
| TU-01 | — | Pending |
| TU-02 | — | Pending |
| TU-03 | — | Pending |
| TU-04 | — | Pending |
| DK-01 | — | Pending |
| DK-02 | — | Pending |
| DK-03 | — | Pending |
| SS-01 | — | Pending |
| SS-02 | — | Pending |
| SS-03 | — | Pending |
| PZ-01 | — | Pending |
| PZ-02 | — | Pending |
| PZ-03 | — | Pending |
| UY-01 | — | Pending |
| UY-02 | — | Pending |
| UY-03 | — | Pending |
| SA-01 | — | Pending |
| SA-02 | — | Pending |
| SA-03 | — | Pending |
| IK-01 | — | Pending |
| IK-02 | — | Pending |
| IK-03 | — | Pending |
| AO-01 | — | Pending |
| AO-02 | — | Pending |
| AO-03 | — | Pending |

**Coverage:**
- v3.0 requirements: 68 total
- Mapped to phases: 0 (awaiting roadmap)
- Unmapped: 68

---
*Requirements defined: 2026-03-01*
*Last updated: 2026-03-01 after research synthesis*
