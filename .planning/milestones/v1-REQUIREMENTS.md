# Requirements Archive: v1 MVP

**Archived:** 2026-02-03
**Status:** SHIPPED

This is the archived requirements specification for v1.
For current requirements, see `.planning/REQUIREMENTS.md` (created for next milestone).

---

# Requirements: B2B Bayi Siparis Yonetim Sistemi

**Defined:** 2025-01-25
**Core Value:** Bayilerin mesai saatlerinden bagimsiz, anlik stok ve fiyat bilgisiyle siparis verebilmesi

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication (AUTH)

- [x] **AUTH-01**: Bayi email ve sifre ile giris yapabilir
- [x] **AUTH-02**: Bayi oturumu tarayici yenilemesinde korunur
- [x] **AUTH-03**: Bayi sifresini email ile sifirlayabilir

### Product Catalog (PROD)

- [x] **PROD-01**: Bayi urun listesini resimlerle goruntuleyebilir
- [x] **PROD-02**: Bayi urunleri kategori ve markaya gore filtreleyebilir
- [x] **PROD-03**: Bayi urunlerin stok durumunu (var/yok/az) gorebilir
- [x] **PROD-04**: Bayi urunleri isim veya kod ile arayabilir

### Pricing (PRIC)

- [x] **PRIC-01**: Bayi kendi grubuna (Altin/Gumus/Bronz) gore iskontolu fiyatlari gorur
- [x] **PRIC-02**: Sistem minimum siparis tutarini bayi grubuna gore kontrol eder
- [x] **PRIC-03**: Admin bayiye ozel fiyat tanimlayabilir (grup fiyatini override eder)

### Ordering (ORDR)

- [x] **ORDR-01**: Bayi urunleri sepete ekleyebilir
- [x] **ORDR-02**: Bayi sepetteki urun adetlerini degistirebilir
- [x] **ORDR-03**: Bayi sepeti onaylayarak siparis olusturabilir
- [x] **ORDR-04**: Bayi sik siparis ettigi urunlerden hizli siparis verebilir
- [x] **ORDR-05**: Bayi gecmis siparislerini goruntuleyebilir
- [x] **ORDR-06**: Bayi gecmis bir siparisi tekrar verebilir (sepete ekle)

### Order Tracking (TRAC)

- [x] **TRAC-01**: Bayi siparisinin durumunu (Beklemede/Onaylandi/Hazirlaniyor/Kargoda/Teslim) gorebilir
- [x] **TRAC-02**: Bayi siparis durumu degistiginde anlik bildirim alir (realtime)

### Admin - Products (APRD)

- [x] **APRD-01**: Admin yeni urun ekleyebilir (isim, kod, aciklama, fiyat, kategori, marka)
- [x] **APRD-02**: Admin urune resim yukleyebilir
- [x] **APRD-03**: Admin urun bilgilerini duzenleyebilir
- [x] **APRD-04**: Admin urun stok miktarini guncelleyebilir
- [x] **APRD-05**: Admin urunu aktif/pasif yapabilir

### Admin - Dealers (ADLR)

- [x] **ADLR-01**: Admin yeni bayi ekleyebilir (firma adi, email, telefon, adres)
- [x] **ADLR-02**: Admin bayiyi bir gruba (Altin/Gumus/Bronz) atayabilir
- [x] **ADLR-03**: Admin bayi grubunun iskonto oranini belirleyebilir
- [x] **ADLR-04**: Admin bayi grubunun minimum siparis tutarini belirleyebilir
- [x] **ADLR-05**: Admin bayiyi aktif/pasif yapabilir
- [x] **ADLR-06**: Admin bayiye ozel fiyat tanimlayabilir

### Admin - Orders (AORD)

- [x] **AORD-01**: Admin tum siparisleri listeleyebilir (filtreleme: tarih, bayi, durum)
- [x] **AORD-02**: Admin siparis detayini goruntuleyebilir
- [x] **AORD-03**: Admin siparis durumunu degistirebilir
- [x] **AORD-04**: Admin siparisi iptal edebilir

### Admin - Reporting (ARPT)

- [x] **ARPT-01**: Admin donemsel satis raporunu gorebilir (gunluk/haftalik/aylik)
- [x] **ARPT-02**: Admin en cok satan urunleri gorebilir
- [x] **ARPT-03**: Admin bayi bazli satis performansini gorebilir
- [x] **ARPT-04**: Admin raporlari CSV olarak export edebilir

### Mobile App (MOBL)

- [x] **MOBL-01**: Bayi mobil uygulamadan giris yapabilir
- [x] **MOBL-02**: Bayi mobil uygulamadan urun katalogunu goruntuleyebilir
- [x] **MOBL-03**: Bayi mobil uygulamadan siparis verebilir
- [x] **MOBL-04**: Bayi mobil uygulamadan siparislerini takip edebilir
- [x] **MOBL-05**: Bayi mobil uygulamada push notification alabilir

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Features

- **AUTH-V2-01**: Bayi hesabinda birden fazla kullanici olabilir (sahip, yonetici, personel)
- **TRAC-V2-01**: Bayi siparis onayi ve kargo bildirimi email ile alir
- **TRAC-V2-02**: Bayi kargo takip numarasini ve takip linkini gorebilir
- **PRIC-V2-01**: Admin promosyon/kampanya tanimlayabilir (indirim kodlari, donemsel)
- **INTG-V2-01**: Sistem ERP ile entegre calisir (Logo/Netsis)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Odeme sistemi entegrasyonu | Mevcut odeme surecleri (havale/acik hesap) devam edecek |
| Canli chat / destek sistemi | Ilk versiyonda yok, telefon/email yeterli |
| Coklu dil destegi | Sadece Turkce, uluslararasi bayi yok |
| Offline mobil calisma | Internet baglantisi gerekli, karmasiklik ekler |
| Gelismis onay akisi | Tum siparisler admin onayina gitmeyecek, direkt isleme alinacak |
| Stok rezervasyonu | MVP'de stok kontrolu anlik, rezervasyon v2'de |

## Technical Stack

| Component | Technology |
|-----------|------------|
| Web Frontend | Next.js 14+ (App Router) |
| Mobile | Expo (React Native) |
| Backend | Next.js API Routes + Supabase |
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth |
| Realtime | Supabase Realtime |
| File Storage | Supabase Storage |
| Deployment | Vercel |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| PROD-01 | Phase 1 | Complete |
| PROD-02 | Phase 1 | Complete |
| PROD-03 | Phase 1 | Complete |
| PROD-04 | Phase 1 | Complete |
| PRIC-01 | Phase 1 | Complete |
| PRIC-02 | Phase 1 | Complete |
| PRIC-03 | Phase 1 | Complete |
| ORDR-01 | Phase 1 | Complete |
| ORDR-02 | Phase 1 | Complete |
| ORDR-03 | Phase 1 | Complete |
| ORDR-04 | Phase 2 | Complete |
| ORDR-05 | Phase 2 | Complete |
| ORDR-06 | Phase 2 | Complete |
| TRAC-01 | Phase 2 | Complete |
| TRAC-02 | Phase 2 | Complete |
| APRD-01 | Phase 1 | Complete |
| APRD-02 | Phase 1 | Complete |
| APRD-03 | Phase 1 | Complete |
| APRD-04 | Phase 1 | Complete |
| APRD-05 | Phase 1 | Complete |
| ADLR-01 | Phase 1 | Complete |
| ADLR-02 | Phase 1 | Complete |
| ADLR-03 | Phase 1 | Complete |
| ADLR-04 | Phase 1 | Complete |
| ADLR-05 | Phase 1 | Complete |
| ADLR-06 | Phase 1 | Complete |
| AORD-01 | Phase 2 | Complete |
| AORD-02 | Phase 2 | Complete |
| AORD-03 | Phase 2 | Complete |
| AORD-04 | Phase 2 | Complete |
| ARPT-01 | Phase 3 | Complete |
| ARPT-02 | Phase 3 | Complete |
| ARPT-03 | Phase 3 | Complete |
| ARPT-04 | Phase 3 | Complete |
| MOBL-01 | Phase 3 | Complete |
| MOBL-02 | Phase 3 | Complete |
| MOBL-03 | Phase 3 | Complete |
| MOBL-04 | Phase 3 | Complete |
| MOBL-05 | Phase 3 | Complete |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0
- **Complete: 38/38 (100%)**

**Phase Distribution:**
- Phase 1 (Foundation & Basic Ordering): 23 requirements
- Phase 2 (Order Management & Tracking): 9 requirements
- Phase 3 (Insights & Mobile): 9 requirements

---

## Milestone Summary

**Shipped:** 38 of 38 v1 requirements
**Adjusted:** None — all requirements implemented as specified
**Dropped:** None — all requirements shipped

---
*Archived: 2026-02-03 as part of v1 milestone completion*
