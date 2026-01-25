# Domain Pitfalls: B2B Dealer Order Management Systems

**Domain:** B2B Dealer Order Management
**Researched:** 2026-01-25
**Project Context:** First B2B system replacing phone/WhatsApp ordering with dealer group pricing, MVP with demo data, ERP integration in Phase 2

## Critical Pitfalls

These mistakes cause rewrites, security breaches, or fundamental system failures.

### Pitfall 1: Multi-Tenant Data Isolation Failure

**Risk:** One dealer sees or modifies another dealer's orders, pricing, or customer data. This is catastrophic for B2B trust and potentially illegal under data protection laws. Even a single WHERE clause mistake can expose all dealer data.

**Warning Signs:**
- Database queries lack consistent tenant_id filtering
- No automated tests verify data isolation between dealers
- Developers manually write tenant filtering logic (not enforced at ORM/database level)
- Raw SQL queries bypass ORM tenant scoping
- Missing database-level row security policies

**Prevention:**
- Implement row-level security at database level (PostgreSQL RLS, MySQL tenant views)
- Use ORM default scopes that automatically inject tenant_id filters
- Write automated integration tests that verify dealers cannot access each other's data
- Implement database-level foreign key constraints including tenant_id in composite keys
- Use a "tenant context" pattern that's set once per request and enforced everywhere
- Never rely on application logic alone - enforce at multiple layers

**Phase to Address:** Phase 1 (MVP Foundation) - This must be architected correctly from day one. Retrofitting multi-tenant isolation is extremely difficult and risky.

**Confidence:** HIGH - Multiple authoritative sources confirm this is the #1 security failure in multi-tenant B2B systems.

**Sources:**
- [Multi-Tenant Security: Definition, Risks and Best Practices](https://qrvey.com/blog/multi-tenant-security/)
- [Tenant Data Isolation: Patterns and Anti-Patterns](https://propelius.ai/blogs/tenant-data-isolation-patterns-and-anti-patterns)
- [Why Your Multi-Tenant Database Design is Probably Wrong](https://medium.com/@harishsingh8529/why-your-multi-tenant-database-design-is-probably-wrong-and-how-to-fix-it-before-its-too-late-c543b777106a)

---

### Pitfall 2: Complex Pricing Structure Hardcoded in Application Logic

**Risk:** Dealer group pricing, volume discounts, and promotional pricing become unmaintainable when hardcoded. Business users cannot change pricing rules without developer intervention. Adding new discount types requires code changes and deployment. This creates bottlenecks and inflexibility.

**Warning Signs:**
- Pricing calculations scattered across multiple controllers/services
- If-else chains or switch statements for different dealer tiers
- Pricing logic duplicated between quote generation and order processing
- No pricing audit trail (who changed what price when)
- Business users request developer help for routine pricing changes

**Prevention:**
- Design pricing as data, not code: create PricingRule and DiscountRule tables
- Implement a pricing engine that evaluates rules in priority order
- Store pricing formulas as expressions (not hardcoded logic)
- Create admin UI for business users to manage pricing rules
- Log all pricing calculations with inputs and results for audit
- Design schema to support: base price, dealer tier multipliers, volume thresholds, promotional overlays, customer-specific pricing
- Consider using a rules engine for complex pricing scenarios

**Phase to Address:** Phase 1 (MVP Foundation) - Database schema must support flexible pricing. You don't need the full admin UI in MVP, but the data model must be extensible. Hardcoded pricing in Phase 1 will force a rewrite in Phase 2.

**Confidence:** HIGH - B2B pricing complexity is well-documented, and inflexible pricing models are cited as a top mistake.

**Sources:**
- [A Survey of 1,700 Companies Reveals Common B2B Pricing Mistakes](https://hbr.org/2018/06/a-survey-of-1700-companies-reveals-common-b2b-pricing-mistakes)
- [Common B2B Pricing Challenges and How to Solve Them](https://blog.blackcurve.com/common-b2b-pricing-challenges-and-how-to-solve-them)
- [6 Common B2B Pricing Strategy Mistakes](https://sbigrowth.com/insights/b2b-pricing-mistakes)

---

### Pitfall 3: No Order State Machine for Workflow Management

**Risk:** Order status becomes inconsistent. Invalid state transitions occur (e.g., "shipped" order moves back to "pending"). Edge cases aren't handled (what happens when payment fails after inventory is reserved?). Concurrent updates cause race conditions. System behavior becomes unpredictable.

**Warning Signs:**
- Order status is just a string field with no validation
- Status can be changed to any value at any time
- No business rules govern valid state transitions
- Rollback/compensation logic doesn't exist for partial failures
- Race conditions when multiple systems update order status
- No audit trail of state transitions and reasons

**Prevention:**
- Implement explicit state machine for order lifecycle
- Define valid states: Draft → Pending → Approved → Processing → Shipped → Delivered (+ Cancelled, Returned)
- Define valid transitions and trigger events
- Implement saga pattern for distributed transactions (order creation, inventory reservation, payment processing)
- Make state transitions atomic with database transactions
- Log every state change with timestamp, user, and reason
- Implement idempotency for state transition events (duplicate events don't cause duplicate transitions)
- Handle compensation: if payment fails, release inventory reservation

**Phase to Address:** Phase 1 (MVP Foundation) - State machine must be designed upfront. Adding it later means migrating orders with inconsistent states and retrofitting validation.

**Confidence:** HIGH - State machine pattern for order management is well-established best practice.

**Sources:**
- [State machines | Model your business structure | commercetools](https://docs.commercetools.com/learning-model-your-business-structure/state-machines/state-machines-page)
- [Use State Machines!](https://rclayton.silvrback.com/use-state-machines)
- [Temporal: Beyond State Machines for Reliable Distributed Applications](https://temporal.io/blog/temporal-replaces-state-machines-for-distributed-applications)

---

### Pitfall 4: Pricing Visibility Leakage Between Dealers

**Risk:** Dealers can infer competitor pricing through system behavior or discover pricing inconsistencies that damage trust. This is especially critical when different dealers have different pricing tiers. Price leakage erodes competitive advantage and causes channel conflict.

**Warning Signs:**
- API responses include pricing for multiple dealers
- Error messages reveal pricing information
- Dealers can enumerate product catalog with pricing via brute force
- No audit logging for pricing access
- Public product IDs make price discovery easy
- Mobile app caches other dealers' pricing data

**Prevention:**
- Always filter pricing queries by authenticated dealer's tenant_id
- Use opaque UUIDs instead of sequential IDs for products/dealers
- Return 404 (not 403) for unauthorized pricing requests to avoid confirming existence
- Implement rate limiting on pricing API endpoints
- Audit log all pricing queries with dealer_id, timestamp, products requested
- In mobile app, only cache current dealer's pricing
- Never send pricing for multiple dealers in a single response
- Consider encrypting pricing data in transit and at rest
- Monitor for unusual pricing query patterns

**Phase to Address:** Phase 1 (MVP Foundation) - Security-by-design. Retrofitting authorization is extremely difficult.

**Confidence:** MEDIUM - Pricing leakage is a known B2B concern, though specific dealer context is extrapolated from general B2B pricing security principles.

**Sources:**
- [2026 Pricing Trends: What Retail and Automotive Leaders Must Prepare for Now](https://www.openpr.com/news/4337639/2026-pricing-trends-what-retail-and-automotive-leaders-must)
- [Stop Leaking Revenue: Uncovering The Internal Friction That Kills B2B Deals](https://www.globaltrademag.com/stop-leaking-revenue-uncovering-the-internal-friction-that-kills-b2b-deals/)

---

### Pitfall 5: Inventory Synchronization Strategy Mismatch

**Risk:** Choosing batch synchronization causes dealers to order out-of-stock items (angry customers, cancelled orders). Choosing real-time synchronization without proper architecture causes system overload during peak hours. Hybrid approach without clear rules causes inconsistencies.

**Warning Signs:**
- Dealers report ordering products that show "in stock" but are actually unavailable
- System slows down significantly during order submission peaks
- Inventory counts drift between systems and require manual reconciliation
- No defined strategy for handling inventory conflicts
- Race conditions when multiple dealers order last remaining units

**Prevention:**
- For MVP with demo data: Use real-time inventory checks (no sync needed)
- For Phase 2 ERP integration: Design hybrid approach:
  - Real-time availability checks on critical operations (order submission, cart validation)
  - Batch sync for non-critical inventory updates (overnight reconciliation)
  - Implement inventory reservation system: hold stock during checkout for X minutes
- Define conflict resolution strategy: "last write wins" vs "first reserve wins"
- Implement queue-based architecture for high-concurrency inventory updates
- Monitor sync lag and alert when exceeds threshold
- Consider eventual consistency model with clear user communication ("availability confirmed after order review")

**Phase to Address:** Phase 1 (MVP) - Use simple real-time approach. Phase 2 (ERP Integration) - Must design hybrid strategy before integration.

**Confidence:** HIGH - Inventory synchronization is consistently cited as a major B2B challenge.

**Sources:**
- [How to Solve Common Order Management Issues in B2B](https://www.dckap.com/commerce/blog/how-to-solve-common-order-management-issues-in-b2b-distribution/)
- [Real-Time vs Batch Integration: The NetSuite Decision Matrix](https://www.stockton10.com/blog/real-time-vs-batch-integration-the-netsuite-decision-matrix)
- [Batch vs Real-Time Integrations for B2B Data](https://boomi.com/blog/batch-vs-real-time-integrations-whats-the-difference-what-are-the-trade-offs/)

---

### Pitfall 6: Mobile API Versioning Not Planned for Breaking Changes

**Risk:** Mobile apps update on their own schedule (or never). When you deploy breaking API changes, old mobile clients stop working. Dealers in the field lose access to ordering system. You cannot force app updates, especially on iOS with staged rollout.

**Warning Signs:**
- API endpoints have no version identifiers
- Backend changes require simultaneous mobile app updates
- No deprecation policy for old API versions
- Mobile team discovers backend changes from production errors
- No way to communicate with users on old app versions

**Prevention:**
- Implement API versioning from day one: use URI path versioning (e.g., /v1/, /v2/)
- Support at least 2 active API versions simultaneously
- Establish deprecation policy: minimum 6 months notice, in-app warnings for old versions
- Use semantic versioning (SemVer) to communicate change impact
- Breaking changes require new major version
- Non-breaking changes (new optional fields) can be added to existing version
- Implement feature flags to enable gradual rollout
- Build version detection into API (reject clients below minimum version)
- Include API version in error logs for debugging
- Document migration guides for each version transition

**Phase to Address:** Phase 1 (MVP Foundation) - Must implement before first mobile app release. Adding versioning after launch is extremely difficult.

**Confidence:** HIGH - Mobile API versioning is critical and well-documented.

**Sources:**
- [API Versioning Strategies for B2B SaaS](https://www.wudpecker.io/blog/api-versioning-strategies-for-b2b-saas)
- [8 API Versioning Best Practices for Developers in 2026](https://getlate.dev/blog/api-versioning-best-practices)
- [Backend REST API Versioning: A Deep Dive Into Strategies, Nightmares, and Best Practices](https://dev.to/mrgio7/backend-rest-api-versioning-a-deep-dive-into-strategies-nightmares-and-best-practices-22f0)

---

### Pitfall 7: Demo Data Leaks into Production or Vice Versa

**Risk:** Real dealer data accidentally appears in demo environment (privacy violation, potential legal liability). Demo orders appear in production reporting (corrupted metrics). Dealers see test/demo dealers in their system (confusion, lack of trust).

**Warning Signs:**
- Same database used for demo and production data with flag column
- No clear separation between environments
- Developer accidentally uses production credentials in testing
- Demo data generation scripts can access production
- Screenshots or demos accidentally show real dealer information

**Prevention:**
- Use completely separate databases for demo and production (different servers, different credentials)
- Use environment-specific configuration (never share credentials across environments)
- Implement database-level namespacing or schemas if shared database required
- Use synthetic data generation for demos (Faker.js, etc.) - never copy production data
- Implement data masking if production data must be copied to staging
- Add visual indicators in demo environment (banner, different color scheme)
- Use different domain names (demo.example.com vs app.example.com)
- Restrict production data access with RBAC
- Audit log all cross-environment data access
- Never show real dealer names in screenshots or marketing materials without permission

**Phase to Address:** Phase 1 (MVP Foundation) - Environment separation must be architected from the start.

**Confidence:** MEDIUM - Data leakage between environments is a general security concern, specific to B2B context based on privacy requirements.

**Sources:**
- [B2B Data Sharing Security: 40 Critical Statistics for 2026-2026](https://www.integrate.io/blog/b2b-data-sharing-security-statistics/)
- [Data Security in 2026: The Figures Leaders Can't Ignore](https://datapatrol.com/data-security-in-2026-the-figures-leaders-cant-ignore/)

---

## Medium Priority Pitfalls

These mistakes cause delays, technical debt, or moderate user friction.

### Pitfall 8: Manual Order Approval Workflow Creates Bottlenecks

**Risk:** Every order requires manual approval, creating delays and reducing system value. Approval bottlenecks frustrate dealers. Staff overhead increases linearly with order volume. System doesn't scale.

**Warning Signs:**
- All orders marked "pending approval" regardless of value or dealer history
- Orders sit in approval queue for hours/days
- Dealers call to ask why order isn't approved yet
- Staff complaints about approval workload
- No automation or rules-based approval
- Email-based approval process (requests get buried)

**Prevention:**
- Implement tiered approval rules:
  - Auto-approve: Trusted dealers, orders under threshold, products in stock
  - Manager approval: High-value orders, new dealers, custom pricing
  - Finance approval: Orders exceeding credit limit
- Configure approval thresholds by dealer tier (platinum dealers get higher auto-approve limits)
- Implement in-app approval workflow (not email-based)
- Mobile approval capability for managers
- Automated reminders for pending approvals
- Escalation rules: if no response in 24 hours, escalate to senior manager
- Audit trail: who approved, when, why

**Phase to Address:** Phase 1 (MVP) - Start with manual approval to understand patterns. Phase 2 (Optimization) - Implement auto-approval rules based on Phase 1 learnings.

**Confidence:** HIGH - Manual approval bottlenecks are consistently cited as B2B order management problems.

**Sources:**
- [Common Approval Workflow Mistakes Enterprises Make](https://snohai.com/common-approval-workflow-mistakes-enterprises-make/)
- [Ultimate Guide to Purchase Order Approval Process for 2026](https://www.gep.com/blog/strategy/purchase-order-approval-process-guide)
- [How to Solve Common Order Management Issues in B2B](https://www.dckap.com/commerce/blog/how-to-solve-common-order-management-issues-in-b2b-distribution/)

---

### Pitfall 9: ERP Integration Treated as "Just an API Call"

**Risk:** Phase 2 ERP integration becomes a rewrite instead of an enhancement. Your MVP data model doesn't map cleanly to ERP entities. Synchronization complexity explodes. Data inconsistencies proliferate.

**Warning Signs:**
- MVP schema designed without considering ERP mapping
- No research into target ERP's data model
- Assumption that ERP integration is straightforward
- No plan for handling ERP downtime
- No conflict resolution strategy for bidirectional sync
- Data types incompatible with ERP (string IDs vs numeric IDs)

**Prevention:**
- Research target ERP's data model during Phase 1 (even if integration is Phase 2)
- Design MVP schema with ERP in mind:
  - Use compatible data types
  - Include fields for external system IDs (erp_customer_id, erp_order_id)
  - Design for eventual bidirectional sync
- Plan integration architecture early:
  - Real-time vs batch for different entities
  - Source of truth for each data type (ERP owns products, OMS owns orders-in-progress)
  - Conflict resolution strategy
- Implement idempotency from day one (ERP sync will retry failed operations)
- Design for ERP downtime: queue-based architecture, eventual consistency
- Budget 3-6 months for ERP integration (not 3-6 weeks)
- Expect 50% of integration effort in edge cases and error handling

**Phase to Address:** Phase 1 (MVP) - Design database schema with ERP in mind. Phase 2 (ERP Integration) - Implement actual integration.

**Confidence:** HIGH - ERP integration complexity is extremely well-documented, with 50% failure rate for improper planning.

**Sources:**
- [5 Common B2B ecommerce ERP integration pitfalls to Avoid](https://www.ignitiv.com/b2b-ecommerce-erp-integration/)
- [A Guide to B2B ERP Integration That Delivers ROI (2025)](https://www.shopify.com/enterprise/blog/b2b-ecommerce-erp-integration)
- [B2B Order Management ERP Integration Challenges 2026](https://www.manh.com/our-insights/resources/blog/finding-the-right-technical-architecture-to-augment-erp-with-advanced-b2b-order-management)

---

### Pitfall 10: Push Notification Spam Destroys User Engagement

**Risk:** Excessive or poorly timed notifications cause dealers to disable notifications entirely. You lose critical communication channel for order updates. Notification fatigue leads to app uninstalls.

**Warning Signs:**
- Every order status change triggers notification (too many)
- Notifications sent at 2am local time (poor timing)
- No user control over notification preferences
- Marketing messages disguised as transactional notifications
- Notifications without clear action or value
- Generic messages: "Your order was updated" (no specifics)

**Prevention:**
- Implement notification preferences per dealer:
  - Critical only: Order approved/rejected, shipped, delivery issues
  - Standard: Above + order received confirmation
  - All: Above + every status change
- Respect time zones: don't send non-critical notifications outside business hours
- Make notifications actionable: "Order #1234 shipped - track it" with deep link
- Include key details in notification: order number, product, status
- Never send marketing via push (use email instead)
- Implement frequency limits: max N notifications per day
- A/B test notification content and timing
- Monitor opt-out rates as key metric
- Provide in-app notification center for history

**Phase to Address:** Phase 1 (MVP) - Implement basic notification preferences. Phase 2 (Optimization) - Add advanced scheduling and frequency controls.

**Confidence:** HIGH - Push notification best practices are well-established across mobile apps.

**Sources:**
- [14 Push Notification Best Practices for 2026](https://reteno.com/blog/push-notification-best-practices-ultimate-guide-for-2026)
- [App Push Notification Best Practices for 2026](https://appbot.co/blog/app-push-notifications-2026-best-practices/)
- [Push Notifications for eCommerce Apps: Best Practices 2026](https://www.shopaccino.com/blog/push-notifications-that-drive-sales-best-practices-for-ecommerce-apps)

---

### Pitfall 11: Mobile App Offline Mode Not Considered

**Risk:** Dealers lose access to critical functionality when internet is spotty (warehouses, remote locations). They cannot browse products, check order history, or prepare orders offline. This reduces system utility and adoption.

**Warning Signs:**
- App shows blank screens or errors without internet
- Cannot view previously loaded data when offline
- No indication of offline status
- Data loss when connection drops during order submission
- Sync conflicts not handled when reconnecting

**Prevention:**
- Implement offline-first architecture for mobile app:
  - Cache product catalog and pricing locally
  - Allow browsing and cart building offline
  - Queue order submission for when connection returns
- Use local database (SQLite, Realm) for offline data
- Implement sync engine with conflict resolution:
  - "Last write wins" with timestamp for most data
  - Prevent conflicting changes (can't modify same order offline on two devices)
- Show clear offline indicator in UI
- Provide offline-capable features: product search, order history, saved carts
- Auto-retry failed operations when connection restored
- Show sync status and queued actions
- Test on slow/intermittent connections, not just offline/online

**Phase to Address:** Phase 1 (MVP) - Basic offline support (view cached data). Phase 2 (Enhancement) - Full offline order creation and sync.

**Confidence:** MEDIUM - Offline-first is increasingly important for mobile apps, especially in B2B contexts with field users.

**Sources:**
- [Offline-First Apps: Key Use Cases and Benefits in 2026](https://www.octalsoftware.com/blog/offline-first-apps)
- [How to Build Resilient Offline-First Mobile Apps with Seamless Syncing](https://medium.com/@quokkalabs135/how-to-build-resilient-offline-first-mobile-apps-with-seamless-syncing-adc98fb72909)
- [Data Synchronization in Logistics: Setting Offline Sync Up](https://intellisoft.io/implementing-offline-data-synchronization-in-logistics-applications/)

---

### Pitfall 12: Poor Mobile UX from Direct Web Port

**Risk:** Mobile app is just a webview of desktop site. Poor performance, awkward navigation, doesn't follow mobile patterns. Dealers revert to phone/WhatsApp ordering because app is frustrating.

**Warning Signs:**
- Tiny text and buttons (not touch-optimized)
- Excessive scrolling and navigation depth
- No mobile-specific features (barcode scanning, photo capture)
- Slow load times on mobile networks
- Desktop-style multi-column layouts on phone
- Form inputs not optimized for mobile keyboards

**Prevention:**
- Design mobile-first, not desktop-first
- Use native mobile UI components (not webview)
- Optimize for thumb-friendly interaction:
  - Bottom navigation, not top menu
  - Large touch targets (minimum 44x44pt)
  - Swipe gestures for common actions
- Reduce navigation depth: 3 taps to complete common task
- Implement mobile-specific features:
  - Barcode scanning for quick product lookup
  - Camera for order issues/returns documentation
  - Quick reorder from history
  - Voice search
- Optimize image sizes and lazy load
- Test on slow networks (3G, not just WiFi)
- Follow platform guidelines (Material Design for Android, Human Interface Guidelines for iOS)

**Phase to Address:** Phase 1 (MVP) - Mobile-first design from the start. Retrofitting mobile UX is extremely expensive.

**Confidence:** MEDIUM - Mobile UX best practices are well-established, specific dealer context extrapolated from general B2B patterns.

**Sources:**
- [7 UI Pitfalls Mobile App Developers Should Avoid in 2026](https://www.webpronews.com/7-ui-pitfalls-mobile-app-developers-should-avoid-in-2026/)
- [Mobile App Design and User Experience (UX) Best Practices](https://www.dealerappvantage.com/articles/mobile-app-design-ux/)
- [Usability Issues With Mobile Applications](https://arxiv.org/html/2502.05120v2)

---

## Low Priority Pitfalls

These mistakes cause annoyance but are relatively easy to fix.

### Pitfall 13: Poor First-Time User Onboarding

**Risk:** Dealers don't understand how to use system, fail to complete first order, abandon app. Without proper onboarding, system adoption is slow and requires extensive manual training.

**Warning Signs:**
- No onboarding flow for first-time users
- Dealers immediately presented with empty state (no guidance)
- Support tickets asking basic "how do I..." questions
- Generic onboarding for all dealer types (ignores their experience level)
- Onboarding can't be skipped or revisited
- Information overload: 20 screens of instructions

**Prevention:**
- Implement progressive onboarding:
  - First login: Quick 3-step tour of critical features
  - Contextual tips: Show tooltips when user encounters feature first time
  - Interactive tutorial: Let dealers practice creating first order with sample data
- Segment onboarding by dealer type:
  - New dealers: Full explanation of process
  - Experienced dealers switching from competitor: Highlight differences
  - Existing phone/WhatsApp dealers: Emphasize convenience benefits
- Provide skip option (but remember preference)
- Include onboarding checklist in dashboard: "Create first order", "Add team member", etc.
- Offer help resources without leaving app: video tutorials, FAQ, chat support
- Avoid upselling during onboarding (focus on value of current features)

**Phase to Address:** Phase 1 (MVP) - Basic onboarding. Phase 2 (Enhancement) - Personalized and contextual onboarding.

**Confidence:** MEDIUM - Onboarding best practices are well-documented, dealer-specific context extrapolated.

**Sources:**
- [The 7 Most Common Customer Onboarding Mistakes & How to Fix Them](https://onramp.us/blog/customer-onboarding-mistakes)
- [5 Top User Onboarding Challenges in B2B Software](https://www.inturact.com/blog/user-onboarding-challenges-in-b2b-software)
- [SaaS Onboarding UX: Best Practices, Common Mistakes, Examples](https://cieden.com/saas-onboarding-best-practices-and-common-mistakes-ux-upgrade-article-digest)

---

### Pitfall 14: No Communication of System Status Changes

**Risk:** Dealers don't know when their orders are processed, inventory updates, or system maintenance occurs. They make decisions based on stale information. Trust in system declines.

**Warning Signs:**
- Dealers call to ask "what's the status of my order?"
- No order confirmation emails/notifications
- System maintenance happens without warning
- Price changes occur silently
- Inventory updates invisible to dealers

**Prevention:**
- Implement comprehensive status communication:
  - Order received → immediate confirmation
  - Order approved/rejected → notification within SLA
  - Order shipped → tracking information
  - Delivery confirmed → final confirmation
- Show last updated timestamp on all data (prices, inventory)
- Announce scheduled maintenance via in-app banner + email 48 hours in advance
- Provide system status page for outages
- Email digest for significant changes: new products, price updates, policy changes
- In-app notification center for history
- Allow dealers to subscribe to product availability alerts

**Phase to Address:** Phase 1 (MVP) - Basic order status notifications. Phase 2 (Enhancement) - Comprehensive communication system.

**Confidence:** MEDIUM - Transparency in B2B systems is important but specific implementation details vary.

**Sources:**
- [How to Solve Common Order Management Issues in B2B](https://www.dckap.com/commerce/blog/how-to-solve-common-order-management-issues-in-b2b-distribution/)
- [10 Common Order Management Challenges in B2B Manufacturing Businesses](https://decorum.work/blog/managing-orders-in-b2b)

---

### Pitfall 15: Search and Filter Performance Not Optimized

**Risk:** Product search and filtering is slow on large catalogs. Dealers get frustrated waiting for results. System feels sluggish and unresponsive.

**Warning Signs:**
- Search takes >2 seconds to return results
- Filtering/sorting requires full page reload
- No typeahead or autocomplete
- Search doesn't handle typos or partial matches
- Faceted filtering is slow on large result sets

**Prevention:**
- Implement proper database indexing on searchable fields
- Use full-text search engine (Elasticsearch, PostgreSQL FTS) for product search
- Implement typeahead with debouncing (search after user stops typing)
- Cache common searches and filters
- Use pagination for large result sets
- Implement progressive loading (show initial results immediately)
- Optimize database queries with EXPLAIN ANALYZE
- Consider search-as-you-type with instant results
- Handle typos with fuzzy matching
- Index by dealer-relevant fields (frequently ordered products, category)

**Phase to Address:** Phase 1 (MVP) - Basic search with indexing. Phase 2 (Optimization) - Advanced search features and performance tuning.

**Confidence:** MEDIUM - General search optimization best practices, specific to B2B catalogs.

**Sources:**
- General database optimization and search best practices (not specific sources from research, inferred from common patterns)

---

### Pitfall 16: Inadequate Error Messages and Logging

**Risk:** When errors occur, dealers see generic messages like "Something went wrong." Developers cannot debug issues without detailed logs. Problems recur because root cause is unclear.

**Warning Signs:**
- Error messages don't explain what went wrong or how to fix it
- No correlation between user reports and server logs
- Cannot reproduce reported issues due to missing context
- Logs don't include dealer_id, order_id, timestamp
- No structured logging (just print statements)
- Production errors discovered by users, not monitoring

**Prevention:**
- Implement structured logging with context:
  - Include: dealer_id, user_id, request_id, timestamp, action, result
  - Use log levels appropriately (DEBUG, INFO, WARN, ERROR)
  - Log both successes and failures for audit trail
- User-friendly error messages:
  - Explain what went wrong: "This product is out of stock"
  - Suggest action: "Try again later or contact support"
  - Provide error code for support reference: "Error code: ORD-1234"
- Implement error tracking (Sentry, Rollbar) for production monitoring
- Set up alerts for critical errors (payment failures, order processing errors)
- Include request ID in API responses for tracing
- Log API calls to external systems (ERP) with request/response
- Implement correlation IDs across distributed systems

**Phase to Address:** Phase 1 (MVP) - Structured logging and error handling from day one. Adding it later is extremely difficult.

**Confidence:** HIGH - Proper logging and error handling is fundamental software engineering.

**Sources:**
- General software engineering best practices (not specific sources from research)

---

## Phase-Specific Research Recommendations

Based on pitfall analysis, here are phases likely to need deeper research:

### Phase 1: MVP Foundation - Research Mostly Complete
Most critical architectural decisions can be made with current research. No additional deep research needed unless specific technology questions arise.

### Phase 2: ERP Integration - NEEDS DEEP RESEARCH
**Required research topics:**
- Target ERP's specific API documentation and data model
- ERP authentication and security requirements
- Real-time vs batch synchronization capabilities and limitations
- ERP-specific edge cases and limitations
- Vendor-specific integration best practices

**Why:** ERP integration is high-risk and highly variable based on target system. Generic research is insufficient.

### Phase 3: Advanced Features - MAY NEED RESEARCH
Depending on features chosen, may need research on:
- Advanced analytics and reporting libraries
- B2B-specific mobile features (AR product visualization, etc.)
- Advanced pricing engines if going beyond rules-based system

---

## Summary of Critical Architectural Decisions

Based on pitfall research, these decisions MUST be made correctly in Phase 1:

1. **Multi-tenant isolation strategy**: Row-level security + ORM scoping
2. **Pricing data model**: Flexible, rule-based, not hardcoded
3. **Order state machine**: Explicit states and transitions
4. **API versioning**: URI path versioning from day one
5. **Environment separation**: Completely separate demo and production
6. **Database schema design**: ERP-compatible even in MVP
7. **Mobile-first UX**: Native patterns, not web port
8. **Logging and monitoring**: Structured from the start

These cannot be retrofitted easily. Getting them wrong forces rewrites.

---

## Research Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Multi-tenant security | HIGH | Multiple authoritative sources, well-established patterns |
| Pricing complexity | HIGH | Extensive B2B-specific research, HBR study |
| Order workflow | HIGH | State machine pattern is well-documented |
| ERP integration | HIGH | Consistently cited as high-risk, 50% failure rate documented |
| Mobile UX | MEDIUM | General mobile best practices, dealer-specific context extrapolated |
| API versioning | HIGH | Well-established for mobile apps |
| Push notifications | HIGH | 2026 best practices well-documented |
| Offline support | MEDIUM | Emerging pattern, less mature than other areas |
| Onboarding | MEDIUM | General SaaS patterns, dealer-specific context extrapolated |

---

## Validation Recommendations

While research confidence is generally high, recommend validating these areas with domain experts or pilot dealers:

1. **Dealer-specific approval workflows**: Research covers general B2B patterns, but manufacturer-dealer relationships may have unique requirements
2. **Mobile device landscape**: Confirm dealers' actual device capabilities (iOS vs Android mix, device age, connectivity quality)
3. **ERP integration requirements**: Validate target ERP system once selected (Phase 2)
4. **Pricing complexity depth**: Confirm whether dealer group pricing needs promotional overlays, seasonal pricing, contract pricing, etc.
