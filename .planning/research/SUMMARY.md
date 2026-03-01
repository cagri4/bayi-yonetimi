# Project Research Summary

**Project:** Bayi Yonetimi v3.0 -- Multi-Tenant SaaS + AI Agent Ecosystem
**Domain:** B2B Dealer Management SaaS with 12 AI Digital Workers
**Researched:** 2026-03-01
**Confidence:** HIGH (stack, multi-tenant) / MEDIUM-HIGH (agent ecosystem)

## Executive Summary

v3.0 transforms the existing single-tenant B2B dealer management system into a multi-tenant SaaS platform with 12 AI digital workers (not assistants -- autonomous agents that replace human business roles) accessible via Telegram. Research across all four domains (stack, features, architecture, pitfalls) converges on a clear consensus: **multi-tenancy must be completed before any agent work begins**, and the agent ecosystem should be built incrementally in role-based groups ordered by risk and dependency. The existing Next.js 16 + Supabase stack requires only two new packages (`@anthropic-ai/sdk` and `grammy`) -- a remarkably lean addition for the scope of the transformation.

The recommended approach is shared-schema multi-tenancy using Supabase RLS with `company_id` on all 20+ existing tables, JWT claim injection for tenant isolation, and a `current_company_id()` SECURITY DEFINER function as the policy anchor. For the agent ecosystem, all four researchers agree: agent-per-role with specialized tool sets outperforms general-purpose assistants by a wide margin (45% faster resolution, 60% better accuracy per Anthropic's own multi-agent research). The architecture centers on a single `AgentRunner` class that executes Claude tool-calling loops, with each agent loading only its own tools. Telegram webhooks hit Next.js API routes, respond HTTP 200 immediately, and process via `after()` in Vercel Fluid Compute (up to 800s). Agent-to-agent communication uses lightweight direct tool calls (no Claude invocation) for data queries, reserving full sub-agent loops for complex reasoning tasks only.

The critical risks, in order of severity, are: (1) cross-company data leakage from unmigrated materialized views and stale admin RLS policies -- this is catastrophic and unrecoverable; (2) Telegram webhook timeout loops causing cost multiplication when Claude processing exceeds response windows; (3) unbounded Claude API costs from long conversations without token budgets -- a 700-dealer deployment could reach $14,000/month without controls; and (4) agent hallucination on financial data leading to incorrect business decisions. All four risks have concrete, proven prevention strategies documented in the research. The key insight is that cost controls and security boundaries must be foundational infrastructure, not retrofitted features.

## Key Findings

### Recommended Stack

Only 2 new npm packages are needed. Both are server-side only with zero client bundle impact.

**Core technology additions:**
- **`@anthropic-ai/sdk` ^0.78.0:** Direct Claude API access for all 12 agents -- chosen over Vercel AI SDK because this is a Claude-only project; raw SDK provides prompt caching, `betaZodTool()` (Zod v4 already in stack), and `messages.toolRunner()` without abstraction overhead
- **`grammy` ^1.41.0:** TypeScript-first Telegram bot framework with explicit Vercel webhook support via `webhookCallback('std/http')` -- chosen over Telegraf for cleaner TypeScript types and active maintenance
- **Vercel Fluid Compute (config change):** Enable `maxDuration = 300` on webhook routes (up to 800s on Pro plan) for Claude tool-calling loops that can take 60-120 seconds

**Explicitly rejected (all researchers agree):**
- Vercel AI SDK (unnecessary abstraction for single-provider), LangChain/LangGraph (over-engineered for 12 fixed roles), pgvector (dealers search by code/name, not semantics), Redis (prompt caching eliminates need), separate message queue (Telegram 30s window + `after()` is sufficient), schema-per-tenant (overkill until 50+ tenants)

**Model tiering by agent role:**
- Haiku 4.5 ($1/$5 per MTok): Sales Rep, Field Sales, Collections, Warehouse, Distribution, Procurement, Quality/Returns, Product Manager (8 of 12 agents)
- Sonnet 4.6 ($3/$15 per MTok): Executive Advisor, Accountant, Marketing, Trainer (4 agents requiring complex reasoning or creative output)
- With prompt caching: 90% cost reduction on stable tokens (system prompts + tool definitions)

**Cost projection at 700 dealers:**
- Conservative (20% daily active, 5 msg/day): ~$800/month
- With per-dealer token budgets (50K/day soft, 100K hard): ~$630/month ceiling
- Without any controls: up to $14,000/month

### Expected Features

**Must have -- Multi-Tenant Infrastructure (table stakes for SaaS):**
- `companies` table as root tenant entity with slug, plan tier, settings
- `company_id` column on all 20+ existing tables with NOT NULL constraint after backfill
- All RLS policies updated with `company_id = current_company_id()` as first condition
- JWT claim injection via Supabase Custom Access Token Hook
- `superadmin` role for SaaS platform operator, distinct from company `admin`
- Company-scoped admin authentication (admin of Company A cannot see Company B)
- Materialized view (`dealer_spending_summary`) rebuilt with company_id and wrapped in RPC function

**Must have -- Agent Infrastructure (blocks all 12 agents):**
- `AgentRunner` class with Claude tool-calling loop (max 10 iterations)
- `ToolRegistry` per agent role (each agent loads only its own 4-7 tools)
- `ConversationManager` with rolling window (last 50 messages) + periodic summarization
- Telegram webhook with immediate 200 response + `after()` background processing
- Telegram `update_id` idempotency (prevent duplicate processing on retries)
- `AgentBridge` for cross-agent tool calls (direct DB query, no Claude invocation)
- Per-dealer daily token budget with soft/hard limits
- Depth limit (max 5) and cycle detection for agent-to-agent calls
- Agent conversation storage: `agent_definitions`, `agent_conversations`, `agent_messages`, `agent_calls` tables

**Should have -- First Agent Group (launch with):**
- Egitimci (Trainer): read-only, lowest risk, validates full pipeline
- Satis Temsilcisi (Sales): highest dealer value, 6 tools using existing data
- Muhasebeci (Accountant): financial queries, read-only, second most requested
- Depo Sorumlusu (Warehouse): internal operations, validates write tools
- Genel Mudur Danismani (Executive): reads all data, build last, high demo value

**Defer to v3.1+:**
- Collections, Field Sales, Distribution, Marketing (need existing core agents proven first)
- Procurement, Product Manager, Returns/Quality (need new DB tables)
- All agent-to-agent handoffs (need both participating agents to exist)
- Proactive daily briefings (need usage patterns validated first)
- ERP real-time sync, voice interface, A2A cross-vendor protocol, predictive ML

### Architecture Approach

The architecture is a 4-layer system: Presentation (Next.js App Router + Telegram bots), API/Webhook (Server Actions + API routes), Agent Layer (AgentRunner + ToolRegistry + ConversationManager + AgentBridge), and Data Layer (Supabase PostgreSQL with RLS). The critical design decision is that agent dispatch happens inside the Next.js webhook handler -- no separate agent server. All 12 agent roles are instantiated on-demand per incoming message, with session state persisted in Supabase. The agent layer uses the service role key (bypasses RLS intentionally) but enforces company scoping in code via a mandatory `companyId` parameter on every tool handler.

**Major components:**
1. **Multi-Tenant Data Layer** -- `companies` table as root, `company_id` FK on all tables, `current_company_id()` SECURITY DEFINER function, JWT claim injection, composite indexes on `(company_id, dealer_id)`
2. **Telegram Webhook Handler** -- `/api/telegram/[agentId]/route.ts` validates secret token, responds 200 immediately, processes in `after()` with Fluid Compute
3. **AgentRunner** -- Claude API tool-calling loop with iteration cap (10), model selection per role, prompt caching on system prompts and tool definitions
4. **ToolRegistry** -- Per-role tool sets (4-7 tools each, NOT all 120 tools on every agent); tools are wrappers around existing Server Actions with company scoping
5. **ConversationManager** -- DB-backed message history with rolling window (50 active messages), automatic archival and summarization via Haiku for older context
6. **AgentBridge** -- Lightweight cross-agent tool calls via internal HTTP POST (no Claude invocation for data queries); full agent loop only for reasoning tasks; logged to `agent_calls` audit table

**New file structure:**
- `src/lib/agents/` -- entire new subsystem (runner.ts, conversation.ts, bridge.ts, telegram.ts)
- `src/lib/agents/tools/` -- one file per agent role + registry.ts + common-tools.ts
- `src/lib/agents/system-prompts/` -- role-specific system prompts as TypeScript templates
- `src/app/api/telegram/[agentId]/route.ts` -- dynamic webhook handler for all 12 bots
- `src/app/api/agents/[agentId]/tools/route.ts` -- internal cross-agent tool endpoint
- `src/lib/supabase/service.ts` -- new service role client for agent layer only

### Critical Pitfalls

All four researchers identified overlapping concerns. Here are the top 8 pitfalls ranked by severity and cross-researcher consensus:

1. **Materialized view exposes cross-company data** -- PostgreSQL does NOT support RLS on materialized views. The existing `dealer_spending_summary` will leak all companies' financial data after company_id migration. Prevention: rebuild view with company_id in SELECT/GROUP BY, wrap in RPC function with company filter, never expose directly via Supabase API. Phase: Multi-Tenant DB Migration. Severity: CRITICAL.

2. **company_id backfill fails on live system** -- Adding NOT NULL without backfill crashes migration; adding nullable and forgetting to constrain later creates silent integrity bugs. Prevention: 3-step pattern (add nullable, backfill from related tables, verify zero NULLs then add NOT NULL + FK + index). Phase: Multi-Tenant DB Migration. Severity: CRITICAL.

3. **Admin RLS policies become cross-company** -- Existing `is_admin()` has no company scope. After migration, any admin can access all companies' data. Prevention: replace with `is_company_admin()` that checks both role AND company_id; introduce separate `superadmin` role. Phase: Multi-Tenant DB Migration. Severity: CRITICAL.

4. **Telegram webhook sync timeout causes retry loop** -- Awaiting Claude API in webhook handler causes Vercel timeout, Telegram retries, cost multiplication. Prevention: respond 200 immediately, process in `after()`, implement `update_id` deduplication. Phase: Agent Infrastructure. Severity: CRITICAL.

5. **Agent uses service role key without company scoping** -- Bypasses all RLS; any tool bug exposes cross-company data. Prevention: every tool handler receives `companyId` as mandatory parameter; never query without it; use typed `AgentToolHandler` signature. Phase: Agent Infrastructure. Severity: CRITICAL.

6. **Claude API cost explosion** -- Unbounded conversations grow exponentially expensive. A 30-turn Sonnet conversation costs $0.60+ per message in input tokens alone. Prevention: 20-turn session limit with summarize-and-reset, per-dealer daily token budget (50K soft/100K hard), model tiering (Haiku for 8/12 agents), minimal structured tool results (80 tokens, not 2000). Phase: Agent Infrastructure. Severity: HIGH.

7. **Agent hallucination on financial data** -- LLMs confabulate when data is absent. Financial agents stating wrong amounts has real monetary impact. Prevention: system prompt mandates tool-only responses for financial facts, structured output validation with confirmation tokens, human confirmation for write operations. Phase: Individual Agent Implementation. Severity: HIGH.

8. **Agent-to-agent deadlock and infinite loops** -- Without cycle detection and depth limits, cross-agent calls create distributed system deadlocks. Prevention: `depth > 5` guard, `call_trace` array for cycle detection, 10 tool calls per turn cap, 30-second timeout per sub-call. Phase: Agent Infrastructure. Severity: HIGH.

## Implications for Roadmap

Based on combined research, v3.0 should be structured into 5 phases following strict dependency order.

### Phase 1: Multi-Tenant Database Migration
**Rationale:** This is the absolute prerequisite. Every other phase depends on company_id isolation being complete and correct. All four researchers agree: multi-tenancy must be done first, done completely, and verified exhaustively before any agent work begins. A single RLS policy oversight creates unrecoverable trust damage.

**Delivers:**
- `companies` table with seed company for existing 700 dealers
- `company_id` column on all 20+ existing tables (3-step: nullable, backfill, constrain)
- `current_company_id()` and `is_company_admin()` SECURITY DEFINER functions
- All existing RLS policies updated with `company_id` as first condition
- `superadmin` role for platform operator
- Materialized view rebuilt with company_id + RPC wrapper
- Composite indexes on `(company_id, dealer_id)` for all tenant-scoped tables
- JWT claim injection via Custom Access Token Hook
- Database types regenerated

**Addresses features:** Multi-tenant infrastructure (all table stakes)
**Avoids pitfalls:** #1 materialized view exposure, #2 backfill failure, #3 admin RLS escalation
**Estimated complexity:** HIGH -- touches every table, every policy, live data migration
**Research flag:** Standard Supabase RLS patterns, well-documented. No additional research needed. Focus on exhaustive verification testing.

---

### Phase 2: Agent Infrastructure Foundation
**Rationale:** All 12 agents depend on this shared infrastructure. Building it correctly -- with cost controls, security boundaries, and deadlock guards baked in from the start -- prevents every "retrofit" pitfall identified in research. This phase produces zero user-visible agents but is the most architecturally critical phase of v3.0.

**Delivers:**
- `agent_definitions`, `agent_conversations`, `agent_messages`, `agent_calls` tables
- `src/lib/supabase/service.ts` -- service role client for agent layer
- `AgentRunner` class with Claude tool-calling loop, iteration cap, model selection
- `ToolRegistry` base class with company-scoped execution pattern
- `ConversationManager` with rolling window (50 messages) + archival + summarization
- Telegram webhook route (`/api/telegram/[agentId]/route.ts`) with immediate 200 response + `after()` processing
- `update_id` idempotency in database
- `AgentBridge` with depth limit, cycle detection, tool call cap
- `/api/agents/[agentId]/tools/route.ts` for internal cross-agent calls
- Per-dealer daily token budget tracking
- Prompt caching configuration (`cache_control` on system prompts + tool definitions)
- Common tools (dealer lookup, company config)
- Agent definition seeding for all 12 roles

**Addresses features:** Agent infrastructure (all prerequisite features)
**Avoids pitfalls:** #4 webhook timeout loop, #5 service key bypass, #6 cost explosion, #8 deadlock
**Estimated complexity:** HIGH -- new subsystem, multiple integration points
**Research flag:** NEEDS RESEARCH on Telegram bot registration workflow (one bot per agent vs single bot with routing), webhook secret management for 12 bots, and `after()` error handling patterns in Next.js 16.

---

### Phase 3: First Agent Group -- Dealer-Facing, Low Risk
**Rationale:** Start with the lowest-risk, highest-value agents. Trainer is read-only (zero financial risk) and validates the entire pipeline end-to-end. Sales Rep is the highest dealer value (replaces WhatsApp order taking) and uses only existing data. These two agents prove the architecture works before touching financial data.

**Delivers:**
- **Egitimci (Trainer)** -- 2 tools: `get_product_info`, `get_faq`. Read-only. Uses existing products and FAQ tables. System prompt tested with adversarial prompts.
- **Satis Temsilcisi (Sales Rep)** -- 6 tools: `get_catalog`, `create_order`, `get_order_status`, `get_campaigns`, `check_stock`, `get_dealer_profile`. Highest business value.
- Role-specific system prompts in Turkish
- Tool implementations wrapping existing Server Actions with company scoping
- End-to-end Telegram conversation flow validated

**Addresses features:** First agents (launch with), table stakes for AI ecosystem
**Avoids pitfalls:** #7 hallucination (trainer is factual only; sales tools return structured data)
**Estimated complexity:** MEDIUM -- infrastructure exists from Phase 2; focus is on tool quality and prompt engineering
**Research flag:** Standard patterns. Focus on Turkish language prompt engineering and adversarial testing. No additional research needed.

---

### Phase 4: Financial and Operations Agents
**Rationale:** After the pipeline is validated with low-risk agents, add financial agents (highest business value after Sales) and operations agents (Warehouse validates write operations). The Accountant is read-only financial access -- the safest entry into financial agent territory. Executive Advisor comes last because it needs all other agents' data tools to exist.

**Delivers:**
- **Muhasebeci (Accountant)** -- 5 tools: `get_financials`, `get_payment_history`, `get_invoices`, `get_dealer_balance`, `export_report`. Read-only. System prompt enforces "never state financial facts without tool evidence."
- **Depo Sorumlusu (Warehouse)** -- 5 tools: `get_inventory_status`, `get_pending_orders`, `update_stock`, `check_reorder_level`, `get_shipments`. First agent with write operations.
- **Genel Mudur Danismani (Executive Advisor)** -- 6+ tools: ALL read-only tools from other agents + `get_dashboard_summary`, `export_report`. Uses Sonnet 4.6 for complex reasoning.
- Cross-agent tool calls: Sales asks Warehouse for stock, Executive reads all domains
- Financial hallucination prevention verified with adversarial prompts

**Addresses features:** Financial agents (P1), operations agents (P2), executive (P2)
**Avoids pitfalls:** #7 financial hallucination (strict tool-only response rules), #8 cross-agent deadlock (bridge with guards)
**Estimated complexity:** MEDIUM-HIGH -- financial agents require careful prompt engineering and exhaustive testing
**Research flag:** NEEDS RESEARCH on Turkish financial terminology for agent prompts (borc/alacak, fatura, irsaliye, cari hesap vocabulary). Also research write-operation confirmation UX in Telegram (inline keyboards for approve/reject).

---

### Phase 5: Extended Agent Ecosystem
**Rationale:** After core agents are proven in production, expand to the remaining 7 agents. These require new database tables (dealer_visits, sales_targets, suppliers, purchase_orders, return_requests, quality_complaints, collection_activities) and have dependencies on existing agents. Build in sub-groups based on data dependencies.

**Delivers:**
- **Group A -- Financial extensions:** Tahsilat Uzmani (Collections, builds on Accountant data)
- **Group B -- Operations extensions:** Dagitim Koordinatoru (Distribution), Saha Satis Sorumlusu (Field Sales -- needs new dealer_visits table)
- **Group C -- Business intelligence:** Pazarlamaci (Marketing), Urun Yoneticisi (Product Manager)
- **Group D -- Supply chain:** Satin Alma Sorumlusu (Procurement -- needs suppliers/PO tables, depends on Warehouse)
- **Group E -- Quality:** Iade/Kalite Sorumlusu (Returns -- needs return_requests table)
- All agent-to-agent handoff workflows
- Proactive notification system (daily briefings per agent)
- New database tables for agents requiring net-new data

**Addresses features:** Extended ecosystem (v3.1), all remaining agents
**Avoids pitfalls:** All pitfalls addressed by infrastructure from Phase 2; focus is on per-agent prompt quality
**Estimated complexity:** HIGH (volume -- 7 agents + new tables, but each individual agent is MEDIUM)
**Research flag:** NEEDS RESEARCH on Field Sales visit tracking patterns, Procurement workflow for Turkish B2B distributors, and returns/quality management domain specifics.

---

### Phase Ordering Rationale

**Dependency chain is strict and non-negotiable:**
- Multi-tenant isolation (Phase 1) blocks everything -- agents operating on un-isolated data is a security catastrophe
- Agent infrastructure (Phase 2) blocks all agents -- building agents without cost controls and security boundaries creates technical debt that compounds with each agent added
- First agents (Phase 3) validate the pipeline with minimum risk before financial data is touched
- Financial/operations agents (Phase 4) add business value incrementally, with each agent proving a new capability layer
- Extended ecosystem (Phase 5) is parallel work once the foundation is solid

**Grouping logic:**
- Phase 1 is pure database work (SQL migrations, RLS policies) -- no application code
- Phase 2 is pure infrastructure (no user-visible features) -- framework and plumbing
- Phase 3 is the proof point -- 2 agents that validate everything works
- Phase 4 adds the high-value agents that make v3.0 compelling
- Phase 5 completes the ecosystem at lower urgency

**Risk mitigation sequence:**
- Security-critical work (RLS, company isolation) before any new features
- Cost controls before any Claude API calls in production
- Read-only agents before write-capable agents
- Single-agent validation before cross-agent communication
- Low-financial-risk agents before financial data agents

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 2 (Agent Infrastructure):** Telegram multi-bot management (12 bots, webhook registration automation), `after()` error handling and retry patterns in Next.js 16, Vercel Fluid Compute behavior under concurrent webhook load
- **Phase 4 (Financial Agents):** Turkish financial terminology for agent prompts, write-operation confirmation UX in Telegram inline keyboards, audit trail requirements for financial agent actions
- **Phase 5 (Extended Ecosystem):** Field sales visit tracking domain patterns, Turkish B2B procurement workflows, returns/quality management regulatory requirements

**Phases with standard patterns (skip research):**
- **Phase 1 (Multi-Tenant Migration):** Supabase RLS multi-tenant patterns are exhaustively documented in official docs and community guides
- **Phase 3 (First Agents):** Claude tool calling is well-documented, Telegram bot interaction is standard, product catalog and order tools map directly to existing Server Actions

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only 2 new packages, both verified on npm with current versions. Anthropic SDK 0.78.0 confirmed. grammY 1.41.0 confirmed. Zod v4 compatibility verified via `betaZodTool`. |
| Features -- Multi-Tenant | HIGH | Shared schema + RLS is industry standard for B2B SaaS at this scale. Confirmed by AWS, Azure, Supabase official docs, and Citus multi-tenant guides. |
| Features -- Agent Roles | MEDIUM | Agent-per-role architecture validated by Anthropic multi-agent research. Individual role capabilities inferred from comparable B2B platforms (BeatRoute, HighRadius, ZBrain). Mapping to this specific business needs involves judgment. |
| Architecture -- Multi-Tenant | HIGH | Supabase custom access token hook, JWT claim injection, `current_company_id()` SECURITY DEFINER -- all from official Supabase docs. Migration pattern from Citus docs. |
| Architecture -- Agent Ecosystem | MEDIUM | Claude API tool calling loop verified from official docs. AgentRunner/ToolRegistry/ConversationManager/AgentBridge patterns are design decisions informed by research but not copied from a single reference implementation. |
| Pitfalls | HIGH | All critical pitfalls sourced from official docs (Supabase RLS footguns, Anthropic advanced tool use, Telegram webhook guides) and community post-mortems. Cost calculations verified against official Anthropic pricing page. |

**Overall confidence: MEDIUM-HIGH**

Multi-tenancy is HIGH confidence -- well-trodden ground. Agent ecosystem is MEDIUM -- the individual technologies are proven (Claude API, Telegram, Supabase) but their integration into a 12-agent system at this scale is project-specific design. The research provides strong architectural patterns but implementation will require iterative refinement, particularly around prompt engineering and cost optimization.

### Gaps to Address

**Telegram multi-bot management at scale:**
- Research confirms grammY webhook pattern for a single bot. Managing 12 bots (12 tokens, 12 webhook registrations, per-company bot provisioning) needs a deployment automation strategy. Handle during Phase 2 planning.

**Agent prompt engineering in Turkish:**
- Claude has strong Turkish language capability, but financial and business terminology (borc/alacak, cari hesap, fatura, irsaliye, KDV) requires domain-specific prompt testing. Handle during Phase 4 with native speaker review.

**Vercel `after()` reliability under load:**
- `after()` is stable in Next.js 16 but its behavior under concurrent webhook load (50+ dealers messaging simultaneously) is not extensively documented. Monitor during Phase 3 rollout; fall back to Upstash QStash if needed.

**Per-company agent customization:**
- Research assumes all companies use the same 12 agents. In practice, companies may want different agent configurations, custom system prompts, or different model selections. The `agent_definitions` table supports this, but the admin UI for it is not in scope for v3.0. Handle post-launch.

**Existing data migration verification:**
- The company_id backfill for 700 dealers across 20+ tables requires zero-NULL verification. Research provides the pattern but the actual migration must be tested on a staging copy of production data before running live. Handle during Phase 1 execution with a staging environment.

**Cost model validation:**
- The $800/month conservative estimate assumes 20% daily active users with 5 messages each. Actual usage patterns are unknown until agents are live. Implement comprehensive token tracking from day one and review after 2 weeks of Phase 3 production usage. Adjust model tiering and token budgets based on real data.

## Sources

### Primary (HIGH confidence)
- [Anthropic TypeScript SDK -- GitHub](https://github.com/anthropics/anthropic-sdk-typescript) -- SDK features, betaZodTool, toolRunner
- [@anthropic-ai/sdk -- npm 0.78.0](https://www.npmjs.com/package/@anthropic-ai/sdk) -- Version verification
- [Claude API Pricing 2026 -- Official](https://platform.claude.com/docs/en/about-claude/pricing) -- Cost calculations
- [Claude Prompt Caching -- Official](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) -- 90% cost reduction
- [Claude Tool Calling -- Official](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) -- Tool use patterns
- [grammY -- Official](https://grammy.dev/) -- Bot framework, Vercel hosting guide
- [grammY npm 1.41.0](https://www.npmjs.com/package/grammy) -- Version verification
- [Vercel Fluid Compute](https://vercel.com/docs/fluid-compute) -- maxDuration, after() behavior
- [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) -- JWT claim injection
- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) -- Multi-tenant policies
- [Supabase Postgres Best Practices for AI Agents](https://supabase.com/blog/postgres-best-practices-for-ai-agents) -- Conversation storage

### Secondary (MEDIUM confidence)
- [Multi-Tenant Applications with RLS on Supabase](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/) -- Implementation patterns
- [VoltAgent Supabase Memory Pattern](https://voltagent.dev/docs/agents/memory/supabase/) -- Agent conversation storage
- [Postgres RLS Footguns -- Bytebase](https://www.bytebase.com/blog/postgres-row-level-security-footguns/) -- Pitfall identification
- [Multi-Agent Orchestration Collapse -- DEV](https://dev.to/onestardao/-ep-6-why-multi-agent-orchestration-collapses-deadlocks-infinite-loops-and-memory-overwrites-1e52) -- Deadlock patterns
- [AI Agent Design Patterns -- Microsoft Azure](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) -- Architecture reference
- [How AI Agents Will Transform B2B Sales -- BCG](https://www.bcg.com/publications/2025/how-ai-agents-will-transform-b2b-sales) -- Business case
- [Anthropic Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system) -- Multi-agent patterns

### Tertiary (LOW confidence, needs validation)
- [Telegram B2B Business Promotion](https://magnetto.com/blog/top-ways-to-promote-your-b2b-business-on-telegram) -- Turkish B2B Telegram adoption rates (secondary source)
- [Multi-Tenant AI Agent Architecture -- Fast.io](https://fast.io/resources/ai-agent-multi-tenant-architecture/) -- General multi-tenant agent patterns (not Supabase-specific)
- Agent-per-role performance statistics (45%/60% improvement) -- from Anthropic blog, specific numbers may vary by domain

---
*Research completed: 2026-03-01*
*Ready for roadmap: yes*
*Synthesized from: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md*
