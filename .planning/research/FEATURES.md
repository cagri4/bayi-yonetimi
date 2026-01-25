# Feature Landscape: B2B Dealer Order Management System

**Domain:** Manufacturer-to-Dealer Order Management
**Project:** Bayi Yönetimi (Dealer Management)
**Researched:** 2026-01-25
**Overall Confidence:** HIGH

## Executive Summary

Based on research into B2B dealer order management systems in 2026, this document categorizes features into table stakes (must-have or dealers won't adopt), differentiators (competitive advantages), and anti-features (avoid for MVP to prevent over-engineering).

**Key Insight:** 74% of B2B buyers switch to competitors for a smoother buying experience. 83% prefer digital ordering over phone/email. The current pain points (phone/WhatsApp orders, no after-hours ordering, no stock visibility) align precisely with what 2026 dealers demand as table stakes.

---

## Table Stakes

Features users expect. Missing = product feels incomplete or dealers won't adopt.

### 1. 24/7 Self-Service Ordering
**Why Expected:** 83% of B2B buyers prefer digital ordering, and 61% prefer rep-free experiences. After-hours ordering is explicitly listed as a current pain point.

**Complexity:** Medium
- Product catalog with search/filter
- Shopping cart functionality
- Checkout process
- Order confirmation

**Notes:**
- Directly addresses current pain: "no after-hours ordering"
- Dealer portals that provide 24/7 access reduce customer service inquiries by 40%
- CRITICAL for MVP - this is the core value proposition

**Sources:**
- [B2B Order Management (BigCommerce)](https://www.bigcommerce.com/articles/b2b-ecommerce/b2b-order-management/)
- [The New B2B Buyer 2026 (Nishtech)](https://www.nishtech.com/Blog/2025/December/The-New-B2B-Buyer-2026-Insights)

---

### 2. Real-Time Stock Visibility
**Why Expected:** "Real-time visibility is non-negotiable" per 2026 research. Current pain explicitly states "no real-time stock visibility."

**Complexity:** Medium-High
- Live inventory integration
- Stock level display per product
- Low stock warnings
- Multi-location inventory (if applicable)

**Notes:**
- Prevents overselling and builds dealer trust
- Must integrate with manufacturer's inventory system
- Update frequency: Real-time or near-real-time (max 5-minute lag acceptable for MVP)

**Sources:**
- [B2B Order Management Trends (Silicon Slopes)](https://www.siliconslopes.com/c/posts/top-7-b2b-order-management-software-trends-to-transform-your-business-in-2026)
- [Dealer Portal Benefits (GenAlpha)](https://www.genalpha.com/post/start-your-digital-commerce-journey-with-a-dealer-portal-5-benefits-for-manufacturers)

---

### 3. Tiered Pricing by Dealer Group (Gold/Silver/Bronze)
**Why Expected:** Explicitly stated in project context. B2B systems must support "customer-specific pricing agreements and complex pricing tiers."

**Complexity:** Medium
- Customer group assignment (Gold/Silver/Bronze)
- Automated price application based on group
- Price display shows dealer's specific price
- No manual price calculation

**Notes:**
- 78% of SaaS companies use tiered pricing models successfully
- Must be transparent: dealers see their tier's prices immediately
- For MVP: Simple 3-tier system (Gold/Silver/Bronze) is sufficient
- Defer: Dynamic pricing, promotional pricing, volume discounts beyond tier

**Sources:**
- [Tiered Pricing for B2B (InfluenceFlow)](https://influenceflow.io/resources/creating-tiered-pricing-structures-a-complete-guide-for-2026/)
- [B2B Customer Groups & Pricing (Shopaccino)](https://www.shopaccino.com/blog/how-manufacturers-can-manage-b2b-customer-groups-and-custom-pricing)

---

### 4. Quick/Bulk Order Entry
**Why Expected:** Dealers reorder frequently with known SKUs. Manual one-by-one addition is friction that drives them back to phone orders.

**Complexity:** Low-Medium
- CSV upload for bulk orders
- Quick order form (SKU + Quantity entry)
- Copy from previous order
- Frequently ordered items shortcut

**Notes:**
- AI-driven bulk order processing shows 50% faster processing, 85% fewer errors
- For MVP: Quick order form (paste SKU list) is sufficient
- CSV upload can be added post-MVP if needed
- Reduces order entry time from minutes to seconds

**Sources:**
- [Future of Order Management (Netguru)](https://www.netguru.com/blog/oms-future-trends)
- [B2B Order Management (BigCommerce)](https://www.bigcommerce.com/articles/b2b-ecommerce/b2b-order-management/)

---

### 5. Order Tracking & Status Updates
**Why Expected:** "73% of customers consider experience a key factor" and "real-time tracking is no longer optional—it's expected."

**Complexity:** Medium
- Order status workflow (Pending → Confirmed → Processing → Shipped → Delivered)
- Status history timeline
- Estimated delivery date
- Order search/filter by status, date, etc.

**Notes:**
- Dealers need to know "where's my order?" without calling
- For MVP: Basic status tracking with manual admin updates is acceptable
- Post-MVP: Automated status updates via warehouse integration

**Sources:**
- [B2B Order Tracking Transparency (IF Global)](https://www.ifglobal.com/resources/blog/how-smart-order-management-accelerates-dtc-b2b-expansion)
- [B2B Buyer Behavior 2026 (Vendict)](https://vendict.com/blog/b2b-buyer-behavior-why-verifiable-trust-digital-transparency-are-the-real-dealbreakers)

---

### 6. Push Notifications for Order Updates
**Why Expected:** Explicitly stated in project context. "Automatic updates on order status are essential" per research.

**Complexity:** Low-Medium
- Order confirmed notification
- Order shipped notification
- Order delivered notification
- Low stock alert for reorder reminders

**Notes:**
- Multi-channel: In-app, email, SMS (prioritize by dealer preference)
- For MVP: Email + in-app notifications sufficient
- Reduces "where's my order?" support calls
- Mobile push requires mobile app (defer to post-MVP unless web push used)

**Sources:**
- [Push Notifications B2B (SuprSend)](https://www.suprsend.com/post/what-is-an-effective-notification-service-in-b2b-context---selecting-implementing-and-optimizing-notification-services-for-saas-business)
- [B2B Commerce Notifications (Salesforce)](https://developer.salesforce.com/docs/commerce/salesforce-commerce/guide/b2b-b2c-comm-notifications-other-custom.html)

---

### 7. Order History & Reordering
**Why Expected:** Dealers place repeat orders. Not having history forces them to recreate orders manually or call.

**Complexity:** Low
- View past orders with details
- Search/filter order history
- "Reorder" button copies items to cart
- Download order as PDF/CSV

**Notes:**
- Simple feature with high dealer value
- For MVP: Basic order history with reorder function
- Post-MVP: Predictive reordering, subscription orders

**Sources:**
- [Dealer Portal Benefits (I95Dev)](https://www.i95dev.com/who-benefits-from-dealer-portals-and-how/)
- [B2B Ordering Trends (DueTrade)](https://www.duetrade.co.uk/blog-posts/our-prediction-6-b2b-ordering-trends-shaping-2026)

---

### 8. Secure Authentication & Role-Based Access
**Why Expected:** "Dealer portals provide heightened security with unique logins for every dealer." B2B systems require multi-user access per dealer.

**Complexity:** Medium
- User authentication (email/password)
- Role-based permissions (Owner, Manager, Staff)
- Password reset
- Session management

**Notes:**
- Each dealer may have multiple users (owner, purchasing manager, sales staff)
- For MVP: Simple roles (Admin, Dealer Admin, Dealer Staff)
- Post-MVP: Fine-grained permissions, SSO, 2FA

**Sources:**
- [Dealer Portal Security (I95Dev)](https://www.i95dev.com/who-benefits-from-dealer-portals-and-how/)
- [Dealer Management 2026 (DealerClick)](https://dealerclick.com/blog/dealer-management-software-buyers-guide-2026)

---

### 9. Admin: Product Management
**Why Expected:** Manufacturer needs to control catalog, pricing, and availability. Core admin function.

**Complexity:** Medium
- Create/edit/delete products
- Product details (name, SKU, description, images)
- Category management
- Set base price + tier prices
- Set stock levels

**Notes:**
- For MVP: Basic CRUD operations sufficient
- Bulk product upload via CSV can be post-MVP
- Product images: Optional for MVP if SKU-based ordering is primary

**Sources:**
- [Dealer Portal Features (Digital Hill)](https://www.digitalhill.com/blog/how-manufacturers-can-benefit-from-a-dealer-portal/)

---

### 10. Admin: Order Management
**Why Expected:** Manufacturer must process, confirm, and update orders. Core operational requirement.

**Complexity:** Medium
- View all orders with filters
- Update order status
- View order details
- Cancel/modify orders
- Export orders for processing

**Notes:**
- For MVP: Manual status updates acceptable
- Integration with warehouse/shipping systems is post-MVP
- Critical: Clear workflow to prevent orders from being forgotten

**Sources:**
- [Order Management Best Practices (Sharp Commerce)](https://sharpcommerce.com/common-order-management-mistakes/)

---

### 11. Admin: Dealer Management
**Why Expected:** ~700 dealers need onboarding, tier assignment, and management.

**Complexity:** Medium
- Create/edit dealer accounts
- Assign dealer tier (Gold/Silver/Bronze)
- Activate/deactivate dealers
- View dealer details
- Search/filter dealers

**Notes:**
- For MVP: Manual dealer creation by admin
- Bulk import via CSV useful given 700 dealers (consider for MVP if onboarding all at once)
- Self-registration can be post-MVP

**Sources:**
- [B2B Customer Groups (Shopaccino)](https://www.shopaccino.com/blog/how-manufacturers-can-manage-b2b-customer-groups-and-custom-pricing)

---

### 12. Basic Reporting
**Why Expected:** "Comprehensive reporting and analytics tools provide insights for data-driven decisions."

**Complexity:** Medium
- Sales by period (daily, weekly, monthly)
- Top products
- Top dealers
- Order status summary
- Export to CSV/Excel

**Notes:**
- For MVP: Basic tabular reports with export
- Post-MVP: Interactive dashboards, charts, advanced analytics
- Critical metrics: Total sales, order count, average order value

**Sources:**
- [Dealer Analytics (Titan DMS)](https://www.titandms.com/solution/dealer-analytics)
- [Dealer Reporting Features (DashThis)](https://dashthis.com/reporting-tools-car-dealership/)

---

## Differentiators

Features that set the product apart. Not expected, but provide competitive advantage if implemented well.

### 1. WhatsApp Integration for Order Notifications
**Value Proposition:** Current workflow uses WhatsApp. Integrating notifications via WhatsApp meets dealers where they already are.

**Complexity:** Low-Medium
- WhatsApp Business API integration
- Send order confirmations via WhatsApp
- Send status updates via WhatsApp
- Allow dealers to choose notification channel

**Notes:**
- Unique differentiator given current WhatsApp-based ordering
- Reduces friction: dealers already check WhatsApp constantly
- Cost: WhatsApp Business API has per-message costs (evaluate ROI)
- For MVP: Consider as "quick win" if API integration is straightforward

**Competitive Edge:** Most B2B systems don't integrate WhatsApp for notifications—email/SMS only.

---

### 2. Smart Reorder Suggestions
**Value Proposition:** AI-driven predictive ordering reduces dealer cognitive load and prevents stockouts.

**Complexity:** High
- Analyze dealer order history
- Predict reorder timing
- Suggest order quantities
- "Smart reorder" button pre-fills cart

**Notes:**
- Research shows AI-driven bulk processing delivers 50% faster processing
- Requires sufficient historical data (defer until post-MVP when order history exists)
- High value for repeat/predictable orders
- Competitive advantage: Moves from passive portal to proactive partner

**Competitive Edge:** Few dealer portals offer predictive reordering in 2026.

---

### 3. Mobile-First Design / Progressive Web App
**Value Proposition:** Dealers order on-the-go from their phones. Mobile-optimized experience provides convenience.

**Complexity:** Low-Medium (if designed mobile-first from start)
- Responsive design
- Touch-friendly UI
- Offline capability (PWA)
- Add to home screen

**Notes:**
- "Mobile-first" is table stakes for consumer apps, differentiator for B2B
- For MVP: Fully responsive web design is sufficient
- PWA features (offline, push) can be added incrementally
- Native app is overkill for MVP

**Competitive Edge:** Many B2B portals still desktop-only or poorly optimized for mobile.

---

### 4. Product Availability Alerts
**Value Proposition:** Dealers subscribe to out-of-stock products, get notified when back in stock.

**Complexity:** Low
- "Notify me" button on out-of-stock products
- Email notification when back in stock
- Dealer can order immediately from email

**Notes:**
- Captures demand that would otherwise go to competitors
- Low complexity, high dealer satisfaction
- Consider for MVP as "quick win"

**Competitive Edge:** Proactive communication builds loyalty.

---

### 5. Dealer Performance Dashboard
**Value Proposition:** Show dealers their own metrics (YTD orders, spending, top products). Gamification + transparency.

**Complexity:** Medium
- Dealer-specific analytics
- Year-to-date spending
- Order frequency
- Comparison to their tier average (optional)
- Downloadable reports

**Notes:**
- Empowers dealers with self-service insights
- Reduces "how much have I ordered?" support calls
- For MVP: Defer to post-MVP (nice-to-have, not must-have)

**Competitive Edge:** Few portals provide dealer-facing analytics—usually admin-only.

---

### 6. Multi-Language Support
**Value Proposition:** If dealers operate in multiple regions/languages, native language support improves adoption.

**Complexity:** Medium-High
- UI translation (Turkish + others)
- Multi-language product data
- Language switcher

**Notes:**
- ONLY a differentiator if dealers need it (check: do all dealers speak Turkish?)
- For MVP: Single language (Turkish) unless multi-language is confirmed requirement
- Complexity increases with content translation and maintenance

**Competitive Edge:** Only relevant if competitor portals are English-only and dealers prefer Turkish.

---

### 7. Credit Limit & Payment Terms Display
**Value Proposition:** Dealers see their credit limit, outstanding balance, and payment terms in real-time.

**Complexity:** High
- Integration with accounting/ERP system
- Real-time credit limit calculation
- Display available credit
- Block orders if credit exceeded
- Payment terms per dealer

**Notes:**
- High value for manufacturers extending credit to dealers
- Requires ERP/accounting integration (complex)
- For MVP: Defer unless credit management is critical pain point
- Alternative for MVP: Manual credit approval by admin

**Competitive Edge:** Transparency in credit/payment builds trust.

---

### 8. Order Approval Workflows
**Value Proposition:** For dealers with internal hierarchy, orders require approval before submission.

**Complexity:** Medium-High
- Multi-step approval chain
- Manager approval notifications
- Approve/reject interface
- Approval history

**Notes:**
- Relevant for large dealers with purchasing managers ≠ order placers
- Research indicates "approval workflows need to follow buyer's actual hierarchy"
- For MVP: Defer (most dealers likely don't need this for ~700 dealer network)
- Post-MVP: Offer as optional feature for enterprise dealers

**Competitive Edge:** Enterprise-grade feature that competitors may lack.

---

## Anti-Features (Avoid for MVP)

Features that seem good but add complexity without value for MVP. Defer or avoid entirely.

### 1. Advanced Promotions Engine
**What:** Coupon codes, flash sales, bundle discounts, BOGO offers, time-limited promotions.

**Why Avoid:**
- Tier-based pricing already provides discount structure
- Complexity: Stacking rules, expiration, conflict resolution
- Maintenance burden: Managing active promotions
- B2B relationships are about negotiated pricing, not consumer-style promotions

**Instead:** Use tiered pricing (Gold/Silver/Bronze). Manually adjust tier if special pricing needed.

**Defer to:** Post-MVP, only if manufacturer runs seasonal promotions for dealers.

**Sources:**
- [B2B Pricing Strategy (DealHub)](https://dealhub.io/glossary/b2b-pricing/)

---

### 2. Complex Product Configurator
**What:** Build custom products with options, variants, add-ons, and dynamic pricing.

**Why Avoid:**
- High complexity: UI for configuration, pricing logic, inventory per variant
- Only needed if manufacturer sells highly customizable products (e.g., made-to-order furniture)
- Project context doesn't mention product customization

**Instead:** Standard catalog with fixed products. If variants exist (e.g., sizes/colors), model as separate SKUs.

**Defer to:** Only if product customization is confirmed requirement (verify with stakeholders).

**Sources:**
- [Engineer-to-Order Complexity (Tacton)](https://www.tacton.com/cpq-blog/engineering-to-order-2/)

---

### 3. Integrated Logistics / Real-Time Shipping Tracking
**What:** Live GPS tracking of shipments, carrier API integration, delivery route optimization.

**Why Avoid:**
- High complexity: Integration with carrier APIs, real-time data sync
- Dependency on logistics partners having compatible systems
- MVP doesn't require this level of transparency
- "Order shipped" status + estimated delivery date is sufficient for MVP

**Instead:** Basic order status ("Shipped" + tracking number if available). Dealers contact carrier for detailed tracking.

**Defer to:** Post-MVP, if dealers demand live tracking.

**Sources:**
- [Order Management Mistakes (Smart Logistics)](https://www.unigis.com/en/order-management-5-mistakes-to-avoid/)

---

### 4. Advanced Warehouse Management
**What:** Multi-warehouse allocation, stock transfers, bin/location tracking, pick/pack/ship workflows.

**Why Avoid:**
- This is warehouse software (WMS), not a dealer portal
- Manufacturer likely has existing warehouse processes
- MVP only needs to display stock availability, not manage warehouse operations

**Instead:** Integrate with existing warehouse/inventory system for stock levels. Warehouse operations remain in existing system.

**Defer to:** Never (out of scope—this is a dealer ordering system, not a WMS).

**Sources:**
- [B2B Order Management Scope (Unleashed Software)](https://www.unleashedsoftware.com/blog/b2b-order-management-system/)

---

### 5. Built-In CRM
**What:** Lead tracking, sales pipeline, contact management, opportunity scoring.

**Why Avoid:**
- This is a dealer ordering system, not a manufacturer sales CRM
- Manufacturer likely has existing CRM for managing dealer relationships
- Scope creep: CRM is a separate product category

**Instead:** If CRM integration is needed (e.g., sync dealer contact info), integrate with existing CRM via API.

**Defer to:** Never (out of scope—buy/integrate CRM if needed).

**Sources:**
- [CRM Integration Best Practices (DealHub)](https://dealhub.io/glossary/b2b-pricing/)

---

### 6. Dealer Self-Registration
**What:** Dealers can sign up for an account themselves without manufacturer approval.

**Why Avoid:**
- Manufacturer needs to vet dealers, assign tiers, negotiate terms
- Open registration invites spam, competitors, or unauthorized resellers
- B2B is relationship-based, not open marketplace

**Instead:** Admin manually creates dealer accounts after offline approval process.

**Defer to:** Post-MVP, if manufacturer wants "apply to become a dealer" workflow with admin approval.

**Sources:**
- [Dealer Portal Security (I95Dev)](https://www.i95dev.com/who-benefits-from-dealer-portals-and-how/)

---

### 7. Multi-Currency / Multi-Region
**What:** Support for multiple currencies, tax jurisdictions, international shipping.

**Why Avoid:**
- Complexity: Currency conversion, exchange rates, international tax rules
- ONLY needed if manufacturer sells internationally
- Project context doesn't mention international dealers

**Instead:** Single currency (Turkish Lira assumed). Single tax jurisdiction.

**Defer to:** Only if international expansion is confirmed roadmap item (verify with stakeholders).

**Notes:** If manufacturer already has international dealers, this becomes table stakes—verify before deferring.

---

### 8. EDI (Electronic Data Interchange) Integration
**What:** Standards-based B2B data exchange (EDI 850 purchase orders, EDI 810 invoices, etc.).

**Why Avoid:**
- High complexity: EDI standards, mapping, translation, partner onboarding
- Primarily used by large enterprises and retailers (e.g., Walmart mandates EDI)
- 700 dealers unlikely to demand EDI (they're calling/WhatsApp now)

**Instead:** Web-based ordering portal. Export orders to CSV for processing.

**Defer to:** Only if large enterprise dealers demand EDI (unlikely for MVP).

**Sources:**
- [B2B Order Management Complexity (Unleashed Software)](https://www.unleashedsoftware.com/blog/b2b-order-management-system/)

---

### 9. Custom Dealer Storefronts
**What:** Each dealer gets a customized branded portal (white-label, custom domain, custom branding).

**Why Avoid:**
- High complexity: Multi-tenancy, theme customization, domain management
- Maintenance burden: Supporting N different storefronts
- Not needed: This is manufacturer → dealer, not dealer → end customer

**Instead:** Single unified dealer portal. All dealers use the same interface.

**Defer to:** Never (out of scope—dealers sell to end customers via their own channels).

---

### 10. Advanced Analytics / BI Dashboards
**What:** Interactive dashboards, drill-down reports, predictive analytics, data visualization.

**Why Avoid:**
- High complexity: Charting libraries, dashboard builders, query performance
- MVP needs basic reports (sales totals, order counts), not BI tool
- Over-engineering: Manufacturers can export to Excel for ad-hoc analysis

**Instead:** Basic tabular reports with CSV export. Stakeholders use Excel/Google Sheets for advanced analysis.

**Defer to:** Post-MVP, if reporting becomes a bottleneck or stakeholders demand interactive dashboards.

**Sources:**
- [Dealer Analytics Features (Titan DMS)](https://www.titandms.com/solution/dealer-analytics)

---

## Feature Dependencies

Understanding which features depend on others to function properly.

### Dependency Graph

```
Authentication & Authorization
├── Dealer Management (admin creates dealer accounts)
│   ├── Tiered Pricing (dealers assigned to tier)
│   │   └── Product Catalog (prices displayed per tier)
│   │       └── Shopping Cart
│   │           └── Order Placement
│   │               ├── Order Management (admin processes orders)
│   │               ├── Order Tracking (dealers view status)
│   │               └── Order History (dealers view past orders)
│   │                   └── Reordering (copy from history)
│   └── Push Notifications (notify dealer users)
│
├── Product Management (admin creates catalog)
│   ├── Real-Time Stock Visibility (products show stock)
│   └── Search & Filter (products searchable)
│
└── Reporting (aggregates order/dealer data)
```

### Critical Path for MVP

**Must be built in this order:**

1. **Authentication** (foundation for everything)
2. **Product Management** (admin creates catalog)
3. **Dealer Management** (admin creates dealers, assigns tiers)
4. **Tiered Pricing** (products show correct prices per dealer)
5. **Product Catalog + Cart** (dealers browse and add to cart)
6. **Order Placement** (dealers submit orders)
7. **Order Management** (admin processes orders)
8. **Order Tracking** (dealers check status)
9. **Notifications** (automated status updates)
10. **Order History** (dealers view past orders)
11. **Reporting** (business insights)

**Can be built in parallel (no dependencies):**
- Real-Time Stock Visibility (integrates with Product Catalog)
- Quick Order Entry (alternate ordering UI)
- Push Notifications (notification delivery channel)

---

## MVP Feature Prioritization

Based on complexity, impact, and project pain points:

### Phase 1: Core Ordering (Must-Have)
**Goal:** Replace phone/WhatsApp orders with digital ordering.

| Feature | Complexity | Impact | Priority |
|---------|-----------|---------|----------|
| Authentication & User Management | Medium | High | P0 |
| Product Management (Admin) | Medium | High | P0 |
| Dealer Management (Admin) | Medium | High | P0 |
| Tiered Pricing (Gold/Silver/Bronze) | Medium | High | P0 |
| Product Catalog (Dealer) | Medium | High | P0 |
| Shopping Cart | Low | High | P0 |
| Order Placement | Medium | High | P0 |
| Order Management (Admin) | Medium | High | P0 |

**Outcome:** Dealers can place orders 24/7 with correct pricing. Admin can process orders.

---

### Phase 2: Visibility & Trust (High Value)
**Goal:** Address "no real-time stock/price visibility" pain point.

| Feature | Complexity | Impact | Priority |
|---------|-----------|---------|----------|
| Real-Time Stock Visibility | Medium-High | High | P1 |
| Order Tracking & Status | Medium | High | P1 |
| Order History | Low | High | P1 |
| Reorder from History | Low | Medium | P1 |
| Email Notifications | Low | High | P1 |

**Outcome:** Dealers trust stock availability and can track their orders without calling.

---

### Phase 3: Efficiency & Retention (Nice-to-Have)
**Goal:** Make ordering faster and more convenient.

| Feature | Complexity | Impact | Priority |
|---------|-----------|---------|----------|
| Quick/Bulk Order Entry | Low-Medium | Medium | P2 |
| Push Notifications (In-App) | Low-Medium | Medium | P2 |
| Basic Reporting | Medium | Medium | P2 |
| Product Search & Filter | Low | Medium | P2 |

**Outcome:** Power users order faster. Manufacturer has business insights.

---

### Phase 4: Differentiators (Post-MVP)
**Goal:** Competitive advantage and dealer delight.

| Feature | Complexity | Impact | Priority |
|---------|-----------|---------|----------|
| WhatsApp Notifications | Low-Medium | Medium | P3 |
| Product Availability Alerts | Low | Low | P3 |
| Dealer Performance Dashboard | Medium | Low | P3 |
| Smart Reorder Suggestions | High | Medium | P3 |

**Outcome:** Features that competitors don't have.

---

## Key Recommendations

### For MVP Success

1. **Start narrow, not wide:** Build Phases 1-2 exceptionally well. Don't build Phase 4 features until Phases 1-2 are proven.

2. **Solve the pain:** Current pains are after-hours ordering, no stock visibility, no price visibility. These are table stakes—nail them first.

3. **Avoid over-engineering:** Resist adding promotions, configurators, or advanced workflows. Manufacturer-dealer relationships are simpler than B2C ecommerce.

4. **Data quality matters:** Research shows "data errors in order size, status, location" make systems obsolete. Ensure accurate stock and pricing from day one.

5. **Mobile-friendly is table stakes:** Even if not "mobile-first," ensure responsive design. Dealers will order from phones.

6. **WhatsApp consideration:** Given current WhatsApp usage, WhatsApp notifications could be a "quick win" differentiator if API integration is straightforward.

### Red Flags to Avoid

Based on research into common mistakes:

- **Lack of centralized system** → Build one unified portal, not fragmented tools
- **Poor inventory visibility** → Real-time stock is non-negotiable (Phase 2 priority)
- **Manual processes** → Automate tier-based pricing (no manual calculations)
- **Inadequate training** → Plan dealer onboarding and documentation
- **Ignoring analytics** → Basic reporting must be in MVP (Phase 3)
- **Poor communication** → Order status updates prevent "where's my order?" calls

---

## Confidence Assessment

| Category | Confidence | Reasoning |
|----------|-----------|-----------|
| Table Stakes | **HIGH** | Multiple 2026 sources confirm these features. Aligned with project pain points. |
| Differentiators | **MEDIUM** | WhatsApp integration is context-specific. AI features are emerging (less proven ROI). |
| Anti-Features | **HIGH** | Clear scope boundaries. These features are out of scope for manufacturer-dealer ordering. |
| Dependencies | **HIGH** | Logical build order based on technical dependencies. |

---

## Sources

### Primary Research Sources

**B2B Order Management Trends & Features:**
- [How B2B Ordering Tools Boost Buyer Experience (BigCommerce)](https://www.bigcommerce.com/articles/b2b-ecommerce/b2b-order-management/)
- [Top 7 B2B Order Management Software Trends (Silicon Slopes)](https://www.siliconslopes.com/c/posts/top-7-b2b-order-management-software-trends-to-transform-your-business-in-2026)
- [B2B Order Management Software: What Works (Netguru)](https://www.netguru.com/blog/b2b-order-management-software)
- [Future of Order Management Systems (Netguru)](https://www.netguru.com/blog/oms-future-trends)
- [What is a B2B Order Management System (Unleashed)](https://www.unleashedsoftware.com/blog/b2b-order-management-system/)

**Dealer Portal Specific:**
- [Who Benefits From Dealer Portals (I95Dev)](https://www.i95dev.com/who-benefits-from-dealer-portals-and-how/)
- [Dealer Portal Benefits for Manufacturers (GenAlpha)](https://www.genalpha.com/post/start-your-digital-commerce-journey-with-a-dealer-portal-5-benefits-for-manufacturers)
- [How Manufacturers Benefit from Dealer Portals (Digital Hill)](https://www.digitalhill.com/blog/how-manufacturers-can-benefit-from-a-dealer-portal/)

**Pricing & Tiering:**
- [Creating Tiered Pricing Structures (InfluenceFlow)](https://influenceflow.io/resources/creating-tiered-pricing-structures-a-complete-guide-for-2026/)
- [B2B Customer Groups & Custom Pricing (Shopaccino)](https://www.shopaccino.com/blog/how-manufacturers-can-manage-b2b-customer-groups-and-custom-pricing)
- [Tiered Pricing for B2B eCommerce (Turis)](https://turis.app/b2b-ecommerce/tiered-pricing-strategies-b2b-wholesale/)

**Order Tracking & Transparency:**
- [Smart Order Management for B2B (IF Global)](https://www.ifglobal.com/resources/blog/how-smart-order-management-accelerates-dtc-b2b-expansion)
- [B2B Buyer Behavior: Trust & Transparency (Vendict)](https://vendict.com/blog/b2b-buyer-behavior-why-verifiable-trust-digital-transparency-are-the-real-dealbreakers)
- [The New B2B Buyer 2026 (Nishtech)](https://www.nishtech.com/Blog/2025/December/The-New-B2B-Buyer-2026-Insights)

**MVP Best Practices:**
- [What Is a Minimum Viable Product 2026 (Presta)](https://wearepresta.com/what-is-a-minimum-viable-product-the-complete-2026-guide-to-strategic-startup-validation/)
- [Why You Need MVP Approach to B2B eCommerce (OroCommerce)](https://oroinc.com/b2b-ecommerce/blog/why-you-need-a-minimum-viable-product-approach-to-b2b-ecommerce/)

**Common Mistakes & Pitfalls:**
- [8 Common Order Management Mistakes (Sharp Commerce)](https://sharpcommerce.com/common-order-management-mistakes/)
- [Order Management: 5 Mistakes to Avoid (Unigis)](https://www.unigis.com/en/order-management-5-mistakes-to-avoid/)
- [10 Common Dealership Mistakes (AutoCorp)](https://autocorp.ai/blog/10-common-dealership-mistakes-and-how-to-fix-them)

**Notifications & Communication:**
- [What is an Effective Notification Service in B2B (SuprSend)](https://www.suprsend.com/post/what-is-an-effective-notification-service-in-b2b-context---selecting-implementing-and-optimizing-notification-services-for-saas-business)
- [B2B Commerce Notifications (Salesforce)](https://developer.salesforce.com/docs/commerce/salesforce-commerce/guide/b2b-b2c-comm-notifications-other-custom.html)

**Analytics & Reporting:**
- [Dealer Analytics (Titan DMS)](https://www.titandms.com/solution/dealer-analytics)
- [Best Reporting Tool for Dealerships (DashThis)](https://dashthis.com/reporting-tools-car-dealership/)

---

## Open Questions for Stakeholders

Research reveals these questions should be validated before finalizing roadmap:

1. **International dealers?** → If yes, multi-currency/multi-language moves from anti-feature to table stakes
2. **Credit/payment terms?** → Do dealers buy on credit, or prepay? Affects if credit limit feature is needed
3. **WhatsApp priority?** → Given current WhatsApp usage, is WhatsApp notification integration worth early investment?
4. **Product catalog size?** → How many SKUs? Affects search/filter complexity
5. **Warehouse integration?** → Does manufacturer have existing inventory system? Integration complexity affects real-time stock timeline
6. **Mobile app need?** → Do dealers demand native mobile app, or is responsive web sufficient?
7. **Approval workflows?** → Do any large dealers need internal approval chains before placing orders?

---

**Research Complete | Ready for Roadmap Creation**
