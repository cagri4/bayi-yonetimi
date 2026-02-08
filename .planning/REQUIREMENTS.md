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

- [ ] **SUP-01**: Bayi admin'e mesaj gönderebilir (konu, içerik)
- [ ] **SUP-02**: Bayi mesaj geçmişini görür (bekleyen/cevaplanan)
- [ ] **SUP-03**: Admin bayi mesajlarını görür ve cevaplar
- [ ] **SUP-04**: Bayi SSS sayfasını görür (kategorilere ayrılmış)
- [ ] **SUP-05**: Admin SSS içeriğini yönetir
- [ ] **SUP-06**: Bayi ürün talebi gönderebilir (stokta olmayan ürün için)

### Sipariş Detayları Geliştirme

- [ ] **ORD-01**: Bayi sipariş detayında fatura PDF'ini indirir (varsa)
- [ ] **ORD-02**: Bayi sipariş detayında irsaliye PDF'ini indirir (varsa)
- [ ] **ORD-03**: Admin siparişe fatura/irsaliye PDF'i yükler
- [ ] **ORD-04**: Bayi kargo takip bilgisini görür (araç plakası, sürücü bilgisi vb.)
- [ ] **ORD-05**: Admin sipariş için kargo takip bilgisi girer

### Bayi Raporları

- [ ] **REP-01**: Bayi kendi harcama analizini görür (aylık trend grafiği)
- [ ] **REP-02**: Bayi dönemsel karşılaştırma yapar (bu ay vs geçen ay, bu yıl vs geçen yıl)
- [ ] **REP-03**: Bayi harcama raporunu Excel olarak indirir

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

Hangi fazlar hangi gereksinimleri kapsıyor. Roadmap oluşturulunca doldurulacak.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DASH-01 | — | Pending |
| DASH-02 | — | Pending |
| DASH-03 | — | Pending |
| DASH-04 | — | Pending |
| DASH-05 | — | Pending |
| DASH-06 | — | Pending |
| FIN-01 | — | Pending |
| FIN-02 | — | Pending |
| FIN-03 | — | Pending |
| FIN-04 | — | Pending |
| FIN-05 | — | Pending |
| FIN-06 | — | Pending |
| FAV-01 | — | Pending |
| FAV-02 | — | Pending |
| FAV-03 | — | Pending |
| FAV-04 | — | Pending |
| CAMP-01 | — | Pending |
| CAMP-02 | — | Pending |
| CAMP-03 | — | Pending |
| CAMP-04 | — | Pending |
| CAMP-05 | — | Pending |
| CAMP-06 | — | Pending |
| CAMP-07 | — | Pending |
| SUP-01 | — | Pending |
| SUP-02 | — | Pending |
| SUP-03 | — | Pending |
| SUP-04 | — | Pending |
| SUP-05 | — | Pending |
| SUP-06 | — | Pending |
| ORD-01 | — | Pending |
| ORD-02 | — | Pending |
| ORD-03 | — | Pending |
| ORD-04 | — | Pending |
| ORD-05 | — | Pending |
| REP-01 | — | Pending |
| REP-02 | — | Pending |
| REP-03 | — | Pending |

**Coverage:**
- v2.0 requirements: 36 total
- Mapped to phases: 0
- Unmapped: 36 ⚠️

---
*Requirements defined: 2026-02-08*
*Last updated: 2026-02-08 after research synthesis*
