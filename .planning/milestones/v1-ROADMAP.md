# Milestone v1: MVP

**Status:** SHIPPED 2026-02-03
**Phases:** 1-3
**Total Plans:** 14

## Overview

Bu roadmap bayilerin 7/24 siparis verebilmesini saglayan B2B platformunu, temel auth ve urun yonetiminden baslayarak siparis takibi, raporlama ve mobil uygulamaya dogru 3 asamali bir yolculukla insa eder. Her faz tamamlandiginda bayiler ve adminler gozle gorulur yeni yeteneklere sahip olur.

## Phases

### Phase 1: Foundation & Basic Ordering

**Goal**: Bayiler portal uzerinden giris yapabilir, urun katalogunu grup fiyatlariyla goruntuleyebilir ve temel siparis verebilir. Admin urunleri, bayileri ve fiyatlandirmayi yonetebilir.

**Depends on**: Nothing (first phase)

**Requirements**: AUTH-01, AUTH-02, AUTH-03, PROD-01, PROD-02, PROD-03, PROD-04, PRIC-01, PRIC-02, PRIC-03, ADLR-01, ADLR-02, ADLR-03, ADLR-04, ADLR-05, ADLR-06, APRD-01, APRD-02, APRD-03, APRD-04, APRD-05, ORDR-01, ORDR-02, ORDR-03

**Success Criteria** (what must be TRUE):
  1. Bayi email ve sifre ile giris yapabilir ve oturumu tarayici yenilemesinde korunur
  2. Bayi urun katalogunu resimlerle goruntuleyebilir, stok durumunu gorebilir ve urunleri filtreleyebilir/arayabilir
  3. Bayi kendi grubuna (Altin/Gumus/Bronz) gore dogru iskontolu fiyatlari gorur
  4. Bayi sepete urun ekleyebilir, adetleri degistirebilir ve minimum tutar kontrolu ile siparis olusturabilir
  5. Admin urunleri ekleyebilir, duzenleyebilir, resim yukleyebilir ve stok guncelleyebilir
  6. Admin bayi ekleyebilir, gruplara atayabilir, grup iskonto/minimum tutarlarini belirleyebilir ve bayiye ozel fiyat tanimlayabilir

**Plans**: 6 plans

Plans:
- [x] 01-01-PLAN.md - Project setup, Supabase clients, database schema
- [x] 01-02-PLAN.md - Authentication (login, password reset, session management)
- [x] 01-03-PLAN.md - Admin product management (CRUD, images, stock)
- [x] 01-04-PLAN.md - Admin dealer management (groups, pricing overrides)
- [x] 01-05-PLAN.md - Dealer catalog with group pricing and filters
- [x] 01-06-PLAN.md - Shopping cart and basic order creation

**Completed:** 2026-01-26

---

### Phase 2: Order Management & Tracking

**Goal**: Bayiler siparislerinin durumunu takip edebilir, gecmis siparislerini goruntuleyebilir ve anlik bildirimler alabilir. Admin siparisleri yonetebilir ve durum degistirebilir.

**Depends on**: Phase 1

**Requirements**: TRAC-01, TRAC-02, ORDR-04, ORDR-05, ORDR-06, AORD-01, AORD-02, AORD-03, AORD-04

**Success Criteria** (what must be TRUE):
  1. Bayi siparisinin durumunu (Beklemede/Onaylandi/Hazirlaniyor/Kargoda/Teslim) anlik olarak gorebilir
  2. Bayi siparis durumu degistiginde realtime bildirim alir
  3. Bayi gecmis siparislerini goruntuleyebilir ve gecmis siparislerden tekrar siparis verebilir
  4. Bayi sik siparis ettigi urunlerden hizli siparis formu ile siparis verebilir
  5. Admin tum siparisleri listeleyebilir, filtreleyebilir, detaylari goruntuleyebilir ve siparis durumunu degistirebilir
  6. Admin siparisi iptal edebilir

**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md - Dealer order history, detail page, realtime status tracking
- [x] 02-02-PLAN.md - Admin order list with filters, detail view, status updates, cancellation
- [x] 02-03-PLAN.md - Quick order form with SKU search, frequent products, reorder from history

**Completed:** 2026-01-27

---

### Phase 3: Insights & Mobile

**Goal**: Admin donemsel raporlama ve analiz yapabilir. Bayiler mobil uygulama uzerinden tum portal yeteneklerini kullanabilir ve push notification alabilir.

**Depends on**: Phase 1, Phase 2

**Requirements**: ARPT-01, ARPT-02, ARPT-03, ARPT-04, MOBL-01, MOBL-02, MOBL-03, MOBL-04, MOBL-05

**Success Criteria** (what must be TRUE):
  1. Admin donemsel satis raporunu (gunluk/haftalik/aylik) gorebilir
  2. Admin en cok satan urunleri ve bayi bazli satis performansini gorebilir
  3. Admin raporlari CSV formatinda export edebilir
  4. Bayi mobil uygulamadan giris yapabilir ve urun katalogunu goruntuleyebilir
  5. Bayi mobil uygulamadan siparis verebilir ve siparislerini takip edebilir
  6. Bayi mobil uygulamada siparis guncellemeleri icin push notification alabilir

**Plans**: 5 plans

Plans:
- [x] 03-01-PLAN.md - Admin sales reporting dashboard with time-series charts
- [x] 03-02-PLAN.md - Top products report, dealer performance report, CSV export
- [x] 03-03-PLAN.md - Expo mobile app foundation with authentication
- [x] 03-04-PLAN.md - Mobile product catalog with dealer pricing and cart
- [x] 03-05-PLAN.md - Mobile orders, checkout, and push notifications

**Completed:** 2026-02-03

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Basic Ordering | 6/6 | Complete | 2026-01-26 |
| 2. Order Management & Tracking | 3/3 | Complete | 2026-01-27 |
| 3. Insights & Mobile | 5/5 | Complete | 2026-02-03 |

---

## Milestone Summary

**Key Decisions:**
- Supabase + Next.js stack — unified auth/db/realtime, 9 days to MVP
- Zustand + localStorage cart — client-side simplicity, responsive UX
- Expo for mobile — shared Supabase client, single codebase iOS/Android
- Edge Function for push — server-triggered, secure and scalable

**Issues Resolved:**
- Mobile cart-to-checkout flow break (fixed in commit 0b3ba65)
- Supabase RPC type inference issues (workaround with type casting)

**Technical Debt:**
- Push notification webhook requires manual Supabase configuration
- Expo project ID must be added to mobile/.env

---

*Archived: 2026-02-03 as part of v1 milestone completion*
*For current project status, see .planning/ROADMAP.md (created for next milestone)*
