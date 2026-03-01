# Roadmap: Bayi Yönetimi

## Milestones

- ✅ **v1 MVP** - Phases 1-3 (shipped 2026-02-03)
- 🚧 **v2.0 Bayi Deneyimi ve Finansal Takip** - Phases 4-7 (in progress)

## Phases

<details>
<summary>✅ v1 MVP (Phases 1-3) - SHIPPED 2026-02-03</summary>

### Phase 1: Foundation & Basic Ordering
**Goal**: Dealers can browse catalog and place orders
**Plans**: 6 plans

Plans:
- [x] 01-01: Project setup and database schema
- [x] 01-02: Authentication system
- [x] 01-03: Product catalog
- [x] 01-04: Shopping cart
- [x] 01-05: Group pricing
- [x] 01-06: Order creation

### Phase 2: Order Management & Tracking
**Goal**: Complete order lifecycle management
**Plans**: 3 plans

Plans:
- [x] 02-01: Order status tracking
- [x] 02-02: Quick order form
- [x] 02-03: Reorder functionality

### Phase 3: Insights & Mobile
**Goal**: Admin insights and mobile dealer experience
**Plans**: 5 plans

Plans:
- [x] 03-01: Admin dashboard
- [x] 03-02: Sales reporting
- [x] 03-03: Mobile app foundation
- [x] 03-04: Mobile catalog and cart
- [x] 03-05: Mobile orders and push notifications

</details>

### 🚧 v2.0 Bayi Deneyimi ve Finansal Takip (In Progress)

**Milestone Goal:** Transform from transactional ordering tool to comprehensive dealer relationship platform with financial transparency, personalization, and self-service capabilities.

#### Phase 4: Favorites Quick Win
**Goal**: Dealers can save favorite products for faster reordering
**Depends on**: v1 foundation (Phase 3 complete)
**Requirements**: FAV-01, FAV-02, FAV-03, FAV-04
**Success Criteria** (what must be TRUE):
  1. Dealer can toggle favorite status on any product from catalog
  2. Dealer can view all favorited products in dedicated favorites page
  3. Dealer can add products from favorites list directly to cart
  4. Dealer sees stock status for favorited products
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md — Database schema and Server Actions for favorites
- [x] 04-02-PLAN.md — Client state, UI components, and favorites page
- [x] 04-03-PLAN.md — Gap closure: Catalog favorite state hydration

#### Phase 5: Financial Backbone
**Goal**: Dealers can view cari hesap balance and financial transactions with ERP-ready schema
**Depends on**: Phase 4
**Requirements**: FIN-01, FIN-02, FIN-03, FIN-04, FIN-05, FIN-06
**Success Criteria** (what must be TRUE):
  1. Dealer sees current cari hesap balance (toplam borç, alacak, net bakiye)
  2. Dealer can browse transaction history (fatura, ödeme, düzeltme) with date filtering
  3. Dealer can download invoice PDFs for completed orders
  4. Admin can manually enter financial transactions with validation and audit logging
  5. Admin can upload invoice PDFs to specific dealers
  6. Financial data is isolated per dealer (RLS prevents cross-dealer leakage)
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md — Database schema (tables, functions, RLS, storage)
- [x] 05-02-PLAN.md — Dealer financials UI (balance, transactions, invoices)
- [x] 05-03-PLAN.md — Admin financials UI (transaction entry, invoice upload)

#### Phase 6: Dashboard, Campaigns & Order Documents
**Goal**: Personalized dealer dashboard, marketing hub, and enhanced order documentation
**Depends on**: Phase 5
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, CAMP-01, CAMP-02, CAMP-03, CAMP-04, CAMP-05, CAMP-06, CAMP-07, ORD-01, ORD-02, ORD-03, ORD-04, ORD-05
**Success Criteria** (what must be TRUE):
  1. Dealer sees personalized dashboard on login (spending summary, recent orders, pending count, quick actions)
  2. Dealer can browse active campaigns and view campaign details
  3. Dealer sees announcements feed and can mark announcements as read
  4. Dealer can filter catalog by "new products" tag
  5. Dealer can download invoice/irsaliye PDFs from order detail pages
  6. Dealer sees cargo tracking information (vehicle plate, driver info) when available
  7. Admin can create/edit campaigns with linked products
  8. Admin can upload order documents (invoice, irsaliye) and enter cargo details
**Plans**: 5 plans

Plans:
- [ ] 06-01-PLAN.md — Database schema (campaigns, announcements, order_documents, materialized views)
- [ ] 06-02-PLAN.md — Dealer dashboard (spending summary, orders, quick actions, top products)
- [ ] 06-03-PLAN.md — Campaigns and announcements (dealer browsing, admin CRUD, read receipts)
- [ ] 06-04-PLAN.md — Order documents and cargo (admin upload, dealer download, cargo tracking)
- [ ] 06-05-PLAN.md — New products filter and integration verification

#### Phase 7: Support & Reports
**Goal**: Async dealer-admin messaging and self-service spending analytics
**Depends on**: Phase 6
**Requirements**: SUP-01, SUP-02, SUP-03, SUP-04, SUP-05, SUP-06, REP-01, REP-02, REP-03
**Success Criteria** (what must be TRUE):
  1. Dealer can send messages to admin with subject categorization
  2. Dealer can view message history (pending/answered status)
  3. Dealer can browse FAQ organized by categories
  4. Dealer can submit product requests for out-of-stock items
  5. Admin receives real-time notification for new dealer messages
  6. Admin can reply to dealer messages and manage FAQ content
  7. Dealer can view spending analysis with monthly trend charts
  8. Dealer can compare spending periods (this month vs last month, this year vs last year)
  9. Dealer can export spending report as Excel
**Plans**: 4 plans

Plans:
- [ ] 07-01-PLAN.md — Database schema (support_messages, faq_categories, faq_items, product_requests, realtime setup)
- [ ] 07-02-PLAN.md — Support messaging system (dealer compose/history, FAQ, product requests, admin inbox, FAQ management)
- [ ] 07-03-PLAN.md — Spending reports and analytics (trend chart, period comparison, Excel export via Route Handler)
- [ ] 07-04-PLAN.md — Integration verification (automated checks across all Phase 7 artifacts)

## Progress

**Execution Order:**
Phases execute in numeric order: 4 → 5 → 6 → 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Basic Ordering | v1 | 6/6 | Complete | 2026-01-26 |
| 2. Order Management & Tracking | v1 | 3/3 | Complete | 2026-01-27 |
| 3. Insights & Mobile | v1 | 5/5 | Complete | 2026-02-03 |
| 4. Favorites Quick Win | v2.0 | 3/3 | Complete | 2026-02-09 |
| 5. Financial Backbone | v2.0 | 3/3 | Complete | 2026-02-09 |
| 6. Dashboard, Campaigns & Order Documents | v2.0 | 4/5 | In Progress | - |
| 7. Support & Reports | 3/4 | In Progress|  | - |

---
*Roadmap created: 2026-02-08*
*v1 shipped: 2026-02-03 | v2.0 in progress*
