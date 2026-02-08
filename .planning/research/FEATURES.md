# Features Research: v2.0 - Bayi Dashboard ve Finansal Takip

**Domain:** B2B Dealer Portal - Dealer Experience & Financial Tracking
**Project:** Bayi Yönetimi v2.0
**Researched:** 2026-02-08
**Overall Confidence:** HIGH

## Summary

This research focuses on five new feature categories for v2.0: **Dealer Dashboard**, **Finansal Bilgiler (Cari Hesap)**, **Favori Ürünler**, **Kampanyalar/Duyurular**, and **Destek/İletişim**. These features transform the portal from a basic ordering system to a comprehensive dealer relationship platform.

**Key Findings:**

1. **Dealer dashboards are table stakes in 2026** - 71% of B2B buyers expect personalized experiences, with dashboard widgets showing spending, order status, and performance metrics.

2. **Cari Hesap (current account) is critical for Turkish B2B** - Described as "the backbone of Turkish B2B relationships," financial transparency (debt/credit balance, invoice access) is non-negotiable for dealer trust.

3. **Favorites/wishlists reduce reorder friction** - B2B portals with saved product lists show 50% faster reorder times and are now standard features across platforms.

4. **Campaign management drives engagement** - Modern dealer portals serve as marketing hubs where manufacturers push targeted campaigns, with automated rollouts showing higher dealer engagement than email-only approaches.

5. **Support messaging is evolving from tickets to conversations** - 2026 B2B support platforms favor async messaging over traditional ticketing, with native integration into business tools (Slack/Teams) becoming standard.

---

## Feature Categories

### Bayi Dashboard

The dealer dashboard is the landing page after login - their command center for business metrics and quick actions.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|-----------|--------------|-------|
| **Toplam Harcama Özeti (Spending Summary)** | 71% of B2B buyers expect personalized experiences; spending overview is baseline personalization | Low | Order history data | Show current month/year totals. Compare to previous period. |
| **Son Siparişler Widget** | Dealers need immediate visibility into recent activity without navigating to order history | Low | Order data | Show last 3-5 orders with status, date, total. Link to full order detail. |
| **Bekleyen Sipariş Sayısı** | Actionable metric - shows what needs attention | Low | Order status data | Count of orders in "Beklemede", "Onaylandı", "Hazırlanıyor" states. One-click to filtered list. |
| **Hızlı Aksiyonlar (Quick Actions)** | Portal friction = dealers revert to phone orders. Quick actions reduce clicks to common tasks. | Low | Existing features | "Yeni Sipariş", "Hızlı Sipariş", "Siparişlerim", "Faturalar" buttons. Mobile-friendly large touch targets. |

**Sources:**
- [B2B Portal Features 2026 (B2Bridge)](https://b2bridge.io/blog/b2b-portal/)
- [Top 5 B2B Portal Features (Asabix)](https://asabix.com/blog/top-5-features-b2b-portal-in-2026/)

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|-----------|-------|
| **En Çok Aldığı Ürünler (Top Products Widget)** | Proactive assistance - surface dealer's favorites for one-click reorder | Medium | Requires order item aggregation query. "Add to cart" buttons on each product. |
| **Grup Performans Karşılaştırması** | Gamification - show dealer's metrics vs. their tier average (e.g., "You spent 15% more than average Altın dealers this month") | Medium | Competitive advantage: Few portals show peer comparisons. Privacy concern: Don't reveal specific dealer names. |
| **Stok Uyarıları Widget** | Proactive - show which favorited/frequently-ordered products are low stock or out of stock | Medium | Requires product favorite tracking + stock monitoring. Drives urgency for orders. |

**Sources:**
- [Modern B2B Distributors 2026 (Shopify)](https://www.shopify.com/enterprise/blog/b2b-distributors)
- [Dealer Portal Guide (OroCommerce)](https://oroinc.com/b2b-ecommerce/blog/the-complete-guide-to-b2b-dealer-portals/)

---

### Finansal Bilgiler (Cari Hesap)

"Cari hesap" is **the backbone of Turkish B2B relationships** - dealers need transparency into their financial position with the manufacturer.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|-----------|--------------|-------|
| **Cari Bakiye Görüntüleme (Current Balance)** | Turkish B2B standard. Dealers cannot operate without knowing their debt/credit balance. | Low | ERP-ready schema: `dealer_balance` table with `debit`, `credit`, `balance` columns. Admin manually enters initially, ERP sync later. | Show: Total Debt (Borç), Total Credit (Alacak), Net Balance (Bakiye). Multi-currency support if needed. |
| **Cari Hesap Hareketleri (Account Movements)** | Dealers need transaction history: invoices, payments, adjustments | Medium | Schema: `account_movements` with date, document_number, transaction_type (invoice/payment/adjustment), debit, credit, balance, description | Table showing: Date, Document #, Type, Debit, Credit, Running Balance. Filter by date range, transaction type. Export to Excel. |
| **Fatura Görüntüleme / PDF İndirme** | "24/7 access to invoice history" is table stakes per 2026 research. Reduces support calls. | Medium | File storage (Supabase Storage), `invoices` table with PDF URL. Admin uploads PDFs manually initially. | List invoices (paid/unpaid/partially paid + due dates). Click to view/download PDF. Filter by status, date. |
| **Ödeme Geçmişi (Payment History)** | Transparency builds trust. Dealers need proof of payments made. | Low | Account movements filtered by payment type. | Show payments with date, amount, method, reference number. Link to associated invoice. |

**Sources:**
- [Turkish B2B Cari Hesap (B2B Store)](https://tr.b2bstore.com/cari-hesap-takibi/)
- [Cari Hesap Takibi Features (B2B.net.tr)](https://www.b2b.net.tr/moduller/detayli-cari-hareketler)
- [B2B Invoice Management (Microsoft Dynamics 365)](https://learn.microsoft.com/en-us/dynamics365/commerce/b2b/invoice-management)

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|-----------|-------|
| **Online Ödeme Entegrasyonu** | Dealers can pay outstanding invoices directly from portal via credit card or bank transfer | High | Payment gateway integration (iyzico, PayTR). Reduces DSO (days sales outstanding). Defer to post-v2 unless critical. |
| **Ödeme Planı Görüntüleme** | For dealers with payment terms (e.g., net 30, net 60), show upcoming due dates and amounts | Low | Useful for cash flow planning. Reduces late payments. |
| **Cari Hesap Bildirimleri** | Notify dealer when balance exceeds threshold or invoice is overdue | Low | Email/push notification when: invoice due soon, payment overdue, balance limit approaching. |

**Notes on ERP Integration:**
- v2.0 uses **ERP-ready schema** - admin manually enters financial data
- Post-v2: Real-time sync with Logo/Netsis via API (when ERP integration milestone happens)
- Critical: Data structure must match ERP export format for easy migration

---

### Favori Ürünler (Product Favorites)

Favorites/wishlists are **standard B2B features in 2026** - not differentiators, but expected functionality.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|-----------|--------------|-------|
| **Favorilere Ekle Butonu** | One-click save from product card/detail page | Low | `product_favorites` table (dealer_id, product_id, added_at) | Heart icon on product cards. Toggle on/off. |
| **Favori Listesi Sayfası** | Dedicated page to view/manage all favorites | Low | Query favorites with product details | Grid/list view matching catalog. "Sepete Ekle" buttons. Remove from favorites option. |
| **Favorilerden Sipariş** | Bulk add favorites to cart for quick reorder | Low | Core value: 50% faster reorder times per research | "Tümünü Sepete Ekle" or individual "Sepete Ekle" per item. |

**Sources:**
- [B2B Wholesale Wishlist Features (Shopify Apps)](https://apps.shopify.com/wishlist-project-planner)
- [B2B Order Portals 2026 (Moxo)](https://www.moxo.com/blog/b2b-order-portals-manufacturing)

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|-----------|-------|
| **Çoklu Favori Listeleri** | Power users create themed lists (e.g., "Yaz Ürünleri", "Hızlı Satanlar", "Promosyon Ürünleri") | Medium | Multiple lists add complexity. Defer unless dealers request. B2C feature more than B2B. |
| **Favori Listesi Paylaşma** | Dealers with multiple users can share lists within their team | Medium | Useful for dealers with purchasing manager + sales staff. Requires team collaboration features. |
| **Stok Uyarıları (Favoriler İçin)** | Notify when favorited out-of-stock product is back in stock | Low | High value, low complexity. Recommended for v2. Captures demand that would go to competitors. |

**Anti-Features:**
- **Public/Social Wishlists** - This is B2B, not consumer marketplace. No public sharing or social features needed.

---

### Kampanyalar / Duyurular (Campaigns & Announcements)

Modern dealer portals are **marketing hubs**, not just ordering tools. Campaigns drive engagement and repeat visits.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|-----------|--------------|-------|
| **Aktif Kampanyalar Sayfası** | Dealers expect to see current promotions, special pricing, new products | Low | `campaigns` table with title, description, start_date, end_date, active status. Admin creates campaigns. | List view with campaign cards. Filter by active/expired. Detail page with full description, terms, featured products. |
| **Duyuru Sistemi** | Manufacturer needs to communicate important updates (policy changes, holiday closures, new product launches) | Low | `announcements` table similar to campaigns, but for informational (not sales) content | Show unread announcements as badge/notification. Announcement feed page. Mark as read functionality. |
| **Yeni Ürün Vurgulama** | Highlight new products added to catalog | Low | `products.is_new` flag or `created_at` filter for last 30 days | "Yeni Ürünler" section on dashboard or catalog. Badge on product cards. |

**Sources:**
- [Dealer Portal Campaign Features (i95dev)](https://www.i95dev.com/who-benefits-from-dealer-portals-and-how/)
- [B2B Portal Marketing Hub (Shopaccino)](https://www.shopaccino.com/blog/how-b2b-brands-can-improve-dealer-relationships-with-selfserve-ordering-portals)

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|-----------|-------|
| **Hedefli Kampanyalar (Targeted Campaigns)** | Show campaigns only to specific dealer tiers (e.g., "Altın dealers only") or specific dealers | Medium | Requires campaign targeting rules: by tier, by dealer group, by region. Increases relevance. |
| **İndirimli Ürünler Filtresi** | Dedicated "Kampanyalı Ürünler" filter in catalog showing discounted items | Low | Requires `products.on_sale` flag or campaign-product association table. Quick win for dealers hunting deals. |
| **Push Bildirimi (Yeni Kampanya)** | Notify dealers immediately when new campaign launches | Low | Mobile push (already built in v1) or email. Drives portal engagement. |
| **Kampanya Performans Takibi (Admin)** | Admin sees which campaigns drive most orders, which dealers engage | Medium | Analytics feature. Post-v2 unless admin explicitly needs campaign ROI tracking. |

**Anti-Features:**
- **Dealer-Created Campaigns** - Campaigns are manufacturer-controlled. Dealers don't create their own.
- **Complex Promotion Engine** - Avoid coupon codes, stacking rules, automated discounts. Keep campaigns informational with manual pricing if needed.

---

### Destek / İletişim (Support & Communication)

2026 B2B support is **moving from tickets to conversations** - async messaging preferred over formal ticketing systems.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|-----------|--------------|-------|
| **Admin'e Mesaj Gönderme** | Dealers need communication channel for questions, issues, requests that don't fit phone/email | Medium | `support_messages` table with conversation threading. Admin inbox to view/reply. | Simple message form: subject, message body, optional attachment. Admin replies via admin panel. Email notification to dealer on reply. |
| **Mesaj Geçmişi** | Dealers view conversation history with admin | Low | List dealer's messages with status (pending/replied), timestamp, subject. Click to view full thread. | Filter by status, search by keyword. |
| **SSS Sayfası (FAQ)** | Self-service for common questions reduces support load | Low | Static content page or `faq` table with categories. Admin manages FAQs. | Categories: Sipariş, Ödeme, Teslimat, Ürünler, Hesap. Search functionality helpful. |

**Sources:**
- [B2B Support Ticketing 2026 (Thena)](https://www.thena.ai/post/a-complete-guide-to-b2b-customer-service-ticketing-systems)
- [B2B Customer Support Platform (Pylon)](https://www.usepylon.com/blog/b2b-customer-support-platform-2026)

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|-----------|-------|
| **Ürün Talebi (Product Request)** | Dealer can request products not in catalog or out-of-stock items | Low | Separate form from general support. Admin sees product requests separately for demand planning. High business value. |
| **Canlı Durum Göstergesi** | Show if admin is online for faster response expectations | Low | Presence indicator. Sets expectations: if admin offline, expect delayed response. |
| **Dosya Ekleme (Attachments)** | Dealers attach images (e.g., damaged product photo) or documents to messages | Medium | File upload to Supabase Storage. Link to message. Virus scanning recommended. |
| **WhatsApp Bildirimi** | Notify admin via WhatsApp when dealer sends message (since current workflow uses WhatsApp) | Low | WhatsApp Business API. Admin gets instant notification. Differentiator given current practices. |

**Anti-Features:**
- **Realtime Chat Widget** - Out of scope for v2. Async messaging is sufficient. Dealers don't expect instant chat from manufacturers.
- **Complex Ticket System** - No SLA tracking, priority levels, ticket assignment rules. Keep it simple conversation-based messaging.
- **Public Forum/Community** - Dealers don't need peer-to-peer support. This is manufacturer-dealer 1:1 communication.

**Notes on Architecture:**
- Use **async messaging pattern**, not synchronous chat
- Admin doesn't need real-time WebSocket updates - periodic polling or manual refresh acceptable
- Mobile push for dealers on new admin reply (leverage v1 push infrastructure)

---

### Sipariş Detayları Geliştirmeleri (Order Detail Enhancements)

These features extend existing v1 order functionality with document management.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|-----------|--------------|-------|
| **Fatura PDF İndirme (Sipariş Detayında)** | Dealers need invoice for accounting, tax purposes | Low | Same as Finansal Bilgiler > Fatura. Link invoice to order. | "Faturayı İndir" button on order detail page if invoice exists. |
| **İrsaliye PDF İndirme** | Waybill/delivery note required for goods receipt | Low | `order_documents` table with type (invoice/waybill), file URL. Admin uploads. | "İrsaliyeyi İndir" button on shipped/delivered orders. |

**Sources:**
- [B2B Invoice Portal (Cloudfy)](https://cloudfy.com/platform/features/invoice-payment-portal/)

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|-----------|-------|
| **Kargo Takip Bilgisi** | For manufacturer's own vehicles (not 3rd party carriers with API), manual tracking info entry | Low | Text field for tracking notes (e.g., "Araç plakası: 34 ABC 123, Sürücü: Mehmet, Tel: 555-1234"). |
| **E-Fatura Entegrasyonu** | Turkey's e-invoice system compliance. Auto-generate e-invoice from order. | High | Requires GİB (Revenue Administration) integration or e-invoice provider. Complex compliance. Defer unless legally required. |

---

### Bayi Raporları (Dealer-Facing Reports)

Self-service analytics empower dealers and reduce support questions.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|-----------|--------------|-------|
| **Kendi Harcama Analizi** | Dealers want to see their own spending patterns | Medium | Aggregate order data by month, product category, etc. Simple bar/line charts or tabular data. | Show: Monthly spending trend, spending by product category, top 10 products by spend. Export to Excel. |

**Sources:**
- [B2B Reporting 2026 (AgencyAnalytics)](https://agencyanalytics.com/blog/b2b-reporting)

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|-----------|-------|
| **Dönemsel Karşılaştırma** | Compare current period vs. previous period (e.g., "This month vs. last month", "This year vs. last year") | Low | Useful for dealers tracking their own growth. Simple percentage change calculations. |
| **Ürün Kategori Analizi** | Breakdown of spending by product category to identify purchasing patterns | Medium | Requires product categorization (if not already exists). Helps dealers plan inventory. |

**Anti-Features:**
- **Complex BI Dashboards** - No drill-down, pivot tables, or interactive visualizations. Keep it simple tabular reports + basic charts.
- **Predictive Analytics** - No AI/ML forecasting. Defer to much later phases.

---

## Anti-Features (v2.0)

Features to deliberately **NOT** build in v2.0.

### 1. Online Payment Processing (İyzico/PayTR Integration)
**What:** Credit card or bank transfer payment from portal.

**Why Avoid:**
- High complexity: PCI compliance, payment gateway integration, reconciliation
- Current payment processes work (offline payments, bank transfers)
- Not in v2.0 scope per PROJECT.md ("Ödeme sistemi entegrasyonu sonraki milestone")

**Instead:** Show outstanding balance and invoice PDFs. Dealers pay via existing offline methods.

**Defer to:** v3.0 or later if requested.

---

### 2. ERP Real-Time Sync (Logo/Netsis)
**What:** Live bidirectional sync of orders, inventory, financials with ERP.

**Why Avoid:**
- Complex integration, varies by ERP system
- v2.0 explicitly states "ERP-ready schema" but not actual integration
- Financial data manually entered by admin initially

**Instead:** Build **ERP-ready database schema** that matches ERP export formats. Admin manually imports/exports data.

**Defer to:** Dedicated ERP integration milestone after v2.0.

---

### 3. Canlı Chat (Realtime Chat)
**What:** Instant messaging widget with typing indicators, online status, read receipts.

**Why Avoid:**
- Out of scope per PROJECT.md: "v2'de mesajlaşma var ama async, canlı chat yok"
- Complexity: WebSocket infrastructure, presence tracking, typing indicators
- B2B doesn't require instant response - async messaging sufficient

**Instead:** Async message system with email notifications on replies.

**Defer to:** Only if dealers explicitly request real-time chat (unlikely).

---

### 4. Dealer Self-Service Financial Adjustments
**What:** Dealers can dispute invoices, request credit notes, adjust their balance.

**Why Avoid:**
- Financial adjustments require manufacturer approval
- Audit trail and compliance concerns
- Dealers should request adjustments, admin approves

**Instead:** Dealers send message to admin requesting adjustment. Admin makes changes in financial system.

---

### 5. Advanced Campaign Automation
**What:** Scheduled campaigns, A/B testing, personalization rules, conversion tracking.

**Why Avoid:**
- Marketing automation complexity
- v2.0 needs basic campaign publishing, not full marketing platform
- Over-engineering for ~700 dealers

**Instead:** Admin manually creates campaigns with start/end dates. Simple targeted visibility by tier.

**Defer to:** Only if manufacturer has dedicated marketing team needing advanced tools.

---

### 6. Multi-User Collaboration (per Dealer)
**What:** Multiple users per dealer with role-based permissions, approval workflows, shared carts.

**Why Avoid:**
- v1 already has basic multi-user (admin vs. dealer roles)
- Collaboration features (shared carts, approvals) add significant complexity
- Most dealers likely single-user or informal multi-user

**Instead:** Keep existing simple role model. Multiple users from same dealer can all access same data.

**Defer to:** Post-v2 if large dealers request internal approval workflows.

---

### 7. Public API for Dealers
**What:** REST API for dealers to integrate portal with their own systems.

**Why Avoid:**
- Dealers unlikely to have technical sophistication for API integration
- Security concerns (rate limiting, authentication, documentation)
- Maintenance burden

**Instead:** Dealers use web/mobile UI. Export functionality (CSV, PDF) for data portability.

**Defer to:** Only if enterprise dealers request API access (very unlikely for this market).

---

## Feature Dependencies

Understanding which v2.0 features depend on existing v1 features or other v2.0 features.

### Dependency Graph

```
[v1 Foundation]
├── Orders (existing)
│   ├── Dashboard > Son Siparişler Widget
│   ├── Dashboard > Bekleyen Sipariş Sayısı
│   ├── Dashboard > Toplam Harcama Özeti
│   ├── Bayi Raporları > Harcama Analizi
│   ├── Sipariş Detayları > Fatura/İrsaliye PDF
│   └── Dashboard > En Çok Aldığı Ürünler
│
├── Products (existing)
│   ├── Favoriler > Favorilere Ekle
│   ├── Favoriler > Favori Listesi
│   ├── Kampanyalar > İndirimli Ürünler Filtresi
│   └── Dashboard > Stok Uyarıları Widget
│
├── Authentication (existing)
│   ├── Finansal Bilgiler (dealer-specific data)
│   ├── Destek > Mesaj Gönderme
│   └── All dealer-specific features
│
└── Push Notifications (existing)
    ├── Kampanyalar > Yeni Kampanya Bildirimi
    ├── Destek > Yeni Mesaj Bildirimi
    └── Finansal > Cari Hesap Bildirimleri

[v2 New Features - Internal Dependencies]
├── Favoriler
│   └── Dashboard > Stok Uyarıları Widget (requires favorites tracking)
│
└── Finansal Bilgiler
    └── Sipariş Detayları > Fatura PDF (shared invoice table)
```

### Critical Path for v2.0

**Build order recommendation:**

1. **Finansal Bilgiler (ERP-ready schema)** - Foundation for financial tracking
   - Cari bakiye schema
   - Account movements schema
   - Invoice document management

2. **Favoriler** - Simple, high-value feature with no external dependencies
   - Favorites table
   - UI components (heart icon, favorites page)

3. **Kampanyalar/Duyurular** - Marketing content system
   - Campaigns table
   - Announcements table
   - Admin UI for creating campaigns

4. **Destek/İletişim** - Communication infrastructure
   - Messages table with threading
   - Admin inbox
   - FAQ management

5. **Bayi Dashboard** - Aggregates data from above features
   - Spending summary (uses orders)
   - Top products (uses orders + favorites)
   - Quick actions (links to features)
   - Stock alerts (uses favorites + products)

6. **Bayi Raporları** - Analytics layer on top of orders
   - Spending analysis
   - Period comparison

**Parallel Development Opportunities:**
- Favoriler and Kampanyalar can be built in parallel (no dependencies)
- Finansal Bilgiler and Destek can be built in parallel
- Bayi Dashboard should be last (aggregates all other features)

---

## MVP Recommendations for v2.0

Based on complexity vs. impact analysis:

### Must-Have (P0) - Core v2.0 Value

| Feature Category | Specific Features | Rationale |
|-----------------|-------------------|-----------|
| **Finansal Bilgiler** | Cari bakiye, Account movements, Invoice PDF access, Payment history | **Non-negotiable for Turkish B2B.** Without cari hesap tracking, dealers won't trust the platform for financial transparency. |
| **Bayi Dashboard** | Spending summary, Recent orders widget, Pending orders count, Quick actions | **Landing page experience.** Empty dashboard = feels like unfinished product. Low complexity, high perceived value. |
| **Favoriler** | Add to favorites, Favorites list, Order from favorites | **Quick win.** Low complexity, high dealer convenience. 50% faster reorder times per research. |

### High Value (P1) - Complete the Experience

| Feature Category | Specific Features | Rationale |
|-----------------|-------------------|-----------|
| **Kampanyalar** | Active campaigns page, Announcements, New product highlighting | **Engagement driver.** Gives dealers reason to log in regularly beyond ordering. |
| **Destek** | Message admin, Message history, FAQ page | **Communication channel.** Dealers need support path beyond phone. Reduces support load with FAQ. |
| **Sipariş Detayları** | Invoice PDF on order, Waybill PDF | **Document access.** Dealers need these for accounting. Leverages financial schema. |

### Nice-to-Have (P2) - Differentiators

| Feature Category | Specific Features | Rationale |
|-----------------|-------------------|-----------|
| **Dashboard Advanced** | Top products widget, Stock alerts for favorites | **Proactive assistance.** Surfaces useful info, but not critical. |
| **Kampanyalar Advanced** | Targeted campaigns (by tier), Discounted products filter | **Personalization.** Increases relevance but adds complexity. |
| **Destek Advanced** | Product request form, File attachments | **Enhanced communication.** Useful but can be added post-launch. |
| **Bayi Raporları** | Spending analysis, Period comparison | **Self-service analytics.** Nice-to-have for power users. |

### Defer Post-v2.0 (P3)

| Feature | Reason to Defer |
|---------|-----------------|
| Cari hesap online payment | Complex payment gateway integration, not in scope |
| Multi-tier comparison | Privacy concerns, complex calculations |
| WhatsApp notifications | Requires Business API setup, evaluate ROI first |
| E-fatura integration | Complex compliance, only if legally required |
| Advanced campaign targeting | Marketing automation complexity |

---

## Implementation Complexity vs. Business Value

Prioritization matrix:

```
High Value
│
│  [Must Do]              [Plan Carefully]
│  • Cari Bakiye          • Bayi Raporları
│  • Fatura PDF           • Targeted Campaigns
│  • Favoriler
│  • Dashboard Widgets
│  • Kampanyalar
│  • Destek Mesajlaşma
│
│  [Quick Wins]           [Defer]
│  • SSS Sayfası          • Online Payment
│  • Duyurular            • E-Fatura
│  • Sipariş PDF'leri     • Advanced Analytics
│                         • WhatsApp Integration
│
└────────────────────────────────────────> Complexity
                                            (Low → High)
```

**Quick Wins (Low Complexity, High Value):**
- Favorilere Ekle / Favori Listesi
- Kampanyalar Sayfası
- Duyurular
- SSS (Static FAQ)
- Dashboard: Spending summary, Recent orders, Pending count

**Must Do (Medium Complexity, Critical Value):**
- Cari Hesap Bakiyesi
- Cari Hesap Hareketleri
- Fatura PDF Görüntüleme
- Destek Mesajlaşma

**Strategic (Higher Complexity, High Long-Term Value):**
- Bayi Raporları (spending analysis)
- Targeted Campaigns

**Defer (High Complexity, Lower Immediate Value):**
- Online Payment Integration
- E-Fatura Entegrasyonu
- Advanced Analytics/BI

---

## Key Recommendations

### For v2.0 Success

1. **Prioritize Finansal Bilgiler first** - This is the highest-value differentiator for Turkish B2B. Without cari hesap transparency, dealers won't fully trust/adopt the platform.

2. **Build ERP-ready schema from day one** - Even though ERP sync is post-v2.0, the database structure must match ERP data models for easy future integration. Work with actual Logo/Netsis export formats.

3. **Keep dashboard simple but complete** - Don't build an empty dashboard. Include at least 4 widgets: spending, recent orders, pending count, quick actions. Avoid the temptation to add complex charts.

4. **Favorites are table stakes, not optional** - Research shows this is expected in 2026 B2B portals. Low complexity, high adoption.

5. **Async messaging > ticket system** - Don't build complex support ticketing. Simple threaded conversations with email notifications is sufficient and matches 2026 B2B patterns.

6. **Leverage v1 infrastructure** - v1 already has push notifications, file storage, auth. Reuse these for v2 features (campaign notifications, invoice PDFs, message attachments).

7. **Mobile-first for dashboard** - Dealers will check dashboard on mobile. Ensure responsive design with large touch targets for quick actions.

8. **Start with manual admin workflow** - Admin manually uploads invoices, enters balances, creates campaigns. Automation/integration comes later. Validate the UX first.

### Red Flags to Avoid

**Based on B2B portal research:**

- **Empty dashboard** → Feels unfinished, low perceived value
- **Fake real-time data** → If cari hesap isn't real ERP data, clearly label as "demo" or "manual entry"
- **Over-promising payment features** → Don't show "Pay Now" buttons if online payment isn't implemented
- **Complex campaign rules** → Keep campaigns simple (title, description, dates). Avoid discount automation.
- **Realtime chat expectations** → Clearly set async messaging expectations. Don't use "chat" terminology.
- **Missing FAQ** → Without FAQ, all dealer questions go to messaging, overwhelming admin

---

## Confidence Assessment

| Category | Confidence Level | Reasoning |
|----------|-----------------|-----------|
| **Finansal Bilgiler** | **HIGH** | Multiple Turkish B2B sources confirm cari hesap as critical. Invoice access is universal B2B requirement. |
| **Bayi Dashboard** | **HIGH** | 71% of B2B buyers expect personalized dashboards per 2026 research. Standard across all modern B2B portals. |
| **Favoriler** | **HIGH** | Wishlist/favorites features are table stakes per 2026 B2B ecommerce platform reviews. |
| **Kampanyalar** | **MEDIUM** | Campaign/announcement features are common but implementation patterns vary. Turkish-specific research limited. |
| **Destek** | **MEDIUM-HIGH** | 2026 B2B support trending toward async messaging. Pattern validated across multiple platforms (Thena, Pylon, Plain). |
| **Bayi Raporları** | **MEDIUM** | Dealer-facing analytics less common than admin analytics. Value validated but not universal table stakes. |

**Overall v2.0 Feature Confidence: HIGH** - All major feature categories are validated by 2026 B2B portal research and align with Turkish market expectations.

---

## Open Questions for Stakeholders

Before finalizing v2.0 roadmap, validate these assumptions:

### Finansal Bilgiler
1. **ERP system in use?** → Logo, Netsis, SAP, or other? Need to match schema to actual system.
2. **Current financial workflow?** → How does manufacturer currently track dealer balances? Manual spreadsheet, ERP, accounting software?
3. **Credit terms?** → Do dealers buy on credit (net 30/60) or prepay? Affects balance display and urgency.
4. **Multi-currency?** → All dealers in Turkey with TRY, or international dealers exist?

### Dashboard
5. **KPI priorities?** → Which metrics matter most to manufacturer? (Total sales, order frequency, average order value, etc.)
6. **Benchmark data available?** → Can we show tier averages for comparison, or privacy concerns?

### Kampanyalar
7. **Campaign frequency?** → How often does manufacturer run promotions/campaigns? Daily, weekly, monthly, seasonally?
8. **Target audience?** → Do campaigns target all dealers, or specific tiers/regions?

### Destek
9. **Support team size?** → Is there dedicated support staff, or does admin handle all dealer questions?
10. **Response time expectations?** → Same-day, 24-hour, or best-effort response to dealer messages?

### General
11. **Document volume?** → How many invoices/waybills per month? Affects storage planning.
12. **Mobile usage?** → What percentage of dealers primarily use mobile vs. desktop? Affects UI prioritization.

---

## Sources

### Dealer Dashboards & Personalization
- [B2B Portal Meaning, Key Features, Examples [Updated 2026] - B2Bridge](https://b2bridge.io/blog/b2b-portal/)
- [Top 5 Features of a Modern B2B Portal in 2026 | Asabix](https://asabix.com/blog/top-5-features-b2b-portal-in-2026/)
- [How Modern B2B Distributors Scale in 2026 - Shopify](https://www.shopify.com/enterprise/blog/b2b-distributors)
- [The Complete Guide to B2B Dealer Portals | OroCommerce](https://oroinc.com/b2b-ecommerce/blog/the-complete-guide-to-b2b-dealer-portals/)
- [Who Benefits From Dealer Portals and How | B2B Portal Solutions by i95dev](https://www.i95dev.com/who-benefits-from-dealer-portals-and-how/)

### Financial Tracking & Cari Hesap
- [B2B Store Cari Hesap ile E Ticaret Sürecinizi Maksimize Edin](https://tr.b2bstore.com/cari-hesap-takibi/)
- [Cari Hesap Takibi - B2B.net.tr](https://www.b2b.net.tr/moduller/detayli-cari-hareketler)
- [Invoice management for B2B e-commerce websites - Commerce | Dynamics 365 | Microsoft Learn](https://learn.microsoft.com/en-us/dynamics365/commerce/b2b/invoice-management)
- [Simplify B2B Transactions with Invoice Payment Portal | Cloudfy](https://cloudfy.com/platform/features/invoice-payment-portal/)
- [2026 B2B Payment Trends for Manufacturers and Distributors](https://oroinc.com/b2b-ecommerce/blog/b2b-payment-trends-where-b2b-payments-are-heading-in-2026/)
- [B2B Dealer Portal, Dealer Management Systems - Trizbi](https://www.trizbi.com/en/system-features/b2b-dealer-portal)

### Favorites & Wishlists
- [Wishlist & B2B Project Planner - Shopify App Store](https://apps.shopify.com/wishlist-project-planner)
- [The List - The ultimate wishlist app for customers and B2B companies. | Shopify App Store](https://apps.shopify.com/on-the-business-portal)
- [10 Best B2B Wholesale Apps For Your Shopify Store (2026)](https://multivariants.com/blog/best-b2b-wholesale-apps/)
- [5 B2B order portals for manufacturing in 2026 | Moxo](https://www.moxo.com/blog/b2b-order-portals-manufacturing)

### Campaigns & Announcements
- [Self-Serve Dealer Portals: Transform B2B Relationships in 2026](https://www.shopaccino.com/blog/how-b2b-brands-can-improve-dealer-relationships-with-selfserve-ordering-portals)
- [B2B Portal Development in 2026: Features, Benefits & Enterprise Architecture](https://www.techvoot.com/blog/b2b-portal-development-enterprise-architecture)
- [How a B2B dealer portal can change how manufacturers promote their products](https://www.digitaljournal.com/pr/news/indnewswire/b2b-dealer-portal-change-manufacturers-1742456640.html)

### Support & Messaging
- [Modren B2B Customer Support Ticketing System | Thena](https://www.thena.ai/post/a-complete-guide-to-b2b-customer-service-ticketing-systems)
- [What to Look for in a B2B Customer Support Platform for 2026 | Pylon](https://www.usepylon.com/blog/b2b-customer-support-platform-2026)
- [Plain — AI-Powered Support for B2B Teams](https://www.plain.com/)
- [Beyond Tickets: How Plain is Transforming B2B Customer Support - Battery Ventures](https://www.battery.com/blog/beyond-tickets-how-plain-is-transforming-b2b-customer-support/)
- [Best customer portal software for B2B teams [Guide]](https://www.thena.ai/post/best-customer-portal-software-guide)

### Reporting & Analytics
- [B2B Reporting: Tools, Strategies & Dashboards for 2025 - AgencyAnalytics](https://agencyanalytics.com/blog/b2b-reporting)

### General B2B Portal Trends
- [Top 7 B2B Marketplace Features in 2026: Why They Matter & Best Practices | Rigby Blog](https://www.rigbyjs.com/blog/b2b-marketplace-features)
- [B2B Order Management (BigCommerce)](https://www.bigcommerce.com/articles/b2b-ecommerce/b2b-order-management/)

---

**Research Complete | Ready for Roadmap Creation**
