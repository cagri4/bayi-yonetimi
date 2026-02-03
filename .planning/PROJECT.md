# B2B Bayi Siparis Yonetim Sistemi

## What This Is

Uretici firmanin bayilerine 7/24 siparis verebilme imkani sunan B2B siparis yonetim platformu. Web portal ve mobil uygulama uzerinden bayiler urun katalogunu gorebilir, stok durumunu kontrol edebilir, kendi grup fiyatlarini gorebilir ve siparis verebilir. Admin panelden urunler, bayiler ve siparisler yonetilir.

## Core Value

Bayilerin mesai saatlerinden bagimsiz, anlik stok ve fiyat bilgisiyle siparis verebilmesi — "siparisim nerede?" sorusuna son.

## Current State

**v1 MVP shipped: 2026-02-03**

- Web portal: Next.js 14 App Router + Supabase
- Mobile app: Expo/React Native
- 13,200 LOC TypeScript/TSX
- 215 files across 3 phases, 14 plans

**Deployed capabilities:**
- Dealer auth with session persistence
- Product catalog with group pricing (Altin/Gumus/Bronz)
- Shopping cart with minimum order validation
- Order creation with status tracking
- Realtime order updates via Supabase Realtime
- Quick order form with SKU search
- Reorder from history
- Admin product/dealer/order management
- Sales reporting with CSV export
- Mobile app with push notifications

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

(None — planning next milestone)

### Out of Scope

- ERP entegrasyonu (Logo/Netsis) — MVP sonrasi, v2'de
- Odeme sistemi entegrasyonu — Mevcut odeme surecleri devam edecek
- Canli chat / destek sistemi — Ilk versiyonda yok
- Coklu dil destegi — Sadece Turkce
- Offline mobil calisma — Internet baglantisi gerekli

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

- **Platform**: Web portal (Next.js) + Mobil uygulama (Expo/React Native)
- **Backend**: Next.js API Routes + Supabase (Auth, Database, Realtime, Storage)
- **Deployment**: Vercel (web), Expo EAS (mobile)
- **Data**: Demo data ile baslandi, ERP entegrasyonu v2'de
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

---
*Last updated: 2026-02-03 after v1 milestone*
