# Requirements: Bayi Yonetimi v3.0

**Defined:** 2026-03-01
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

- [ ] **AI-01**: AgentRunner sinifi Claude API tool-calling loop ile calisir (max 10 iterasyon, model secimi per rol)
- [x] **AI-02**: ToolRegistry her ajan rolu icin 4-7 tool yukler (tum tool'lar degil, sadece ilgili olanlar)
- [ ] **AI-03**: ConversationManager DB-backed mesaj gecmisi tutar (rolling window 50 mesaj + otomatik ozet)
- [ ] **AI-04**: Telegram webhook route immediate 200 response + after() ile background processing yapar
- [ ] **AI-05**: update_id idempotency ile duplicate mesaj isleme engellenir
- [ ] **AI-06**: AgentBridge cross-agent tool call yapar (direkt DB sorgusu, Claude invocation olmadan)
- [x] **AI-07**: Per-dealer gunluk token budget tracking (50K soft / 100K hard limit) calisir
- [ ] **AI-08**: Agent-to-agent deadlock korumasi (depth limit 5, cycle detection, 10 tool call cap)
- [x] **AI-09**: agent_definitions, agent_conversations, agent_messages, agent_calls tablolari olusturulur
- [x] **AI-10**: Prompt caching konfigurasyonu (system prompt + tool definition uzerine cache_control)
- [x] **AI-11**: Service role client (createServiceClient) sadece agent layer icin olusturulur

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
| MT-01 | Phase 8 | Complete |
| MT-02 | Phase 8 | Complete |
| MT-03 | Phase 8 | Complete |
| MT-04 | Phase 8 | Complete |
| MT-05 | Phase 8 | Complete |
| MT-06 | Phase 8 | Complete |
| MT-07 | Phase 8 | Complete |
| MT-08 | Phase 8 | Complete |
| AI-01 | Phase 9 | Pending |
| AI-02 | Phase 9 | Complete |
| AI-03 | Phase 9 | Pending |
| AI-04 | Phase 9 | Pending |
| AI-05 | Phase 9 | Pending |
| AI-06 | Phase 9 | Pending |
| AI-07 | Phase 9 | Complete |
| AI-08 | Phase 9 | Pending |
| AI-09 | Phase 9 | Complete |
| AI-10 | Phase 9 | Complete |
| AI-11 | Phase 9 | Complete |
| TR-01 | Phase 10 | Pending |
| TR-02 | Phase 10 | Pending |
| TR-03 | Phase 10 | Pending |
| TR-04 | Phase 10 | Pending |
| SR-01 | Phase 10 | Pending |
| SR-02 | Phase 10 | Pending |
| SR-03 | Phase 10 | Pending |
| SR-04 | Phase 10 | Pending |
| SR-05 | Phase 10 | Pending |
| SR-06 | Phase 10 | Pending |
| SR-07 | Phase 10 | Pending |
| MH-01 | Phase 11 | Pending |
| MH-02 | Phase 11 | Pending |
| MH-03 | Phase 11 | Pending |
| MH-04 | Phase 11 | Pending |
| MH-05 | Phase 11 | Pending |
| MH-06 | Phase 11 | Pending |
| DS-01 | Phase 11 | Pending |
| DS-02 | Phase 11 | Pending |
| DS-03 | Phase 11 | Pending |
| DS-04 | Phase 11 | Pending |
| DS-05 | Phase 11 | Pending |
| GM-01 | Phase 11 | Pending |
| GM-02 | Phase 11 | Pending |
| GM-03 | Phase 11 | Pending |
| GM-04 | Phase 11 | Pending |
| GM-05 | Phase 11 | Pending |
| TU-01 | Phase 12 | Pending |
| TU-02 | Phase 12 | Pending |
| TU-03 | Phase 12 | Pending |
| TU-04 | Phase 12 | Pending |
| DK-01 | Phase 12 | Pending |
| DK-02 | Phase 12 | Pending |
| DK-03 | Phase 12 | Pending |
| SS-01 | Phase 12 | Pending |
| SS-02 | Phase 12 | Pending |
| SS-03 | Phase 12 | Pending |
| PZ-01 | Phase 12 | Pending |
| PZ-02 | Phase 12 | Pending |
| PZ-03 | Phase 12 | Pending |
| UY-01 | Phase 12 | Pending |
| UY-02 | Phase 12 | Pending |
| UY-03 | Phase 12 | Pending |
| SA-01 | Phase 12 | Pending |
| SA-02 | Phase 12 | Pending |
| SA-03 | Phase 12 | Pending |
| IK-01 | Phase 12 | Pending |
| IK-02 | Phase 12 | Pending |
| IK-03 | Phase 12 | Pending |
| AO-01 | Phase 12 | Pending |
| AO-02 | Phase 12 | Pending |
| AO-03 | Phase 12 | Pending |

**Coverage:**
- v3.0 requirements: 71 total (8 MT + 11 AI + 4 TR + 7 SR + 6 MH + 5 DS + 5 GM + 4 TU + 3 DK + 3 SS + 3 PZ + 3 UY + 3 SA + 3 IK + 3 AO)
- Mapped to phases: 71/71
- Unmapped: 0

| Phase | Requirements | Count |
|-------|-------------|-------|
| Phase 8 — Multi-Tenant Database Migration | MT-01 through MT-08 | 8 |
| Phase 9 — Agent Infrastructure Foundation | AI-01 through AI-11 | 11 |
| Phase 10 — First Agent Group (Trainer + Sales) | TR-01..04, SR-01..07 | 11 |
| Phase 11 — Financial and Operations Agents | MH-01..06, DS-01..05, GM-01..05 | 16 |
| Phase 12 — Extended Agent Ecosystem | TU-01..04, DK-01..03, SS-01..03, PZ-01..03, UY-01..03, SA-01..03, IK-01..03, AO-01..03 | 25 |

---
*Requirements defined: 2026-03-01*
*Last updated: 2026-03-01 — traceability mapped to Phases 8-12*
