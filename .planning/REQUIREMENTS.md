# Requirements: Bayi Yönetimi v2.0

**Defined:** 2026-02-08
**Core Value:** Bayilerin finansal durumlarını takip edebilmesi, kişiselleştirilmiş deneyim ve admin ile iletişim — "cari hesabım ne durumda?" sorusuna son.

## v2.0 Requirements

v2.0 milestone için gereksinimler. Her biri roadmap fazlarına eşlenecek.

### Bayi Dashboard

- [ ] **DASH-01**: Bayi giriş yaptığında dashboard sayfasını görür (ana sayfa)
- [ ] **DASH-02**: Bayi toplam harcama özetini görür (bu ay ve bu yıl)
- [ ] **DASH-03**: Bayi son 5 siparişini widget olarak görür
- [ ] **DASH-04**: Bayi bekleyen sipariş sayısını görür (Beklemede/Onaylandı/Hazırlanıyor)
- [ ] **DASH-05**: Bayi hızlı aksiyonlara tek tıkla erişir (Yeni Sipariş, Siparişlerim, Faturalar)
- [ ] **DASH-06**: Bayi en çok aldığı 5 ürünü görür ve sepete ekleyebilir

### Finansal Bilgiler

- [ ] **FIN-01**: Bayi cari hesap bakiyesini görür (toplam borç, alacak, net bakiye)
- [ ] **FIN-02**: Bayi cari hesap hareketlerini listeler (fatura, ödeme, düzeltme)
- [ ] **FIN-03**: Bayi faturalarını listeler ve PDF olarak indirir
- [ ] **FIN-04**: Bayi ödeme geçmişini görür (tarih, tutar, yöntem)
- [ ] **FIN-05**: Admin bayi için cari hareket girebilir (borç/alacak/ödeme)
- [ ] **FIN-06**: Admin bayiye fatura PDF'i yükleyebilir

### Favori Ürünler

- [ ] **FAV-01**: Bayi ürün kartından favorilere ekleyebilir/çıkarabilir
- [ ] **FAV-02**: Bayi favori ürünlerini ayrı sayfada listeler
- [ ] **FAV-03**: Bayi favori listesinden ürünleri sepete ekleyebilir
- [ ] **FAV-04**: Bayi favorilerdeki stokta olmayan ürünler için bildirim alır (opsiyonel)

### Kampanyalar ve Duyurular

- [ ] **CAMP-01**: Bayi aktif kampanyaları listeler
- [ ] **CAMP-02**: Bayi kampanya detayını görür (açıklama, tarihler, ürünler)
- [ ] **CAMP-03**: Bayi duyuruları görür ve okundu olarak işaretler
- [ ] **CAMP-04**: Bayi katalogda "yeni ürünler" filtresini kullanabilir
- [ ] **CAMP-05**: Admin kampanya oluşturur/düzenler/siler
- [ ] **CAMP-06**: Admin duyuru oluşturur/düzenler/siler
- [ ] **CAMP-07**: Bayi yeni kampanya için push notification alır (opsiyonel)

### Destek ve İletişim

- [x] **SUP-01**: Bayi admin'e mesaj gönderebilir (konu, içerik)
- [x] **SUP-02**: Bayi mesaj geçmişini görür (bekleyen/cevaplanan)
- [x] **SUP-03**: Admin bayi mesajlarını görür ve cevaplar
- [x] **SUP-04**: Bayi SSS sayfasını görür (kategorilere ayrılmış)
- [x] **SUP-05**: Admin SSS içeriğini yönetir
- [x] **SUP-06**: Bayi ürün talebi gönderebilir (stokta olmayan ürün için)

### Sipariş Detayları Geliştirme

- [ ] **ORD-01**: Bayi sipariş detayında fatura PDF'ini indirir (varsa)
- [ ] **ORD-02**: Bayi sipariş detayında irsaliye PDF'ini indirir (varsa)
- [ ] **ORD-03**: Admin siparişe fatura/irsaliye PDF'i yükler
- [ ] **ORD-04**: Bayi kargo takip bilgisini görür (araç plakası, sürücü bilgisi vb.)
- [ ] **ORD-05**: Admin sipariş için kargo takip bilgisi girer

### Bayi Raporları

- [x] **REP-01**: Bayi kendi harcama analizini görür (aylık trend grafiği)
- [x] **REP-02**: Bayi dönemsel karşılaştırma yapar (bu ay vs geçen ay, bu yıl vs geçen yıl)
- [x] **REP-03**: Bayi harcama raporunu Excel olarak indirir

## Future Requirements (v3+)

Sonraki milestone'lara ertelenen gereksinimler.

### Online Ödeme
- **PAY-01**: Bayi portaldan online ödeme yapabilir (iyzico/PayTR)
- **PAY-02**: Bayi fatura için "Şimdi Öde" butonu görür

### ERP Entegrasyonu
- **ERP-01**: Cari hesap verileri ERP'den otomatik senkronize olur
- **ERP-02**: Stok verileri ERP'den otomatik güncellenir
- **ERP-03**: Siparişler ERP'ye otomatik aktarılır

### Gelişmiş Özellikler
- **ADV-01**: E-fatura entegrasyonu (GİB)
- **ADV-02**: WhatsApp bildirim entegrasyonu
- **ADV-03**: Bayi içi çoklu kullanıcı ve onay akışı

## Out of Scope

Kapsam dışı özellikler ve nedenleri.

| Feature | Reason |
|---------|--------|
| Canlı chat (realtime) | Async mesajlaşma yeterli, WebSocket karmaşıklığı gereksiz |
| Online ödeme | Mevcut ödeme süreçleri devam edecek, v3'e ertelendi |
| ERP real-time sync | v2'de ERP-ready şema, gerçek entegrasyon sonraki milestone |
| Çoklu favori listesi | B2C özelliği, B2B için tek liste yeterli |
| Dealer self-service finansal düzeltme | Güvenlik riski, admin onayı gerekli |
| Karmaşık kampanya otomasyonu | Basit kampanya yönetimi yeterli |
| Public API | Bayilerin teknik kapasitesi yok |
| Predictive analytics / AI | Overengineering, basit raporlama yeterli |

## Traceability

Hangi fazlar hangi gereksinimleri kapsıyor.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FAV-01 | Phase 4 | Pending |
| FAV-02 | Phase 4 | Pending |
| FAV-03 | Phase 4 | Pending |
| FAV-04 | Phase 4 | Pending |
| FIN-01 | Phase 5 | Pending |
| FIN-02 | Phase 5 | Pending |
| FIN-03 | Phase 5 | Pending |
| FIN-04 | Phase 5 | Pending |
| FIN-05 | Phase 5 | Pending |
| FIN-06 | Phase 5 | Pending |
| DASH-01 | Phase 6 | Pending |
| DASH-02 | Phase 6 | Pending |
| DASH-03 | Phase 6 | Pending |
| DASH-04 | Phase 6 | Pending |
| DASH-05 | Phase 6 | Pending |
| DASH-06 | Phase 6 | Pending |
| CAMP-01 | Phase 6 | Pending |
| CAMP-02 | Phase 6 | Pending |
| CAMP-03 | Phase 6 | Pending |
| CAMP-04 | Phase 6 | Pending |
| CAMP-05 | Phase 6 | Pending |
| CAMP-06 | Phase 6 | Pending |
| CAMP-07 | Phase 6 | Pending |
| ORD-01 | Phase 6 | Pending |
| ORD-02 | Phase 6 | Pending |
| ORD-03 | Phase 6 | Pending |
| ORD-04 | Phase 6 | Pending |
| ORD-05 | Phase 6 | Pending |
| SUP-01 | Phase 7 | Complete |
| SUP-02 | Phase 7 | Complete |
| SUP-03 | Phase 7 | Complete |
| SUP-04 | Phase 7 | Complete |
| SUP-05 | Phase 7 | Complete |
| SUP-06 | Phase 7 | Complete |
| REP-01 | Phase 7 | Complete |
| REP-02 | Phase 7 | Complete |
| REP-03 | Phase 7 | Complete |

**Coverage:**
- v2.0 requirements: 36 total
- Mapped to phases: 36 ✓
- Unmapped: 0 ✓

**Phase Distribution:**
- Phase 4 (Favorites Quick Win): 4 requirements
- Phase 5 (Financial Backbone): 6 requirements
- Phase 6 (Dashboard, Campaigns & Order Documents): 18 requirements
- Phase 7 (Support & Reports): 9 requirements

---
*Requirements defined: 2026-02-08*
*Last updated: 2026-02-08 after roadmap creation*
