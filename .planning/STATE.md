# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01)

**Core value:** Bayilerin mesai saatlerinden bagimsiz, anlik stok ve fiyat bilgisiyle siparis verebilmesi — AI agent'lar ile 7/24 otonom is surecleri.

**Current focus:** v3.0 — Multi-Tenant SaaS + AI Agent Ecosystem

## Current Position

Phase: 8 — Multi-Tenant Database Migration
Plan: —
Status: Not started (roadmap complete, ready for planning)
Last activity: 2026-03-01 — v3.0 roadmap created (5 phases, 68 requirements mapped)

Progress: [░░░░░░░░░░] 0% — Phase 8 of 12

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
- RLS: Uses is_admin() SECURITY DEFINER function
- All 8 migrations applied, seed data present

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
Stopped at: v3.0 roadmap created — ready to plan Phase 8
Resume file: None

---
*Last updated: 2026-03-01*
