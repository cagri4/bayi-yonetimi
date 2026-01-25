# Requirements: B2B Bayi Sipariş Yönetim Sistemi

**Defined:** 2025-01-25
**Core Value:** Bayilerin mesai saatlerinden bağımsız, anlık stok ve fiyat bilgisiyle sipariş verebilmesi

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication (AUTH)

- [ ] **AUTH-01**: Bayi email ve şifre ile giriş yapabilir
- [ ] **AUTH-02**: Bayi oturumu tarayıcı yenilemesinde korunur
- [ ] **AUTH-03**: Bayi şifresini email ile sıfırlayabilir

### Product Catalog (PROD)

- [ ] **PROD-01**: Bayi ürün listesini resimlerle görüntüleyebilir
- [ ] **PROD-02**: Bayi ürünleri kategori ve markaya göre filtreleyebilir
- [ ] **PROD-03**: Bayi ürünlerin stok durumunu (var/yok/az) görebilir
- [ ] **PROD-04**: Bayi ürünleri isim veya kod ile arayabilir

### Pricing (PRIC)

- [ ] **PRIC-01**: Bayi kendi grubuna (Altın/Gümüş/Bronz) göre iskontolu fiyatları görür
- [ ] **PRIC-02**: Sistem minimum sipariş tutarını bayi grubuna göre kontrol eder
- [ ] **PRIC-03**: Admin bayiye özel fiyat tanımlayabilir (grup fiyatını override eder)

### Ordering (ORDR)

- [ ] **ORDR-01**: Bayi ürünleri sepete ekleyebilir
- [ ] **ORDR-02**: Bayi sepetteki ürün adetlerini değiştirebilir
- [ ] **ORDR-03**: Bayi sepeti onaylayarak sipariş oluşturabilir
- [ ] **ORDR-04**: Bayi sık sipariş ettiği ürünlerden hızlı sipariş verebilir
- [ ] **ORDR-05**: Bayi geçmiş siparişlerini görüntüleyebilir
- [ ] **ORDR-06**: Bayi geçmiş bir siparişi tekrar verebilir (sepete ekle)

### Order Tracking (TRAC)

- [ ] **TRAC-01**: Bayi siparişinin durumunu (Beklemede/Onaylandı/Hazırlanıyor/Kargoda/Teslim) görebilir
- [ ] **TRAC-02**: Bayi sipariş durumu değiştiğinde anlık bildirim alır (realtime)

### Admin - Products (APRD)

- [ ] **APRD-01**: Admin yeni ürün ekleyebilir (isim, kod, açıklama, fiyat, kategori, marka)
- [ ] **APRD-02**: Admin ürüne resim yükleyebilir
- [ ] **APRD-03**: Admin ürün bilgilerini düzenleyebilir
- [ ] **APRD-04**: Admin ürün stok miktarını güncelleyebilir
- [ ] **APRD-05**: Admin ürünü aktif/pasif yapabilir

### Admin - Dealers (ADLR)

- [ ] **ADLR-01**: Admin yeni bayi ekleyebilir (firma adı, email, telefon, adres)
- [ ] **ADLR-02**: Admin bayiyi bir gruba (Altın/Gümüş/Bronz) atayabilir
- [ ] **ADLR-03**: Admin bayi grubunun iskonto oranını belirleyebilir
- [ ] **ADLR-04**: Admin bayi grubunun minimum sipariş tutarını belirleyebilir
- [ ] **ADLR-05**: Admin bayiyi aktif/pasif yapabilir
- [ ] **ADLR-06**: Admin bayiye özel fiyat tanımlayabilir

### Admin - Orders (AORD)

- [ ] **AORD-01**: Admin tüm siparişleri listeleyebilir (filtreleme: tarih, bayi, durum)
- [ ] **AORD-02**: Admin sipariş detayını görüntüleyebilir
- [ ] **AORD-03**: Admin sipariş durumunu değiştirebilir
- [ ] **AORD-04**: Admin siparişi iptal edebilir

### Admin - Reporting (ARPT)

- [ ] **ARPT-01**: Admin dönemsel satış raporunu görebilir (günlük/haftalık/aylık)
- [ ] **ARPT-02**: Admin en çok satan ürünleri görebilir
- [ ] **ARPT-03**: Admin bayi bazlı satış performansını görebilir
- [ ] **ARPT-04**: Admin raporları CSV olarak export edebilir

### Mobile App (MOBL)

- [ ] **MOBL-01**: Bayi mobil uygulamadan giriş yapabilir
- [ ] **MOBL-02**: Bayi mobil uygulamadan ürün kataloğunu görüntüleyebilir
- [ ] **MOBL-03**: Bayi mobil uygulamadan sipariş verebilir
- [ ] **MOBL-04**: Bayi mobil uygulamadan siparişlerini takip edebilir
- [ ] **MOBL-05**: Bayi mobil uygulamada push notification alabilir

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Features

- **AUTH-V2-01**: Bayi hesabında birden fazla kullanıcı olabilir (sahip, yönetici, personel)
- **TRAC-V2-01**: Bayi sipariş onayı ve kargo bildirimi email ile alır
- **TRAC-V2-02**: Bayi kargo takip numarasını ve takip linkini görebilir
- **PRIC-V2-01**: Admin promosyon/kampanya tanımlayabilir (indirim kodları, dönemsel)
- **INTG-V2-01**: Sistem ERP ile entegre çalışır (Logo/Netsis)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Ödeme sistemi entegrasyonu | Mevcut ödeme süreçleri (havale/açık hesap) devam edecek |
| Canlı chat / destek sistemi | İlk versiyonda yok, telefon/email yeterli |
| Çoklu dil desteği | Sadece Türkçe, uluslararası bayi yok |
| Offline mobil çalışma | İnternet bağlantısı gerekli, karmaşıklık ekler |
| Gelişmiş onay akışı | Tüm siparişler admin onayına gitmeyecek, direkt işleme alınacak |
| Stok rezervasyonu | MVP'de stok kontrolü anlık, rezervasyon v2'de |

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
| AUTH-01 | TBD | Pending |
| AUTH-02 | TBD | Pending |
| AUTH-03 | TBD | Pending |
| PROD-01 | TBD | Pending |
| PROD-02 | TBD | Pending |
| PROD-03 | TBD | Pending |
| PROD-04 | TBD | Pending |
| PRIC-01 | TBD | Pending |
| PRIC-02 | TBD | Pending |
| PRIC-03 | TBD | Pending |
| ORDR-01 | TBD | Pending |
| ORDR-02 | TBD | Pending |
| ORDR-03 | TBD | Pending |
| ORDR-04 | TBD | Pending |
| ORDR-05 | TBD | Pending |
| ORDR-06 | TBD | Pending |
| TRAC-01 | TBD | Pending |
| TRAC-02 | TBD | Pending |
| APRD-01 | TBD | Pending |
| APRD-02 | TBD | Pending |
| APRD-03 | TBD | Pending |
| APRD-04 | TBD | Pending |
| APRD-05 | TBD | Pending |
| ADLR-01 | TBD | Pending |
| ADLR-02 | TBD | Pending |
| ADLR-03 | TBD | Pending |
| ADLR-04 | TBD | Pending |
| ADLR-05 | TBD | Pending |
| ADLR-06 | TBD | Pending |
| AORD-01 | TBD | Pending |
| AORD-02 | TBD | Pending |
| AORD-03 | TBD | Pending |
| AORD-04 | TBD | Pending |
| ARPT-01 | TBD | Pending |
| ARPT-02 | TBD | Pending |
| ARPT-03 | TBD | Pending |
| ARPT-04 | TBD | Pending |
| MOBL-01 | TBD | Pending |
| MOBL-02 | TBD | Pending |
| MOBL-03 | TBD | Pending |
| MOBL-04 | TBD | Pending |
| MOBL-05 | TBD | Pending |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 0
- Unmapped: 38 ⚠️

---
*Requirements defined: 2025-01-25*
*Last updated: 2025-01-25 after initial definition*
