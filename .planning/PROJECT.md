# B2B Bayi Sipariş Yönetim Sistemi

## What This Is

Üretici firmanın bayilerine 7/24 sipariş verebilme imkanı sunan B2B sipariş yönetim platformu. Web portal ve mobil uygulama üzerinden bayiler ürün kataloğunu görebilir, stok durumunu kontrol edebilir, kendi grup fiyatlarını görebilir ve sipariş verebilir. Admin panelden ürünler, bayiler ve siparişler yönetilir.

## Core Value

Bayilerin mesai saatlerinden bağımsız, anlık stok ve fiyat bilgisiyle sipariş verebilmesi — "siparişim nerede?" sorusuna son.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Bayi Portalı:**
- [ ] Ürün kataloğu görüntüleme (resimler, stok durumu)
- [ ] Bayi grubuna göre fiyat görüntüleme (Altın/Gümüş/Bronz iskonto)
- [ ] Sepete ürün ekleme ve toplu sipariş verme
- [ ] Hızlı sipariş (sık alınan ürünler için)
- [ ] Sipariş geçmişi ve durum takibi
- [ ] Push notification (sipariş durumu değişimlerinde)
- [ ] Email + şifre ile giriş

**Admin Paneli:**
- [ ] Ürün yönetimi (ekleme, düzenleme, stok güncelleme, resim yükleme)
- [ ] Bayi yönetimi (ekleme, grup atama, aktif/pasif)
- [ ] Bayi grubu yönetimi (iskonto oranları, minimum sipariş tutarı)
- [ ] Sipariş yönetimi (görüntüleme, durum değiştirme, iptal)
- [ ] Temel raporlama (satış, bayi performansı)

**Sipariş Akışı:**
- [ ] Sipariş durumları: Beklemede → Onaylandı → Hazırlanıyor → Kargoya Verildi → Teslim Edildi
- [ ] Minimum sipariş tutarı kontrolü (bayi grubuna göre)

### Out of Scope

- ERP entegrasyonu (Logo/Netsis) — MVP sonrası, Faz 2'de
- Ödeme sistemi entegrasyonu — Mevcut ödeme süreçleri devam edecek
- Canlı chat / destek sistemi — İlk versiyonda yok
- Çoklu dil desteği — Sadece Türkçe
- Offline mobil çalışma — İnternet bağlantısı gerekli

## Context

**Mevcut Durum:**
- Siparişler telefon, WhatsApp ve Excel ile alınıyor
- Manuel ERP girişi yapılıyor (hata ve zaman kaybı)
- Mesai saatleri dışında sipariş alınamıyor
- Bayiler stok ve fiyat için her seferinde aramak zorunda
- Sipariş takibi yok, "siparişim nerede?" soruları çok fazla

**İş Ölçeği:**
- ~700 kayıtlı bayi (~50 aktif kullanıcı hedefi başlangıçta)
- 10-15 marka
- ~500 ürün
- Günde 20-30 sipariş beklentisi

**Bayi Grupları:**
- Altın, Gümüş, Bronz gibi gruplar
- Her grubun farklı iskonto oranı
- Her grubun farklı minimum sipariş tutarı olabilir

## Constraints

- **Platform**: Web portal (Next.js) + Mobil uygulama (Expo/React Native)
- **Backend**: Next.js API Routes + Supabase (Auth, Database, Realtime, Storage)
- **Deployment**: Vercel
- **Data**: MVP'de demo data kullanılacak, gerçek ERP entegrasyonu Faz 2'de
- **Dil**: Sadece Türkçe

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase + Next.js stack | Ayrı backend yerine Supabase ile auth/db/realtime tek yerden, daha hızlı geliştirme | — Pending |
| Bayi grubu + bayiye özel fiyat | Hem grup bazlı iskonto hem de bayiye özel fiyat override desteği | — Pending |
| Expo (React Native) seçimi | Tek codebase ile iOS + Android, Supabase client desteği, hızlı geliştirme | — Pending |
| Demo data ile MVP | ERP entegrasyonu karmaşık, önce temel akışı doğrulamak önemli | — Pending |
| Sepet + hızlı sipariş | Hem detaylı sipariş hem de sık kullanım senaryoları desteklenmeli | — Pending |

---
*Last updated: 2025-01-25 after requirements definition*
