# Project Research Summary

**Project:** Bayi Yönetimi (B2B Dealer Order Management System)
**Domain:** Manufacturer-to-Dealer Order Management
**Researched:** 2026-01-25
**Confidence:** HIGH

## Executive Summary

This is a B2B dealer order management system replacing phone/WhatsApp ordering for a manufacturer with ~700 dealers and ~500 products. The system addresses critical pain points: no after-hours ordering, no real-time stock/price visibility, and manual order processing inefficiencies. Research shows 83% of B2B buyers prefer digital ordering, and 74% switch to competitors for smoother buying experiences—making this transformation essential for competitive survival.

**Recommended approach:** Build a **modular monolith** (not microservices) using NestJS backend, PostgreSQL for transactional data, Next.js for web admin, and React Native with Expo for mobile dealers. This stack prioritizes type safety throughout (TypeScript everywhere), developer velocity (Prisma ORM, TanStack Query), and proven scalability at the 20-30 orders/day scale. The architecture balances modern best practices with pragmatic MVP speed.

**Key risks:** Multi-tenant data isolation (dealers seeing each other's data), inflexible pricing architecture requiring rewrites, and ERP integration complexity in Phase 2. All three must be architected correctly in Phase 1—retrofitting is extremely difficult. Research shows 42% of organizations that prematurely adopted microservices consolidated back to monoliths due to operational complexity, validating the modular monolith choice for this scale.

---

## Key Findings

### Recommended Stack

The 2025-2026 standard for B2B order management emphasizes **TypeScript throughout the stack** for type safety in complex business logic (dealer groups, tiered pricing, order workflows). NestJS dominates enterprise Node.js development due to built-in dependency injection and modular architecture—critical for maintainability as features grow. PostgreSQL with Prisma provides ACID transactions for order integrity while supporting flexible product catalogs via JSONB.

**Core technologies:**

- **NestJS ^11.1.0** (Backend) — Enterprise-grade architecture with dependency injection, ideal for complex B2B logic like tiered pricing and approval workflows
- **PostgreSQL 16.x + Prisma ^7.3.0** (Database) — ACID compliance for transactional order data, JSONB for flexible product attributes, best-in-class TypeScript ORM
- **Next.js ^16.1.0 + React 19** (Web Admin) — App Router with server components, file-based routing, industry standard for 2025
- **React Native ^0.83 + Expo ^54.0.0** (Mobile) — Cross-platform dealer app with Expo Router for file-based navigation
- **TanStack Query ^5.90.0 + Zustand ^5.0.10** (State) — Replaces Redux; TanStack Query for server state, Zustand for client state (2025 standard)
- **Firebase Cloud Messaging** (Push) — Free, reliable push notifications for order updates
- **Cloudinary** (Images/CDN) — Automatic image optimization, built-in CDN, free tier sufficient for 500 products
- **JWT + bcrypt** (Auth) — Stateless authentication for web + mobile, refresh token rotation for security

**What NOT to use:**
- **Express standalone** — Too minimal for B2B complexity, use NestJS which provides structure
- **MongoDB** — Lacks ACID transactions across collections needed for order management
- **Redux** — TanStack Query + Zustand replace it with less boilerplate
- **GraphQL** — Overkill for straightforward CRUD; REST is faster to implement and debug

---

### Expected Features

Research into B2B dealer portals and order management systems in 2026 reveals clear feature expectations. 83% of B2B buyers prefer digital ordering, and real-time visibility is "non-negotiable" per industry sources.

**Must have (table stakes):**

1. **24/7 Self-Service Ordering** — Core value proposition addressing "no after-hours ordering" pain point
2. **Real-Time Stock Visibility** — Explicitly listed pain point; prevents overselling and builds trust
3. **Tiered Pricing (Gold/Silver/Bronze)** — Automatic price application by dealer group, no manual calculation
4. **Quick/Bulk Order Entry** — CSV upload or SKU paste for dealers who reorder frequently
5. **Order Tracking & Status Updates** — 73% of customers consider experience a key factor; tracking is expected
6. **Push Notifications for Order Updates** — Multi-channel (email + in-app) for order confirmations, shipping, delivery
7. **Order History & Reordering** — One-click reorder from past orders reduces friction
8. **Secure Authentication & RBAC** — Multi-user access per dealer (owner, manager, staff roles)
9. **Admin: Product Management** — CRUD for products, categories, pricing, stock levels
10. **Admin: Order Management** — View, approve, update status, cancel/modify orders
11. **Admin: Dealer Management** — Create dealers, assign tiers, activate/deactivate
12. **Basic Reporting** — Sales by period, top products, top dealers, order status summary with CSV export

**Should have (differentiators):**

- **WhatsApp Integration** — Send notifications via WhatsApp (current workflow uses it; meets dealers where they are)
- **Smart Reorder Suggestions** — AI-driven predictive ordering based on dealer history (defer until post-MVP)
- **Mobile-First Design / PWA** — Responsive web design is table stakes, full PWA features can be incremental
- **Product Availability Alerts** — "Notify me when back in stock" captures lost demand
- **Dealer Performance Dashboard** — Show dealers their YTD metrics, order frequency (empowerment + transparency)

**Defer (v2+):**

- Advanced promotions engine (coupon codes, flash sales) — tier pricing is sufficient for MVP
- Complex product configurator — only if manufacturer sells customizable products (verify)
- Integrated logistics / real-time shipping tracking — basic "shipped" status + tracking number sufficient
- Built-in CRM — manufacturer likely has existing CRM; integrate if needed
- Multi-currency / multi-region — only if international dealers confirmed (verify with stakeholders)

---

### Architecture Approach

For a system at this scale (20-30 orders/day, 700 dealers), a **modular monolith** is strongly recommended over microservices. This provides 2-3x faster time-to-market, lower operational complexity, and easier debugging while maintaining clear module boundaries for future scalability. Industry data shows 42% of organizations that initially adopted microservices consolidated back to larger units due to operational overhead.

**Major components (modules with clear boundaries):**

1. **Auth Module** — JWT token generation/validation, dealer login, session management (no dependencies)
2. **Dealers Module** — Dealer CRUD, profile management, group assignment (depends on Auth)
3. **Products Module** — Product catalog, search, filtering (depends on Files module)
4. **Pricing Module** — Calculate dealer-specific prices based on group discounts (depends on Dealers, Products)
5. **Orders Module** — Order creation, state machine, order history (depends on Dealers, Products, Pricing, Notifications)
6. **Files Module** — Image upload to Cloudinary, storage, retrieval (no dependencies)
7. **Notifications Module** — Push notifications via FCM (depends on Dealers)

**Key architectural decisions:**

- **REST API (not GraphQL)** — 93% adoption, easier caching, 2-3x faster to implement for small teams
- **Event-driven inter-module communication** — Modules communicate via internal event emitter for loose coupling (e.g., order.statusChanged → notification sent)
- **Repository pattern for data access** — Clean separation between business logic and database queries
- **Order state machine** — Explicit states (Pending → Approved → Preparing → Shipped → Delivered) with valid transitions enforced
- **JWT authentication** — Stateless, scalable, works across web and mobile
- **Cloudinary for images** — CDN delivery, automatic optimization, free tier sufficient for MVP
- **Code sharing (40-60%)** — Shared package for API client, types, utilities, state management between React Native and Next.js

---

### Critical Pitfalls

Research into B2B order management failures reveals seven architectural mistakes that must be avoided in Phase 1. Retrofitting these is extremely difficult and often requires rewrites.

1. **Multi-Tenant Data Isolation Failure** — One dealer sees another's orders/pricing. Prevention: Row-level security (PostgreSQL RLS), ORM default scopes auto-inject tenant_id, automated isolation tests. **Must architect in Phase 1.**

2. **Pricing Hardcoded in Application Logic** — Business users can't change pricing without developers. Prevention: Design pricing as data (PricingRule tables), pricing engine evaluates rules, admin UI for rule management. **Database schema must be flexible from day one.**

3. **No Order State Machine** — Invalid transitions occur (shipped → pending), edge cases unhandled, race conditions. Prevention: Explicit state machine with valid transitions, saga pattern for distributed transactions, audit trail of state changes. **Phase 1 requirement.**

4. **Pricing Visibility Leakage** — Dealers infer competitor pricing. Prevention: Filter all pricing queries by authenticated dealer, use UUIDs not sequential IDs, return 404 (not 403) for unauthorized requests, audit log pricing queries. **Security-by-design in Phase 1.**

5. **Inventory Sync Strategy Mismatch** — Batch sync causes "in stock" items to be unavailable; real-time overloads system. Prevention: MVP uses real-time (demo data). Phase 2 ERP uses hybrid: real-time availability checks at checkout, batch reconciliation overnight, inventory reservation during checkout. **Design before Phase 2 integration.**

6. **Mobile API Versioning Not Planned** — Breaking API changes break old mobile clients. Prevention: URI path versioning (/v1/, /v2/) from day one, support 2+ versions simultaneously, 6-month deprecation policy, version detection in API. **Must implement before first mobile release.**

7. **Demo Data Leaks into Production** — Real dealer data in demo environment (privacy violation) or demo orders corrupt production metrics. Prevention: Completely separate databases, environment-specific credentials, synthetic data generation (never copy production), visual indicators in demo UI. **Environment separation from Phase 1.**

---

## Implications for Roadmap

Based on combined research findings, dependencies, and pitfall analysis, suggested phase structure:

### Phase 1: Core Ordering (Foundation)

**Rationale:** Establishes the architectural foundation that everything else depends on. Authentication, dealer management, and product catalog are prerequisites for ordering. This phase directly addresses the primary pain point: replacing phone/WhatsApp orders with digital self-service.

**Delivers:**
- Dealers can place orders 24/7 with correct tier-based pricing
- Admin can manage products, dealers, and process orders
- Real-time stock visibility prevents overselling
- JWT authentication secures multi-tenant access

**Addresses (from FEATURES.md):**
- 24/7 self-service ordering (table stakes #1)
- Tiered pricing by dealer group (#3)
- Secure authentication & RBAC (#8)
- Admin: Product management (#9)
- Admin: Order management (#10)
- Admin: Dealer management (#11)
- Real-time stock visibility (#2)

**Avoids (from PITFALLS.md):**
- Multi-tenant data isolation (#1) — PostgreSQL RLS + ORM scoping from day one
- Pricing hardcoded in logic (#2) — Flexible pricing schema with dealer_groups table
- No order state machine (#3) — Explicit state machine with valid transitions
- API versioning not planned (#6) — /api/v1/ versioning from start
- Demo data leaks (#7) — Separate environments, synthetic data

**Key architectural decisions required:**
- Database schema with multi-tenant isolation
- Pricing data model supporting future extensions
- Order state machine implementation
- API structure with versioning

**Research needed:** NONE — Well-documented patterns, current research sufficient.

---

### Phase 2: Trust & Transparency

**Rationale:** With basic ordering functional, dealers need visibility and communication to trust the system. Order tracking prevents "where's my order?" support calls. Order history enables quick reordering. Notifications keep dealers informed without them checking constantly.

**Delivers:**
- Order tracking with status timeline
- Push notifications for order updates (confirmed, shipped, delivered)
- Order history with one-click reorder
- Email notifications for order events

**Uses (from STACK.md):**
- Firebase Cloud Messaging for push notifications
- Event-driven architecture (order.statusChanged events trigger notifications)

**Addresses (from FEATURES.md):**
- Order tracking & status updates (#5)
- Push notifications (#6)
- Order history & reordering (#7)

**Implements (from ARCHITECTURE.md):**
- Notifications Module listening to order state change events
- FCM integration for mobile push
- Event emitter pattern for decoupled modules

**Research needed:** NONE — Standard notification patterns, FCM documentation sufficient.

---

### Phase 3: Efficiency & Insights

**Rationale:** Power users need faster ordering workflows and admins need business insights. Quick order entry reduces friction for repeat orders. Basic reporting provides visibility into sales trends and dealer performance.

**Delivers:**
- Quick/bulk order entry (CSV upload or SKU paste)
- Product search and filtering
- Admin reporting dashboard (sales, top products, top dealers)
- Export capabilities for further analysis

**Addresses (from FEATURES.md):**
- Quick/bulk order entry (#4)
- Basic reporting (#12)
- Product search optimization (from PITFALLS.md #15)

**Avoids (from PITFALLS.md):**
- Search performance not optimized (#15) — Database indexing, debounced typeahead
- Manual approval bottlenecks (#8) — Implement auto-approval rules for trusted dealers

**Research needed:** NONE — Standard search optimization and reporting patterns.

---

### Phase 4: Differentiators (Post-MVP)

**Rationale:** Competitive advantages that set this system apart from competitors. WhatsApp integration leverages existing dealer behavior. Smart reorder suggestions provide proactive value. Dealer dashboard empowers self-service analytics.

**Delivers:**
- WhatsApp integration for notifications
- Product availability alerts (back-in-stock notifications)
- Dealer performance dashboard (YTD metrics)
- Smart reorder suggestions (AI-driven, requires order history)

**Addresses (from FEATURES.md):**
- WhatsApp integration (differentiator #1)
- Product availability alerts (#4)
- Dealer performance dashboard (#5)
- Smart reorder suggestions (#2, requires ML)

**Research needed:** MEDIUM
- WhatsApp Business API integration specifics
- ML models for reorder prediction (if pursuing smart suggestions)

---

### Phase 5: ERP Integration (Major Extension)

**Rationale:** Connects to manufacturer's existing systems for real-time inventory, product data, and order fulfillment. This is explicitly mentioned as Phase 2 in project context but should come after core system is validated with dealers.

**Delivers:**
- Bidirectional sync with ERP for inventory, products, orders
- Hybrid sync strategy (real-time checkout, batch reconciliation)
- Automated order fulfillment workflow
- Production-ready inventory management

**Uses (from STACK.md):**
- Queue-based architecture for sync resilience
- External system ID fields in database (designed in Phase 1)

**Avoids (from PITFALLS.md):**
- Inventory sync strategy mismatch (#5) — Hybrid approach designed upfront
- ERP integration treated as "just an API call" (#9) — Proper planning, 3-6 month budget
- No plan for ERP downtime (#9) — Queue-based eventual consistency

**Research needed:** HIGH
- Target ERP's specific API documentation and data model
- ERP authentication and security requirements
- Real-time vs batch capabilities and limitations
- ERP-specific edge cases and vendor best practices

**Critical:** This phase has highest risk. Budget 3-6 months, expect 50% of effort in edge cases and error handling.

---

### Phase Ordering Rationale

**Dependency-driven:**
- Phase 1 must come first: Auth, Dealers, Products, and Orders are the foundation everything else builds on
- Phase 2 depends on Phase 1: Cannot track orders or send notifications without order creation
- Phase 3 enhances Phase 1: Bulk ordering and reporting add efficiency but aren't blockers
- Phase 4 can run parallel to Phase 3: Differentiators are independent features
- Phase 5 should come last: ERP integration requires validated system and dealer feedback

**Architecture-driven:**
- Modular monolith allows phases to add modules incrementally without rewrites
- Event-driven communication means Phase 2 (notifications) integrates cleanly without changing Phase 1 code
- REST API versioning allows mobile updates to roll out gradually

**Pitfall-driven:**
- Phase 1 must architect multi-tenant isolation, flexible pricing, state machine, and API versioning correctly
- Phase 5 (ERP) benefits from database schema designed in Phase 1 with external system IDs
- Delaying differentiators (Phase 4) until after core system (Phases 1-3) avoids over-engineering

**Risk mitigation:**
- Phases 1-3 use well-documented patterns (low research risk)
- Phase 4 has moderate novelty (WhatsApp integration needs research)
- Phase 5 has highest risk (ERP integration requires deep, vendor-specific research)

---

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 5 (ERP Integration):** HIGH PRIORITY — Vendor-specific API documentation, data model mapping, sync strategy design, edge case handling. Current generic research insufficient for implementation.
- **Phase 4 (WhatsApp Integration):** MEDIUM PRIORITY — WhatsApp Business API specifics, cost analysis, message template requirements.

**Phases with standard patterns (skip research-phase):**

- **Phase 1 (Core Ordering):** Well-documented patterns for auth, CRUD, state machines. Current research sufficient.
- **Phase 2 (Notifications):** FCM integration is standard, existing documentation adequate.
- **Phase 3 (Efficiency):** Search optimization and reporting use established patterns.

**Validation recommended:**

- **Dealer-specific approval workflows:** Research covers general B2B, but manufacturer-dealer relationships may have unique requirements (validate with stakeholders)
- **Mobile device landscape:** Confirm dealers' actual devices (iOS vs Android mix, connectivity quality, device age)
- **Pricing complexity depth:** Verify whether simple 3-tier pricing is sufficient or if promotional/seasonal/contract pricing needed
- **International dealers:** Confirm single-currency assumption; multi-currency moves from anti-feature to table stakes if international dealers exist

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | **HIGH** | NestJS, PostgreSQL, React Native, Next.js are industry standards for B2B systems in 2025-2026. Multiple authoritative sources confirm. Prisma + TanStack Query + Zustand represent current best practices. |
| **Features** | **HIGH** | Table stakes features (24/7 ordering, stock visibility, tiered pricing, tracking) consistently cited across B2B research. 83% digital ordering preference statistic validates priorities. Feature dependencies are logical. |
| **Architecture** | **HIGH** | Modular monolith recommended by 2026 consensus (42% microservices consolidation validates this). REST over GraphQL for simplicity is well-supported. State machine pattern for orders is established best practice. |
| **Pitfalls** | **HIGH** | Multi-tenant security, pricing flexibility, state machines, and ERP complexity are extensively documented in B2B literature. 50% ERP integration failure rate is well-cited. Mobile API versioning is critical and proven. |

**Overall confidence: HIGH**

Research quality is strong due to:
- Multiple authoritative sources per finding (not single-source)
- 2025-2026 recency ensures modern best practices
- B2B-specific sources (not generic e-commerce)
- Consistent patterns across stack, features, architecture, and pitfalls
- Statistical validation (83% digital ordering preference, 42% microservices consolidation, 50% ERP integration failure)

---

### Gaps to Address

While research confidence is high overall, the following areas need validation or additional research during execution:

**Validation needed (stakeholder confirmation):**

1. **International dealer presence** — If yes, multi-currency and multi-language move from anti-features to table stakes. Verify before finalizing Phase 1 schema.

2. **Pricing complexity beyond 3-tier** — Research assumes Gold/Silver/Bronze is sufficient. Validate whether promotional pricing, seasonal pricing, volume discounts, or contract-specific pricing are needed. Impacts Phase 1 pricing schema design.

3. **Credit/payment terms management** — Research unclear if dealers buy on credit or prepay. If credit limits and payment terms are critical, add to Phase 1 (from differentiators). Verify with stakeholders.

4. **Target ERP system** — Phase 5 planning cannot proceed without identifying the specific ERP. Different systems (SAP, Oracle, Microsoft Dynamics, NetSuite, Odoo) have vastly different integration patterns.

5. **Dealer device landscape** — Confirm iOS vs Android mix, device age, and connectivity quality (WiFi vs 3G/4G). Impacts offline-first design priority and minimum supported OS versions.

6. **WhatsApp priority** — Current workflow uses WhatsApp. Validate whether WhatsApp notification integration is high-value quick win or nice-to-have for Phase 4.

**Research to conduct later:**

- **Phase 5: ERP integration** — Once ERP selected, conduct deep research into vendor-specific API, data model, authentication, sync capabilities, and known pitfalls. Budget 1-2 weeks research before Phase 5 planning.

- **Phase 4: WhatsApp Business API** — If prioritized, research message template requirements, pricing structure, conversation-based billing, and approved use cases.

**Technical unknowns (resolve during Phase 1):**

- **Inventory reservation timeout** — How long to hold stock during checkout? (Recommend 15 minutes based on e-commerce norms, adjust based on dealer feedback)

- **Auto-approval thresholds** — What order value triggers manual approval? (Start conservative in MVP, tune based on Phase 1 learnings)

- **Notification frequency limits** — Max notifications per dealer per day to avoid fatigue? (Recommend starting with critical-only in MVP, expand based on opt-out rates)

---

## Sources

### Primary (HIGH confidence)

**Stack Research:**
- [Express.js vs Fastify vs NestJS Comparison 2026](https://www.index.dev/skill-vs-skill/backend-nestjs-vs-expressjs-vs-fastify)
- [PostgreSQL vs MongoDB 2025 Decision Guide](https://dev.to/hamzakhan/postgresql-vs-mongodb-in-2025-which-database-should-power-your-next-project-2h97)
- [Node.js ORMs 2025: Prisma vs Drizzle vs TypeORM](https://thedataguy.pro/blog/2025/12/nodejs-orm-comparison-2025/)
- [Redux Toolkit vs React Query vs Zustand 2025](https://medium.com/@vishalthakur2463/redux-toolkit-vs-react-query-vs-zustand-which-one-should-you-use-in-2025-048c1d3915f4)
- [Next.js Routing: App Router vs Pages Router 2025](https://kitemetric.com/blogs/next-js-routing-in-2025-app-router-vs-pages-router)

**Features Research:**
- [B2B Order Management Buyer Experience (BigCommerce)](https://www.bigcommerce.com/articles/b2b-ecommerce/b2b-order-management/)
- [The New B2B Buyer 2026 Insights (Nishtech)](https://www.nishtech.com/Blog/2025/December/The-New-B2B-Buyer-2026-Insights) — 83% digital ordering preference
- [Top 7 B2B Order Management Trends 2026 (Silicon Slopes)](https://www.siliconslopes.com/c/posts/top-7-b2b-order-management-software-trends-to-transform-your-business-in-2026)
- [Dealer Portal Benefits for Manufacturers (GenAlpha)](https://www.genalpha.com/post/start-your-digital-commerce-journey-with-a-dealer-portal-5-benefits-for-manufacturers)
- [Creating Tiered Pricing Structures 2026 (InfluenceFlow)](https://influenceflow.io/resources/creating-tiered-pricing-structures-a-complete-guide-for-2026/)

**Architecture Research:**
- [B2B Ecommerce Software Architecture (Shopify)](https://www.shopify.com/enterprise/blog/b2b-ecommerce-software-architecture)
- [Microservices vs Monoliths 2026 (Java Code Geeks)](https://www.javacodegeeks.com/2025/12/microservices-vs-monoliths-in-2026-when-each-architecture-wins.html) — 42% consolidation statistic
- [Monolithic vs Microservices 2026 (AWS)](https://aws.amazon.com/compare/the-difference-between-monolithic-and-microservices-architecture/)
- [State Machines Best Practices (commercetools)](https://docs.commercetools.com/learning-model-your-business-structure/state-machines/state-machines-page)
- [REST vs GraphQL vs tRPC 2026 (DEV)](https://dev.to/dataformathub/rest-vs-graphql-vs-trpc-the-ultimate-api-design-guide-for-2026-8n3) — 93% REST adoption

**Pitfalls Research:**
- [Multi-Tenant Security Risks and Best Practices (Qrvey)](https://qrvey.com/blog/multi-tenant-security/)
- [B2B Pricing Mistakes Survey of 1,700 Companies (HBR)](https://hbr.org/2018/06/a-survey-of-1700-companies-reveals-common-b2b-pricing-mistakes)
- [B2B ERP Integration Pitfalls (Ignitiv)](https://www.ignitiv.com/b2b-ecommerce-erp-integration/) — 50% failure rate
- [API Versioning Best Practices 2026 (GetLate)](https://getlate.dev/blog/api-versioning-best-practices)
- [Common Order Management Mistakes (Sharp Commerce)](https://sharpcommerce.com/common-order-management-mistakes/)

### Secondary (MEDIUM confidence)

- Various dealer portal case studies from I95Dev, Digital Hill
- Mobile UX best practices from WebProNews, Usability studies
- Push notification optimization guides from Reteno, Appbot
- Offline-first architecture patterns from Quokka Labs, OctalSoft

### Research Methodology

Research was conducted across four parallel workstreams (STACK, FEATURES, ARCHITECTURE, PITFALLS) focusing on 2025-2026 sources to ensure current best practices. Sources were prioritized by:
1. Authoritative industry publications (HBR, AWS, official framework docs)
2. B2B-specific content (not generic e-commerce)
3. Statistical validation (surveys, adoption rates, failure rates)
4. Recency (2025-2026 publications)

Cross-validation was performed by checking multiple sources for each major finding. Where sources conflicted, preference given to official documentation and recent authoritative sources over older blog posts.

---

**Research completed:** 2026-01-25
**Ready for roadmap:** Yes
**Synthesized by:** GSD Research Synthesizer
**Next step:** Roadmap creation with phase structure, features, and dependencies
