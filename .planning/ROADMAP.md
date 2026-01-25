# Roadmap: B2B Bayi Sipariş Yönetim Sistemi

## Overview

Bu roadmap bayilerin 7/24 sipariş verebilmesini sağlayan B2B platformunu, temel auth ve ürün yönetiminden başlayarak sipariş takibi, raporlama ve mobil uygulamaya doğru 3 aşamalı bir yolculukla inşa eder. Her faz tamamlandığında bayiler ve adminler gözle görülür yeni yeteneklere sahip olur.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Basic Ordering** - Auth, ürün kataloğu, fiyatlandırma, bayi yönetimi ve temel sipariş verme
- [ ] **Phase 2: Order Management & Tracking** - Sipariş takibi, geçmiş, bildirimler ve admin sipariş yönetimi
- [ ] **Phase 3: Insights & Mobile** - Raporlama ve mobil uygulama

## Phase Details

### Phase 1: Foundation & Basic Ordering
**Goal**: Bayiler portal üzerinden giriş yapabilir, ürün kataloğunu grup fiyatlarıyla görüntüleyebilir ve temel sipariş verebilir. Admin ürünleri, bayileri ve fiyatlandırmayı yönetebilir.

**Depends on**: Nothing (first phase)

**Requirements**: AUTH-01, AUTH-02, AUTH-03, PROD-01, PROD-02, PROD-03, PROD-04, PRIC-01, PRIC-02, PRIC-03, ADLR-01, ADLR-02, ADLR-03, ADLR-04, ADLR-05, ADLR-06, APRD-01, APRD-02, APRD-03, APRD-04, APRD-05, ORDR-01, ORDR-02, ORDR-03

**Success Criteria** (what must be TRUE):
  1. Bayi email ve şifre ile giriş yapabilir ve oturumu tarayıcı yenilemesinde korunur
  2. Bayi ürün kataloğunu resimlerle görüntüleyebilir, stok durumunu görebilir ve ürünleri filtreleyebilir/arayabilir
  3. Bayi kendi grubuna (Altın/Gümüş/Bronz) göre doğru iskontolu fiyatları görür
  4. Bayi sepete ürün ekleyebilir, adetleri değiştirebilir ve minimum tutar kontrolü ile sipariş oluşturabilir
  5. Admin ürünleri ekleyebilir, düzenleyebilir, resim yükleyebilir ve stok güncelleyebilir
  6. Admin bayi ekleyebilir, gruplara atayabilir, grup iskonto/minimum tutarlarını belirleyebilir ve bayiye özel fiyat tanımlayabilir

**Plans**: TBD

Plans:
- TBD after phase planning

---

### Phase 2: Order Management & Tracking
**Goal**: Bayiler siparişlerinin durumunu takip edebilir, geçmiş siparişlerini görüntüleyebilir ve anlık bildirimler alabilir. Admin siparişleri yönetebilir ve durum değiştirebilir.

**Depends on**: Phase 1

**Requirements**: TRAC-01, TRAC-02, ORDR-04, ORDR-05, ORDR-06, AORD-01, AORD-02, AORD-03, AORD-04

**Success Criteria** (what must be TRUE):
  1. Bayi siparişinin durumunu (Beklemede/Onaylandı/Hazırlanıyor/Kargoda/Teslim) anlık olarak görebilir
  2. Bayi sipariş durumu değiştiğinde realtime bildirim alır
  3. Bayi geçmiş siparişlerini görüntüleyebilir ve geçmiş siparişlerden tekrar sipariş verebilir
  4. Bayi sık sipariş ettiği ürünlerden hızlı sipariş formu ile sipariş verebilir
  5. Admin tüm siparişleri listeleyebilir, filtreleyebilir, detayları görüntüleyebilir ve sipariş durumunu değiştirebilir
  6. Admin siparişi iptal edebilir

**Plans**: TBD

Plans:
- TBD after phase planning

---

### Phase 3: Insights & Mobile
**Goal**: Admin dönemsel raporlama ve analiz yapabilir. Bayiler mobil uygulama üzerinden tüm portal yeteneklerini kullanabilir ve push notification alabilir.

**Depends on**: Phase 1, Phase 2

**Requirements**: ARPT-01, ARPT-02, ARPT-03, ARPT-04, MOBL-01, MOBL-02, MOBL-03, MOBL-04, MOBL-05

**Success Criteria** (what must be TRUE):
  1. Admin dönemsel satış raporunu (günlük/haftalık/aylık) görebilir
  2. Admin en çok satan ürünleri ve bayi bazlı satış performansını görebilir
  3. Admin raporları CSV formatında export edebilir
  4. Bayi mobil uygulamadan giriş yapabilir ve ürün kataloğunu görüntüleyebilir
  5. Bayi mobil uygulamadan sipariş verebilir ve siparişlerini takip edebilir
  6. Bayi mobil uygulamada sipariş güncellemeleri için push notification alabilir

**Plans**: TBD

Plans:
- TBD after phase planning

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Basic Ordering | 0/TBD | Not started | - |
| 2. Order Management & Tracking | 0/TBD | Not started | - |
| 3. Insights & Mobile | 0/TBD | Not started | - |

---
*Last updated: 2026-01-25*
