# Pitfalls Research: v2.0 Features - Bayi Deneyimi ve Finansal Takip

**Domain:** B2B Dealer Dashboard, Financial Tracking, Messaging, and Dealer Experience Features
**Researched:** 2026-02-08
**Project Context:** Adding dealer dashboard, financial tracking (cari hesap), favorites, campaigns, messaging, and reporting features to existing B2B order management system (~700 dealers, Supabase RLS multi-tenant, manual financial data entry initially, ERP-ready schema)

## Summary

v2.0 introduces financially sensitive data (cari hesap/account balances), aggregated dashboard metrics, PDF generation, messaging systems, and campaign management to an existing multi-tenant B2B platform. The critical risks center around:

1. **Financial data leakage** through dashboard aggregation queries bypassing RLS
2. **Performance degradation** from naive dashboard metric calculations for 700 dealers
3. **Manual data entry errors** creating financial discrepancies and trust erosion
4. **Notification fatigue** from campaigns and messaging destroying engagement
5. **PDF generation bottlenecks** during high-traffic periods
6. **Messaging system abuse** and spam without proper controls

These features touch the most sensitive aspect of dealer relationships - money. Mistakes here damage trust irreparably.

---

## Critical Pitfalls

### Pitfall 1: Financial Data Leakage Through Dashboard Aggregation Queries

**Risk:** Dashboard aggregate queries (total spending, top products, period comparisons) can bypass RLS policies if written incorrectly, exposing one dealer's financial data to another. A single missing WHERE clause in a materialized view or reporting query exposes account balances, payment history, and spending patterns across all 700 dealers. This violates financial privacy and potentially breaks data protection laws.

**What Goes Wrong:**
- Materialized views for dashboard metrics don't inherit RLS policies automatically
- Aggregate functions (SUM, COUNT) on orders table might pull all dealers if tenant_id filter forgotten
- Caching layer caches cross-tenant aggregated data and serves to wrong dealer
- Admin-created reports accessible to dealers leak aggregated competitor insights
- PostgreSQL function (SECURITY DEFINER) bypasses RLS to "improve performance"

**Warning Signs:**
- Dashboard queries use SECURITY DEFINER functions to bypass RLS
- Materialized views don't include dealer_id in WHERE clause
- No automated tests verify each dealer only sees their own financial data
- RLS policies not applied to financial tables (cari_hesap, payments)
- Dashboard metrics pulled from materialized views without dealer filtering
- Developers use service_role key in API routes for "convenience"

**Prevention:**
1. **Verify RLS on all financial tables:**
   ```sql
   ALTER TABLE cari_hesap ENABLE ROW LEVEL SECURITY;
   ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
   ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Dealers see only own balance"
     ON cari_hesap FOR SELECT
     USING (dealer_id IN (
       SELECT id FROM dealers WHERE user_id = auth.uid()
     ));
   ```

2. **Materialized views MUST include dealer_id filter:**
   ```sql
   -- WRONG: This aggregates across all dealers
   CREATE MATERIALIZED VIEW dealer_spending_summary AS
   SELECT dealer_id, SUM(total_amount) as total_spent
   FROM orders GROUP BY dealer_id;

   -- RIGHT: Application must filter by dealer_id when querying
   -- AND verify RLS policy on base tables catches mistakes
   ```

3. **Never use SECURITY DEFINER for dealer-facing queries** - This bypasses RLS entirely
4. **Test data isolation:** Write integration tests that authenticate as Dealer A and verify they cannot see Dealer B's financial data through any API endpoint
5. **Audit all aggregate queries:** Use query logging to verify every financial query includes dealer_id filter
6. **Cache per dealer:** Cache keys must include dealer_id: `dashboard:metrics:{dealer_id}` not `dashboard:metrics`

**Detection:**
- Enable PostgreSQL query logging and grep for financial tables without dealer_id
- Monitor for unexpected JOIN patterns across dealers table
- Automated test: Create 2 dealers with different balances, verify each sees only their own
- Code review checklist: Every query touching cari_hesap/payments/invoices filtered by dealer_id

**Phase:** Phase 1 (Dashboard Foundation) - Must be correct from day one. Financial data leakage is unrecoverable reputational damage.

**Confidence:** HIGH - Multi-tenant financial data leakage is the #1 cited failure mode in B2B SaaS systems.

**Sources:**
- [Multi-Tenant Leakage: When Row-Level Security Fails in SaaS](https://instatunnel.my/blog/multi-tenant-leakage-when-row-level-security-fails-in-saas)
- [Multi-Tenant Applications with RLS on Supabase](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/)
- [Multi-Tenant Security: Definition, Risks and Best Practices](https://qrvey.com/blog/multi-tenant-security/)

---

### Pitfall 2: Dashboard Performance Degradation from Naive Aggregation Queries

**Risk:** Dashboard shows "Total spending this month" by scanning all 700 dealers' orders on every page load. With 20-30 orders per day (~600-900/month), queries become progressively slower. After 6 months, dashboard takes 5-10 seconds to load. Dealers abandon the feature. Under concurrent load (50 active users), database CPU spikes to 100%.

**What Goes Wrong:**
- Aggregate queries without indexes scan entire orders table sequentially
- Real-time calculations on every dashboard load (no caching)
- Multiple separate queries for each widget (N+1 query problem)
- Complex JOINs across orders → order_items → products for "top products"
- Missing composite indexes on (dealer_id, created_at) for time-filtered aggregates
- No query result caching - every dealer refresh recalculates from scratch

**Warning Signs:**
- Dashboard load time >2 seconds even with few orders
- Database CPU usage correlates with dashboard page views
- No materialized views or pre-aggregated tables
- Each dashboard widget triggers separate database query
- Queries don't use indexes (EXPLAIN shows Seq Scan)
- No caching headers on dashboard API responses

**Prevention:**

1. **Pre-aggregate with materialized views or summary tables:**
   ```sql
   -- Dealer spending summary (refresh periodically, not real-time)
   CREATE TABLE dealer_spending_summary (
     dealer_id UUID PRIMARY KEY,
     total_all_time DECIMAL(12,2),
     total_this_year DECIMAL(12,2),
     total_this_month DECIMAL(12,2),
     order_count INT,
     last_order_date DATE,
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Refresh via scheduled function (every hour is acceptable for dashboard)
   CREATE OR REPLACE FUNCTION refresh_dealer_spending_summary()
   RETURNS void AS $$
     -- Incremental update logic
   $$ LANGUAGE plpgsql;
   ```

2. **Use proper indexes for time-range queries:**
   ```sql
   -- Critical for "this month" / "this year" queries
   CREATE INDEX idx_orders_dealer_created
     ON orders(dealer_id, created_at DESC);

   -- For top products query
   CREATE INDEX idx_order_items_dealer_product
     ON order_items(
       (SELECT dealer_id FROM orders WHERE id = order_id),
       product_id
     );
   ```

3. **Implement smart caching strategy:**
   - Cache dashboard data for 15-30 minutes (financial dashboards don't need real-time)
   - Invalidate cache on dealer's own order events (not all dealers)
   - Use Supabase edge caching or Redis for dealer-specific dashboard data
   - Cache key: `dashboard:summary:{dealer_id}:{date}` - auto-expires daily

4. **Batch widget queries:**
   ```typescript
   // WRONG: 4 separate queries
   const totalSpent = await getTotalSpent(dealerId);
   const orderCount = await getOrderCount(dealerId);
   const topProducts = await getTopProducts(dealerId);
   const recentOrders = await getRecentOrders(dealerId);

   // RIGHT: Single query with multiple aggregates
   const dashboard = await getDealerDashboard(dealerId);
   // Returns all metrics in one round-trip
   ```

5. **Monitor query performance:**
   - Use Supabase Query Performance tab to identify slow queries
   - Set up alerts when dashboard queries exceed 500ms
   - Use EXPLAIN ANALYZE to verify indexes are used

**Detection:**
- Load time monitoring: Alert if dashboard API response >1 second
- Query count: Dashboard should make ≤3 queries total (not 1 per widget)
- Index usage: EXPLAIN shows "Index Scan" not "Seq Scan"
- Cache hit rate monitoring

**Phase:** Phase 1 (Dashboard Foundation) - Design aggregation strategy upfront. Retrofitting caching is painful.

**Confidence:** HIGH - Dashboard performance issues with aggregation are well-documented in PostgreSQL analytics contexts.

**Sources:**
- [Postgres for Analytics Workloads: Capabilities and Performance Tips](https://www.epsio.io/blog/postgres-for-analytics-workloads-capabilities-and-performance-tips)
- [Scalable incremental data aggregation on Postgres and Citus](https://www.citusdata.com/blog/2018/06/14/scalable-incremental-data-aggregation/)
- [Optimize Read Performance in Supabase with Postgres Materialized Views](https://dev.to/kovidr/optimize-read-performance-in-supabase-with-postgres-materialized-views-12k5)

---

### Pitfall 3: Manual Financial Data Entry Errors Creating Trust Erosion

**Risk:** Admin manually enters cari hesap (account balance) and payment data. Typos, wrong dealer selection, missed payments, and duplicate entries create financial discrepancies. Dealer sees balance that doesn't match their records. They call to dispute. Admin has no audit trail to explain discrepancy. Trust in system collapses. Dealers revert to phone-based ordering.

**What Goes Wrong:**
- No validation on manual entry (can enter negative payments, future dates)
- No confirmation step before saving financial data
- Duplicate payment entries (admin hits save twice)
- Wrong dealer selected from dropdown (similar company names)
- No audit trail of who entered what data when
- No reconciliation workflow to catch errors
- Manual entry happens during high-pressure moments (month-end close)

**Warning Signs:**
- Dealers frequently call to dispute balance discrepancies
- No "last updated by" or "created by" fields on financial records
- Financial data can be edited/deleted without trace
- No export/import validation for bulk updates
- Admin complains "I don't remember entering that"
- Multiple payments on same day with same amount (likely duplicate)

**Prevention:**

1. **Implement comprehensive audit logging:**
   ```sql
   CREATE TABLE financial_audit_log (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     table_name TEXT NOT NULL,
     record_id UUID NOT NULL,
     action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
     old_values JSONB,
     new_values JSONB,
     changed_by UUID REFERENCES users(id),
     changed_at TIMESTAMPTZ DEFAULT NOW(),
     ip_address INET,
     notes TEXT
   );

   -- Trigger on cari_hesap, payments, invoices tables
   ```

2. **Add validation and confirmation:**
   - Amount validation: Warn if payment >2x average payment for dealer
   - Date validation: Warn if backdated >30 days or future-dated
   - Duplicate detection: "Payment for 1,500 TL on same date already exists"
   - Two-step confirmation: "You're updating Bayi ABC's balance. Confirm?"
   - Required notes field for manual adjustments

3. **Design for ERP sync from day one:**
   ```sql
   CREATE TABLE cari_hesap (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     dealer_id UUID REFERENCES dealers(id),
     balance_borc DECIMAL(12,2) DEFAULT 0,  -- Debt
     balance_alacak DECIMAL(12,2) DEFAULT 0, -- Credit
     last_sync_at TIMESTAMPTZ,
     erp_account_id TEXT, -- For future ERP integration
     is_manually_entered BOOLEAN DEFAULT true,
     entered_by UUID REFERENCES users(id),
     notes TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE TABLE payments (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     dealer_id UUID REFERENCES dealers(id),
     amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
     payment_date DATE NOT NULL,
     payment_method TEXT,
     reference_number TEXT,
     erp_payment_id TEXT, -- Future integration
     is_manually_entered BOOLEAN DEFAULT true,
     entered_by UUID REFERENCES users(id),
     notes TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

4. **Reconciliation workflow:**
   - Show dealer "last updated" timestamp on balance display
   - Admin panel: Bulk export for month-end reconciliation with ERP
   - Dealer-facing: "Your balance was updated 2 days ago"
   - Flag discrepancies: Automated check comparing sum(payments) vs balance

5. **Immutable financial records:**
   - Don't allow DELETE on payments (soft delete only)
   - Don't allow editing payment amount (create reversal instead)
   - Financial corrections create audit trail: Original + Adjustment entries

**Detection:**
- Alert when balance updated without notes
- Alert when payment amount >3 standard deviations from dealer's average
- Weekly reconciliation report: Manual entries vs system calculations
- Monitor frequency of balance disputes (support ticket tracking)

**Phase:** Phase 2 (Financial Tracking Implementation) - Design carefully to prevent errors and enable future ERP sync.

**Confidence:** HIGH - Manual data entry errors are extensively documented in financial system implementations.

**Sources:**
- [The Pitfalls of Immature Payrolls: Manual Data Entry](https://www.linkedin.com/pulse/pitfalls-immature-payrolls-manual-data-entry-ian-giles-hc0be)
- [11 Common Accounting Problems (And How to Finally Fix Them in 2026)](https://www.spendflo.com/blog/accounting-problems)
- [How Manual Data Entry and Human Error Are Costing You Money](https://www.connectpointz.com/blog/manual-data-entry-costing-you-money)

---

### Pitfall 4: PDF Invoice Generation Becomes Performance Bottleneck

**Risk:** Dealers request PDF invoices. System generates on-the-fly using HTML-to-PDF library. Works fine for 1-2 concurrent requests. Under real load (50 dealers downloading invoices at month-end), PDF generation saturates CPU, requests timeout, dealers get errors. Admin panel becomes unresponsive during "PDF generation storms."

**What Goes Wrong:**
- PDF generation is CPU-intensive and synchronous (blocks request thread)
- No pre-generation or caching of commonly requested PDFs
- Complex invoice template with many images/fonts increases generation time
- No queue system - all PDF requests hit server simultaneously
- Memory leak in PDF library causes out-of-memory crashes under load
- Dealers repeatedly retry failed PDF downloads, amplifying problem

**Warning Signs:**
- PDF download requests take >10 seconds
- Server CPU spikes when invoices are downloaded
- Timeout errors during PDF generation
- No PDF generation monitoring or rate limiting
- Each invoice generated fresh every time (no caching)
- Month-end performance degradation

**Prevention:**

1. **Pre-generate PDFs asynchronously:**
   ```sql
   CREATE TABLE invoice_documents (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     invoice_id UUID REFERENCES invoices(id),
     dealer_id UUID REFERENCES dealers(id),
     pdf_url TEXT, -- Supabase Storage URL
     generated_at TIMESTAMPTZ,
     file_size_bytes INT,
     is_latest BOOLEAN DEFAULT true
   );

   -- Generate PDF when invoice is finalized, not when dealer downloads
   -- Store in Supabase Storage, serve pre-generated file
   ```

2. **Use background job queue:**
   - Don't generate PDFs in API request handler
   - Queue PDF generation job (Supabase Edge Function + queue)
   - Return "PDF being generated..." immediately, notify when ready
   - Bulk generation for month-end via scheduled job

3. **Implement caching and regeneration strategy:**
   - Cache generated PDFs in Supabase Storage
   - Serve cached version if invoice unchanged
   - Invalidate cache only when invoice data changes
   - Pre-generate during low-traffic hours (2-6 AM)

4. **Use efficient PDF library:**
   - For server-side Node.js: puppeteer or playwright (Chromium-based)
   - For edge functions: Consider lightweight libraries or external PDF service
   - Optimize template: Minimize images, use web fonts, reduce complexity
   - Test memory usage and generation time with realistic data

5. **Rate limiting and load management:**
   - Limit: 5 concurrent PDF generations per dealer
   - Queue excess requests
   - Month-end preparation: Pre-generate all invoices 2 days before
   - Provide bulk download option (single ZIP with all invoices)

6. **Monitor and alert:**
   - Track: Average PDF generation time, success rate, queue depth
   - Alert when: Generation time >3 seconds, queue depth >50, error rate >5%

**Detection:**
- Load testing with concurrent PDF requests
- Monitor CPU usage during PDF generation
- Track request duration for PDF endpoints
- Memory usage monitoring for PDF process

**Phase:** Phase 2 (Financial Tracking - Invoice PDFs) - Design async generation from start. Retrofitting is complex.

**Confidence:** MEDIUM - General PDF generation performance issues are well-documented, B2B invoice context inferred.

**Sources:**
- [Most Common Invoicing Mistakes & How to Fix Them in 2025](https://quickbooks.intuit.com/r/invoicing/invoice-mistakes/)
- [B2B Invoicing Best Practices: Tips for Faster Payments in 2025](https://www.paystand.com/blog/b2b-invoicing)

---

### Pitfall 5: Campaign and Announcement Notification Spam Destroys Engagement

**Risk:** v2.0 adds campaigns and announcements. Marketing gets excited and sends daily campaign notifications. Combined with order status notifications from v1, dealers receive 5-10 notifications per day. They disable all notifications. You lose critical communication channel for important updates (shipment delays, urgent order issues). Campaign feature becomes useless because notifications are blocked.

**What Goes Wrong:**
- No distinction between transactional (order updates) and marketing (campaigns) notifications
- Marketing team can send unlimited push notifications
- No frequency capping or quiet hours
- Dealers cannot customize notification preferences by type
- Every campaign triggers push notification by default
- Notification copy is generic: "New campaign available!" (not informative)

**Warning Signs:**
- Push notification opt-out rate >30%
- Campaign click-through rate <5%
- Support tickets: "How do I stop notifications?"
- Dealers disable app notifications at OS level
- Notification open rate declining month-over-month

**Prevention:**

1. **Separate notification channels:**
   ```sql
   CREATE TABLE notification_preferences (
     dealer_id UUID PRIMARY KEY REFERENCES dealers(id),
     -- Transactional (cannot be fully disabled)
     order_critical BOOLEAN DEFAULT true,        -- Rejected, cancelled
     order_status BOOLEAN DEFAULT true,          -- Shipped, delivered
     order_confirmations BOOLEAN DEFAULT false,  -- Received, processing
     -- Marketing (can be disabled)
     campaigns BOOLEAN DEFAULT false,            -- OFF by default!
     announcements BOOLEAN DEFAULT true,
     product_updates BOOLEAN DEFAULT false,
     -- Delivery preferences
     quiet_hours_start TIME DEFAULT '22:00',
     quiet_hours_end TIME DEFAULT '08:00',
     timezone TEXT DEFAULT 'Europe/Istanbul'
   );
   ```

2. **Frequency capping:**
   - Max 1 marketing notification per dealer per day
   - Max 3 notifications total per day (including transactional)
   - Admin warning: "This campaign will send to 700 dealers. Last campaign was 2 hours ago."
   - Automatic throttling during high notification periods

3. **Notification quality over quantity:**
   - Campaigns default to in-app only (no push)
   - Push notification requires explicit admin action: "Send push to segment"
   - Segmentation: Only notify dealers who bought from this category before
   - A/B test notification copy and timing

4. **Rich, actionable notifications:**
   ```typescript
   // WRONG: Generic spam
   {
     title: "New campaign!",
     body: "Check out our latest offers"
   }

   // RIGHT: Specific and valuable
   {
     title: "15% off Marka X products - 2 days only",
     body: "Your favorite category on sale. Save on your next order.",
     data: { campaign_id: "...", deep_link: "/campaigns/marka-x-sale" }
   }
   ```

5. **Respect quiet hours:**
   - No non-critical notifications between 22:00 - 08:00 dealer local time
   - Weekend throttling (optional): Reduce marketing notifications on Sunday
   - Emergency override for critical issues (system outage, urgent recalls)

6. **In-app notification center:**
   - All notifications available in-app even if push disabled
   - Badge count for unread campaigns/announcements
   - Dealers can browse without enabling push

7. **Monitor engagement metrics:**
   - Track: Push open rate, in-app view rate, notification-to-action conversion
   - Alert when: Open rate drops below baseline, opt-out rate spikes
   - Monthly report: Notification effectiveness by type

**Detection:**
- Daily monitoring of opt-out rate
- Notification count per dealer per day
- Engagement rate trending (should stay >20% for campaigns)

**Phase:** Phase 3 (Campaigns & Announcements) - Build notification preferences before launching campaigns.

**Confidence:** HIGH - Push notification fatigue and best practices are extensively documented for 2026.

**Sources:**
- [14 Push Notification Best Practices for 2026](https://reteno.com/blog/push-notification-best-practices-ultimate-guide-for-2026)
- [App Push Notification Best Practices for 2026](https://appbot.co/blog/app-push-notifications-2026-best-practices/)
- [Why Most Mobile Push Notification Architecture Fails](https://www.netguru.com/blog/why-mobile-push-notification-architecture-fails)

---

### Pitfall 6: Dealer Messaging System Becomes Support Bottleneck Without Proper Workflow

**Risk:** v2.0 adds dealer-admin messaging. Dealers love it and send hundreds of messages daily (product questions, complaints, order issues). Messages go to unmonitored inbox. No routing, no SLA, no assignment. Response times balloon to 24-48 hours. Dealers frustrated. System perceived as "broken" even though technically working.

**What Goes Wrong:**
- All messages go to single shared admin inbox
- No assignment or routing logic
- No SLA tracking or escalation
- Admins don't know which messages are urgent
- No canned responses for common questions
- Messages buried when new ones arrive (no prioritization)
- Weekend messages not monitored until Monday

**Warning Signs:**
- Average response time >12 hours
- Messages marked unread and forgotten
- Dealers send multiple messages for same issue
- No way to track conversation history with specific dealer
- Support team complains of overwhelming message volume
- No metrics on response time or resolution rate

**Prevention:**

1. **Message categorization and routing:**
   ```sql
   CREATE TABLE dealer_messages (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     dealer_id UUID REFERENCES dealers(id),
     subject TEXT NOT NULL,
     category TEXT CHECK (category IN (
       'order_issue',
       'product_question',
       'payment_dispute',
       'technical_problem',
       'feature_request',
       'general'
     )),
     priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
     status TEXT DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'waiting_dealer', 'resolved', 'closed')),
     assigned_to UUID REFERENCES users(id),
     first_response_at TIMESTAMPTZ,
     resolved_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE TABLE message_threads (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     message_id UUID REFERENCES dealer_messages(id),
     sender_type TEXT CHECK (sender_type IN ('dealer', 'admin')),
     sender_id UUID REFERENCES users(id),
     content TEXT NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. **Automatic prioritization:**
   - Payment disputes → High priority, route to finance team
   - Order issues → High priority, route to operations team
   - Product questions → Normal priority, route to sales team
   - Escalation: If no response in 4 hours, escalate to high priority

3. **SLA tracking and alerts:**
   - Target response time by priority:
     - Urgent: 1 hour
     - High: 4 hours
     - Normal: 24 hours
     - Low: 48 hours
   - Alert admins when SLA at risk (80% of time elapsed)
   - Daily digest: "5 messages breached SLA yesterday"

4. **Assignment and workload balancing:**
   - Auto-assign new messages to least-loaded admin in relevant department
   - Manual reassignment capability
   - "Claim message" workflow for admins
   - Track response rate per admin

5. **Canned responses and FAQ integration:**
   - Library of pre-written responses for common questions
   - Link to FAQ articles in responses
   - Auto-suggest FAQ articles based on message content
   - One-click "Resolve with FAQ" workflow

6. **Status transparency for dealers:**
   - Dealer sees message status: "Waiting for response", "Admin replied", "Resolved"
   - Expected response time shown: "We typically respond within 4 hours"
   - Auto-reply: "Your message received. Category: Product Question. Expected response: 24 hours."

7. **Integration with existing support channels:**
   - Don't create isolated messaging system
   - Consider: Forward to existing email/ticketing system
   - Or: Build full-featured ticket system with message integration

**Detection:**
- Monitor: Average first response time, resolution time, messages breaching SLA
- Alert when: First response time >6 hours, >10 unassigned messages
- Weekly report: Message volume by category, top issues

**Phase:** Phase 4 (Support & Messaging) - Design workflow before building chat UI.

**Confidence:** MEDIUM - B2B messaging best practices extrapolated from customer support systems and limited B2B portal messaging research.

**Sources:**
- [Self-Serve Dealer Portals: Transform B2B Relationships in 2026](https://www.shopaccino.com/blog/how-b2b-brands-can-improve-dealer-relationships-with-selfserve-ordering-portals)
- [The Complete Guide to B2B Dealer Portals](https://oroinc.com/b2b-ecommerce/blog/the-complete-guide-to-b2b-dealer-portals/)

---

### Pitfall 7: Favorites System Creates Confusing Data Duplication Issues

**Risk:** Dealer adds product to favorites. Product price changes. Favorite shows old price. Dealer orders expecting favorite price, gets current (higher) price. Dispute. Or: Product is discontinued. Favorite still shows it. Dealer tries to order, gets error. Or: Dealer has 100+ favorites, system slows down showing them all.

**What Goes Wrong:**
- Favorites store snapshot of product data (price, name, image) instead of reference
- Stale favorite data not updated when product changes
- No indication in favorites list that product is discontinued or out of stock
- Favorites query pulls full product data on every page load (N+1 queries)
- No pagination or limits on favorites list

**Warning Signs:**
- Dealers report favorites showing wrong prices
- Favorites include discontinued products with no warning
- Slow load time for favorites page with many items
- Duplicate data storage (product info in both products and favorites tables)
- No "last updated" timestamp on favorites

**Prevention:**

1. **Store reference, not snapshot:**
   ```sql
   -- RIGHT: Store reference only
   CREATE TABLE dealer_favorites (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     dealer_id UUID REFERENCES dealers(id),
     product_id UUID REFERENCES products(id),
     added_at TIMESTAMPTZ DEFAULT NOW(),
     sort_order INT, -- For custom ordering
     UNIQUE(dealer_id, product_id)
   );

   -- WRONG: Don't store product snapshot
   -- product_name TEXT, product_price DECIMAL, etc.
   ```

2. **Join to get current data:**
   ```sql
   -- Favorites query always gets fresh product data
   SELECT
     f.id,
     f.added_at,
     p.code,
     p.name,
     p.is_active,
     p.stock_quantity,
     get_dealer_price(f.dealer_id, p.id) as current_price
   FROM dealer_favorites f
   JOIN products p ON f.product_id = p.id
   WHERE f.dealer_id = $1
   ORDER BY f.sort_order;
   ```

3. **Handle edge cases gracefully:**
   - Discontinued products: Show in favorites with "No longer available" badge
   - Out of stock: Show "Out of stock - notify me when available" option
   - Price changes: Show current price, optionally "Price changed" indicator
   - Deleted products: Soft delete from favorites or mark as unavailable

4. **Performance optimization:**
   - Limit favorites to 100 per dealer (or paginate)
   - Batch fetch prices using get_dealer_price in single query
   - Cache favorites list for 5-10 minutes
   - Index on (dealer_id, product_id) for fast lookups

5. **Enhanced UX:**
   - Show when favorite was added: "Favorited 3 months ago"
   - Sort options: Recently added, price, name, most ordered
   - Bulk actions: Add all to cart, remove discontinued items
   - Availability notifications: "X favorites are low in stock"

**Detection:**
- Monitor for complaints about favorites price mismatches
- Track favorites list load time
- Monitor favorites count distribution (alert if >1000 for single dealer)

**Phase:** Phase 2 (Favorites Feature) - Simple to implement correctly from start.

**Confidence:** MEDIUM - Wishlist/favorites best practices from e-commerce adapted to B2B context with dealer pricing.

**Sources:**
- [Wishlists Design - How to design Wishlists for E-Commerce?](https://thestory.is/en/journal/designing-wishlists-in-e-commerce/)
- [10 Common Mistakes in Database Design](https://chartdb.io/blog/common-database-design-mistakes)

---

### Pitfall 8: Cargo Tracking Integration Underestimated in Complexity

**Risk:** "Sipariş Detayları" feature includes cargo tracking. Seems simple: store tracking number, show status. Reality: Multiple cargo companies (Aras, MNG, Yurtiçi, PTT) with different APIs. Tracking data inconsistent. Status updates delayed. Integration to each carrier takes weeks. Manual tracking number entry error-prone. Dealers see "Tracking unavailable" for half their orders.

**What Goes Wrong:**
- Assumption that all cargo companies have similar APIs (they don't)
- No unified cargo tracking library/service used
- Manual entry of tracking numbers causes typos
- Tracking status not automatically updated (stale data)
- Different carriers use different status terminology
- No fallback when carrier API is down
- Bulk tracking updates not considered (admin enters 50 tracking numbers at once)

**Warning Signs:**
- Each cargo company requires custom integration code
- Tracking numbers entered manually with no validation
- No scheduled job to refresh tracking status
- Dealers see outdated tracking info
- API errors when cargo company site is down
- No support for manual/own-vehicle deliveries (tracking number not applicable)

**Prevention:**

1. **Design flexible schema for multiple carriers:**
   ```sql
   CREATE TABLE cargo_companies (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     name TEXT UNIQUE NOT NULL,
     slug TEXT UNIQUE NOT NULL, -- 'aras', 'mng', 'yurtici'
     api_enabled BOOLEAN DEFAULT false,
     api_config JSONB, -- API endpoint, auth details
     tracking_url_template TEXT -- For manual tracking links
   );

   CREATE TABLE order_shipments (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     order_id UUID REFERENCES orders(id),
     cargo_company_id UUID REFERENCES cargo_companies(id),
     tracking_number TEXT NOT NULL,
     shipment_date DATE,
     estimated_delivery_date DATE,
     -- Normalized status
     status TEXT CHECK (status IN (
       'pending',
       'picked_up',
       'in_transit',
       'out_for_delivery',
       'delivered',
       'delivery_failed',
       'returned'
     )),
     raw_status_data JSONB, -- Store carrier's raw response
     last_status_update TIMESTAMPTZ,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE TABLE shipment_tracking_events (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     shipment_id UUID REFERENCES order_shipments(id),
     event_date TIMESTAMPTZ NOT NULL,
     location TEXT,
     description TEXT,
     raw_event_data JSONB,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. **Phased cargo integration approach:**
   - **Phase 1 (MVP):** Manual tracking number storage + external link
     - Admin enters tracking number manually
     - Dealer clicks link to carrier's website for tracking
     - No automated status updates yet

   - **Phase 2 (Automated tracking):** Integrate 1-2 most-used carriers
     - Scheduled job (hourly) fetches tracking updates via API
     - Normalize carrier status to system status
     - Store raw response for debugging

   - **Phase 3 (Full integration):** Remaining carriers + webhooks
     - Webhook support for real-time status updates where available
     - Fallback to polling for carriers without webhooks

3. **Validation and error handling:**
   - Tracking number format validation per carrier
   - Duplicate tracking number detection (same order)
   - Handle carrier API timeouts/errors gracefully
   - Show "Tracking info temporarily unavailable" instead of error
   - Manual override when API fails: Admin can manually update status

4. **Support for manual deliveries:**
   - Option: "Delivered by own vehicle" (no tracking number)
   - Status updates via admin panel: "In transit", "Delivered"
   - Photo upload: Proof of delivery, cargo damage documentation

5. **Bulk operations:**
   - CSV import for tracking numbers: order_number, tracking_number, carrier
   - Validation before import: Check order exists, valid tracking format
   - Batch status update job after import

6. **Consider third-party aggregation service:**
   - Services like AfterShip, ShipEngine provide unified API for multiple carriers
   - Tradeoff: Cost vs development time
   - Recommendation: Start with manual, add aggregation service if cargo tracking becomes priority

**Detection:**
- Monitor tracking update freshness (alert if >24 hours old)
- Track API error rate per cargo company
- Monitor dealer usage of tracking feature (clicks on tracking links)

**Phase:** Phase 3 (Order Details Enhancement) - Start with manual, add automation based on usage.

**Confidence:** MEDIUM - Cargo tracking complexity documented in B2B portal guides, specific carrier integration challenges inferred.

**Sources:**
- [Cargo at B2B Companies on Special Days](https://www.trizbi.com/en/blog/cargo-at-b2b-companies-on-special-days)
- [Top 7 B2B Marketplace Features in 2026](https://www.rigbyjs.com/blog/b2b-marketplace-features)
- [B2B Freight in 2026: Trends, Challenges & Future of Shipping](https://www.aajswift.com/blog/b2b-freight)

---

## Medium Priority Pitfalls

### Pitfall 9: Next.js Caching Serves Stale Dashboard Data to Wrong Dealer

**Risk:** Next.js App Router aggressive caching causes Dealer A to see Dealer B's cached dashboard data. Or dealer sees yesterday's spending total because page cached. Financial data shown is incorrect. Trust destroyed.

**What Goes Wrong:**
- Using Next.js default caching without understanding multi-tenant implications
- Static rendering or ISR for dealer-specific pages (should be dynamic)
- Shared cache key across dealers
- Not using `cookies()` or `headers()` to force dynamic rendering
- Supabase client caching dealer data across requests

**Warning Signs:**
- Dealer reports seeing wrong company name or different orders
- Dashboard metrics don't update after new order placed
- Different dealers report seeing same totals
- Development works fine but production shows stale data

**Prevention:**

1. **Force dynamic rendering for dealer pages:**
   ```typescript
   // app/(dealer)/dashboard/page.tsx
   import { cookies } from 'next/headers';

   export const dynamic = 'force-dynamic';
   export const revalidate = 0;

   export default async function DashboardPage() {
     // Reading cookies forces dynamic rendering
     cookies();

     // Safe to fetch dealer-specific data
     const { data: dealer } = await supabase
       .from('dealers')
       .select('*')
       .single();
     // ...
   }
   ```

2. **Never cache dealer-specific API routes:**
   ```typescript
   // app/api/dealer/dashboard/route.ts
   export async function GET(request: Request) {
     // IMPORTANT: No cache headers for dealer data
     return NextResponse.json(data, {
       headers: {
         'Cache-Control': 'private, no-cache, no-store, must-revalidate',
       },
     });
   }
   ```

3. **Use Supabase RLS, don't rely on Next.js caching:**
   - RLS guarantees dealer only sees own data even if cached incorrectly
   - Defense in depth: Cache bug won't leak data if RLS enforced

4. **Test caching behavior:**
   - Test with 2 dealers logged in simultaneously (different browsers)
   - Verify each sees only own dashboard
   - Test after deployment (caching works differently in production)

**Detection:**
- Integration tests with multiple dealer sessions
- Monitor for "wrong data" support tickets

**Phase:** Phase 1 (Dashboard Foundation) - Configure caching correctly from start.

**Confidence:** HIGH - Next.js caching complexity with dynamic data is well-documented in 2026.

**Sources:**
- [The Hidden Complexity of Data Caching in Next.js 16](https://medium.com/@lilyanaldimashki/the-hidden-complexity-of-data-caching-in-next-js-16-4f57c9ef0a00)
- [Next.js Caching and Rendering: Complete Guide for 2026](https://dev.to/marufrahmanlive/nextjs-caching-and-rendering-complete-guide-for-2026-ij2)
- [Caching & Revalidation in Next.js: ISR, fetch Cache & Real Production Patterns](https://medium.com/@chandansingh73718/caching-revalidation-in-next-js-isr-fetch-cache-real-production-patterns-7433354a2591)

---

### Pitfall 10: Materialized View Refresh Strategy Creates Stale Dashboard Data

**Risk:** Dashboard uses materialized views for performance. Views refresh on schedule (nightly). Dealer places order at 10am. Dashboard still shows yesterday's totals at 11am. Dealer confused, calls support. "My order doesn't appear in my spending."

**What Goes Wrong:**
- Materialized views refresh too infrequently (daily)
- No incremental refresh (full recalculation takes too long)
- Refresh happens during business hours, causing locks
- No indication to user that data is time-delayed
- Dealers don't understand "as of midnight" data model

**Warning Signs:**
- Dealers expect real-time dashboard but it's batch-updated
- Dashboard shows "Total: 0" for new dealers until first refresh
- Refresh job takes >10 minutes (blocks queries)
- No "last updated" timestamp shown to dealers

**Prevention:**

1. **Choose appropriate refresh frequency:**
   - Financial summary: Hourly refresh acceptable (not real-time critical)
   - Recent orders widget: Real-time query (no materialization)
   - Top products: Daily refresh acceptable
   - Pending orders count: Real-time query (critical metric)

2. **Use incremental refresh where possible:**
   ```sql
   -- Don't recalculate everything, just today's changes
   CREATE OR REPLACE FUNCTION refresh_dealer_spending_incremental()
   RETURNS void AS $$
   BEGIN
     -- Update only dealers with orders in last 2 hours
     UPDATE dealer_spending_summary s
     SET
       total_this_month = (
         SELECT COALESCE(SUM(total_amount), 0)
         FROM orders
         WHERE dealer_id = s.dealer_id
           AND created_at >= date_trunc('month', CURRENT_DATE)
       ),
       updated_at = NOW()
     WHERE EXISTS (
       SELECT 1 FROM orders
       WHERE dealer_id = s.dealer_id
         AND created_at > NOW() - INTERVAL '2 hours'
     );
   END;
   $$ LANGUAGE plpgsql;
   ```

3. **Show data freshness to users:**
   ```tsx
   <DashboardCard title="Total Spending This Month">
     <div className="text-2xl font-bold">₺{totalSpending}</div>
     <div className="text-xs text-muted-foreground">
       Updated {formatDistanceToNow(lastRefresh)} ago
     </div>
   </DashboardCard>
   ```

4. **Hybrid approach:**
   - Expensive aggregations: Materialized view (hourly refresh)
   - Critical real-time data: Direct query with proper indexes
   - User can manually refresh: "Refresh now" button triggers on-demand update

5. **Schedule refreshes during low-traffic hours:**
   - Full refresh: 3 AM daily
   - Incremental refresh: Every 2 hours during business hours
   - Don't refresh during peak times (9-11 AM, 2-4 PM)

**Detection:**
- Monitor: View refresh duration, staleness (time since last refresh)
- Alert when: Refresh duration >5 minutes, refresh fails

**Phase:** Phase 1 (Dashboard Foundation) - Design refresh strategy before implementing materialized views.

**Confidence:** HIGH - Materialized view refresh strategies are well-documented for Supabase/PostgreSQL.

**Sources:**
- [Optimize Read Performance in Supabase with Postgres Materialized Views](https://dev.to/kovidr/optimize-read-performance-in-supabase-with-postgres-materialized-views-12k5)
- [Using Materialized Views for RLS in Supabase: Best Practices and UI Limitations](https://github.com/orgs/supabase/discussions/17790)
- [How to Use Materialized Views in PostgreSQL](https://oneuptime.com/blog/post/2026-01-25-use-materialized-views-postgresql/view)

---

### Pitfall 11: Admin Panel Lacks Financial Data Audit Trail and Reconciliation

**Risk:** Admin manually enters payment and balance data. Mistakes happen. No way to trace who entered what data when. Month-end reconciliation with ERP shows discrepancies. No audit trail to investigate. Finger pointing between admin and dealer. Cannot prove who is correct.

**What Goes Wrong:**
- Financial tables lack audit columns (created_by, updated_by)
- No soft delete (records can be permanently deleted)
- No change history (before/after values)
- No reconciliation reports comparing system vs expected
- Manual corrections overwrite data without trace

**Prevention:**

1. **Comprehensive audit columns on all financial tables:**
   ```sql
   -- Apply to: cari_hesap, payments, invoices
   ALTER TABLE payments ADD COLUMN created_by UUID REFERENCES users(id);
   ALTER TABLE payments ADD COLUMN updated_by UUID REFERENCES users(id);
   ALTER TABLE payments ADD COLUMN deleted_at TIMESTAMPTZ;
   ALTER TABLE payments ADD COLUMN deleted_by UUID REFERENCES users(id);
   ```

2. **Change history table:**
   ```sql
   CREATE TABLE financial_change_history (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     table_name TEXT NOT NULL,
     record_id UUID NOT NULL,
     field_name TEXT NOT NULL,
     old_value TEXT,
     new_value TEXT,
     changed_by UUID REFERENCES users(id),
     changed_at TIMESTAMPTZ DEFAULT NOW(),
     change_reason TEXT
   );

   -- Trigger to populate on UPDATE
   ```

3. **Soft delete only:**
   - Never allow hard DELETE on financial records
   - Soft delete: Set deleted_at timestamp
   - Queries exclude soft-deleted by default
   - Admin can view deleted records for audit

4. **Reconciliation tools:**
   - Monthly report: Sum of payments vs balance changes
   - Dealer-by-dealer comparison: System balance vs expected
   - Highlight discrepancies >100 TL for investigation
   - Export for external reconciliation (Excel/CSV)

5. **Required change justification:**
   - When editing payment amount: Require "Reason for change" field
   - When deleting record: Require approval + justification
   - Store justification in audit log

**Detection:**
- Monthly automated reconciliation report
- Alert when: Financial record modified after 30 days old
- Track frequency of manual corrections (should decrease over time)

**Phase:** Phase 2 (Financial Tracking) - Build audit trail from day one. Cannot retrofit.

**Confidence:** HIGH - Financial audit trail is standard accounting practice.

**Sources:**
- [11 Common Accounting Problems (And How to Finally Fix Them in 2026)](https://www.spendflo.com/blog/accounting-problems)

---

## Low Priority Pitfalls

### Pitfall 12: Campaign Targeting Too Broad Wastes Opportunities

**Risk:** Marketing creates campaign: "20% off all products!" Sends to all 700 dealers. Half the dealers never buy those product categories. Campaign seen as spam. Real opportunities missed (could have targeted high-value segment with personalized offer).

**What Goes Wrong:**
- No segmentation capability in campaign system
- Cannot target by dealer group, purchase history, or behavior
- All campaigns blast to all dealers
- No A/B testing of campaign messaging
- Cannot measure campaign effectiveness per segment

**Prevention:**

1. **Build segmentation into campaign schema:**
   ```sql
   CREATE TABLE campaigns (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     title TEXT NOT NULL,
     description TEXT,
     discount_percent DECIMAL(5,2),
     start_date TIMESTAMPTZ NOT NULL,
     end_date TIMESTAMPTZ NOT NULL,
     is_active BOOLEAN DEFAULT true,
     -- Targeting
     target_dealer_groups UUID[], -- NULL = all groups
     target_dealers UUID[], -- Specific dealers
     min_lifetime_spend DECIMAL(12,2), -- Only dealers who spent >X
     category_filter UUID[], -- Relevant to dealers who buy these categories
     created_by UUID REFERENCES users(id),
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. **Smart campaign suggestions:**
   - "This campaign targets Kategori X. 45 dealers have ordered from this category."
   - "Suggest: Target Altın group dealers only (highest LTV)"
   - "Warn: Last campaign to this segment was 3 days ago"

3. **Campaign effectiveness tracking:**
   - Track: Views, clicks, orders placed using campaign
   - Conversion rate by dealer segment
   - Revenue attributed to campaign
   - A/B test different discount levels

4. **Gradual rollout:**
   - Test campaign with small segment first (10%)
   - Monitor performance before full rollout
   - Adjust messaging based on initial results

**Phase:** Phase 3 (Campaigns) - Basic segmentation in MVP, advanced targeting later.

**Confidence:** MEDIUM - Campaign segmentation best practices from marketing automation applied to B2B context.

---

### Pitfall 13: FAQ System Not Integrated with Messaging Creates Duplicate Work

**Risk:** Dealer asks question via messaging. Admin answers. Same question asked by 5 more dealers. Admin answers manually each time. FAQ section exists but nobody uses it because it's disconnected from support flow.

**Prevention:**

1. **Integrated FAQ suggestion:**
   - When dealer types message, suggest relevant FAQ articles
   - "Before sending, check these articles: [relevant FAQ]"
   - Admin can reply with FAQ link + custom message

2. **Convert messages to FAQ:**
   - Admin UI: "Create FAQ from this conversation"
   - One-click creates FAQ article from message thread
   - Track: Which FAQs originated from support messages

3. **FAQ analytics:**
   - Track: Most viewed FAQ articles, search terms with no results
   - Identify gaps: Common questions without FAQ coverage
   - Update FAQ based on actual dealer questions

**Phase:** Phase 4 (Support) - Basic FAQ first, integration with messaging later.

**Confidence:** MEDIUM - FAQ best practices from customer support systems.

---

## Phase-Specific Research Recommendations

### Phase 1: Dashboard Foundation - Research Complete
Current research adequate for dashboard implementation. Focus on RLS verification and query performance optimization.

### Phase 2: Financial Tracking - Deep Research Recommended
**Required research topics:**
- Turkish accounting standards for cari hesap tracking
- ERP systems commonly used by Turkish manufacturers (Logo, Netsis, Mikro, etc.)
- ERP-ready schema requirements for future integration
- Financial data retention and compliance requirements in Turkey

**Why:** Financial features are high-risk legally and relationally. Understanding Turkish business context critical.

### Phase 3: Campaigns & Announcements - Research Complete
Current research provides adequate guidance. Focus on notification best practices and segmentation.

### Phase 4: Support & Messaging - May Need Research
**Potential research topics if building full support system:**
- Support ticketing system architecture
- SLA management best practices
- Integration with existing tools (email, WhatsApp Business API)

---

## Summary: Critical Decisions for v2.0

Based on pitfall research, these decisions MUST be made correctly:

1. **Financial data RLS policies**: Every financial query MUST filter by dealer_id - test exhaustively
2. **Dashboard aggregation strategy**: Pre-aggregate with materialized views, refresh hourly, cache aggressively
3. **Audit logging**: Comprehensive audit trail for all financial data changes from day one
4. **Notification preferences**: Separate transactional vs marketing, frequency caps, quiet hours
5. **PDF generation**: Async generation + caching, never synchronous in request handler
6. **Messaging workflow**: SLA tracking, assignment, categorization before launching feature
7. **Cargo tracking scope**: Start manual, add automation incrementally based on usage
8. **Next.js caching**: Force dynamic rendering for dealer pages, never cache dealer-specific data

These cannot be easily retrofitted. Getting them wrong creates trust issues, performance problems, or legal liability.

---

## Research Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Financial RLS security | HIGH | Multi-tenant financial data security extensively documented |
| Dashboard performance | HIGH | PostgreSQL aggregation optimization well-established |
| Manual entry errors | HIGH | Accounting system pitfalls well-documented |
| PDF generation | MEDIUM | General best practices, B2B invoice context inferred |
| Notification spam | HIGH | 2026 push notification best practices comprehensive |
| Messaging workflow | MEDIUM | Support system patterns adapted to B2B dealer context |
| Cargo tracking | MEDIUM | B2B portal guides mention complexity, details inferred |
| Favorites design | MEDIUM | E-commerce wishlist patterns adapted to B2B with dealer pricing |
| Next.js caching | HIGH | Next.js 14+ caching behavior extensively documented for 2026 |
| Materialized views | HIGH | Supabase/PostgreSQL materialized view strategies well-documented |

---

## Sources

### Financial Data Security & Multi-Tenancy
- [Multi-Tenant Leakage: When Row-Level Security Fails in SaaS](https://instatunnel.my/blog/multi-tenant-leakage-when-row-level-security-fails-in-saas)
- [Multi-Tenant Applications with RLS on Supabase](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/)
- [Multi-Tenant Security: Definition, Risks and Best Practices](https://qrvey.com/blog/multi-tenant-security/)
- [Multi-Tenant Access Control: Safeguarding Sensitive Data](https://jumpcloud.com/blog/multi-tenant-access-control)
- [Compliant B2B Data: A 2026 Guide to Privacy and Quality Standards](https://persana.ai/blogs/compliant-b2b-data)

### Dashboard Performance & PostgreSQL Optimization
- [Postgres for Analytics Workloads: Capabilities and Performance Tips](https://www.epsio.io/blog/postgres-for-analytics-workloads-capabilities-and-performance-tips)
- [Scalable incremental data aggregation on Postgres and Citus](https://www.citusdata.com/blog/2018/06/14/scalable-incremental-data-aggregation/)
- [Optimize Read Performance in Supabase with Postgres Materialized Views](https://dev.to/kovidr/optimize-read-performance-in-supabase-with-postgres-materialized-views-12k5)
- [Using Materialized Views for RLS in Supabase: Best Practices and UI Limitations](https://github.com/orgs/supabase/discussions/17790)
- [How to Use Materialized Views in PostgreSQL](https://oneuptime.com/blog/post/2026-01-25-use-materialized-views-postgresql/view)

### Manual Data Entry & Financial System Errors
- [The Pitfalls of Immature Payrolls: Manual Data Entry](https://www.linkedin.com/pulse/pitfalls-immature-payrolls-manual-data-entry-ian-giles-hc0be)
- [11 Common Accounting Problems (And How to Finally Fix Them in 2026)](https://www.spendflo.com/blog/accounting-problems)
- [How Manual Data Entry and Human Error Are Costing You Money](https://www.connectpointz.com/blog/manual-data-entry-costing-you-money)

### PDF Generation & Invoicing
- [Most Common Invoicing Mistakes & How to Fix Them in 2025](https://quickbooks.intuit.com/r/invoicing/invoice-mistakes/)
- [B2B Invoicing Best Practices: Tips for Faster Payments in 2025](https://www.paystand.com/blog/b2b-invoicing)

### Push Notifications & Engagement
- [14 Push Notification Best Practices for 2026](https://reteno.com/blog/push-notification-best-practices-ultimate-guide-for-2026)
- [App Push Notification Best Practices for 2026](https://appbot.co/blog/app-push-notifications-2026-best-practices/)
- [Why Most Mobile Push Notification Architecture Fails](https://www.netguru.com/blog/why-mobile-push-notification-architecture-fails)
- [Notification Service Design | The Ultimate Guide with Diagrams](https://www.pingram.io/blog/notification-service-design-with-architectural-diagrams)
- [Why building a scalable notification system is complex?](https://engagespot.co/blog/why-building-a-notification-system-is-complex)

### B2B Portal & Dealer Experience
- [Self-Serve Dealer Portals: Transform B2B Relationships in 2026](https://www.shopaccino.com/blog/how-b2b-brands-can-improve-dealer-relationships-with-selfserve-ordering-portals)
- [The Complete Guide to B2B Dealer Portals](https://oroinc.com/b2b-ecommerce/blog/the-complete-guide-to-b2b-dealer-portals/)
- [Top 7 B2B Marketplace Features in 2026](https://www.rigbyjs.com/blog/b2b-marketplace-features)

### Cargo Tracking & Logistics
- [Cargo at B2B Companies on Special Days](https://www.trizbi.com/en/blog/cargo-at-b2b-companies-on-special-days)
- [B2B Freight in 2026: Trends, Challenges & Future of Shipping](https://www.aajswift.com/blog/b2b-freight)

### Next.js Caching & Performance
- [The Hidden Complexity of Data Caching in Next.js 16](https://medium.com/@lilyanaldimashki/the-hidden-complexity-of-data-caching-in-next-js-16-4f57c9ef0a00)
- [Next.js Caching and Rendering: Complete Guide for 2026](https://dev.to/marufrahmanlive/nextjs-caching-and-rendering-complete-guide-for-2026-ij2)
- [Caching & Revalidation in Next.js: ISR, fetch Cache & Real Production Patterns](https://medium.com/@chandansingh73718/caching-revalidation-in-next-js-isr-fetch-cache-real-production-patterns-7433354a2591)

### Database Design & Best Practices
- [Wishlists Design - How to design Wishlists for E-Commerce?](https://thestory.is/en/journal/designing-wishlists-in-e-commerce/)
- [10 Common Mistakes in Database Design](https://chartdb.io/blog/common-database-design-mistakes)
- [Database Design Bad Practices](https://www.toptal.com/developers/database/database-design-bad-practices)
