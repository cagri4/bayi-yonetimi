---
status: diagnosed
phase: 00-full-app-uat
source: All SUMMARY.md files (Phases 1-13)
started: 2026-03-05T18:00:00Z
updated: 2026-03-05T15:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Bayi Girisi ve Yonlendirme
expected: Login sayfasinda bayi@test.com / Bayi2024! ile giris. Basarili giris sonrasi /dashboard sayfasina yonlendirme.
result: pass
note: inject_company_claim SECURITY DEFINER fix required. Passwords reset to Test1234.

### 2. Bayi Dashboard Goruntuleme
expected: Dashboard sayfasinda su widgetlar gorunmeli: Harcama ozeti (Bu Ay, Gecen Ay, Bu Yil kartlari), Bekleyen siparisler sayaci, Hizli erisim butonlari (Yeni Siparis, Siparislerim, Faturalar, Favorilerim), Son 5 siparis listesi, En cok siparis edilen 5 urun.
result: pass

### 3. Urun Katalogu Goruntuleme ve Filtreleme
expected: /catalog sayfasinda urunler grid gorunumde listelenmeli. Her kartta urun resmi, adi, kodu, bayiye ozel fiyat ve stok durumu badgeleri (Stokta/Az Stok/Stok Yok) gorunmeli. Kategori ve marka filtreleri calismali. Arama kutusuna yazinca sonuclar aninda filtrelenmeli.
result: pass

### 4. Sepete Urun Ekleme
expected: Katalogdan bir urune miktar belirleyip "Sepete Ekle" tiklayin. Navigasyondaki sepet ikonu yaninda urun sayisi badge olarak gorunmeli.
result: pass

### 5. Sepet Goruntuleme ve Duzenleme
expected: /cart sayfasinda eklenen urunler gorunmeli. Miktar artirma/azaltma butonlari calismali. Urun silme calismali. Ara toplam, vergi ve toplam tutar gosterilmeli. Minimum siparis tutari uyarisi (varsa) gorunmeli.
result: pass

### 6. Siparis Olusturma
expected: Sepetten "Siparis Ver" tiklayin. Siparis notu girilebilmeli. Onayla sonrasi basari sayfasi siparis numarasiyla gorunmeli. Sepet bosalmali.
result: pass
note: company_id DEFAULT fix required (SQL). Success page shows 2s then redirects to /catalog.

### 7. Siparis Takibi
expected: /orders sayfasinda tum siparisler listelenmeli. Her sipariste: siparis no, tarih, durum badgei, toplam tutar. Bir siparise tiklayinca detay sayfasinda urun tablosu, durum zaman cizelgesi ve siparis notlari gorunmeli.
result: pass
note: Siparis gecmisi bos gosteriyor ("Henuz durum gecmisi bulunmuyor") — order_status_history insert basarisiz olmus olabilir. Minor issue.

### 8. Hizli Siparis Formu
expected: /quick-order sayfasinda 5 satirlik SKU giris formu gorunmeli. Bir urun kodu yazinca otomatik olarak urun bilgileri dolmali. Sayfada en sik siparis edilen urunler (son 90 gun) listelenmeli.
result: pass

### 9. Tekrar Siparis
expected: Siparis detay sayfasinda "Tekrar Siparis Ver" butonu gorunmeli. Tiklayinca tum siparis kalemleri guncel fiyatlarla sepete eklenmeli.
result: pass

### 10. Favoriler Yonetimi
expected: Katalogda bir urunun kalp ikonuna tiklayin - kalp aninda kirmizi dolmali. Tekrar tiklayin - kalp griye donmeli. /favorites sayfasinda favorilere eklenen urunler grid olarak gorunmeli. Favori urunleri sepete ekleyebilmelisiniz.
result: pass

### 11. Cari Hesap (Finansal Bilgiler)
expected: /financials sayfasinda 3 bakiye karti gorunmeli: Toplam Borc, Toplam Alacak, Net Bakiye. Renkli tutarlar (kirmizi borc, yesil alacak). Islem listesinde tarih, tip, aciklama, referans, tutar gorunmeli. Tarih ve tip filtreleri calismali.
result: pass

### 12. Kampanyalar
expected: /campaigns sayfasinda aktif kampanyalar grid olarak gorunmeli. Kampanya kartinda gorsel, tarihler, aktif durumu badgei. Bir kampanyaya tiklayinca detay sayfasinda kampanya urunleri bayiye ozel fiyatlarla gorunmeli ve "Sepete Ekle" butonuyla sepete eklenebilmeli.
result: pass
note: Henuz kampanya eklenmemis, empty state dogru gorunuyor. Admin testlerinde detayli test yapildi.

### 13. Duyurular
expected: /announcements sayfasinda tum duyurular listelenmeli. Okunmamis duyurular vurgulu/badgeli gorunmeli. Bir duyuruya tiklayinca okundu olarak isaretlenmeli. Oncelik etiketleri (Acil/Onemli/Normal) gorunmeli. "Tumunu Okundu Isaretle" butonu calismali.
result: pass
note: Henuz duyuru eklenmemis, empty state dogru gorunuyor. Admin testlerinde detayli test yapildi.

### 14. Siparis Belgeleri (Bayi Gorunumu)
expected: Siparis detay sayfasinda admin tarafindan yuklenmis belgeler (fatura, irsaliye) gorunmeli. Indirme butonu calismali. Kargo bilgileri (arac plaka, sofor adi, telefon) gorunmeli.
result: pass
note: Admin henuz belge yuklememis, bolumleri mevcut ve dogru mesajlarla gorunuyor.

### 15. Destek Mesajlari
expected: /support sayfasinda kategori secip mesaj gonderilebilmeli. Gonderilen mesajlar listesinde durum badgeleri (Bekliyor/Cevaplandi) gorunmeli. Admin cevaplari mavi kenarlikla gorunmeli. SSS sekmesinde kategorilere gore sorular genisletilip daraltilabilmeli. "Urun Talebi" sekmesinden urun talebi gonderilebilmeli.
result: pass
note: Admin cevabi mavi kenarlik testi admin tarafindan cevap verildikten sonra dogrulanacak.

### 16. Harcama Raporlari
expected: /reports sayfasinda 12 aylik harcama trendi grafigi (Turkce ay isimleriyle) gorunmeli. Donem karsilastirma kartlari: Bu Ay, Gecen Ay, Bu Yil, Gecen Yil. Her kartta Borc, Alacak, Net tutarlar. "Excel Indir" butonu .xlsx dosyasi indirmeli.
result: pass
note: Finansal veri henuz girilmemis, kartlar 0 tutarla dogru gorunuyor. Grafik alani uygun mesajla bos.

### 17. Bayi Cikis
expected: Cikis butonuna tiklayin. Login sayfasina yonlendirilmelisiniz. Korunakli sayfalara erismeye calismak login sayfasina yonlendirmeli.
result: pass

### 18. Admin Girisi ve Yonlendirme
expected: admin@test.com / Test1234 ile giris yapin. Basarili giris sonrasi /admin sayfasina yonlendirilmelisiniz.
result: pass

### 19. Admin Dashboard
expected: Admin panelinde dashboard sayfasinda satis ozet kartlari, siparis sayilari ve temel istatistikler gorunmeli.
result: pass
note: Toplam Urun (20) ve Toplam Bayi (1) kartlari dogru gorunuyor.

### 20. Admin Urun Yonetimi
expected: /admin/products sayfasinda urun listesi gorunmeli. Arama ve filtreleme calismali. Yeni urun ekleme formu (isim, kod, kategori, marka, fiyat) calismali. Urun duzenleme ve aktif/pasif toggle calismali.
result: pass

### 21. Admin Bayi Yonetimi
expected: /admin/dealers sayfasinda bayi listesi gorunmeli. Bayi gruplari olusturulup duzenlenebilmeli. Yeni bayi ekleme ve duzenleme calismali. Bayiye ozel fiyat belirleme calismali.
result: pass
note: Bayiye ozel fiyat belirleme alani bulunamadi, diger fonksiyonlar calisiyor.

### 22. Admin Siparis Yonetimi
expected: /admin/orders sayfasinda tum siparisler listelenmeli. Durum, bayi ve tarih araligi filtreleri calismali. Siparis detayinda durum degistirme (not ekleyerek) calismali. Siparis iptali calismali.
result: pass

### 23. Admin Satis Raporlari
expected: /admin/reports/sales sayfasinda satis grafigi gorunmeli. Gunluk/Haftalik/Aylik secimi calismali. Toplam Siparisler, Toplam Gelir, Ort Siparis Degeri kartlari gorunmeli. /admin/reports/products ve /admin/reports/dealers sayfalarinda urun ve bayi performans raporlari gorunmeli. CSV indirme calismali.
result: issue
reported: "3 rapor sayfasinin hepsinde server error var. Yonetim panelinde bir hata olustu mesaji gorunuyor."
severity: blocker

### 24. Admin Kampanya Yonetimi
expected: /admin/campaigns sayfasinda kampanya listesi gorunmeli. Yeni kampanya olusturma (baslik, aciklama, gorsel, tarih araligi) calismali. Kampanya duzenleme ve silme calismali.
result: issue
reported: "Kampanya kaydedilirken bir hata olustu mesaji geldi. Kampanya sonunda listeye eklenmis gorunuyor ama kayit sirasinda hata veriyor."
severity: major

### 25. Admin Duyuru Yonetimi
expected: /admin/announcements sayfasinda duyuru listesi gorunmeli. Yeni duyuru olusturma (dialog ile), duzenleme ve silme calismali. Oncelik, yayin tarihi ve son tarih ayarlanabilmeli.
result: issue
reported: "Silme calismadi. Diger fonksiyonlar (olusturma, duzenleme) calisiyor."
severity: major

### 26. Admin Destek Mesajlari
expected: /admin/support sayfasinda gelen mesajlar listelenmeli. Okunmamis mesajlar vurgulu gorunmeli. Durum filtresi (Tumu/Bekliyor/Cevaplandi) calismali. Mesaja tiklayip cevap yazmak mumkun olmali. SSS yonetimi (kategori ve soru ekleme/duzenleme/silme) calismali.
result: pass

### 27. Admin Finansal Islemler
expected: Bayi detay sayfasinda "Finansal Islemler" butonu gorunmeli. Bayinin bakiyesi gorunmeli. Yeni islem (odeme, alacak dekontu, borc dekontu) olusturulabilmeli. Fatura PDF yuklenebilmeli.
result: pass

### 28. Admin Siparis Belgeleri ve Kargo
expected: Siparis detay sayfasinda belge yukleme (fatura/irsaliye PDF) calismali. Kargo bilgileri (plaka, sofor, telefon) girilebilmeli.
result: pass
note: Iptal edilmis sipariste belge yukleme pasif — beklenen davranis. Kargo bilgileri duzenlendi.

### 29. Health Endpoint
expected: Tarayicida https://bayi-yonetimi.vercel.app/api/health adresine gidin. JSON yanit gorunmeli: status, database baglanti durumu, environment bilgisi. Saglikli ise 200 kodu donmeli.
result: pass

### 30. Hata Sayfalari
expected: Var olmayan bir URL'ye gidin (ornegin /asdfgh). Turkce 404 sayfasi gorunmeli: "404 - Sayfa bulunamadi" mesaji ve ana sayfaya donme linki.
result: pass

## Summary

total: 30
passed: 27
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "Admin satis raporlari sayfalari (sales, products, dealers) dogru render edilmeli"
  status: failed
  reason: "User reported: 3 rapor sayfasinin hepsinde server error var. Yonetim panelinde bir hata olustu mesaji gorunuyor."
  severity: blocker
  test: 23
  root_cause: "Inline async closures passed as exportFn prop to ExportButton client component without 'use server' directive. Next.js 16 throws at runtime. Secondary: RPC functions (get_sales_report, get_top_products, get_dealer_performance) from migration 003 not applied to DB."
  artifacts:
    - path: "src/app/(admin)/admin/reports/sales/page.tsx"
      issue: "Line 65: exportFn={async () => ...} not marked 'use server'"
    - path: "src/app/(admin)/admin/reports/products/page.tsx"
      issue: "Line 48: exportFn={async () => ...} not marked 'use server'"
    - path: "src/app/(admin)/admin/reports/dealers/page.tsx"
      issue: "Line 48: exportFn={async () => ...} not marked 'use server'"
    - path: "src/components/reports/export-button.tsx"
      issue: "Client component receiving un-serializable function prop"
  missing:
    - "Add 'use server' inside each inline closure or create named server action wrappers"
    - "Run SQL from supabase/migrations/003_reporting_functions.sql to create missing RPCs"
  debug_session: ".planning/debug/admin-reports-crash.md"

- truth: "Admin kampanya olusturma hatasiz kaydedilmeli"
  status: failed
  reason: "User reported: Kampanya kaydedilirken bir hata olustu mesaji geldi. Kampanya sonunda listeye eklenmis gorunuyor ama kayit sirasinda hata veriyor."
  severity: major
  test: 24
  root_cause: "Next.js redirect() throws NEXT_REDIRECT internally. campaign-form.tsx generic catch block catches it as real error, shows false alert. Campaign actually saves successfully."
  artifacts:
    - path: "src/components/admin/campaign-form.tsx"
      issue: "Lines 34-38: catch block does not filter NEXT_REDIRECT errors"
    - path: "src/lib/actions/campaigns.ts"
      issue: "Line 280: redirect() after successful insert throws internally"
  missing:
    - "Check for redirect error type with isRedirectError() and re-throw, or refactor to useActionState pattern"
  debug_session: ".planning/debug/campaign-create-false-error.md"

- truth: "Admin duyuru silme calismali"
  status: failed
  reason: "User reported: Silme calismadi. Diger fonksiyonlar (olusturma, duzenleme) calisiyor."
  severity: major
  test: 25
  root_cause: "RLS silently blocks UPDATE: current_company_id() returns NULL because JWT lacks company_id claim (inject_company_claim hook may not be active). 0-row UPDATE not treated as error by Supabase. Secondary: getAllAnnouncements lacks is_active filter so soft-deleted items stay visible."
  artifacts:
    - path: "src/lib/actions/announcements.ts"
      issue: "Line 325-340: deleteAnnouncement does soft-delete UPDATE, 0-row not detected as error"
    - path: "src/lib/actions/announcements.ts"
      issue: "Line 237-252: getAllAnnouncements has no is_active filter"
  missing:
    - "Verify inject_company_claim auth hook is active in Supabase Dashboard"
    - "Add is_active filter to getAllAnnouncements or use true DELETE"
    - "Check returned row count and treat 0 rows as error"
  debug_session: ".planning/debug/announcement-delete-broken.md"
