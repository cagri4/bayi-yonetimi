# B2B Bayi Siparis Yonetim Sistemi

## What This Is

Uretici firmanin bayilerine 7/24 siparis verebilme imkani sunan B2B siparis yonetim platformu. Web portal ve mobil uygulama uzerinden bayiler urun katalogunu gorebilir, stok durumunu kontrol edebilir, kendi grup fiyatlarini gorebilir ve siparis verebilir. Admin panelden urunler, bayiler ve siparisler yonetilir.

## Core Value

Bayilerin mesai saatlerinden bagimsiz, anlik stok ve fiyat bilgisiyle siparis verebilmesi — "siparisim nerede?" sorusuna son.

## Current State

**v1 MVP shipped: 2026-02-03**
**v2.0 shipped: 2026-03-01**

- Web portal: Next.js 16 App Router + Supabase
- 38 routes deployed on Vercel
- Supabase: neqcuhejmornybmbclwt (Frankfurt)

**Deployed capabilities (v1 + v2.0):**
- Dealer auth with session persistence
- Product catalog with group pricing (Altin/Gumus/Bronz)
- Shopping cart with minimum order validation
- Order creation with status tracking + cargo tracking
- Realtime order updates via Supabase Realtime
- Quick order form with SKU search
- Reorder from history
- Admin product/dealer/order management
- Sales reporting with CSV/Excel export
- Dealer dashboard (spending summary, top products, recent orders)
- Financial backbone (cari hesap, transactions, invoices)
- Campaigns and announcements with read receipts
- Order documents (invoice/irsaliye PDF upload)
- Support messaging (dealer-admin async)
- FAQ system
- Product requests
- Spending reports with Excel export

## Requirements

### Validated

**Bayi Portali:**
- [x] Urun katalogu goruntuleme (resimler, stok durumu) — v1
- [x] Bayi grubuna gore fiyat goruntuleme (Altin/Gumus/Bronz iskonto) — v1
- [x] Sepete urun ekleme ve toplu siparis verme — v1
- [x] Hizli siparis (sik alinan urunler icin) — v1
- [x] Siparis gecmisi ve durum takibi — v1
- [x] Push notification (siparis durumu degisimlerinde) — v1
- [x] Email + sifre ile giris — v1

**Admin Paneli:**
- [x] Urun yonetimi (ekleme, duzenleme, stok guncelleme, resim yukleme) — v1
- [x] Bayi yonetimi (ekleme, grup atama, aktif/pasif) — v1
- [x] Bayi grubu yonetimi (iskonto oranlari, minimum siparis tutari) — v1
- [x] Siparis yonetimi (goruntuleme, durum degistirme, iptal) — v1
- [x] Temel raporlama (satis, bayi performansi) — v1

**Siparis Akisi:**
- [x] Siparis durumlari: Beklemede -> Onaylandi -> Hazirlaniyor -> Kargoya Verildi -> Teslim Edildi — v1
- [x] Minimum siparis tutari kontrolu (bayi grubuna gore) — v1

### Active

**Current Milestone: v3.0 — Multi-Tenant SaaS + AI Agent Ecosystem**

**Goal:** Mevcut SaaS'i multi-tenant yapiya donustur, 12 AI dijital calisani Telegram uzerinden Claude API ile insa et. Birden fazla firmaya satilabilir urun haline getir.

**Multi-Tenant Mimari:**
- [ ] companies tablosu ve firma yonetimi
- [ ] Tum tablolara company_id ekleme
- [ ] RLS policy'leri company-aware guncelleme
- [ ] Firma bazli login ve routing

**Agent Altyapisi:**
- [ ] Claude API entegrasyonu (tool calling framework)
- [ ] Telegram Bot entegrasyonu
- [ ] Agent konusma hafizasi ve state yonetimi
- [ ] Agent-to-agent iletisim protokolu
- [ ] Agent tool sarmalama (mevcut server actions -> tools)

**12 AI Dijital Calisan:**
- [ ] Satis Temsilcisi (bayi siparisi, urun onerme, fiyat verme)
- [ ] Muhasebeci (cari hesap, fatura, tahsilat takibi)
- [ ] Depo Sorumlusu (stok yonetimi, siparis hazirlama)
- [ ] Saha Satis Sorumlusu (rut planlama, bayi ziyaret)
- [ ] Dagitim Koordinatoru (rut optimizasyonu, teslimat takibi)
- [ ] Tahsilat Uzmani (vadesi gecen alacak, odeme hatirlatma)
- [ ] Satin Alma Sorumlusu (tedarikci siparisi, stok yenileme)
- [ ] Pazarlamaci (kampanya yonetimi, bayi segmentasyonu)
- [ ] Urun Yoneticisi (katalog yonetimi, fiyat stratejisi)
- [ ] Egitimci (bayi onboarding, urun egitimi)
- [ ] Iade/Kalite Sorumlusu (iade sureci, sikayet takibi)
- [ ] Genel Mudur Danismani (KPI, stratejik analiz, trend tespiti)

### Out of Scope

- ERP entegrasyonu (Logo/Netsis) — API baglantisi v4.0'da
- Odeme sistemi entegrasyonu — Mevcut odeme surecleri devam edecek
- WhatsApp Business API — Telegram oncelikli, WhatsApp v4.0'da
- Sesli asistan — Text-based oncelikli
- Mobil uygulama agent entegrasyonu — Web + Telegram oncelikli
- Coklu dil destegi — Sadece Turkce

## Context

**Onceki Durum (v1 oncesi):**
- Siparisler telefon, WhatsApp ve Excel ile aliniyordu
- Manuel ERP girisi yapiliyordu (hata ve zaman kaybi)
- Mesai saatleri disinda siparis alinamiyordu
- Bayiler stok ve fiyat icin her seferinde aramak zorundaydi
- Siparis takibi yoktu, "siparisim nerede?" sorulari cok fazlaydi

**Is Olcegi:**
- ~700 kayitli bayi (~50 aktif kullanici hedefi baslangiçta)
- 10-15 marka
- ~500 urun
- Gunde 20-30 siparis beklentisi

**Bayi Gruplari:**
- Altin, Gumus, Bronz gibi gruplar
- Her grubun farkli iskonto orani
- Her grubun farkli minimum siparis tutari olabilir

## Constraints

- **Platform**: Web portal (Next.js 16) + Telegram Bot
- **Backend**: Next.js API Routes + Supabase (Auth, Database, Realtime, Storage)
- **AI**: Claude API (Anthropic) — tool calling for agent capabilities
- **Messaging**: Telegram Bot API — primary agent channel
- **Deployment**: Vercel (web + API)
- **Multi-tenant**: Single deployment, company_id isolation
- **Dil**: Sadece Turkce

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase + Next.js stack | Ayri backend yerine Supabase ile auth/db/realtime tek yerden, daha hizli gelistirme | Good — 9 gunde MVP tamamlandi |
| Bayi grubu + bayiye ozel fiyat | Hem grup bazli iskonto hem de bayiye ozel fiyat override destegi | Good — get_dealer_price RPC ile tutarli fiyatlama |
| Expo (React Native) secimi | Tek codebase ile iOS + Android, Supabase client destegi, hizli gelistirme | Good — Ayni is mantigi web ve mobile'da calisiyor |
| Demo data ile MVP | ERP entegrasyonu karmasik, once temel akisi dogrulamak onemli | Good — Hizli iterasyon sagladi |
| Sepet + hizli siparis | Hem detayli siparis hem de sik kullanim senaryolari desteklenmeli | Good — Iki farkli UX pattern yeterliligi kanitladi |
| Zustand + localStorage cart | Server-side cart yerine client-side basitlik | Good — Hizli ve responsive UX |
| Supabase Realtime for orders | WebSocket yerine Supabase postgres_changes | Good — Minimum setup ile realtime calisiyor |
| Edge Function for push | Client-side push yerine server-triggered | Good — Guvenli ve olceklenebilir |

| Multi-tenant architecture | Scale to multiple companies from single deployment | — Pending |
| Claude API for agents | Best tool-calling capability, Turkish language support | — Pending |
| Telegram as primary channel | B2B users prefer Telegram for business bots, rich API | — Pending |
| Agent-per-role design | Each business role = separate agent with own tools/authority | — Pending |

---
*Last updated: 2026-03-01 after v3.0 milestone start*
