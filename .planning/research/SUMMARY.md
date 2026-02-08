# Project Research Summary

**Project:** Bayi Yönetimi v2.0 - Dealer Dashboard and Financial Tracking
**Domain:** B2B Dealer Experience and Financial Management (subsequent milestone)
**Researched:** 2026-02-08
**Confidence:** HIGH

## Executive Summary

v2.0 transforms the existing B2B order management system from a transactional ordering tool into a comprehensive dealer relationship platform. Research shows that in 2026, dealer dashboards, financial transparency (cari hesap), and self-service features are table stakes for Turkish B2B — not differentiators. This milestone adds seven integrated feature sets (dashboard, financial tracking, favorites, campaigns, support messaging, order documents, and dealer reports) that leverage the proven Supabase/Next.js foundation from v1 with minimal stack additions.

The recommended approach is an extension strategy: reuse existing patterns (RLS multi-tenancy, Server Actions, Supabase services) rather than introducing new platforms. Only 5 required dependencies (react-pdf + 4 Radix UI components + expo-document-picker) are needed. The architecture follows established database patterns with 7 new tables, all inheriting the same RLS security model as v1. Financial data is ERP-ready from day one (manual admin entry initially, automated sync deferred to post-v2.0), ensuring migration path to Logo/Netsis integration without schema changes.

The critical risk is financial data leakage through dashboard aggregation queries that bypass RLS policies. Multi-tenant financial systems require exhaustive testing to ensure dealers never see each other's balances or spending data. Secondary risks include performance degradation from naive dashboard calculations (700 dealers with growing order history), manual data entry errors eroding trust, and notification fatigue destroying the campaign communication channel. All are preventable with upfront design: materialized views for dashboard metrics, comprehensive audit logging for financial changes, and strict notification frequency capping. The research provides concrete prevention patterns for each pitfall.

## Key Findings

### Recommended Stack

v2.0 requires MINIMAL additions to the existing Next.js 16 + Supabase stack. Research confirms the current platform provides 90% of needed capabilities through integrated services (Database, Storage, Realtime, Auth). The philosophy is "extend existing capabilities rather than introduce new platforms."

**Core technology additions:**
- **@react-pdf/renderer** (web): Server-side PDF generation for invoices and dealer reports — chosen over Puppeteer for lighter bundle (1.2M weekly downloads, proven compatibility with Next.js 16 + React 19)
- **Radix UI extensions** (web): Accordion, Tabs, Popover, Collapsible — consistent with existing v1 Radix usage, adds ~10KB total
- **expo-document-picker** (mobile): Official Expo SDK for dealer document uploads — cross-platform, works in Expo Go

**Leveraging existing stack:**
- **Supabase Realtime** (no new dependency): Async messaging for support via postgres_changes subscriptions, already in stack
- **Supabase Storage** (no new dependency): File uploads for financial documents and order attachments with RLS policies
- **Recharts** (from v1): Dashboard charts and dealer reports visualization, already proven in admin reporting
- **Sonner** (from v1): Toast notifications for campaign alerts and file upload feedback, sufficient for all v2.0 needs

**Total bundle impact:** ~150KB web, ~50KB mobile for required dependencies. No breaking changes. All dependencies fully compatible with Next.js 16 + React 19 + Supabase.

### Expected Features

Research confirms a clear hierarchy of features based on 2026 B2B portal standards and Turkish market expectations:

**Must have (table stakes):**
- **Cari Hesap (Current Account)** — Financial balance tracking is "the backbone of Turkish B2B relationships" per research. Dealers cannot operate without transparency into borç/alacak (debit/credit). Must include: balance display, transaction history, invoice PDF access, payment history.
- **Dealer Dashboard** — 71% of B2B buyers expect personalized dashboards in 2026. Must include: spending summary, recent orders widget, pending orders count, quick actions. Empty dashboard = feels unfinished.
- **Favorites** — B2B portals with saved product lists show 50% faster reorder times. Standard feature across modern platforms. Must include: add to favorites, favorites list, order from favorites.
- **Kampanyalar (Campaigns)** — Modern dealer portals are marketing hubs. Must include: active campaigns page, announcements system, new product highlighting.
- **Support Messaging** — Dealers need communication channel beyond phone. 2026 trend is async messaging over traditional ticketing. Must include: message admin, message history, FAQ page.

**Should have (competitive):**
- **Enhanced Dashboard** — Top products widget, stock alerts for favorites, group performance comparison (with privacy controls)
- **Targeted Campaigns** — Segment by dealer tier/region rather than blast to all 700 dealers
- **Order Documents** — Invoice and irsaliye (waybill) PDF download on order detail pages
- **Dealer Reports** — Self-service spending analysis, period comparison, category breakdown

**Defer (v2+):**
- **Online Payment Integration** — iyzico/PayTR integration complex (PCI compliance), current offline payment methods work
- **ERP Real-Time Sync** — v2.0 builds ERP-ready schema but manual data entry; Logo/Netsis integration deferred to dedicated milestone
- **Realtime Chat** — Async messaging sufficient for B2B, live chat adds complexity without validated need
- **Advanced Campaign Automation** — A/B testing, personalization rules over-engineered for 700 dealers

### Architecture Approach

v2.0 integrates seamlessly into the existing multi-tenant Supabase architecture using established patterns. All new features follow the same security model as v1 (RLS with dealer_id filtering) and Server Actions pattern for data mutations.

**Major components:**
1. **7 New Database Tables** — dealer_transactions (financial ledger), favorite_products, campaigns, campaign_products, announcements, support_messages, order_attachments. All use standard RLS pattern: `dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid())`
2. **2 New Storage Buckets** — financial-documents (invoices, receipts), order-attachments (fatura, irsaliye). Both use folder-based RLS matching dealer ownership.
3. **New Server Actions** — 6 new action files (dashboard.ts, financials.ts, favorites.ts, campaigns.ts, support.ts, reports.ts) following existing pattern from catalog.ts and orders.ts
4. **New Route Groups** — 7 new dealer-facing routes under (dealer)/ (dashboard, financials, favorites, campaigns, announcements, support, reports) plus admin counterparts
5. **Realtime Subscriptions** (optional) — Support messages (admin inbox) and urgent announcements use postgres_changes pattern already established in v1

**Integration points:**
- Dashboard aggregates existing orders data with new financial transactions
- Favorites references existing products table
- Campaigns link to products via campaign_products join table
- Support messages optionally reference products/orders for context
- Order attachments extend existing orders with document storage

**Build order:** Foundation (tables + storage) → Favorites (simple, validates patterns) → Dashboard (aggregates existing data) → Campaigns (read-only dealer view) → Support (tests Realtime) → Financial (complex, file uploads) → Order Attachments → Reports (complex queries).

### Critical Pitfalls

Research identified 13 pitfalls across 3 severity tiers. The top 5 critical pitfalls require upfront prevention:

1. **Financial Data Leakage Through Dashboard Aggregation** — Dashboard aggregate queries (total spending, top products) can bypass RLS if written incorrectly, exposing dealer financial data across all 700 dealers. Prevention: Verify RLS on all financial tables, never use SECURITY DEFINER for dealer queries, test data isolation with multiple dealer sessions, cache per dealer (not globally). This is unrecoverable reputational damage if it occurs.

2. **Dashboard Performance Degradation** — Naive aggregation queries scanning entire orders table on every page load cause 5-10 second load times after 6 months. Under concurrent load (50 active users), database CPU spikes to 100%. Prevention: Pre-aggregate with materialized views or summary tables (refresh hourly), use composite indexes on (dealer_id, created_at), implement smart caching (15-30 min TTL per dealer), batch widget queries in single round-trip.

3. **Manual Financial Entry Errors** — Admin manually enters cari hesap balances and payments. Typos, wrong dealer selection, duplicates create discrepancies that erode trust. Prevention: Comprehensive audit logging (who/when/what changed), validation and confirmation on entry, duplicate detection, ERP-ready schema from day one, immutable financial records (no deletion, corrections create audit trail).

4. **PDF Invoice Generation Bottleneck** — On-the-fly PDF generation saturates CPU under load (50 dealers downloading at month-end), requests timeout. Prevention: Pre-generate PDFs asynchronously when invoice is finalized (not when downloaded), cache in Supabase Storage, use background job queue, rate limit concurrent generations, pre-generate all month-end invoices 2 days before.

5. **Notification Spam Destroys Engagement** — Daily campaign notifications + order status updates = 5-10 notifications/day. Dealers disable all notifications, losing critical communication channel. Prevention: Separate transactional vs marketing notification preferences, frequency capping (max 1 marketing/day), campaigns default to in-app only (push requires explicit action), respect quiet hours (22:00-08:00), rich actionable notification copy.

**Additional medium-priority pitfalls:** Next.js caching serving stale dealer data (force dynamic rendering), materialized view refresh too infrequent (show last updated timestamp), messaging system without SLA/routing becomes bottleneck (build assignment workflow), favorites storing snapshot vs reference (join for current data), cargo tracking complexity underestimated (start manual, add automation incrementally).

## Implications for Roadmap

Based on combined research findings, v2.0 should be structured into 7 phases following dependency order and risk mitigation:

### Phase 1: Foundation & Database Setup
**Rationale:** All features depend on correct data layer. Financial data security must be correct from day one (unrecoverable if wrong). Establishing RLS patterns and storage buckets before building features prevents architectural rework.

**Delivers:**
- 7 new database tables with RLS policies
- 2 new Storage buckets with folder-based RLS
- Database migrations and verification scripts
- Server Actions file structure (empty implementations)

**Addresses:** PITFALLS.md Critical Pitfall #1 (financial data leakage prevention through RLS verification)

**Research flags:** Standard patterns, no additional research needed. Focus on exhaustive RLS testing.

---

### Phase 2: Favorites (Quick Win)
**Rationale:** Simplest feature with no external dependencies. Validates Server Actions pattern and component integration before tackling complex features. High business value (50% faster reorders) with low complexity.

**Delivers:**
- Favorites toggle on product cards
- Favorites list page (reuses ProductGrid)
- Stock alerts for favorited products

**Addresses:** FEATURES.md table stakes, PITFALLS.md #7 (reference vs snapshot design)

**Uses:** favorite_products table, existing products table, toggleFavorite/getFavoriteProducts actions

**Research flags:** None. Well-documented wishlist patterns.

---

### Phase 3: Dealer Dashboard
**Rationale:** Early visibility into dealer experience. Aggregates existing orders data (no new data entry needed), so can be built before financial features are ready. Dashboard performance patterns inform later reporting features.

**Delivers:**
- Dashboard landing page (replaces empty catalog as default)
- 4 core widgets: spending summary, recent orders, pending count, quick actions
- Balance summary (reads from financial tables once Phase 5 complete)

**Addresses:** FEATURES.md table stakes (71% expect personalized dashboards), PITFALLS.md #2 (performance optimization with materialized views)

**Uses:** dashboard.ts actions, Recharts from v1, existing orders data, new dealer_transactions table

**Research flags:** Focus on aggregation query optimization and caching strategy. Standard PostgreSQL analytics patterns.

---

### Phase 4: Campaigns & Announcements
**Rationale:** Read-only dealer view can be built independently while financial features (Phase 5) are in development. Establishes notification preferences system needed for all future features. Defer admin CRUD to later (admin can manually insert via SQL initially).

**Delivers:**
- Active campaigns page with product listings
- Announcements feed
- Notification preferences UI
- In-app notification center

**Addresses:** FEATURES.md table stakes (marketing hub), PITFALLS.md #5 (notification spam prevention through frequency capping)

**Uses:** campaigns, announcements, campaign_products tables, Radix Tabs/Collapsible, Sonner notifications, optional Realtime subscriptions

**Research flags:** Notification best practices well-documented. Consider deeper research on Turkish B2B campaign patterns if targeting becomes priority.

---

### Phase 5: Financial Tracking (Highest Business Value)
**Rationale:** Most complex feature (file uploads, manual entry validation, audit logging) but highest business value. "Backbone of Turkish B2B relationships" per research. All preparatory work (database, RLS, dashboard placeholder) completed in earlier phases allows focus on correct implementation.

**Delivers:**
- Cari hesap balance display for dealers
- Transaction history (invoice, payment, credit/debit notes) with filtering
- Invoice PDF viewing/download
- Admin panel for manual transaction entry with validation
- Comprehensive audit logging

**Addresses:** FEATURES.md highest-priority table stakes, PITFALLS.md #3 (manual entry errors), #4 (PDF generation performance)

**Uses:** dealer_transactions table, financial-documents bucket, @react-pdf/renderer, Server Actions for file upload, Radix Accordion/Popover

**Research flags:** DEEP RESEARCH RECOMMENDED on Turkish accounting standards, Logo/Netsis ERP data models for schema compatibility, financial compliance requirements. Phase success depends on ERP-ready schema.

---

### Phase 6: Support & Messaging
**Rationale:** Builds on notification system from Phase 4. Tests Realtime subscriptions on admin side (low risk — only admin sees real-time updates). Async messaging pattern simpler than live chat, matches 2026 B2B trends.

**Delivers:**
- Dealer message creation form (with category, optional product/order reference)
- Message history for dealers
- Admin support inbox with assignment and status tracking
- Static FAQ page
- Admin real-time notification on new messages

**Addresses:** FEATURES.md table stakes (communication channel), PITFALLS.md #6 (messaging workflow design)

**Uses:** support_messages table, Realtime postgres_changes for admin, expo-document-picker for attachments (mobile), Radix Popover

**Research flags:** Standard support ticketing patterns. Consider deeper research on WhatsApp Business API integration if that becomes priority post-v2.0.

---

### Phase 7: Order Documents & Reports
**Rationale:** Extends existing orders feature with document management (validates file upload patterns from Phase 5). Dealer reports require meaningful data (months of orders), so build last when real data exists for testing aggregation queries.

**Delivers:**
- Invoice/irsaliye PDF download on order detail pages
- Dealer spending analysis reports
- Period comparison (this month vs last month)
- Category breakdown
- Cargo tracking info (manual entry by admin, external link for dealers)

**Addresses:** FEATURES.md should-haves, PITFALLS.md #8 (cargo tracking scoped to manual), #10 (materialized view refresh strategy for reports)

**Uses:** order_attachments table, order-attachments bucket, reports.ts actions with complex aggregation queries, Recharts

**Research flags:** Standard patterns. Cargo tracking automation deferred; consider research if real-time tracking becomes requirement.

---

### Phase Ordering Rationale

**Dependency-driven:**
- Foundation must precede all features (database + storage)
- Favorites has zero dependencies → early quick win validates patterns
- Dashboard aggregates orders (existing) before financial data available
- Campaigns establishes notification system before support messaging needs it
- Financial complexity isolated to single phase after simpler features proven
- Order documents reuse file upload patterns from financial tracking

**Risk mitigation:**
- RLS verification in Phase 1 before any financial data entered
- Performance patterns (caching, materialized views) established in Dashboard before Reports
- Notification preferences built before marketing features launch
- Manual entry validation and audit logging designed upfront in Financial phase

**Business value sequence:**
- Early quick win (Favorites) shows progress
- Dashboard visibility early, even if balance summary empty initially
- Financial tracking (highest value) in Phase 5 after foundation solid
- Lower-value features (reports, documents) deferred to end

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 5 (Financial Tracking):** Turkish accounting standards for cari hesap, Logo/Netsis ERP data export formats for schema compatibility, financial data retention laws in Turkey. Current research covers B2B patterns but lacks Turkey-specific compliance context.

**Phases with standard patterns (skip research-phase):**

- **Phase 1 (Foundation):** Standard Supabase RLS patterns extensively documented
- **Phase 2 (Favorites):** E-commerce wishlist patterns well-established
- **Phase 3 (Dashboard):** PostgreSQL analytics optimization well-documented
- **Phase 4 (Campaigns):** Push notification best practices comprehensive for 2026
- **Phase 6 (Support):** Async messaging patterns established in customer support systems
- **Phase 7 (Reports & Documents):** Standard aggregation queries, file storage patterns proven

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Minimal additions to proven Next.js 16 + Supabase stack. All dependencies compatible and well-documented with v1 versions. @react-pdf/renderer verified for Next.js 16 + React 19. |
| Features | HIGH | All feature categories validated by 2026 B2B portal research. Cari hesap confirmed as critical for Turkish market by multiple sources. Dashboard and favorites are universal table stakes. |
| Architecture | HIGH | Extends existing v1 multi-tenant patterns. 7 new tables follow established RLS model. No architectural changes required. Integration points clearly defined. |
| Pitfalls | HIGH | Multi-tenant financial security extensively documented. Dashboard performance patterns proven. Manual entry risks and notification fatigue well-researched. Medium confidence on cargo tracking complexity (inferred from B2B guides). |

**Overall confidence: HIGH**

v2.0 research is comprehensive and actionable. All major technical decisions (stack, architecture, security patterns) have clear evidence-based recommendations. Feature prioritization aligns with both 2026 B2B standards and Turkish market specifics.

### Gaps to Address

**Turkey-specific financial context:**
- Research covers international B2B financial tracking but lacks detail on Turkish accounting terminology (borç/alacak conventions), Logo/Netsis ERP specifics, and compliance requirements (e-invoice, e-ledger). Recommend consulting with Turkish accounting software expert during Phase 5 planning to validate schema.

**Cargo company integration:**
- Research identifies complexity but provides limited detail on specific Turkish carriers (Aras, MNG, Yurtiçi, PTT) API capabilities. Current recommendation (start manual, add automation incrementally) is sound, but deeper carrier research would be valuable if automated tracking becomes priority.

**Dealer usage patterns:**
- Research based on general B2B portal trends. Actual dealer behavior (mobile vs desktop usage ratio, feature adoption curves, notification tolerance) should be validated with analytics after launch to inform priorities.

**Handling during execution:**
- Turkey-specific gaps: Validate financial schema with ERP export samples before Phase 5 implementation
- Cargo integration: Defer automation research until Phase 7; assess dealer demand for real-time tracking
- Usage patterns: Instrument all v2.0 features with analytics from day one; review after 30 days to adjust priorities

## Sources

### Primary (HIGH confidence)

**Stack & Technology:**
- [react-pdf Official Compatibility Documentation](https://react-pdf.org/compatibility) — Next.js 16 + React 19 compatibility verified
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) — Official RLS patterns for file storage
- [Next.js Server Actions Official Guide](https://nextjs.org/docs/14/app/building-your-application/data-fetching/server-actions-and-mutations) — Data mutation patterns

**Features & B2B Standards:**
- [B2B Portal Features 2026 (B2Bridge)](https://b2bridge.io/blog/b2b-portal/) — 71% personalization expectation statistic
- [B2B Store Cari Hesap Takibi](https://tr.b2bstore.com/cari-hesap-takibi/) — Turkish B2B financial tracking as "backbone"
- [Microsoft Dynamics 365 B2B Invoice Management](https://learn.microsoft.com/en-us/dynamics365/commerce/b2b/invoice-management) — Invoice access as table stakes
- [Shopify B2B Wishlist Apps](https://apps.shopify.com/wishlist-project-planner) — 50% faster reorder time with favorites

**Security & Multi-Tenancy:**
- [Supabase RLS Multi-Tenant Guide (DEV Community)](https://dev.to/blackie360/-enforcing-row-level-security-in-supabase-a-deep-dive-into-lockins-multi-tenant-architecture-4hd2) — Multi-tenant RLS patterns
- [Multi-Tenant Security Best Practices (Qrvey)](https://qrvey.com/blog/multi-tenant-security/) — Data leakage prevention

**Performance & Optimization:**
- [Supabase Materialized Views Guide (DEV)](https://dev.to/kovidr/optimize-read-performance-in-supabase-with-postgres-materialized-views-12k5) — Dashboard performance optimization
- [PostgreSQL Analytics Workload Optimization (Epsio)](https://www.epsio.io/blog/postgres-for-analytics-workloads-capabilities-and-performance-tips) — Aggregation query patterns

### Secondary (MEDIUM confidence)

**Notification Best Practices:**
- [Push Notification Best Practices 2026 (Reteno)](https://reteno.com/blog/push-notification-best-practices-ultimate-guide-for-2026) — Frequency capping, quiet hours
- [Why Push Notification Architecture Fails (Netguru)](https://www.netguru.com/blog/why-mobile-push-notification-architecture-fails) — Spam prevention patterns

**B2B Portal Patterns:**
- [Complete Guide to B2B Dealer Portals (OroCommerce)](https://oroinc.com/b2b-ecommerce/blog/the-complete-guide-to-b2b-dealer-portals/) — Portal feature standards
- [Self-Serve Dealer Portals 2026 (Shopaccino)](https://www.shopaccino.com/blog/how-b2b-brands-can-improve-dealer-relationships-with-selfserve-ordering-portals) — Campaign management patterns

**Financial Systems:**
- [Common Accounting Problems 2026 (Spendflo)](https://www.spendflo.com/blog/accounting-problems) — Manual entry error patterns
- [B2B Invoicing Best Practices (Paystand)](https://www.paystand.com/blog/b2b-invoicing) — Invoice generation recommendations

### Tertiary (LOW confidence, needs validation)

**Cargo Tracking:**
- [B2B Cargo Complexity (Trizbi)](https://www.trizbi.com/en/blog/cargo-at-b2b-companies-on-special-days) — Cargo integration challenges mentioned but limited detail on Turkish carriers

**Mobile PDF Viewing:**
- [React Native PDF Viewer Guide (The App Market)](https://theappmarket.io/blog/react-native-pdf-viewer) — WebView vs native PDF tradeoffs (community guide, not official docs)

---

*Research completed: 2026-02-08*
*Ready for roadmap: yes*
*Synthesized from: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md*
