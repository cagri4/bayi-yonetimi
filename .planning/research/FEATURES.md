# Feature Research: v3.0 - Multi-Tenant SaaS + AI Agent Ecosystem

**Domain:** B2B Dealer Management SaaS + AI Digital Worker Ecosystem
**Project:** Bayi Yönetimi v3.0
**Researched:** 2026-03-01
**Overall Confidence:** MEDIUM-HIGH

---

## Summary

This research maps the feature landscape for two distinct but tightly coupled capabilities: (1) the **multi-tenant SaaS infrastructure** that makes the existing product sellable to multiple companies, and (2) the **12 AI digital worker ecosystem** accessible via Telegram/Claude API.

**Key Research Findings:**

1. **Multi-tenant isolation via shared schema + company_id + RLS is the right tier for this scale** — Dedicated databases per tenant are overkill until 50+ paying tenants. Shared schema with row-level security (PostgreSQL RLS) is the standard pattern for B2B SaaS up to hundreds of tenants. Supabase RLS is designed for exactly this use case. (HIGH confidence — AWS, Azure, Microsoft Dynamics documentation all confirm this.)

2. **Agent-per-role (not general assistant) is the correct architecture** — Research shows multi-agent systems with specialized agents per business role achieve 45% faster problem resolution and 60% better accuracy than single general-purpose agents. Each agent having its own tool set and decision scope is the established pattern. (MEDIUM confidence — validated by Anthropic multi-agent docs and B2B AI platform patterns.)

3. **Telegram is the right choice for Turkish B2B agent channel** — Telegram surpassed 1 billion users in 2025. Turkish businesses heavily use Telegram for business communication. High open rates vs. email. Bot API is mature. Webhook (not polling) required for production at scale. (MEDIUM confidence — general Telegram growth data is solid, Turkish-specific data from secondary sources.)

4. **Claude tool calling is the right AI backbone** — Anthropic's tool calling with strict JSON schema validation is production-ready. The Tool Search Tool feature (2026) allows on-demand tool discovery, preventing context window exhaustion for agents with many tools. Programmatic tool calling reduces latency for multi-tool workflows. (HIGH confidence — verified with Anthropic official docs.)

5. **Agent conversation memory requires a dedicated pattern** — Stateless LLM + external persistent memory is the production standard. Three types needed: episodic (past interactions), semantic (domain facts), and procedural (learned preferences). Supabase PostgreSQL can serve as the memory store without additional infrastructure. Mem0 research shows 26% higher accuracy with persistent memory. (MEDIUM confidence — multiple credible sources agree on pattern.)

6. **Agent-to-agent communication should use function-call handoff, not A2A protocol** — Google's A2A protocol is designed for cross-vendor multi-agent systems. For a self-contained system where all agents share the same codebase, direct tool-call-based handoff (Agent A calls `escalate_to_agent_B(context)` tool) is simpler, faster, and more reliable. A2A adds complexity without benefit when all agents are co-located. (MEDIUM confidence — A2A vs. function-call comparison from multiple sources.)

7. **The build order is infrastructure-first, then agents by business criticality** — Multi-tenant infrastructure MUST precede any agent work. Sales and Accounting agents have the highest ROI for B2B and should be built first. Trainer and Executive Advisor are lowest complexity and highest "demo value" — good for showcasing. (MEDIUM confidence — derived from B2B AI platform adoption patterns.)

---

## Part 1: Multi-Tenant SaaS Infrastructure

### Table Stakes

Features the product MUST have to be sellable as a multi-tenant SaaS.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Company table + company_id on all tables** | Every SaaS tenant needs logical isolation. Without company_id, data bleeds between tenants — catastrophic. | MEDIUM | Add `companies` table. Add `company_id uuid REFERENCES companies(id)` to all existing tables: dealers, products, orders, order_items, campaigns, announcements, support_messages, financials, etc. Single migration. |
| **RLS policies updated to be company-aware** | Existing RLS only checks `auth.uid()`. For multi-tenant, also need `company_id` check. Otherwise tenant A's admin can read tenant B's data. | HIGH | Every existing RLS policy must be updated. Pattern: `dealer_id = auth.uid() AND company_id = get_user_company_id()`. Need a `get_user_company_id()` SECURITY DEFINER function (same pattern as existing `is_admin()`). |
| **Company-scoped admin authentication** | Admin login must scope to the right company. Currently there's one admin; now each company has its own admin(s). | MEDIUM | Add `company_id` to auth user metadata or `admins` table. Login redirects to company-specific admin panel. URL routing: `/[company_slug]/admin/` or subdomain per company. |
| **Company onboarding flow** | SaaS operator (you) needs to create new tenant companies and configure them. | MEDIUM | Admin-of-admins "super admin" role that can create companies, set limits, manage subscriptions. Not dealer-visible. |
| **Company-scoped Supabase Storage buckets** | File uploads (invoices, product images) must be isolated per company. Cross-tenant file access = data breach. | LOW | Enforce `/companies/{company_id}/...` prefix in all storage paths. Update Storage RLS policies to include company_id check. |
| **Dealer registration scoped to company** | When dealer registers or is invited, they must be associated with correct company. | LOW | Invitation flow: admin generates invite link with company_id embedded. Dealer registers and is auto-associated. |

### Differentiators

Features that make the multi-tenant product more competitive.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Company-specific branding (logo, colors)** | Each tenant company can display their own logo and primary color in the portal. White-label feel. | LOW | Add `logo_url`, `primary_color`, `company_name` to companies table. CSS custom properties via server-side injection. |
| **Per-company feature flags** | Some tenants need Campaigns, others don't. Feature flags per company allow graduated rollout and tiered pricing. | MEDIUM | `company_features` table: `{company_id, feature_name, enabled}`. Gate features with `hasFeature('campaigns')` check. |
| **Usage metering foundation** | Track per-tenant usage (orders/month, dealers, AI queries) for billing purposes. | MEDIUM | `company_usage_events` table. Log order creations, agent queries, etc. Foundation for Stripe metering billing in v4. |
| **Company subdomain routing** | `acme.bayiapp.com` feels more professional than `bayiapp.com/acme/`. | HIGH | Requires Vercel Edge Config or middleware for subdomain routing. Defer unless explicitly needed. |

### Anti-Features

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| **Separate database per tenant from day 1** | "Maximum isolation, compliance ready" | Over-engineering for <50 tenants. 10x ops cost. Schema migrations require per-tenant execution. | Shared schema + RLS. Migrate to dedicated DB only when a tenant requires SOC2/HIPAA compliance — post v4. |
| **Tenant self-service signup** | "Scale automatically without sales" | Unmoderated SaaS signups = abuse, bad data, support burden. With 700 dealers at one company, you want managed onboarding. | Manual tenant onboarding by super admin for v3. Automate only when there are 10+ paying tenants. |
| **Complex role hierarchy (super admin → company admin → manager → dealer)** | "Enterprise permission system" | 4-tier RBAC requires 4x the RLS policy logic and testing. Current 2-tier (admin/dealer) is sufficient. | Keep 2 tiers per company (admin/dealer) + super admin role. Add manager tier only when a specific tenant needs it. |

---

## Part 2: Agent Infrastructure (Shared Foundation)

All 12 agents depend on this infrastructure. It MUST be built before any individual agent.

### Table Stakes — Agent Infrastructure

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Claude API integration (tool calling)** | All agents use Claude as the reasoning engine. Tool calling is how agents interact with the database and existing business logic. | MEDIUM | `@anthropic-ai/sdk` package. Tool definitions as JSON schemas wrapping existing Server Actions. `strict: true` for all tools. Each agent has its own system prompt + tool set. |
| **Telegram Bot connection (webhook mode)** | All 12 agents are accessed via Telegram. Webhook mode (not polling) required for production to handle concurrent users. | MEDIUM | `grammy` or `telegraf` library. `/api/telegram/webhook` Next.js Route Handler. Bot token stored as env var. One bot = one entry point, routes to correct agent based on command or chat type. |
| **User-to-agent routing** | Telegram users need to reach the right agent. A dealer asking about orders goes to Sales Agent, not Warehouse Agent. | MEDIUM | Routing layer: parse `/start satis` or menu buttons. Admin users can access all agents. Dealer users scoped to dealer-relevant agents (Sales, Trainer). Company association from Telegram `user_id` → lookup in DB. |
| **Agent conversation state (session)** | Claude is stateless. Each message needs conversation history to maintain context. Without state, every message starts fresh — poor UX. | MEDIUM | `agent_sessions` table: `{id, telegram_user_id, agent_role, company_id, messages JSONB, created_at, updated_at}`. Load last N messages as context on each turn. |
| **Agent long-term memory** | Agents must remember facts across sessions: "Dealer X always orders on Monday", "Supplier Y has 2-week delays". Without memory, agents feel dumb. | MEDIUM | `agent_memory` table: `{id, agent_role, company_id, subject_id, memory_type, content, created_at}`. Memory types: episodic (past events), semantic (facts), preference (learned patterns). Agent writes memories after significant interactions. Agent reads relevant memories at session start via similarity search or direct lookup. |
| **Tool wrapper layer (Server Actions → Agent Tools)** | Existing business logic lives in Next.js Server Actions. Agents need these as tools. | HIGH | Each agent's tools call existing Server Actions or Supabase queries directly. No duplication — tools are thin wrappers. Example: `get_dealer_orders(dealer_id, status)` tool calls existing order query. |
| **Agent authorization / company scoping** | Agent tools must respect multi-tenant isolation. Agent for Company A must NEVER access Company B data. | HIGH | Every tool call must include `company_id` from the authenticated session context. Same RLS policies apply. Tools get `company_id` from `agent_sessions` record, not from user input (prevents injection). |
| **Telegram user authentication** | Linking a Telegram user to a dealer/admin record in the database. Without auth, anyone can message the bot. | MEDIUM | Registration flow: dealer opens bot → sends `/start` → bot asks for verification code → code sent to email → dealer enters code → Telegram `user_id` linked to dealer record. |
| **Structured tool response format** | Claude needs tool responses in consistent format to reason correctly. | LOW | Standardize all tool responses: `{success: boolean, data: any, error?: string}`. Include metadata: `{record_count, truncated, next_page_token}` for paginated results. |

### Differentiators — Agent Infrastructure

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Agent activity logging** | Full audit trail of what each agent did, what tools it called, what decisions it made. Essential for debugging and compliance. | LOW | `agent_activity_log` table: `{agent_role, tool_called, input_summary, output_summary, company_id, user_id, created_at}`. Not full messages (privacy) — just tool call events. |
| **Agent escalation protocol** | When Sales Agent can't resolve something, it escalates to a human admin via Telegram message. Clean handoff with context. | MEDIUM | Tool: `escalate_to_human(reason, context_summary)`. Sends message to company admin Telegram group. Marks session as `needs_human`. |
| **Multi-agent handoff (agent-to-agent)** | Sales Agent detects a financial dispute and routes to Accounting Agent with full context. Seamless for the user. | HIGH | Tool: `transfer_to_agent(target_agent, context)`. Creates new session for target agent with context prepopulated. User receives message: "Transferring to the Accounting Agent..." |
| **Proactive agent notifications** | Agents send Telegram messages proactively (e.g., "Stock Alert: Product X is running low"). Not just reactive to user messages. | MEDIUM | Scheduled jobs (Vercel Cron) trigger agent checks. Agent generates message and sends via `sendMessage` API. Each agent has configurable notification types. |

### Anti-Features — Agent Infrastructure

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| **One general-purpose "super agent"** | "Simpler to maintain, one system prompt" | General agents perform worse on specialized tasks. Context window fills up with all tools for all roles. 2026 research confirms specialized agents outperform generalists. | One agent per role. Shared infrastructure. Route to correct agent. |
| **Vector database for all memory** | "RAG for smart context recall" | Vector DB (Pinecone, Weaviate) is additional infrastructure, cost, and complexity. For 700 dealers, structured memories in PostgreSQL are sufficient and faster to query. | PostgreSQL agent_memory table with targeted queries. Add vector search only if memory recall becomes a bottleneck — post v4. |
| **Real-time voice/audio agents** | "Voice is the future" | Turkish speech-to-text quality still inconsistent. Voice adds latency, complexity, mobile data costs. Out of scope per PROJECT.md. | Text-only via Telegram. Defer voice to v4+. |
| **Fully autonomous agents with no human approval** | "AI should just do things" | For financial transactions, supplier orders, and collections, autonomous action without human approval creates risk. B2B requires audit trail. | Agents recommend and prepare actions. Human confirms for high-stakes operations. Low-stakes operations (lookups, reporting) can be fully autonomous. |
| **A2A (Google's Agent-to-Agent Protocol)** | "Industry standard for multi-agent" | A2A is designed for cross-vendor, cross-organization agent systems. Overhead is unjustified when all agents are in the same codebase. | Internal function-call handoff: Agent A calls `transfer_to_accounting_agent(context)` tool. Simpler, faster, fully within your control. |

---

## Part 3: The 12 AI Digital Workers

### Agent 1: Satis Temsilcisi (Sales Representative)

**Role:** Primary dealer-facing agent. Handles order taking, product recommendations, price queries, order status.

**User:** Dealers (via Telegram)

**Decision Authority:** Can confirm order details, suggest alternatives, apply dealer-group pricing. Cannot override pricing or approve credit.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Order taking via conversation** | Core value. Dealer messages: "200 adet A001 istiyorum" → Agent creates order. Replaces WhatsApp manual order taking. | MEDIUM | `create_order` tool wrapping existing order creation Server Action. Validates stock, pricing, MOQ. |
| **Product search and lookup** | "Kırmızı renkli 5 litrelik ürün var mı?" → Agent searches catalog and returns matching products with prices and stock. | LOW | `search_products(query, filters)` tool. Returns dealer-group price via existing `get_dealer_price` RPC. |
| **Order status queries** | "Son siparişim nerede?" → Agent returns current status, cargo tracking info if available. | LOW | `get_dealer_orders(dealer_id, limit)` tool. Natural language status formatting. |
| **Product stock inquiry** | "A001 stokta var mı?" → Agent returns stock level and estimated availability. | LOW | `get_product_stock(sku)` tool. |
| **Reorder from history** | "Geçen ay ne sipariş etmiştim? Aynısını tekrar ver" → Agent shows history and creates repeat order. | MEDIUM | `get_order_history(dealer_id)` + `create_order` tools. Confirmation step before placing. |
| **Upsell/cross-sell recommendations** | "Şunu da alabilirsin" — Agent recommends complementary products based on cart or purchase history. | MEDIUM | `get_product_recommendations(dealer_id, current_cart)` tool. Based on frequent co-purchase analysis or admin-defined bundles. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Personalized greeting and dealer context** | "Merhaba Ahmet Bey, Altın grup bayi. Son siparişiniz 5 gün önce teslim edildi." Agent knows who it's talking to. | LOW | Load dealer profile at session start. Include in system context. |
| **Minimum order warning** | Agent warns before order placement if cart is below MOQ. "Minimum sipariş tutarınız 500 TL, sepetiniz 320 TL." | LOW | MOQ check in `create_order` tool validation. |
| **Quick order mode** | Dealer sends product list as text block: "A001: 50, B002: 100, C003: 200" → Agent parses and creates multi-item order. | MEDIUM | Parser in tool that handles bulk text input formats. |
| **Campaign awareness** | Agent proactively mentions active campaigns relevant to what dealer is ordering. "Bu ay B grubunda %10 indirim var." | LOW | `get_active_campaigns(dealer_id)` tool called at session start. |

#### Anti-Features

| Anti-Feature | Why Avoid | Alternative |
|--------------|-----------|-------------|
| **Price negotiation** | Prices are fixed per dealer group. Agent negotiating creates inconsistency and margin erosion. | Agent explains pricing structure. Requests for special pricing go to human admin via escalation. |
| **Autonomous order placement without confirmation** | Accidental orders from misunderstood messages create returns and disputes. | Confirmation step: Agent summarizes order, dealer confirms with "Evet" or "Onayla". |

---

### Agent 2: Muhasebeci (Accountant)

**Role:** Financial transparency for dealers and admins. Cari hesap queries, invoice lookup, payment status.

**User:** Dealers (balance/invoice queries) + Admin (financial management)

**Decision Authority:** Can view and explain financial data. Cannot post transactions or modify balances (audit compliance).

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Cari hesap bakiye sorgusu** | "Borcum ne kadar?" → Agent returns current balance, credit/debit breakdown. Most common financial query. | LOW | `get_dealer_balance(dealer_id)` tool wrapping financial tables. |
| **Hesap hareketleri listesi** | "Son 3 aydaki hareketlerimi göster" → Agent returns transactions with dates, amounts, types. | LOW | `get_account_movements(dealer_id, date_range)` tool. |
| **Fatura sorgusu** | "Ocak ayı faturalarım nerede?" → Agent lists invoices with status (paid/unpaid) and download link. | MEDIUM | `get_invoices(dealer_id, filters)` tool. Returns signed Supabase Storage URLs for PDF download. |
| **Vadesi geçen alacak özeti (admin)** | Admin asks: "Bu ay vadesi geçen bayiler kimler?" → Agent returns ranked list with amounts and days overdue. | MEDIUM | `get_overdue_accounts(company_id, threshold_days)` tool. Aggregate query across all dealer financial records. |
| **Ödeme geçmişi** | "Son 6 aydaki ödemelerimi göster" → Agent returns payment history with dates and amounts. | LOW | `get_payment_history(dealer_id)` tool. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Financial summary for admin** | "Bu ayın tahsilat performansı nasıl?" → Agent provides KPI summary: total collected, DSO trend, top debtors. | MEDIUM | Aggregate queries across financial tables. Formatted natural language summary. |
| **Overdue escalation suggestions** | Agent proactively flags accounts needing attention: "5 bayi 60+ gün vadesi geçmiş, tahsilat bekliyor." Suggests which to escalate to Collections Agent. | MEDIUM | Triggers from cron job or admin query. Suggests but doesn't act. |
| **Payment reminder drafting** | Admin asks: "X bayisine ödeme hatırlatması yaz" → Agent drafts a polite Turkish-language payment reminder. | LOW | LLM generation with dealer financial data as context. Admin reviews and sends manually (or via Collections Agent). |

#### Anti-Features

| Anti-Feature | Why Avoid | Alternative |
|--------------|-----------|-------------|
| **Autonomous balance posting** | Entering debits/credits without human review = financial data errors that are hard to correct. | Agent READS only. Admin enters financial transactions via the web admin panel (existing feature). |
| **Real-time ERP sync** | ERP integration is v4.0 scope per PROJECT.md. | Manual entry workflow (existing). Agent reads what's in the DB, not ERP. Flag clearly: "Veriler son güncelleme: [timestamp]". |

---

### Agent 3: Depo Sorumlusu (Warehouse Manager)

**Role:** Stock management, order preparation status, inventory queries, low stock alerts.

**User:** Internal warehouse staff (via Telegram) + Admin

**Decision Authority:** Can update order preparation status, flag stock issues. Cannot approve purchases (that's Procurement Agent).

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Stok durumu sorgusu** | "A001 stokta kaç tane var?" → Agent returns current stock level. | LOW | `get_stock_level(sku_or_product_id)` tool. |
| **Sipariş hazırlama listesi** | "Bugün hazırlanacak siparişler neler?" → Agent lists orders in "Onaylandı" status ready for preparation. | LOW | `get_orders_for_preparation(company_id, date)` tool. Filter: status = 'onaylandı' or 'hazirlaniyor'. |
| **Sipariş durumu güncelleme** | Warehouse worker messages: "Sipariş #123 hazır" → Agent updates status to 'Hazirlaniyor' or 'Kargoya Verildi'. | MEDIUM | `update_order_status(order_id, new_status, notes)` tool wrapping existing status update logic. Sends existing push notification. |
| **Stok güncelleme** | "A001 stok 500 yap" → Agent updates stock level. | MEDIUM | `update_stock_level(product_id, new_quantity, reason)` tool. Reason logged for audit. |
| **Kritik stok alarmı** | "Hangi ürünlerin stoğu kritik seviyede?" → Agent returns products below reorder threshold. | LOW | `get_low_stock_products(company_id, threshold_ratio)` tool. Threshold: stock < 20% of typical monthly demand. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Günlük hazırlama briefing** | Every morning, agent sends warehouse team a Telegram message with: today's orders to prepare, low stock alerts, special handling notes. | MEDIUM | Vercel Cron 08:00 trigger. Proactive notification. Replaces manual briefing emails. |
| **Order picking list generation** | "Sipariş #123 için toplama listesi" → Agent generates formatted list of items to pick: SKU, location, quantity. | MEDIUM | `generate_picking_list(order_id)` tool. Location data requires warehouse location tracking (new field on products: `shelf_location`). |
| **Procurement agent handoff** | When stock drops to reorder point, Warehouse Agent notifies Procurement Agent automatically. | MEDIUM | Calls `notify_procurement_agent(product_id, current_stock, reorder_point)` tool. Creates a task for Procurement Agent. |

#### Anti-Features

| Anti-Feature | Why Avoid | Alternative |
|--------------|-----------|-------------|
| **Physical robotics/IoT integration** | Barcode scanners, conveyor belt control. Out of scope for software agent. | Manual text input from warehouse workers. "A001 stok 500" type commands. |
| **Autonomous supplier ordering** | Warehouse Agent detects low stock and automatically creates PO. Purchasing decisions need human review. | Warehouse Agent alerts Procurement Agent. Procurement Agent prepares PO draft for human approval. |

---

### Agent 4: Saha Satis Sorumlusu (Field Sales Manager)

**Role:** Route planning for field reps, dealer visit logging, sales target tracking, visit performance analysis.

**User:** Field sales reps (via Telegram) + Admin

**Decision Authority:** Can log visits, update call notes, view targets. Cannot change dealer pricing or approve special deals.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Günlük rut planı** | "Bugün kimleri ziyaret edeyim?" → Agent returns optimized visit list based on priority (last visit date, outstanding balance, order frequency). | MEDIUM | `get_daily_visit_plan(sales_rep_id, date)` tool. Dealer priority scoring: days since last visit, outstanding balance, order recency. New table: `dealer_visits`. |
| **Ziyaret kaydı** | "Ahmet Bayi ziyareti tamamlandı. Notlar: Yeni depo açıyor, ek raf alanı istiyor." → Agent logs visit with notes. | LOW | `log_dealer_visit(dealer_id, sales_rep_id, notes, outcome)` tool. New table: `dealer_visits`. |
| **Satış hedefi takibi** | "Bu ay hedefimin yüzde kaçındayım?" → Agent returns rep's target vs. actual. | LOW | `get_sales_target_progress(sales_rep_id, period)` tool. Requires `sales_targets` table (new). |
| **Bayi bilgi kartı** | "Mehmet Şeker Bayi hakkında bilgi ver" → Agent returns dealer profile, order history summary, outstanding balance, last visit date. | LOW | `get_dealer_summary(dealer_id)` tool. Aggregates dealer data, orders, financials, visit history. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Ziyaret öncesi brifing** | "Yarın 10 bayi ziyaretim var, hazırlık notu" → Agent generates briefing per dealer: last order, outstanding amount, pending issues, suggested products to push. | MEDIUM | Pre-visit report combining dealer data + active campaigns + low-stock products. |
| **Performans karşılaştırması (admin)** | Admin: "Bu ay en iyi saha satış temsilcisi kim?" → Agent compares rep performance by visits, orders generated, conversion rate. | MEDIUM | Aggregate queries across `dealer_visits` + `orders` by `created_by`. |
| **Bölge analizi** | "İzmir bölgesinde sipariş trendi nasıl?" → Agent analyzes orders grouped by dealer geography. | MEDIUM | Requires dealer location data (city/region field). Currently may not exist. Flag as needing schema addition. |

#### Anti-Features

| Anti-Feature | Why Avoid | Alternative |
|--------------|-----------|-------------|
| **GPS tracking of field reps** | Privacy concerns, union issues, requires mobile app integration. | Manual check-in: rep messages "Ahmet Bayi'deyim" to log location contextually. |
| **Automated lead generation** | Finding new dealers is a strategic sales decision, not a field agent task. | Field Agent focuses on existing dealer visits. New dealer acquisition via admin/marketing. |

**New Database Requirements:**
- `dealer_visits` table: `{id, dealer_id, sales_rep_id, company_id, visited_at, notes, outcome, created_at}`
- `sales_targets` table: `{id, sales_rep_id, company_id, period, target_amount, created_at}`

---

### Agent 5: Dagitim Koordinatoru (Distribution Coordinator)

**Role:** Own-fleet delivery planning, route optimization, driver management, real-time delivery tracking.

**User:** Distribution manager + drivers (via Telegram) + Admin

**Decision Authority:** Can assign deliveries to vehicles/drivers, update delivery status. Cannot authorize vehicles outside fleet.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Teslimat listesi oluşturma** | "Bugün teslim edilecek siparişler" → Agent lists orders in 'Kargoya Verildi' status, groups by region for efficient routing. | LOW | `get_delivery_queue(company_id, date)` tool. Groups by dealer geography. |
| **Araç-sürücü ataması** | "Sipariş #123, #124, #125 Mehmet'e ata, 34 ABC 123 plakalı araç" → Updates cargo tracking on orders. | MEDIUM | `assign_delivery(order_ids[], driver_name, vehicle_plate)` tool. Updates existing `cargo_tracking` fields on orders. |
| **Teslimat durumu güncelleme** | Driver messages: "Sipariş #123 teslim edildi" → Agent updates order to 'Teslim Edildi', triggers dealer notification. | LOW | `confirm_delivery(order_id, notes)` tool. Triggers existing push notification to dealer. |
| **Teslim edilemedi kaydı** | "Sipariş #124 teslim edilemedi, bayi kapalıydı" → Agent logs failed attempt, schedules re-delivery. | MEDIUM | `log_failed_delivery(order_id, reason, reschedule_date)` tool. New status: 'Teslim Edilemedi'. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Rut önerisi** | "Yarın İzmir bölgesinde 8 teslimat var, optimal rut öner" → Agent groups deliveries by geography and suggests ordering to minimize travel. | HIGH | Requires dealer address data (latitude/longitude). Calls Google Maps Distance Matrix API or simple geographic clustering. HIGH complexity — defer until dealer location data exists. |
| **Günlük teslimat briefi** | Morning proactive message to distribution manager: today's delivery count, vehicle assignments, special handling notes. | MEDIUM | Cron trigger. Aggregates delivery queue. |
| **Teslim oranı raporlaması** | "Bu haftanın teslimat başarı oranı nedir?" → Agent calculates on-time delivery rate, failed delivery reasons. | LOW | Aggregate query: delivered / total orders in date range. |

**New Database Requirements:**
- `delivery_attempts` table: `{id, order_id, attempt_date, status, reason, driver_name, vehicle_plate, company_id}`

---

### Agent 6: Tahsilat Uzmani (Collections Specialist)

**Role:** Overdue account management, payment reminder generation, escalation workflow for bad debt.

**User:** Admin / collections team (via Telegram)

**Decision Authority:** Can send payment reminders (draft + human approval or auto-send based on days overdue tier), flag accounts for escalation. Cannot write off debt or adjust balances.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Vadesi geçmiş hesaplar listesi** | "Bugün hangi bayileri arayacağım?" → Agent returns prioritized list: 90+ days first, then 60+, then 30+. | LOW | `get_overdue_accounts(company_id, min_days_overdue)` tool. Sorted by days overdue × amount. |
| **Ödeme hatırlatması hazırlama** | "Ahmet Bayi için ödeme hatırlatması oluştur" → Agent drafts a firm but professional Turkish SMS/message with amount and due date. | LOW | LLM generation with financial data as input. Returns draft. Admin approves and sends. |
| **Tahsilat geçmişi** | "Ahmet Bayi ile son 3 ayda ne görüştük?" → Agent returns all payment conversations, promises, amounts collected. | LOW | `get_collection_history(dealer_id)` tool. Requires `collection_activities` table. |
| **Toplu hatırlatma** | "30 günü geçmiş tüm bayilere standart hatırlatma gönder" → Agent prepares batch, admin confirms, then sends. | MEDIUM | Batch draft generation. Requires admin bulk-confirm before sending. NEVER auto-send without approval. |
| **Ödeme taahhüdü kaydı** | "Ahmet Bey Salı günü ödeyeceğini söyledi" → Agent logs the promise with follow-up date. | LOW | `log_payment_promise(dealer_id, promised_date, promised_amount, notes)` tool. New `collection_activities` table. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Tahsilat risk skoru** | Agent scores each overdue dealer: payment history pattern, current amount, order activity. "Yüksek risk" vs "Düşük risk". | MEDIUM | Scoring model based on: days overdue, amount, past payment behavior, recent order activity (if ordering but not paying = high risk). |
| **DSO (Days Sales Outstanding) takibi** | "Bu ay DSO'muz kaç gün?" → Agent calculates DSO metric and compares to previous months. | MEDIUM | DSO = (Accounts Receivable / Total Credit Sales) × Days. Requires aggregation across financial tables. |
| **Bayi Muhasebeci entegrasyonu** | Collections Agent hands off to Accounting Agent for formal dispute handling. | LOW | `transfer_to_accounting_agent(context)` tool call. |

**New Database Requirements:**
- `collection_activities` table: `{id, dealer_id, company_id, activity_type (call/message/promise/payment), notes, promised_amount, promised_date, performed_by, created_at}`

#### Anti-Features

| Anti-Feature | Why Avoid | Alternative |
|--------------|-----------|-------------|
| **Autonomous sending of payment demands** | Auto-sent aggressive messages can damage dealer relationships permanently. | Agent drafts messages. Human approves before sending. Auto-send only for mild reminders (7-day overdue) with explicit admin opt-in toggle. |
| **Legal action automation** | Legal escalation requires human judgment, documentation, and compliance knowledge. | Agent flags for legal review: "Bu hesap avukata yönlendirilmeli." Human decides. |

---

### Agent 7: Satin Alma Sorumlusu (Procurement Manager)

**Role:** Supplier order management, stock replenishment decisions, purchase order creation, supplier performance tracking.

**User:** Admin / procurement team (via Telegram)

**Decision Authority:** Can recommend purchase orders with quantities and suppliers. Cannot approve orders above threshold without human confirmation.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Yenileme ihtiyacı analizi** | "Hangi ürünler yeniden sipariş gerektirir?" → Agent analyzes stock levels vs. reorder points, shows which products need ordering. | MEDIUM | `get_reorder_candidates(company_id)` tool. Compares current stock to `reorder_point` field on products (new field needed). |
| **Tedarikçi siparişi taslağı** | "A grubu ürünleri için tedarikçi siparişi oluştur" → Agent generates PO draft with quantities based on reorder points and current demand trends. | MEDIUM | `draft_purchase_order(product_ids[], supplier_id)` tool. New `purchase_orders` and `suppliers` tables needed. |
| **Tedarikçi listesi** | "Hangi tedarikçilerle çalışıyoruz?" → Agent returns supplier list with last order date, lead time, performance notes. | LOW | `get_suppliers(company_id)` tool. New `suppliers` table. |
| **Satın alma geçmişi** | "Geçen 3 ayda hangi ürünleri tedarikçiden aldık?" → Agent returns PO history with dates, quantities, costs. | LOW | `get_purchase_history(company_id, date_range)` tool. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Talep tahmini** | "A001 için gelecek ay ne kadar sipariş etmeliyim?" → Agent analyzes historical order patterns to estimate next month's demand. | HIGH | Time series analysis of `order_items` by product. Simple: average last 3 months. Advanced: seasonality detection. Flag as HIGH complexity. |
| **Tedarikçi performans takibi** | "Tedarikçi X son teslimat gecikmelerini özetler misin?" → Agent summarizes supplier delivery history. | MEDIUM | Requires logging of expected vs. actual receipt dates on purchase orders. |
| **Depo Sorumlusu entegrasyonu** | When Warehouse Agent flags critical low stock, Procurement Agent receives automated task and responds with estimated restock timeline. | MEDIUM | Agent-to-agent notification via `agent_task_queue` table. |

**New Database Requirements:**
- `suppliers` table: `{id, company_id, name, contact_info, lead_time_days, notes, created_at}`
- `purchase_orders` table: `{id, company_id, supplier_id, status, items JSONB, expected_date, created_by, created_at}`
- `reorder_point` field on `products` table

#### Anti-Features

| Anti-Feature | Why Avoid | Alternative |
|--------------|-----------|-------------|
| **Autonomous PO submission to suppliers** | Unreviewed automatic orders can result in wrong quantities, wrong products, budget overruns. | Agent creates PO draft. Admin reviews and approves. Only after approval does agent (or human) submit to supplier. |

---

### Agent 8: Pazarlamaci (Marketing Manager)

**Role:** Campaign creation assistance, dealer segmentation analysis, announcement drafting, promotional performance reporting.

**User:** Admin / marketing team (via Telegram)

**Decision Authority:** Can draft and schedule campaigns. Cannot publish without admin approval.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Kampanya taslağı oluşturma** | "Altın grubu bayiler için Mayıs kampanyası oluştur. %15 indirim, 2 hafta süre" → Agent drafts campaign with title, description, target segment, dates. | LOW | `draft_campaign(title, description, target_group, start_date, end_date)` tool. Wraps existing campaign creation. Admin reviews and publishes. |
| **Bayi segmentasyonu** | "Son 3 ayda sipariş vermeyen bayiler kimler?" → Agent analyzes order patterns and returns segment. | MEDIUM | `get_dealer_segments(company_id, criteria)` tool. Criteria: dormant (no order in X days), high-value (top 20% by spend), at-risk (declining order frequency). |
| **Duyuru taslağı** | "Yeni ürün lansmanı için duyuru yaz. Ürün: XYZ, özellikler: ..." → Agent drafts announcement text. | LOW | LLM generation with product details as input. Admin edits and publishes via web panel. |
| **Kampanya performans raporu** | "Nisan kampanyası kaç bayi tarafından görüldü? Kampanya döneminde sipariş arttı mı?" → Agent reports campaign views and order lift. | MEDIUM | `get_campaign_performance(campaign_id)` tool. Compares order volumes in campaign period vs. before. Requires `campaign_views` tracking (may need to be added). |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Segment bazlı mesajlaşma** | "Dormant bayilere geri dönüş mesajı yaz" → Agent drafts personalized re-engagement messages for each segment. | MEDIUM | LLM generation for each segment with segment-specific data as input. |
| **Ürün Yoneticisi entegrasyonu** | Marketing Agent requests product data from Product Manager Agent for campaign creation. | LOW | `get_product_details_for_campaign(product_ids[])` tool call. |
| **Mevsimsel kampanya önerileri** | "Bu ay için kampanya önerisi ver" → Agent analyzes seasonal sales patterns and recommends relevant campaigns. | HIGH | Historical order analysis by month/season. HIGH complexity — defer. |

---

### Agent 9: Urun Yoneticisi (Product Manager)

**Role:** Catalog management assistance, pricing strategy, product performance analysis, new product onboarding.

**User:** Admin / product team (via Telegram)

**Decision Authority:** Can draft product updates. Cannot publish price changes or add products without admin approval.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Ürün performans analizi** | "En çok satan 10 ürün neler?" → Agent returns product ranking by revenue/volume in specified period. | LOW | `get_product_performance(company_id, period, metric)` tool. Aggregates `order_items`. |
| **Stok-satış oranı analizi** | "Hangi ürünlerin elde kalma süresi çok uzun?" → Agent calculates inventory turnover per product. | MEDIUM | `get_inventory_turnover(company_id)` tool. Days on hand = (current_stock / avg_daily_sales). |
| **Fiyat güncelleme taslağı** | "Tüm ürün fiyatlarını %10 artır, taslak oluştur" → Agent prepares bulk price update for admin review. | MEDIUM | `draft_price_update(company_id, adjustment_percent, filter_category)` tool. Returns preview. Admin approves before applying. |
| **Ürün ekleme yardımı** | Admin provides product details via text → Agent structures the data and creates a draft product entry for admin to confirm. | MEDIUM | `draft_new_product(name, sku, description, price, stock)` tool. Admin reviews in web panel. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Kategori bazlı analiz** | "Temizlik ürünleri kategorisi nasıl performans gösteriyor?" → Agent returns category-level sales metrics. | LOW | Filter existing product performance tool by category. |
| **Ürün talebi (Product Request) analizi** | "Bayiler ne tür ürün talep ediyor?" → Agent analyzes product request forms submitted by dealers and identifies patterns. | MEDIUM | `analyze_product_requests(company_id)` tool. Existing product request data from v2.0. Identifies most requested new products. |
| **Depo Sorumlusu entegrasyonu** | Product Manager can ask Warehouse Agent for real-time stock levels. | LOW | Shared tools — both agents use `get_stock_level` tool. |

---

### Agent 10: Egitimci (Trainer)

**Role:** Dealer onboarding, product training, portal usage guidance, FAQ augmentation, training materials distribution.

**User:** Dealers (primary) + Admin (for content management)

**Decision Authority:** Read-only access. Can answer questions and guide. Cannot modify system data.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Portal kullanım rehberi** | New dealer: "Nasıl sipariş veririm?" → Agent provides step-by-step guidance with examples. | LOW | Static knowledge in system prompt. Covers: catalog browsing, cart, quick order, order tracking, financial queries. |
| **Ürün bilgisi sorgusu** | "A001 ürünü nasıl kullanılır? Hangi müşteri segmentine önerilir?" → Agent returns product information, usage notes. | LOW | `get_product_details(product_id)` tool. Returns product description, category, notes. Products should have `usage_notes` field (may need adding). |
| **SSS (FAQ) arama** | "Minimum sipariş tutarı nedir?" → Agent searches existing FAQ and returns answer. | LOW | `search_faq(query)` tool. Full-text search on existing `faq` table from v2.0. |
| **Yeni bayi onboarding** | When dealer is created in system, Trainer Agent sends welcome Telegram message explaining how to use the portal. | MEDIUM | Triggered by new dealer creation event. Proactive message sequence: welcome, portal tour, first order guidance. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Kişiselleştirilmiş eğitim** | Agent knows dealer's group and order history. "Altın grubu bayiler şu özelliği kullanabilir..." Tailored to dealer's tier and behavior. | LOW | Load dealer profile at session start. Personalize responses based on dealer group and usage patterns. |
| **Eğitim içeriği oluşturma (admin)** | Admin: "Yeni ürün lansmanı için satış noktaları belgesi oluştur" → Agent drafts product training sheet. | MEDIUM | LLM generation with product data as context. Admin edits and can upload as announcement. |
| **Kullanım analizi** | "Hangi bayiler portali hiç açmadı?" → Agent identifies dormant dealer accounts. | LOW | `get_inactive_dealers(company_id, days_inactive)` tool. Triggers proactive outreach. |

**Key Constraint:** Trainer is the LOWEST stakes agent — read-only, no financial data, no order creation. Build it early as a confidence-building demo. It's the safest agent to get wrong.

---

### Agent 11: Iade/Kalite Sorumlusu (Returns & Quality Manager)

**Role:** Return request processing, complaint handling, quality issue tracking, supplier defect feedback.

**User:** Dealers (return requests) + Admin/quality team (processing)

**Decision Authority:** Can log and categorize returns. Cannot authorize credits or replacements without admin approval.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **İade talebi oluşturma** | Dealer: "A001 ürünü hasarlı geldi, iade etmek istiyorum" → Agent logs return request with order reference, reason, quantity. | MEDIUM | `create_return_request(order_id, items[], reason, notes)` tool. New `return_requests` table. |
| **İade durumu sorgulama** | "İade talebim #456 ne durumda?" → Agent returns current status and notes. | LOW | `get_return_request_status(return_id)` tool. |
| **Şikayet kaydı** | "Ürün kalitesinden şikayetçiyim, çok kırılgan ambalaj" → Agent logs quality complaint categorized by type. | LOW | `log_quality_complaint(type, product_id, description)` tool. New `quality_complaints` table. |
| **İade listesi (admin)** | Admin: "Bu haftaki iade talepleri neler?" → Agent returns open returns with dealer, product, reason, age. | LOW | `get_return_requests(company_id, status, date_range)` tool. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Kalite pattern analizi** | "Son 3 ayda hangi ürünlerde en çok şikayet var?" → Agent identifies quality problems by product. | MEDIUM | `get_quality_complaint_patterns(company_id, period)` tool. Aggregates complaints by product/category/reason. |
| **Otomatik kredi taslağı** | Agent detects confirmed return and drafts credit memo for Accounting Agent to process. | MEDIUM | After admin confirms return, agent generates credit note draft, passes to Accounting Agent. |
| **Tedarikçi kalite bildirimi** | "Bu ürün hataları tedarikçiden mi geliyor?" → Agent connects quality complaints to supplier data and drafts defect report. | HIGH | Requires product-supplier linkage. HIGH complexity — defer. |

**New Database Requirements:**
- `return_requests` table: `{id, dealer_id, company_id, order_id, items JSONB, reason, status, admin_notes, created_at, resolved_at}`
- `quality_complaints` table: `{id, dealer_id, company_id, product_id, complaint_type, description, status, created_at}`

---

### Agent 12: Genel Mudur Danismani (Executive Advisor)

**Role:** Strategic overview, KPI dashboards, trend analysis, anomaly detection, executive reporting.

**User:** Company owner / general manager (via Telegram)

**Decision Authority:** Read-only. Advises, analyzes, reports. Does not modify any data.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Günlük/haftalık KPI özeti** | "Bugünün durumu nedir?" → Agent provides: today's orders (count + value), active dealers, pending shipments, overdue collections, top product. | LOW | `get_executive_dashboard(company_id, period)` tool. Aggregates across orders, financials, delivery status. |
| **Satış trend analizi** | "Son 3 ayın satış trendi nasıl?" → Agent returns revenue trend with comparison to previous period and growth rate. | MEDIUM | `get_sales_trend(company_id, period, compare_to)` tool. Period-over-period comparison. |
| **Bayi performans sıralaması** | "En iyi ve en kötü performanslı bayilerim kimler?" → Agent returns top/bottom 10 dealers by revenue this month. | LOW | `get_dealer_performance_ranking(company_id, period, limit)` tool. |
| **Tahsilat durumu özeti** | "Alacaklarım nasıl?" → Agent summarizes: total receivables, overdue amount, collection rate this month vs. last month. | LOW | `get_collections_summary(company_id, period)` tool. Aggregates financial tables. |
| **Anomali tespiti** | "Bu ay olağandışı bir şey var mı?" → Agent flags: unusual order drops, new overdue accounts, product complaints spike, dormant dealers going active. | HIGH | Requires comparison to baseline metrics. Complex to get right. Start simple: flag any metric >2σ from 3-month average. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Sabah brifing (proaktif)** | Every morning at 08:30, Executive Advisor sends a 5-bullet executive summary to GM via Telegram: yesterday's results, today's priorities, alerts. | MEDIUM | Vercel Cron. This is the highest-perceived-value proactive feature. |
| **Soru bazlı analiz** | "Neden geçen ay satışlar düştü?" → Agent investigates: checks for product stockouts, active dealers count, campaign expiry, competitor mentions in complaint notes. | HIGH | Multi-step analysis combining several tools. Complex but high value. Defer to v3.1. |
| **Karşılaştırmalı analiz** | "Bu yılın Q1'i geçen yılla karşılaştır" → Year-over-year comparison across all KPIs. | MEDIUM | Requires 12+ months of data to be meaningful. Useful from v3's second year. |

#### Anti-Features

| Anti-Feature | Why Avoid | Alternative |
|--------------|-----------|-------------|
| **Predictive sales forecasting** | ML-based forecasting requires large datasets, model training, drift monitoring. Over-engineering for <700 dealers. | Trend analysis based on historical averages. "Geçen 3 ayın ortalaması X, beklenen bu ay Y." |
| **Competitor intelligence** | Scraping competitor data, market analysis. Out of scope — this is internal business intelligence. | Internal metrics only. Agent analyzes own company data, not external market. |

---

## Feature Dependencies

### Critical Build Order

The dependency chain is strict: infrastructure must precede agents, and agents can only use features that exist.

```
[Existing v2.0 Foundation]
├── orders, products, dealers, financials, campaigns, support_messages
│
↓ MUST BUILD FIRST
[Multi-Tenant Infrastructure]
├── companies table
├── company_id on all tables
├── RLS policies updated
└── Company-scoped auth

↓ MUST BUILD SECOND
[Agent Infrastructure]
├── Claude API integration
├── Telegram Bot webhook
├── agent_sessions table (conversation state)
├── agent_memory table (long-term memory)
├── Tool wrapper layer
└── User-to-agent routing

↓ BUILD IN PARALLEL (after infrastructure)
[Agent Group 1 — Dealer-Facing, Low Risk]
├── Egitimci (Trainer) — no DB writes, lowest risk, good demo
└── Satis Temsilcisi (Sales) — highest dealer value, existing tools

[Agent Group 2 — Financial, High Value]
├── Muhasebeci (Accountant) — read-only financial access
└── Tahsilat Uzmani (Collections) — builds on Accountant data

[Agent Group 3 — Operations, Medium Complexity]
├── Depo Sorumlusu (Warehouse) — order status + stock
└── Dagitim Koordinatoru (Distribution) — delivery workflow

[Agent Group 4 — Management, New DB Tables]
├── Saha Satis Sorumlusu (Field Sales) — needs dealer_visits table
├── Satin Alma Sorumlusu (Procurement) — needs suppliers, purchase_orders tables
├── Pazarlamaci (Marketing) — builds on campaigns
└── Urun Yoneticisi (Product Manager) — builds on products + orders

[Agent Group 5 — Quality + Executive]
├── Iade/Kalite Sorumlusu (Returns) — needs return_requests table
└── Genel Mudur Danismani (Executive) — reads all data, last to build

↓ CROSS-AGENT DEPENDENCIES
Agent handoffs (sales → accounting, warehouse → procurement):
└── Requires agent infrastructure + both agents to exist
```

### New Database Tables Required by Agents

| Table | Required By Agent | Purpose |
|-------|------------------|---------|
| `companies` | All agents | Multi-tenant isolation |
| `agent_sessions` | All agents | Conversation state |
| `agent_memory` | All agents | Long-term memory |
| `agent_activity_log` | All agents | Audit trail |
| `dealer_visits` | Field Sales | Visit logging |
| `sales_targets` | Field Sales | Target tracking |
| `collection_activities` | Collections | Activity logging |
| `suppliers` | Procurement | Supplier management |
| `purchase_orders` | Procurement | PO tracking |
| `return_requests` | Returns/Quality | Return processing |
| `quality_complaints` | Returns/Quality | Complaint tracking |

### Existing Features Used by Agents (no new tables)

| Existing Feature | Used By Agents |
|-----------------|----------------|
| `orders` + `order_items` | Sales, Warehouse, Distribution, Product, Executive |
| `products` + stock | Sales, Warehouse, Procurement, Product, Trainer |
| `dealers` | Sales, Field Sales, Collections, Marketing, Trainer, Executive |
| `financials` (cari hesap) | Accountant, Collections, Executive |
| `campaigns` | Marketing, Sales |
| `faq` | Trainer |
| `support_messages` | (foundation for escalation) |
| `product_requests` | Product Manager |

---

## MVP Definition

### Phase 1: Multi-Tenant Foundation (v3.0 prerequisite)

Must-have before any agent work:

- [ ] `companies` table with company metadata
- [ ] `company_id` added to all existing tables via migration
- [ ] All RLS policies updated to include company scoping
- [ ] `get_user_company_id()` SECURITY DEFINER function
- [ ] Super admin role for SaaS operator
- [ ] Company-scoped admin authentication

### Phase 2: Agent Infrastructure (v3.0 prerequisite)

Must-have before any individual agent:

- [ ] Claude API (`@anthropic-ai/sdk`) integration with tool calling
- [ ] Telegram Bot webhook endpoint
- [ ] Telegram user authentication flow (code-based linking)
- [ ] `agent_sessions` table + conversation context loading
- [ ] `agent_memory` table + basic read/write
- [ ] Tool wrapper layer (instrument top 10 most-needed DB operations)
- [ ] Agent routing (which agent handles which command)
- [ ] `agent_activity_log` for audit

### Phase 3: First Agents (Launch With)

Build in this order for maximum value and minimum risk:

- [ ] **Egitimci (Trainer)** — Read-only, low risk, immediate demo value. Validates the full agent pipeline without financial risk.
- [ ] **Satis Temsilcisi (Sales)** — Highest dealer value. Tools already exist. Replaces WhatsApp order taking.
- [ ] **Muhasebeci (Accountant)** — Financial queries. Read-only. Second most requested feature.
- [ ] **Depo Sorumlusu (Warehouse)** — Internal operations. Validates write tools.
- [ ] **Genel Mudur Danismani (Executive)** — Requires all other tools. Build last. Demo value is high.

### Phase 4: Expand Agent Ecosystem (v3.1)

After core agents validated:

- [ ] Collections Specialist (builds on Accountant)
- [ ] Field Sales Manager (needs new DB tables)
- [ ] Distribution Coordinator (needs delivery tracking expansion)
- [ ] Marketing Manager (builds on campaigns)

### Phase 5: Complete Ecosystem (v3.2)

- [ ] Procurement Manager (needs suppliers/PO tables)
- [ ] Product Manager (builds on existing product data)
- [ ] Returns & Quality Manager (needs new tables)
- [ ] All agent-to-agent handoffs
- [ ] Proactive notification system (all agents)

### Defer Post-v3 (v4+)

- [ ] ERP real-time sync (scope per PROJECT.md)
- [ ] Vector database for agent memory (upgrade only if needed)
- [ ] Voice/audio agent interface
- [ ] A2A cross-vendor agent protocol
- [ ] Predictive demand forecasting (ML)
- [ ] Route optimization with GPS (needs address data + Maps API)
- [ ] Supplier defect report automation
- [ ] Autonomous PO submission to external suppliers

---

## Feature Prioritization Matrix

| Feature Area | User Value | Implementation Cost | Priority |
|-------------|------------|---------------------|----------|
| Multi-tenant company_id migration | HIGH (enables SaaS sales) | MEDIUM | P1 |
| RLS policy updates | HIGH (security critical) | HIGH | P1 |
| Claude API + tool calling setup | HIGH (blocks all agents) | MEDIUM | P1 |
| Telegram webhook + auth | HIGH (blocks all agents) | MEDIUM | P1 |
| Agent session management | HIGH (blocks all agents) | LOW | P1 |
| Sales Agent (order taking) | HIGH (core dealer value) | MEDIUM | P1 |
| Trainer Agent | MEDIUM (onboarding) | LOW | P1 (demo) |
| Accountant Agent | HIGH (financial queries) | LOW | P1 |
| Warehouse Agent | HIGH (operations) | MEDIUM | P2 |
| Executive Advisor Agent | HIGH (strategic value) | MEDIUM | P2 |
| Collections Agent | HIGH (revenue recovery) | MEDIUM | P2 |
| Field Sales Agent | MEDIUM (new DB needed) | HIGH | P2 |
| Distribution Agent | MEDIUM (extends existing) | MEDIUM | P2 |
| Marketing Agent | MEDIUM (campaign drafting) | LOW | P3 |
| Product Manager Agent | MEDIUM (analytics) | MEDIUM | P3 |
| Returns/Quality Agent | LOW-MEDIUM (new tables) | HIGH | P3 |
| Agent-to-agent handoffs | MEDIUM (polish) | HIGH | P3 |
| Proactive notifications (all) | HIGH (differentiator) | MEDIUM | P2 |
| Company branding | LOW (nice-to-have) | LOW | P3 |

---

## Complexity Assessment per Agent

| Agent | Overall Complexity | New DB Tables | Net-New Tools | Dependency on Other Agents | Risk |
|-------|-------------------|---------------|--------------|---------------------------|------|
| Egitimci (Trainer) | LOW | 0 | 2 | None | LOW |
| Satis Temsilcisi (Sales) | MEDIUM | 0 | 6 | None | MEDIUM |
| Muhasebeci (Accountant) | LOW-MEDIUM | 0 | 5 | Collections (optional) | LOW |
| Depo Sorumlusu (Warehouse) | MEDIUM | 0 | 5 | Procurement (optional) | MEDIUM |
| Genel Mudur Danismani (Executive) | MEDIUM | 0 | 6 | All (reads all data) | MEDIUM |
| Tahsilat Uzmani (Collections) | MEDIUM | 1 | 4 | Accountant (required) | MEDIUM |
| Dagitim Koordinatoru (Distribution) | MEDIUM | 1 | 4 | Warehouse (optional) | MEDIUM |
| Saha Satis Sorumlusu (Field Sales) | MEDIUM-HIGH | 2 | 4 | None | MEDIUM |
| Pazarlamaci (Marketing) | MEDIUM | 0 | 4 | Product Manager (optional) | LOW |
| Urun Yoneticisi (Product Manager) | MEDIUM | 0 | 4 | Warehouse, Marketing (optional) | LOW |
| Satin Alma Sorumlusu (Procurement) | HIGH | 2 | 5 | Warehouse (required) | HIGH |
| Iade/Kalite Sorumlusu (Returns) | HIGH | 2 | 4 | Accountant (optional) | HIGH |

---

## Competitor Feature Analysis

| Feature | Copilot-type Assistants | Vertical B2B AI Platforms | Our Approach |
|---------|------------------------|--------------------------|--------------|
| Agent interface | Chat widget in web app | Dedicated mobile apps | Telegram (zero install, high engagement) |
| Agent specialization | One general assistant | Role-specific agents | 12 role-specific agents (most specialized) |
| Memory | Session-only | Varies | Persistent cross-session + long-term memory |
| Integration | External APIs | ERP-native | Own existing DB (full control, no sync lag) |
| Multi-tenant | Inherent in SaaS | Yes | Add via migration (Supabase RLS) |
| Turkish language | Partial | Varies | Claude 3.x has strong Turkish capability |

---

## Confidence Assessment

| Category | Confidence | Reasoning |
|----------|------------|-----------|
| **Multi-tenant architecture** | HIGH | Shared schema + RLS is industry-standard, Supabase-native. Well-documented. |
| **Claude tool calling capability** | HIGH | Verified with Anthropic official docs. Tool calling is mature, production-ready. |
| **Telegram as agent channel** | MEDIUM | General Telegram B2B data solid. Turkish B2B preference from secondary sources. |
| **Agent role features** | MEDIUM | Individual agent capabilities researched from comparable products (BeatRoute, HighRadius, etc.). Mapping to this specific company's needs involves inference. |
| **Agent memory patterns** | MEDIUM | Multiple credible sources on memory architecture. Implementation in Supabase not directly verified — requires pattern adaptation. |
| **Multi-agent handoff** | MEDIUM | Anthropic docs confirm tool-call handoff pattern. Custom implementation details require phase-specific research. |
| **Build order** | MEDIUM | Derived from dependency analysis + complexity assessment. Assumes no major surprises in multi-tenant migration. |

---

## Open Questions for Stakeholders

1. **Telegram authentication preference:** Should dealers register by entering a code sent to their email, or should the admin link Telegram accounts manually from the web panel? (Affects user onboarding complexity.)

2. **Agent access per role:** Should all dealers access all dealer-relevant agents (Sales + Trainer), or should specific agents be unlocked per dealer tier? (Altın dealers get all, Bronz dealers get Sales only?)

3. **Proactive notification preference:** Some agents can send daily briefings automatically. Does the company want ALL proactive notifications, or opt-in per notification type? (Affects Cron job design.)

4. **Supplier data:** Does the company currently track suppliers? Is there existing supplier master data that can be imported for the Procurement Agent? (Affects procurement agent complexity.)

5. **Field reps on Telegram:** Do field sales reps already use Telegram for business? This affects Field Sales Agent adoption rate. If reps are WhatsApp-primary, adoption may be low.

6. **Financial data currency:** How frequently is cari hesap data updated in the system? Daily? Real-time? This affects how useful the Accountant and Collections agents are.

7. **Agent decision authority:** For the Sales Agent, should it auto-place orders after dealer confirmation, or should it route confirmed orders through the existing web panel for admin approval?

---

## Sources

### Multi-Tenant SaaS Architecture
- [Multi-Tenant AI Agent Architecture: Design Guide (2026) - Fast.io](https://fast.io/resources/ai-agent-multi-tenant-architecture/)
- [Multi-Tenant Performance Crisis: Advanced Isolation Strategies for 2026 - AddWeb Solution](https://www.addwebsolution.com/blog/multi-tenant-performance-crisis-advanced-isolation-2026)
- [Build a multi-tenant generative AI environment - AWS](https://aws.amazon.com/blogs/machine-learning/build-a-multi-tenant-generative-ai-environment-for-your-enterprise-on-aws/)
- [Architectural Approaches for AI/ML in Multitenant Solutions - Azure](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/approaches/ai-machine-learning)
- [The 2026 Multi-Tenant Data Integration Playbook - CData Software](https://cdatasoftware.medium.com/the-2026-multi-tenant-data-integration-playbook-for-scalable-saas-1371986d2c2c)

### Claude API & Tool Calling
- [Tool use with Claude - Anthropic Official Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
- [Introducing advanced tool use - Anthropic Engineering](https://www.anthropic.com/engineering/advanced-tool-use)
- [How Anthropic built its multi-agent research system - Anthropic Engineering](https://www.anthropic.com/engineering/multi-agent-research-system)
- [When to use multi-agent systems - Anthropic Blog](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them)

### Multi-Agent Orchestration
- [AI Agent Orchestration in 2026: Coordination, Scale and Strategy - Kanerika](https://kanerika.com/blogs/ai-agent-orchestration/)
- [Multi-Agent AI Orchestration: Enterprise Strategy for 2025-2026 - Onabout](https://www.onabout.ai/p/mastering-multi-agent-orchestration-architectures-patterns-roi-benchmarks-for-2025-2026)
- [MCP vs A2A: Protocols for Multi-Agent Collaboration 2026 - OneReach](https://onereach.ai/blog/guide-choosing-mcp-vs-a2a-protocols/)
- [Choosing the Right Multi-Agent Architecture - LangChain Blog](https://blog.langchain.com/choosing-the-right-multi-agent-architecture/)

### Agent Memory & Context
- [Memory for AI Agents: A New Paradigm of Context Engineering - The New Stack](https://thenewstack.io/memory-for-ai-agents-a-new-paradigm-of-context-engineering/)
- [Beyond Short-term Memory: 3 Types of Long-term Memory AI Agents Need - ML Mastery](https://machinelearningmastery.com/beyond-short-term-memory-the-3-types-of-long-term-memory-ai-agents-need/)
- [Long-term memory in agentic systems - Moxo](https://www.moxo.com/blog/agentic-ai-memory)
- [AI Agent Memory: Build Stateful AI Systems - Redis](https://redis.io/blog/ai-agent-memory-stateful-systems/)

### Telegram Bot Architecture
- [Long Polling vs. Webhooks - grammY Documentation](https://grammy.dev/guide/deployment-types)
- [Building a Scalable Telegram Bot with Node.js - Medium](https://medium.com/@pushpesh0/building-a-scalable-telegram-bot-with-node-js-bullmq-and-webhooks-6b0070fcbdfc)
- [Top 7 Ways to Promote B2B Business on Telegram in 2026 - Magnetto](https://magnetto.com/blog/top-ways-to-promote-your-b2b-business-on-telegram)

### AI Sales Agents
- [How AI Agents Will Transform B2B Sales - BCG](https://www.bcg.com/publications/2025/how-ai-agents-will-transform-b2b-sales)
- [Optimize Order Taking and Fulfillment with Order AI Agent - BeatRoute](https://beatroute.io/order-ai-agent/)
- [AI in Field Sales 2025: Best Practices, Trends & Inspiration - Acto](https://www.heyacto.com/en/blog/ai-field-sales)

### AI Accounting & Collections
- [AI Agents for Accounts Receivable - ZBrain](https://zbrain.ai/agents/Finance/Accounts-Receivable/)
- [AI in Debt Collection: The Complete 2026 Guide - Kompato](https://kompatoai.com/ai-in-debt-collection/)
- [Top 9 AI Agents in Accounting in 2026 - AIMultiple](https://research.aimultiple.com/accounting-ai-agent/)
- [AI in Accounts Receivable: What It Is and Why It Matters - Invoiced](https://www.invoiced.com/resources/blog/ai-in-accounts-receivable)

### AI Warehouse & Procurement
- [Agentic AI for inventory to deliver - Microsoft Dynamics 365](https://www.microsoft.com/en-us/dynamics-365/blog/business-leader/2026/02/02/agentic-ai-for-inventory-to-deliver-from-procurement-to-fulfillment/)
- [AI Agents Inventory Management Applications 2026 - Prediko](https://www.prediko.io/blog/ai-agents-in-inventory-management)
- [State of AI in Procurement in 2026 - Art of Procurement](https://artofprocurement.com/blog/state-of-ai-in-procurement)
- [How AI Agents Change Procurement Work in 2026 - Suplari](https://suplari.com/blog/how-ai-agents-change-how-procurement-work-gets-done/)

### AI Distribution & Route Optimization
- [AI Agents for Logistics: Dispatch, Customer Service - Locate2u](https://www.locate2u.com/products/ai-agents/)
- [AI Route Optimization for Smarter Last-Mile Delivery - Descartes](https://www.descartes.com/resources/knowledge-center/ai-route-optimization-enhancing-delivery-efficiency)

### AI Returns & Quality
- [AI in Complaints and Returns Management - ZBrain](https://zbrain.ai/ai-in-complaints-and-returns-management/)
- [Returns and Refunds Process Optimization AI Agents - Akira](https://www.akira.ai/ai-agents/returns-refunds-optimization-ai-agents)

### Executive AI & KPI
- [How AI agents can become strategic partners - World Economic Forum](https://www.weforum.org/stories/2026/01/how-to-ensure-ai-agents-become-the-strategic-partners-in-your-business/)
- [The KPI Blueprint for Agentic AI Success - Fluid AI](https://www.fluid.ai/blog/the-kpi-blueprint-for-agentic-ai-success)
- [Agentic AI Is a Massive Opportunity for B2B Software - Medium](https://medium.com/@jmprunet/agentic-ai-is-a-massive-opportunity-for-b2b-software-c7f55002e147)

---

*Feature research for: B2B Dealer Management SaaS + AI Digital Worker Ecosystem*
*Researched: 2026-03-01*
*Scope: v3.0 milestone - Multi-Tenant + 12 AI Agents*
