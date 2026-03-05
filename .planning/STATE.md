# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01)

**Core value:** Bayilerin mesai saatlerinden bagimsiz, anlik stok ve fiyat bilgisiyle siparis verebilmesi — AI agent'lar ile 7/24 otonom is surecleri.

**Current focus:** v3.0 — Multi-Tenant SaaS + AI Agent Ecosystem

## Current Position

Phase: 13 — Production Readiness — IN PROGRESS
Plan: 04 of 06 complete
Status: IN PROGRESS — Plan 04 complete (GitHub Actions CI workflow, database backup documentation)
Last activity: 2026-03-05 — Phase 13 Plan 04 complete (.github/workflows/ci.yml, P0-CI + P1-DBBACKUP satisfied)

Progress: [██░░░░░░░░] 40% — Phase 13 Plan 04 of 06 complete

## Milestones

**Shipped:**
- v1 MVP (2026-02-03) — 3 phases, 14 plans, 38 requirements
- v2.0 — Bayi Deneyimi ve Finansal Takip (2026-03-01) — 4 phases, 20 plans, 36 requirements

**In Progress:**
- v3.0 — Multi-Tenant SaaS + AI Agent Ecosystem — 5 phases (8-12), 71 requirements

## Accumulated Context

### Supabase Project
- Project ref: neqcuhejmornybmbclwt (restored, West EU London)
- URL: https://neqcuhejmornybmbclwt.supabase.co
- Auth users: admin@test.com (admin), bayi@test.com (dealer)
- RLS: Company-scoped with current_company_id(), is_company_admin(), is_superadmin()
- JWT Hook: inject_company_claim registered (Custom Access Token Hook)
- All 9 migrations applied (001-009), seed data present, 1 company active

### Deployment
- Vercel: https://bayi-yonetimi.vercel.app (38 routes)
- GitHub: cagri4/bayi-yonetimi

### Key Architectural Decisions
- is_admin() SECURITY DEFINER to prevent RLS recursion on users table
- gen_random_uuid() instead of uuid_generate_v4() for Supabase
- Zod v4: error instead of errorMap
- @supabase/supabase-js v2.91+ requires Relationships: [] on all table types
- Server Actions pattern for mutations
- Zustand + localStorage for client state

### Phase 8 Decisions (from Plan 08-01)
- categories and brands company-scoped (not global) — full catalog isolation; seed and clone on new tenant onboarding
- users.company_id added directly (admins may lack dealers record); inject_company_claim checks users.company_id first, falls back to dealers
- dealer_spending_summary dropped and rebuilt with company_id; RPC wrapper get_dealer_spending_summary() is only safe API path (PostgreSQL matview RLS unsupported)
- REVOKE EXECUTE on inject_company_claim FROM anon, authenticated, public — only supabase_auth_admin may call hook
- Seed company slug='default' used as stable subquery key for direct-assign table backfill
- UNIQUE INDEX on (company_id, dealer_id, month DESC NULLS LAST) required for REFRESH MATERIALIZED VIEW CONCURRENTLY
- 9 migrations applied after Plan 08-01 execution (009_multi_tenant.sql)

### Phase 8 Decisions (from Plan 08-02)
- Each CREATE INDEX CONCURRENTLY must be run as standalone Dashboard statement — cannot batch inside a transaction block
- 11 dealer-scoped tables get composite (company_id, dealer_id) indexes for compound predicate efficiency
- 9 direct-assign tables get single-column (company_id) indexes (no dealer_id present)
- users.company_id indexed for JWT hook lookup and admin RLS performance

### Phase 8 Decisions (from Plan 08-05)
- Insert types use company_id?: string (optional) — preserves existing server action compilation; DB enforces NOT NULL at runtime; Phase 9 will inject company_id from JWT context

### Phase 8 Decisions (from Plan 08-03)
- DROP POLICY IF EXISTS uses both old actual names (from migrations 001-008) AND plan's expected names — migrations had different names (e.g., "Anyone can read categories" vs "Authenticated users can read categories")
- dealer_favorites: 3 old granular policies (view/add/remove) collapsed into single FOR ALL policy with company_id scope
- support_messages + product_requests: 4 old policies each collapsed into 2 company-scoped policies (dealer ALL + admin ALL)
- announcement_reads: old separate SELECT/INSERT policies replaced by FOR ALL with company_id + dealer_id check
- BLOCK 12 can be pasted as single block (no CONCURRENTLY); application in locked-out state between BLOCK 12 execution and JWT hook registration

### v3.0 Architecture Decisions
- Multi-tenancy: shared-schema with company_id on all 20+ tables (NOT schema-per-tenant)
- RLS anchor: current_company_id() SECURITY DEFINER function via JWT claim injection
- Agent model tiering: Haiku 4.5 for 8 agents, Sonnet 4.6 for 4 (Trainer, Accountant, Marketing, Executive)
- Telegram framework: grammY 1.41.0 (TypeScript-first, explicit Vercel webhook support)
- Claude SDK: @anthropic-ai/sdk ^0.78.0 (raw SDK, not Vercel AI SDK)
- Webhook pattern: immediate 200 response + after() background processing (Fluid Compute)
- Agent isolation: service role client mandatory companyId parameter on every tool handler
- Cost controls: 50K soft / 100K hard daily token budget per dealer
- Conversation window: rolling 50 messages + automatic summarization via Haiku
- Cross-agent calls: AgentBridge (direct DB query, not Claude invocation) for data; full loop for reasoning
- Rejected: LangChain, LangGraph, Redis, pgvector, schema-per-tenant, WhatsApp (v4.0)

### Phase 9 Decisions (from Plan 09-01)
- Service role client: module-level singleton (not per-request) for agent serverless reuse; persistSession: false, autoRefreshToken: false
- agent_conversations/messages/daily_token_usage/processed_telegram_updates: service role only RLS (no user-facing queries — agents run via service role)
- agent_definitions: company admins can manage (needed for UI config); agent_calls: company admins can SELECT (audit log)
- increment_daily_token_usage uses LANGUAGE sql (not plpgsql) — simpler, no variable overhead for atomic upsert
- processed_telegram_updates uses Telegram's own BIGINT update_id as PRIMARY KEY (natural idempotency key, no UUID needed)

### Phase 9 Decisions (from Plan 09-02)
- applyPromptCaching marks last tool in array with cache_control:ephemeral — consistent with Anthropic caching docs (last breakpoint gets cached content)
- TokenBudget fails open on DB errors — returns allowed:true to prevent blocking dealers on transient Supabase issues
- ToolRegistry exposes getToolsWithCaching convenience method — AgentRunner should use this instead of calling applyPromptCaching manually
- @anthropic-ai/sdk installed at ^0.78.0 per v3.0 architecture decision (raw SDK, not Vercel AI SDK)

### Phase 9 Decisions (from Plan 09-03)
- AgentRunner receives toolHandlers as Map<string, handler> — handlers get both input AND AgentContext for company_id scoping
- System prompt uses array format [{ type:'text', text:..., cache_control:{ type:'ephemeral' } }] not plain string (required for prompt caching to activate)
- ConversationManager.summarizeAndTruncate is private; triggered automatically by saveMessage when count > SUMMARIZE_THRESHOLD (50)
- Summary messages use role='system' in DB but excluded from getMessages() — dispatcher injects them into system prompt separately
- metadata cast to Json via type assertion — Record<string,unknown> is structurally compatible but TypeScript requires explicit cast

### Phase 9 Decisions (from Plan 09-05)
- grammy used for types only (grammy/types Update) — no Bot instance in webhook route; Update body parsed via request.json()
- Idempotency INSERT runs synchronously before after() and before return — ensures dedup record is committed before any background processing
- Non-23505 idempotency DB errors still return 200 — prevents Telegram retry storm on transient Supabase issues
- Agent role resolved from agent_definitions (first active record per company); 'destek' is Phase 9 fallback; Phase 10+ will map bot tokens to roles
- TELEGRAM_BOT_TOKEN from env vars — sendTelegramMessage logs error if missing but never throws
- Placeholder tool handlers (echo/get_current_time/lookup_dealer) defined inline in dispatchAgentUpdate to close over supabase client for lookup_dealer scoping

### Phase 9 Decisions (from Plan 09-04)
- checkDeadlock() is synchronous — no DB access needed, only inspects in-memory callStack (fast guard before async operations)
- callAgent() is a Phase 9 placeholder returning stub result; Phase 10 will replace stub with AgentRunner invocation using extended callStack and depth+1
- getDealerInfo/getRecentOrders/getProductInfo use direct DB queries (not Claude) per AI-06 cross-agent data pattern
- orders.status_id used (not status) — TypeScript Supabase query builder caught column name mismatch at compile time

### Phase 10 Decisions (from Plan 10-01)
- TR-04 read-only enforced at file level: egitimci-tools.ts has ONLY SELECT queries; no INSERT/UPDATE/DELETE code paths
- safeQuery sanitization (replace(/[%_]/g, '')) applied before all ilike queries to prevent wildcard injection
- dealer_group join typed explicitly as { discount_percent: number } | null — Supabase TypeScript builder returns Json for nested join results, requires explicit cast
- void context in handleGetFaq: preserves AgentContext parameter for future audit logging while suppressing TS unused variable warning
- createEgitimciHandlers closes over supabase client — handlers do NOT receive supabase directly (matches Phase 9 dispatcher closure pattern)
- HandlerFn factory pattern established: createXxxHandlers(supabase) returns Map<string, HandlerFn> — Phase 10+ tool files follow this shape

### Phase 10 Decisions (from Plan 10-02)
- create_order validates stock inline before any DB writes — prevents partial order states (stock check before generate_order_number, before INSERT)
- order_status_history inserted without changed_by (null) — agent has no user UUID; notes field carries audit trail text
- (supabase as any) type assertion on orders/order_items/order_status_history inserts — matches createOrder server action pattern; Insert types conflict with optional company_id
- Dealer group min_order_amount defaults to 0 if no group — always passes minimum check (safe fallback for dealers without group)
- Campaigns query uses .lte('start_date', now).gte('end_date', now) — exact mirror of getActiveCampaigns action

### Phase 10 Decisions (from Plan 10-03)
- TOOL_REGISTRY.egitimci = egitimciTools and TOOL_REGISTRY.satis_temsilcisi = satisTools — real tools replace placeholderTools at registry level
- sendTelegramMessage token parameter replaces process.env.TELEGRAM_BOT_TOKEN — each route passes its own token for multi-bot support
- parse_mode: 'Markdown' removed from sendTelegramMessage — prevents Telegram 400 errors from Claude's unbalanced markdown output (Pitfall 6)
- agent_definitions query now filters by .eq('role', role) — retrieves system prompt for the specific role rather than first-active for company
- forcedRole skips role detection; if forcedRole set, role field from agent_definitions is NOT overwritten (only systemPrompt is taken)
- SQL seed creates UNIQUE INDEX on (company_id, role) before INSERT — makes ON CONFLICT safe even if index was absent
- Dedicated webhook per bot: /api/telegram/{role}/route.ts uses TELEGRAM_BOT_TOKEN_{ROLE} and passes forcedRole to dispatcher

### Phase 11 Decisions (from Plan 11-01)
- dealer_transactions has NO company_id column — all transaction queries scope by dealer_id only (Pitfall 1 in research)
- get_payment_history filters payment/credit_note via JS post-query (not SQL IN clause) to avoid join-filter complexity
- export_report returns lines.join('\n') plain text — NOT CSV/JSON — Telegram text-only constraint
- (supabase as any).rpc() type assertion for get_dealer_balance_breakdown — not in auto-generated Database RPC types
- void input in handleGetDealerBalance — no input needed, context.dealerId provides all required data; TS unused var suppressed
- MH-06 hallucination prevention enforced via tool description text only — system prompt remains authoritative

### Phase 11 Decisions (from Plan 11-03)
- GM handler factory cherry-picks handlers from createMuhasebeciHandlers and createSatisHandlers by key — does not inherit full handler maps (avoids leaking write tools like create_order)
- get_any_dealer_balance verifies target dealer belongs to context.companyId before RPC call — tenant isolation enforced at handler level
- get_dashboard_summary uses direct from('orders') + from('order_items').in('order_id', ...) queries — avoids get_top_products and get_dealer_performance RPCs which lack company_id scope
- export_report in GM file is company-wide scope (all dealers); Muhasebeci export_report is dealer-scoped — same tool name, different implementation per agent
- GM-04 satisfied by existing AGENT_MODELS['genel_mudur_danismani'] = SONNET_MODEL in types.ts — no new code needed
- muhasebeci-tools.ts TS2352 fix: as unknown as TransactionRow[] cast pattern for Supabase SelectQueryError on unregistered FK join (dealer_transactions → transaction_types)

### Phase 11 Decisions (from Plan 11-04)
- URL path uses kebab-case (depo-sorumlusu, genel-mudur) while role enum uses underscores (depo_sorumlusu, genel_mudur_danismani) — consistent with satis/satis_temsilcisi pattern from Phase 10
- SQL seed contains KRITIK KURAL in Muhasebeci prompt and ONEMLI KURAL in Depo Sorumlusu prompt — system prompt enforcement, not code logic (MH-06, DS-03)
- Genel Mudur URL shortened to genel-mudur while role enum remains full genel_mudur_danismani — URL brevity vs code clarity tradeoff

### Phase 12 Decisions (from Plan 12-01)
- All 7 domain tables follow 010_agent_tables.sql pattern: UUID PK, company_id NOT NULL FK ON DELETE CASCADE, RLS enabled, compound index on (company_id, created_at DESC)
- purchase_orders.supplier_id and return_requests.order_id use ON DELETE SET NULL — supplier/order deletion must not cascade-delete business records
- JSONB used for items arrays on purchase_orders and return_requests — avoids separate line-item join tables
- SQL executed via Supabase Dashboard (no CLI access to neqcuhejmornybmbclwt)

### Phase 12 Decisions (from Plan 12-02)
- iade_kalite added to AgentRole after satin_alma; TOOL_REGISTRY update deferred to plan 05 (expected TS2741 until then — by design)
- manage_routes is advisory-only: no DB writes, no new tables; groups active dealers by address in JavaScript, returns formatted plain text route suggestion
- get_overdue_payments MUST scope via dealer join (dealers.company_id) before querying dealer_transactions — that table has no company_id column (same constraint as Phase 11 muhasebeci)
- dealers table has no city column — manage_routes uses first word of address field as region key for route grouping

### Phase 12 Decisions (from Plan 12-03)
- suggest_campaign (PZ-03) is advisory-only — NO DB reads or writes; handler returns formatted Turkish string based on inputs only; no supabase calls in handler body
- (supabase as any) on dealer_visits INSERT — table not in auto-generated Database types, same pattern as orders/order_items from Phase 10
- log_visit sets planned_date = actual_date — visit already happened, planned_date column is required by dealer_visits schema
- as unknown as CampaignRow[] cast for analyze_campaigns — campaigns.name not surfaced in Supabase TS types, consistent with Phase 11 muhasebeci-tools TS2352 fix
- segment_dealers uses client-side grouping in JavaScript Map — Supabase JS client does not support GROUP BY, consistent with Phase 11 check_reorder_level pattern

### Phase 12 Decisions (from Plan 12-05)
- handler-factory.ts introduced as single source of truth for role-to-handler mapping — both dispatcher and agent-bridge import buildHandlersForRole(), eliminating duplication risk as more roles are added
- Sub-agent synthetic messages: MessageParam[] = [{ role: 'user', content: query }] — single-turn invocation, no conversation history passed to sub-agent (sub-agents are stateless within a cross-agent call)
- telegramChatId: 0 in targetContext is critical guard — prevents sub-agent from attempting to send Telegram messages; only top-level dispatcher responds to user
- callAgent() catch block returns { success: false, error } — structured error, never throws, consistent with existing logAgentCall/checkDeadlock error handling pattern
- TOOL_REGISTRY destek role keeps placeholderTools — intentional (no dedicated destek bot in current deployment)

### Phase 12 Decisions (from Plan 12-04)
- analyze_catalog uses two-step query (orders by company_id, then order_items IN orderIds) and JS-side aggregation — avoids Supabase JS join filter complexity with company_id scope
- suggest_pricing corrected to use base_price (not price) from products and custom_price (not price) from dealer_prices — plan spec had wrong column names; TypeScript compile errors caught this at Task 1
- suggest_restock filters JS-side after fetching 200 products — same column-to-column comparison limitation as check_reorder_level in depo-sorumlusu-tools
- track_complaint auto-detects list vs create mode from description field presence — no explicit action enum needed
- tool-registry.ts lacked iade_kalite entry — TS2741 blocking error; Rule 3 auto-fix added all 3 new role registrations in Task 2 commit

### Phase 12 Decisions (from Plan 12-06)
- pazarlamaci gets claude-sonnet-4-6 (reasoning-heavy campaign analysis); remaining 6 Phase 12 agents use claude-haiku-4-5
- satin_alma and iade_kalite system prompts contain ONEMLI confirmation gate text — behavioral enforcement via prompt, not code (same pattern as depo_sorumlusu ONEMLI KURAL from Phase 11)
- Webhook route env vars use TELEGRAM_BOT_TOKEN_{ROLE_UPPERCASE} convention — e.g., TELEGRAM_BOT_TOKEN_DAGITIM_KOORDINATORU
- 7 routes are exact copies of egitimci/route.ts with 3 substitutions: env var name, role enum string, log prefix in console.error calls

### Phase 11 Decisions (from Plan 11-02)
- check_reorder_level uses client-side filter (fetch 200 products, filter JS: stock_quantity <= low_stock_threshold) — Supabase JS client does not support column-to-column WHERE comparisons
- update_stock description contains Turkish confirmation instruction: "BU ARACI CAGIRMADAN ONCE bayiye guncelleme detaylarini goster ve onay al. Onay alinmadan bu araci ASLA cagirma." — enforces two-turn pattern without code logic
- get_pending_orders scoped by company_id only (NOT dealer_id) — warehouse manager sees all company orders, not just one dealer's
- (supabase as any) on .update() call in update_stock — same pattern as satis-tools create_order; Update types conflict with optional fields
- update_stock: double company_id scope on both product lookup (.eq('company_id', context.companyId) on SELECT) and UPDATE (.eq('company_id', context.companyId) on UPDATE) — defense in depth

### v3.0 Phase Dependencies (strict)
- Phase 8 (Multi-Tenant) → blocks Phase 9
- Phase 9 (Agent Infrastructure) → blocks Phase 10
- Phase 10 (First Agents) → blocks Phase 11
- Phase 11 (Financial + Ops Agents) → blocks Phase 12

### Pending Todos
- None carried over from v2.0
- Phase 8 requires staging environment copy of production data for migration dry-run
- Claude API key needed for Phase 9+ (user has key from another project)

### Roadmap Evolution
- Phase 13 added: Production Readiness

### Blockers/Concerns
- Database SQL execution requires Dashboard SQL Editor (no CLI access token)
- Phase 8 migration must be dry-run on staging before production (700 dealers, 20+ tables)
- Telegram multi-bot management: 12 bots need automated webhook registration strategy (research during Phase 9 planning)

## Session Continuity

Last session: 2026-03-05 (Phase 13 Plan 02 complete — error boundaries, 404 page, API response helpers)
Stopped at: Completed 13-02-PLAN.md
Resume file: None

---
### Phase 12 Decisions (from Plan 12-07)
- CRON_SECRET header auth (not query param) — Vercel injects Authorization: Bearer header automatically when calling cron routes; avoids secret leakage in server logs
- Overdue scope via dealer_id IN (...) join — dealer_transactions has no company_id column (consistent with Phase 11 muhasebeci-tools decision)
- Middleware fix: /api/ routes excluded from auth redirect — cron route would 302-redirect without Bearer header otherwise (Rule 3 auto-fix)
- briefingsSent counter in JSON response — enables manual test verification without Telegram bot configured

### Phase 13 Decisions (from Plan 13-01)
- env.ts uses try/catch wrapping serverEnvSchema.parse — ZodError formatted into human-readable table before re-throwing (shows exact missing var names)
- health/route.ts validates env vars inline (not via import { env }) — prevents route from throwing when env is misconfigured; health endpoint reports problems, not propagates them
- .gitignore updated with !.env.example negation — .env* pattern was blocking example file from git
- publicEnvSchema exported separately — safe for client component imports without exposing server secrets

### Phase 13 Decisions (from Plan 13-02)
- error.tsx files log via useEffect(console.error) — Sentry will hook into this in Plan 05 without file changes
- not-found.tsx is a server component (no 'use client') — Next.js convention, 404 pages don't receive reset props
- apiSuccess/apiError use 'as const' on success field — TypeScript discriminated union narrows correctly
- Existing 15+ API routes NOT refactored — helpers available for incremental adoption to minimize diff scope

### Phase 13 Decisions (from Plan 13-03)
- request.ip removed — not available on NextRequest in Next.js 16; IP sourced from x-forwarded-for header only (Rule 1 auto-fix)
- Rate limit logic for /api/ routes runs before updateSession() auth check — avoids unnecessary Supabase auth round-trip on blocked requests
- logger.ts NOT imported in middleware — Edge runtime safe; logger is for API route and server-side use only
- cleanup() called on every rate-limited request but only executes every 60s (lastCleanup guard) — avoids per-request Map scan

### Phase 13 Decisions (from Plan 13-04)
- pnpm --frozen-lockfile in CI — enforces lockfile consistency, fails if pnpm-lock.yaml diverges from package.json
- Node 20 LTS in CI — matches Vercel default build environment
- Placeholder NEXT_PUBLIC_* env vars in CI build step — Next.js inlines these at build time; without placeholders the build fails; server-side-only vars not needed
- No test step in CI yet — Plan 06 adds Vitest step after test infrastructure is configured
- Supabase Free tier: 7-day backup retention, no PITR; Pro tier: 14-day + PITR add-on
- Manual pg_dump recommended before major migrations as additional safety beyond automated backups

*Last updated: 2026-03-05 (Phase 13 Plan 03 complete — rate limiter, structured logger, middleware x-request-id + 429 rate limiting)*
