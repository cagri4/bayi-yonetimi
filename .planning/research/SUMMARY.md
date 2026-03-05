# Project Research Summary

**Project:** Bayi Yönetimi — v4.0 Agent-Native SaaS Onboarding & Marketplace
**Domain:** B2B Dealer Management SaaS — Conversational Onboarding + Per-Agent Billing + Agent Marketplace + Superadmin Panel
**Researched:** 2026-03-05
**Confidence:** HIGH (stack, architecture, pitfalls) / MEDIUM-HIGH (features)

---

## Executive Summary

This milestone transforms an existing multi-tenant Telegram-first B2B SaaS (12 deployed AI agents, 38 web routes, production Supabase + Vercel infrastructure) into an agent-native platform with conversational onboarding, per-agent subscription billing, and an agent marketplace. The v3.0 stack is frozen and validated — all research covers only net-new additions. The recommended approach is surgical integration: three new production packages, four to seven new database tables, one new Telegram bot (the 13th "Kurulum Sihirbazi" setup wizard), and two new route groups (superadmin panel and billing webhooks). The wizard must be architecturally isolated from the existing AgentRunner/dispatcher pipeline because it operates before a company record exists — a dedicated DB-backed finite state machine (WizardOrchestrator) is the correct pattern; AgentRunner must not be used here.

The recommended stack additions are iyzipay 2.0.65 for Turkish subscription billing (Stripe does not support Turkish merchant accounts as of 2026), @grammyjs/conversations 2.1.1 with @grammyjs/storage-supabase 2.5.0 for wizard state persistence in serverless environments, and standard Next.js Server Actions plus Supabase service role for the superadmin panel. Per-agent billing is implemented at the application layer (one subscription per company, agent count drives monthly TRY price) because iyzico does not natively support per-seat billing. The "digital employee" mental model — framing agents as hires rather than feature toggles — is the emerging standard for AI agent SaaS and directly informs copy and UX decisions across the entire milestone. Note: ARCHITECTURE.md recommends against the grammY conversations plugin in favor of a custom WizardOrchestrator FSM due to the existing webhook pattern not instantiating a full grammY Bot object — the phase author must resolve this before writing wizard code.

The top risks are architectural, not technical: partial DB records from wizard dropout (mitigate with a staging-first onboarding_sessions table and a single atomic commit transaction), billing state diverging from agent active state (mitigate by making billing the sole writer to is_active), iyzico webhook double-processing (mitigate with immediate 200 response plus paymentId-keyed idempotency store), and superadmin cross-tenant writes (mitigate with mandatory company_id parameters and a superadmin audit log). A 3-day grace period on payment failure and proactive trial expiry warnings at T-7 and T-1 days are required to avoid abrupt mid-conversation cutoffs that drive churn. All pitfalls have concrete prevention strategies derived from official iyzico, Telegram, and Supabase documentation plus direct codebase analysis.

---

## Key Findings

### Recommended Stack

The v3.0 stack (Next.js 16, React 19, Supabase JS 2.91+, grammY 1.41, Anthropic SDK 0.78, Tailwind 4, Zustand 5, Zod 4, Vercel Fluid Compute) is unchanged. Three production packages and one dev type definition are added. All are server-side only with zero client bundle impact.

**Core technologies — new additions:**
- `iyzipay ^2.0.65`: Turkish subscription billing — required because Stripe has no Turkish merchant account support; iyzico is the TCMB-licensed market leader, with a maintained npm package (published February 2026) and a native subscription API supporting trial periods, plan upgrades, and recurring charges; per-seat billing is implemented at the application layer
- `@grammyjs/conversations ^2.1.1`: Wizard state machine — models the multi-step onboarding flow as sequential async code; requires external storage on Vercel serverless (peer dep: grammy ^1.20.1, compatible with existing 1.41); ARCHITECTURE.md recommends against this in favor of a custom FSM
- `@grammyjs/storage-supabase ^2.5.0`: Persists wizard conversation state between serverless invocations using existing Supabase infrastructure — zero new infrastructure dependency if using the conversations plugin
- `@types/iyzipay ^2.0.3` (dev): Community DefinitelyTyped types for the callback-based iyzipay SDK; callbacks must be promisified manually with a thin wrapper

**Environment variables to add:** `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_BASE_URL` (sandbox vs. prod URL switch), `SUPERADMIN_USER_IDS` (comma-separated Supabase user UUIDs).

**What NOT to add:** PayTR (community npm packages abandoned 2022), Paddle/Lemon Squeezy (MoR services priced for global SaaS, add currency conversion costs on TRY), grammY Scenes plugin (superseded by conversations plugin), separate feature flag service (agent billing state belongs in app DB), Clerk/Auth0 for superadmin (already have Supabase Auth), BullMQ (iyzico subscription API handles recurring charge scheduling autonomously).

### Expected Features

**Must have (table stakes — v4.0 milestone fails without these):**
- Superadmin: create company + generate single-use invite deep link (UUID token, 7-day expiry)
- Superadmin: companies dashboard showing all tenants, trial status, active agent count
- Kurulum Sihirbazi: /start validates invite token, links Telegram chat_id to company
- Wizard: collects company profile conversationally (name, sector, admin email, plan selection)
- Wizard: introduces 3-4 key agents with mini-demonstrations (not all 12 — research shows 12 in one session causes dropout)
- Wizard: auto-populates DB on confirmation via single atomic transaction
- Trial period: 14 days, all 12 agents active by default, trial_ends_at column on companies
- Trial countdown notifications: Telegram messages at T-7 and T-1 days to company admin
- agent_subscriptions table: one row per company+agent; is_active, monthly_price, is_trial columns
- Dijital Ekibim page: list all 12 agents with activate/deactivate toggle and monthly cost calculator
- Webhook gate: checkAgentAccess() inside after() before dispatchAgentUpdate() — enforced for all 12 existing routes

**Should have (differentiators that justify per-agent pricing model):**
- "Digital employee" mental model in copy — "Ise Al" / "Aylik maas: X TL" framing throughout
- Sequential agent introductions in wizard (live capability demo, not a feature list)
- Trial progress indicator: proactive Telegram nudge during trial to drive activation ("Day 7 of 14 — 3 agents not yet activated")
- Onboarding completion celebration message ("your digital team is ready" with full roster)
- Superadmin: one-click trial extension (update trial_ends_at + notify user)
- Usage stats per agent in marketplace (message count, last active) — data-driven reason to keep each agent

**Defer to v4.x (validate core flow with 2-3 real tenants first):**
- Full 12-agent introduction sequence in wizard (currently: 4 key agents)
- Domain-specific data collection per agent during setup (each agent collects its own setup data)
- Wizard resumption from interrupted state

**Defer to v5.0+:**
- Automated iyzico payment collection — v4.0 billing is manual (invoice/EFT + DB flag); iyzico SDK wired up but full automation deferred
- Self-service tenant signup — Turkish SMB market is relationship-driven; superadmin-provisioned invite outperforms cold self-signup at this stage
- Outcome-based pricing — requires 6+ months of agent performance data
- WhatsApp channel for onboarding

### Architecture Approach

The v4.0 additions integrate with existing infrastructure via clearly defined seams. The wizard (Kurulum Sihirbazi) is a fully isolated subsystem: its own Telegram bot token, its own webhook route (`/api/telegram/sihirbaz/route.ts`), its own state persistence in `onboarding_sessions`, and a WizardOrchestrator FSM that shares only the Supabase service client with the rest of the app. It does not use AgentRunner, dispatcher.ts, or ConversationManager because those require an existing dealer + company record that does not exist during onboarding. The subscription guard (`subscription-guard.ts`) is a new module called inside `after()` in each of the 12 existing webhook routes before dispatchAgentUpdate — this is the single enforcement point for per-agent billing. The superadmin panel uses a new route group (`src/app/(superadmin)/superadmin/`) protected by middleware, with a service role Supabase client for cross-tenant access.

**Major components:**
1. **WizardOrchestrator** (`src/lib/agents/wizard-orchestrator.ts`) — DB-backed FSM with 7 states from AWAITING_COMPANY_NAME through COMPLETED; calls Claude Haiku only at confirmation step for natural language summary; reads/writes onboarding_sessions table
2. **subscription-guard.ts** (`src/lib/agents/subscription-guard.ts`) — `checkAgentAccess(companyId, agentRole)` reads subscriptions + agent_definitions tables; O(1) indexed lookups; called in all 12 existing webhook routes
3. **create-company.ts** (`src/lib/actions/create-company.ts`) — atomic Postgres transaction: companies then subscriptions then auth.createUser then users then 12 agent_definitions rows (selected=active, unselected=inactive); called by WizardOrchestrator at COMPLETED state
4. **Billing webhook route** (`/api/billing/webhook/route.ts`) — immediate 200, stores raw payload in payment_webhook_events, processes async; sole authority over agent_definitions.is_active; validates X-IYZ-SIGNATURE-V3 before any DB write
5. **Superadmin panel** (`src/app/(superadmin)/superadmin/`) — service role client, mandatory company_id scope on all server actions, audit log for all writes, soft-delete not hard DELETE
6. **New DB tables required**: onboarding_sessions, subscriptions, agent_marketplace, payment_webhook_events, superadmin_audit_log, onboarding_invites; plus grammy_conversations if using the conversations plugin

**Existing components modified:** dispatcher.ts (hard block on is_active=false instead of fallback to generic prompt), all 12 webhook routes (add subscription guard call inside after()), agent_definitions table (add subscription_tier column), companies table (add trial_ends_at column), middleware.ts (add /superadmin route protection).

**Build order (hard dependencies):** DB schema first, then company creation infrastructure, then wizard bot, then billing integration, then agent access gating, then superadmin panel.

### Critical Pitfalls

1. **Wizard creates orphan DB records on user dropout** — Avoid by writing only to `onboarding_sessions` staging table during wizard; create companies/users/agent_definitions in a single atomic transaction only when state reaches COMPLETED. Add pg_cron daily cleanup for expired sessions. Never INSERT directly into companies or users from wizard tool calls.

2. **Invite token replay attacks and link sharing** — Use one-time tokens (cryptographically random 64-char hex, stored as SHA-256 hash in DB). Mark `used_at` immediately on first use in a Postgres transaction. If `used_at IS NOT NULL`, reject with "Bu davet linki zaten kullanilmistir." Rate-limit /start attempts by chat_id (max 3 attempts per 10 minutes).

3. **Billing state and agent active state diverge (split-brain)** — Billing webhook must be the SOLE writer to `agent_definitions.is_active`. Marketplace UI updates a desired_agents intermediate state; billing webhook syncs desired to actual. Never let the UI toggle directly set is_active. Add daily reconciliation job to detect mismatches.

4. **iyzico webhook double-processing** — iyzico explicitly documents non-idempotent architecture and retries every 15 minutes up to 3 times. Implement: immediate 200 response, store raw payload in payment_webhook_events, process async. Use paymentId as idempotency key — check processed_at before any billing activation. Validate X-IYZ-SIGNATURE-V3 with HMAC-SHA256 using crypto.timingSafeEqual() before any DB write.

5. **Trial expiry causes mid-conversation cutoff** — Send proactive Telegram warnings at T-7, T-3, and T-1 days. On expiry, check at dispatch entry (not mid-tool-call). Allow current conversation turn to complete (soft cutoff), then block on next message with upgrade URL embedded in block message.

6. **Superadmin cross-tenant writes** — All superadmin server actions require explicit companyId parameter in function signature. All writes logged to superadmin_audit_log with old_value/new_value JSONB. Use soft-delete (deleted_at timestamp) not hard DELETE. Superadmin UI always shows active company context prominently.

7. **Payment failure disables agents mid-active-conversation** — Implement 3-day grace period: soft failure sends warning email plus Telegram to admin but does NOT disable agents; hard disable only after grace period, and only after checking for in-flight conversations (last_message < 5 minutes).

---

## Implications for Roadmap

Based on dependency analysis across all four research files, a 6-phase build order emerges. Schema must come first because everything depends on it. The wizard must come before billing because the wizard creates the company records that billing tracks. Access gating must come after billing because it reads subscription state. Superadmin panel comes last because it displays data from all other phases.

### Phase 1: Database Schema Foundation
**Rationale:** Every feature in v4.0 requires new tables or column additions. Nothing else can be built or tested without this. Schema migrations are also the safest unit of work — easy to review, easy to rollback, and they surface constraint design questions before code is written.
**Delivers:** `onboarding_sessions`, `subscriptions`, `agent_marketplace`, `payment_webhook_events`, `superadmin_audit_log`, `onboarding_invites` tables; `companies.trial_ends_at` and `agent_definitions.subscription_tier` columns; RLS policies for all new tables; agent_marketplace seeded with all 12 agent roles.
**Addresses:** All v4.0 features depend on schema being correct before code is written
**Avoids:** Pitfall 1 (staging table design prevents orphan records), Pitfall 2 (invite token schema with hash + used_at + single_use constraint), Pitfall 3 (subscriptions table as authoritative billing source)
**Research flag:** Standard Supabase migration pattern — skip additional research. Use Supabase Dashboard SQL Editor (no CLI access token available). All table structures fully specified in STACK.md and ARCHITECTURE.md.

### Phase 2: Company Creation Infrastructure
**Rationale:** The wizard's COMPLETED state calls createCompanyFromWizard(). This action must exist and be verified in isolation before the wizard is built around it. agent-defaults.ts (canonical system prompts for all 12 roles) is also required here since it is what seeds agent_definitions at company creation time.
**Delivers:** `agent-defaults.ts` with canonical names, models, and system prompts for all 12 agent roles; `create-company.ts` atomic server action that creates company + subscription + auth user + users row + 12 agent_definitions rows in a single transaction; verified end-to-end creation flow.
**Uses:** Supabase service role client, Supabase Auth Admin API (createUser)
**Avoids:** Pitfall 1 (atomic transaction — all 12 rows or none), Pitfall 10 from PITFALLS.md (audit log infrastructure ready)
**Research flag:** Standard pattern — skip additional research.

### Phase 3: Kurulum Sihirbazi (13th Bot)
**Rationale:** The wizard is the entry point for every new tenant. Without it, no company can be onboarded through the platform flow. It depends on Phase 1 (onboarding_sessions table and onboarding_invites) and Phase 2 (create-company.ts exists for the COMPLETED state transition).
**Delivers:** New Telegram bot registered with BotFather; `/api/telegram/sihirbaz/route.ts`; WizardOrchestrator FSM with all states; invite token validation with single-use enforcement; company profile collection conversationally; 4-agent introduction sequence (Satis Temsilcisi, Muhasebeci, Depo Sorumlusu, Genel Mudur Danismani); atomic company creation on COMPLETED; welcome message with admin panel URL and temp password.
**Implements:** WizardOrchestrator component; onboarding_sessions staging pattern; deep link token validation
**Avoids:** Pitfall 1 (staging table + atomic commit only at COMPLETED), Pitfall 2 (single-use token validation in Postgres transaction), Pitfall 6 from PITFALLS.md (wizard sub-agent context — use onboarding_mode flag or skip sub-agent delegation in v4.0 MVP and introduce agents via scripted messages instead)
**Research flag:** NEEDS resolution on grammY conversations plugin vs. custom WizardOrchestrator FSM before coding begins. ARCHITECTURE.md's reasoning (existing webhook routes do not instantiate a grammY Bot object; plugin adds replay overhead; most wizard steps are deterministic and do not need Claude) is more technically grounded. Recommendation: implement custom WizardOrchestrator FSM.

### Phase 4: Billing Integration
**Rationale:** The subscriptions table (Phase 1) and company creation (Phase 2) must exist before billing can be wired up. The billing webhook handler and subscription guard module are prerequisites for Phase 5 (access gating reads subscription state).
**Delivers:** iyzico subscription initialization flow (company signs up, subscription created via iyzipay SDK); `/api/billing/webhook/route.ts` with immediate 200 response, paymentId idempotency store, and async processing; `subscription-guard.ts` module with checkAgentAccess() function; grace period logic (3-day soft failure before hard agent disable); manual billing flag for v4.0 MVP (automated iyzico recurring charge is v5.0). Note: ARCHITECTURE.md references Stripe in billing flow diagrams — use iyzico throughout; the architectural patterns (checkout session, webhook receiver, idempotency) are identical.
**Uses:** `iyzipay ^2.0.65` with `@types/iyzipay ^2.0.3`; iyzico sandbox environment for testing
**Avoids:** Pitfall 3 (billing webhook as sole is_active authority — UI writes to desired state only), Pitfall 4 (grace period model with grace_period_ends_at column), Pitfall 7 from PITFALLS.md (iyzico idempotency + signature validation with X-IYZ-SIGNATURE-V3), Pitfall 8 from PITFALLS.md (PayTR mobile 3DS — applicable if PayTR is added later)
**Research flag:** iyzico sandbox subscription lifecycle (trial → active → cancelled) should be validated before implementation. The iyzico non-idempotent architecture requires explicit retry simulation testing — send same webhook payload twice and verify billing activation fires exactly once.

### Phase 5: Agent Access Gating + Dijital Ekibim Marketplace
**Rationale:** Access gating reads from subscriptions (Phase 4 must deliver subscription-guard.ts first). The Dijital Ekibim marketplace page toggles agents and must enforce state through the guard layer, not bypass it.
**Delivers:** `subscription-guard.ts` integrated into all 12 webhook routes inside `after()`; hard block in `dispatcher.ts` when is_active=false (Turkish-language denial message with upgrade URL); `activate-agent.ts` server action that writes to desired_agents table (not directly to agent_definitions.is_active); `/admin/dijital-ekibim` page with 12 agent cards, activate/deactivate toggles, monthly cost calculator, and trial status indicators; in-flight conversation check before agent disable.
**Implements:** Subscription guard component; modified dispatcher behavior; per-agent marketplace page
**Avoids:** Pitfall 3 (marketplace UI writes to desired_agents not is_active directly), Pitfall 5 from PITFALLS.md (trial expiry at dispatch entry with grace message and upgrade URL), Pitfall 9 from PITFALLS.md (in-flight conversation count shown before disable, 5-minute effective window disclosed in UI)
**Research flag:** Standard patterns — skip additional research. The 12-route modification is repetitive but mechanically straightforward.

### Phase 6: Superadmin Panel + Trial Notifications
**Rationale:** Superadmin panel displays and manages data from all prior phases (company list, subscription status, active agent count, invite management). Trial countdown notifications require the subscriptions and cron infrastructure from Phase 4. This is the final integration layer that makes the platform operator-ready.
**Delivers:** `/superadmin/*` route group with middleware protection checking is_superadmin(); companies dashboard (list all tenants, trial status, days remaining, active agent count); invite generation UI with pending/clicked/completed status tracking and one-click resend; one-click trial extension; `superadmin_audit_log` writes on all mutations with old_value and new_value; Vercel Cron job for trial countdown notifications at T-7 and T-1; trial expiry proactive Telegram messages with upgrade URL; soft-delete throughout (never hard DELETE).
**Uses:** Supabase service role client; existing Vercel Cron pattern; existing Telegram send capability
**Avoids:** Pitfall 10 from PITFALLS.md (mandatory company_id scope on every server action + audit log shipped from day 1), Pitfall 5 from PITFALLS.md (proactive warning messages before trial expiry eliminate abrupt mid-conversation cutoffs)
**Research flag:** Standard patterns — skip additional research. Audit log schema is fully specified in PITFALLS.md.

### Phase Ordering Rationale

Schema first: every other phase reads or writes new tables — there is no alternative ordering.

Company creation before wizard: the wizard's terminal state calls createCompanyFromWizard(); building the wizard first would require mocking a function that doesn't exist.

Wizard before billing: the wizard generates the company records that billing tracks; testing billing requires real company records to subscribe.

Billing before access gating: the guard module reads subscriptions rows; access gating without billing data is untestable and meaningless.

Marketplace after access gating: agent toggles must route through the guard layer, not bypass it; building the toggle before the guard creates a coupling inversion that requires rework.

Superadmin panel last: it is a dashboard and management layer over all other features; it has no blocking dependencies on other phases but displays data from all of them.

### Research Flags

Phases needing deeper research or decisions before coding begins:
- **Phase 3 (Wizard):** The grammY conversations plugin vs. custom WizardOrchestrator FSM decision is unresolved between STACK.md and ARCHITECTURE.md. This must be resolved before writing any wizard code. Recommendation: custom FSM (ARCHITECTURE.md approach).
- **Phase 4 (Billing):** iyzico sandbox behavior for subscription lifecycle and webhook retry simulation must be tested before writing production billing code. iyzico's non-idempotent architecture is a known risk; verify idempotency implementation empirically.

Phases with well-documented standard patterns (skip research-phase):
- **Phase 1 (Schema):** All table structures fully specified in research files; standard Supabase migration pattern.
- **Phase 2 (Company Creation):** Standard server action + Supabase Auth Admin API; fully specified including error cases.
- **Phase 5 (Access Gating):** Clear, mechanically specified 12-route modification with subscription-guard.ts pattern.
- **Phase 6 (Superadmin):** Standard Next.js route group + service role client + audit log; all patterns well-documented.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified on npm (iyzipay 2.0.65 Feb 2026, @grammyjs/conversations 2.1.1 Nov 2025, @grammyjs/storage-supabase 2.5.0 Jul 2025). Stripe Turkey unavailability confirmed. iyzico TCMB license confirmed. Version compatibility matrix verified. |
| Features | MEDIUM-HIGH | Core patterns (14-day trial, per-agent billing, conversational onboarding) verified across multiple industry sources (Chargebee, 1Capture, Voiceflow, EMA.ai). Turkish market specifics (flat fee preference, relationship-driven sales model, SMB budget predictability) are reasoned extrapolations from general B2B SMB research — no Turkey-specific SaaS conversion data found. Treat as LOW confidence. |
| Architecture | HIGH | Integration point analysis based on direct codebase reading (agent-runner.ts, dispatcher.ts, agent-bridge.ts, migrations 009 and 010). WizardOrchestrator pattern reasoning is sound. Note: ARCHITECTURE.md references Stripe in billing diagrams — iyzico is correct per STACK.md. Build order derived from hard dependency analysis, not assumption. |
| Pitfalls | HIGH | Based on official iyzico docs (idempotency explicitly documented as non-idempotent, webhook signature validation, 3DS flow), Telegram API docs (64-char payload limit confirmed, deep link format confirmed), and direct codebase analysis of existing dispatcher/guard patterns. Grace period and trial cutoff patterns verified against Stripe and RevenueCat official documentation for industry precedent. |

**Overall confidence: HIGH**

The stack is fully verified. The architecture integration points are derived from direct codebase analysis, not assumption. The pitfalls have official documentation backing. The only genuine uncertainty is Turkish market behavioral data (trial conversion rates, payment preference specifics) which is extrapolated from general B2B SMB research.

### Gaps to Address

**iyzico vs. Stripe in ARCHITECTURE.md billing diagrams:** The architecture document references Stripe Checkout sessions and Stripe webhook events in its billing flow. STACK.md correctly identifies iyzico as the required payment processor for the Turkish market. All architectural patterns (checkout session redirect, webhook receiver, idempotency store, event type handling) apply to both providers — only the SDK, API endpoints, and signature validation header differ. Phase 4 author must use iyzico exclusively. The ARCHITECTURE.md billing section is a pattern reference, not a technology mandate.

**grammY conversations plugin vs. custom WizardOrchestrator FSM:** STACK.md recommends @grammyjs/conversations 2.1.1; ARCHITECTURE.md argues against it on grounds that existing webhook routes do not instantiate a grammY Bot object, the replay-based plugin state accumulates in Supabase over time, and most wizard steps are deterministic prompts that do not benefit from the plugin's sequential async model. This is an unresolved implementation decision that must be made before Phase 3 begins. Both approaches are technically correct — the FSM approach is leaner and avoids adding plugin overhead to an established non-plugin webhook pattern.

**Manual vs. automated billing in v4.0:** FEATURES.md explicitly defers automated iyzico payment collection to v5.0 — v4.0 billing is manual (invoice or EFT, superadmin sets an is_paid flag). STACK.md researches iyzico subscription API thoroughly as if it will be used in v4.0. The roadmap resolves this: Phase 4 wires up iyzico SDK and webhook receiving infrastructure, but automated recurring charge and agent gating by payment status is treated as v4.x optional enhancement. The subscriptions table and payment_webhook_events table are built now; full billing automation ships when at least 3 tenants have validated the manual flow.

**Turkish market trial conversion benchmarks:** FEATURES.md cites 14-day trial as 71% better converting than 30-day, sourced from US/EU SaaS benchmarks. No Turkey-specific trial conversion data was found. Treat 14 days as a reasonable starting hypothesis; adjust based on data from the first 3 real tenants. The proactive warning cadence (T-7, T-3, T-1) is derived from the same US/EU research and should be validated against Turkish SMB behavior.

---

## Sources

### Primary (HIGH confidence)
- [iyzipay npm](https://www.npmjs.com/package/iyzipay) — v2.0.65 verified, February 2026
- [iyzico Subscription Docs](https://docs.iyzico.com/en/products/subscription) — subscription features, trial period, lifecycle
- [iyzico Subscription Transactions](https://docs.iyzico.com/en/products/subscription/subscription-implementation/subscription-transactions) — status lifecycle, trial mechanics
- [iyzico Webhook Docs](https://docs.iyzico.com/en/advanced/webhook) — retry behavior, signature headers
- [iyzico Idempotency Docs](https://docs.iyzico.com/en/getting-started/preliminaries/idempotency) — non-idempotent architecture explicitly confirmed
- [iyzico 3DS Implementation](https://docs.iyzico.com/en/payment-methods/api/3ds/3ds-implementation) — 3DS flow, mobile redirect issues
- [@grammyjs/conversations npm](https://www.npmjs.com/package/@grammyjs/conversations) — v2.1.1, Nov 2025, peer dep compatibility verified
- [@grammyjs/storage-supabase npm](https://www.npmjs.com/package/@grammyjs/storage-supabase) — v2.5.0, Jul 2025
- [grammY Conversations Plugin docs](https://grammy.dev/plugins/conversations) — serverless storage requirement confirmed
- [Telegram Bot Deep Linking](https://core.telegram.org/bots/features#deep-linking) — 64-char payload limit confirmed, format confirmed
- [Telegram API Links](https://core.telegram.org/api/links) — deep link specification
- [Supabase RLS + Service Role](https://supabase.com/docs/guides/database/postgres/row-level-security) — service role bypass pattern
- Existing codebase: `agent-runner.ts`, `agent-bridge.ts`, `dispatcher.ts`, `conversation-manager.ts`, migrations 009_multi_tenant.sql and 010_agent_tables.sql — analyzed directly (ground truth)

### Secondary (MEDIUM confidence)
- [Chargebee: Selling Intelligence — 2026 Playbook For Pricing AI Agents](https://www.chargebee.com/blog/pricing-ai-agents-playbook/) — per-agent pricing models, flat vs. usage-based tradeoffs
- [1Capture: Free Trial Conversion Benchmarks 2025](https://www.1capture.io/blog/free-trial-conversion-benchmarks-2025) — trial length and conversion rate data
- [Voiceflow: Build an AI Onboarding Bot for Your SaaS App](https://www.voiceflow.com/blog/saas-onboarding-chatbot) — onboarding flow phases, progressive disclosure pattern
- [EMA.ai: 8 AI Agent Pricing Models](https://www.ema.ai/additional-blogs/addition-blogs/ai-agents-pricing-strategies-models-guide) — per-agent vs. usage-based vs. outcome-based
- [Stripe Grace Period and Failed Payments — RevenueCat](https://www.revenuecat.com/docs/subscription-guidance/how-grace-periods-work) — grace period industry standard
- [Architecture Patterns for SaaS Billing, RBAC, Onboarding — AppFoster](https://medium.com/appfoster/architecture-patterns-for-saas-platforms-billing-rbac-and-onboarding-964ea071f571) — feature gating patterns
- [AI Agent Context Handoff — XTrace](https://xtrace.ai/blog/ai-agent-context-handoff) — wizard sub-agent delegation patterns
- [Handling Payment Webhooks Reliably — Sohail](https://medium.com/@sohail_saifii/handling-payment-webhooks-reliably-idempotency-retries-validation-69b762720bf5) — idempotency implementation

### Tertiary (LOW confidence)
- Turkish SMB market SaaS adoption patterns — extrapolated from general B2B SMB research; no Turkey-specific SaaS conversion data found; treat Turkish market behavioral assumptions as hypotheses to validate with first 3 tenants
- PayTR mobile 3DS behavior in Telegram in-app browser — documented from general 3DS redirect behavior analysis; not empirically tested against PayTR specifically

---
*Research completed: 2026-03-05*
*Ready for roadmap: yes*
*Synthesized from: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md (v4.0 research)*
