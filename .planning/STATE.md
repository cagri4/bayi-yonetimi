# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01)

**Core value:** Bayilerin mesai saatlerinden bagimsiz, anlik stok ve fiyat bilgisiyle siparis verebilmesi — AI agent'lar ile 7/24 otonom is surecleri.

**Current focus:** v3.0 — Multi-Tenant SaaS + AI Agent Ecosystem

## Current Position

Phase: 9 — Agent Infrastructure Foundation
Plan: 01 of 05 complete
Status: IN PROGRESS — Plan 01 executed (migration SQL, service client, TypeScript types)
Last activity: 2026-03-01 — Phase 9 Plan 01 complete (agent tables migration, createServiceClient, database.types.ts)

Progress: [██████░░░░] 22% — Phase 9 Plan 01 complete, Plan 02 next

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

### v3.0 Phase Dependencies (strict)
- Phase 8 (Multi-Tenant) → blocks Phase 9
- Phase 9 (Agent Infrastructure) → blocks Phase 10
- Phase 10 (First Agents) → blocks Phase 11
- Phase 11 (Financial + Ops Agents) → blocks Phase 12

### Pending Todos
- None carried over from v2.0
- Phase 8 requires staging environment copy of production data for migration dry-run
- Claude API key needed for Phase 9+ (user has key from another project)

### Blockers/Concerns
- Database SQL execution requires Dashboard SQL Editor (no CLI access token)
- Phase 8 migration must be dry-run on staging before production (700 dealers, 20+ tables)
- Telegram multi-bot management: 12 bots need automated webhook registration strategy (research during Phase 9 planning)

## Session Continuity

Last session: 2026-03-01
Stopped at: Phase 9 Plan 01 COMPLETE — migration SQL (010_agent_tables.sql), createServiceClient() factory, database.types.ts updated with 6 agent tables + RPC type. Ready for Plan 09-02.
Resume file: None

---
*Last updated: 2026-03-01*
