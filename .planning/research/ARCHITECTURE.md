# Architecture Research: v4.0 Agent-Native SaaS Onboarding & Marketplace

**Domain:** B2B Dealer Management SaaS with AI Digital Workers — v4.0 milestone additions
**Researched:** 2026-03-05
**Confidence:** HIGH (integration points, data flow) / MEDIUM (billing integration, marketplace patterns)

> This document supersedes and replaces the v3.0 ARCHITECTURE.md. It focuses exclusively on how the five new v4.0 features integrate with the existing architecture. Existing components are described only when they are modified by v4.0.

---

## Existing Architecture Reference

Before describing integration points, here is the complete picture of what already exists and will not change:

| Component | Location | Status |
|-----------|----------|--------|
| AgentRunner | `src/lib/agents/agent-runner.ts` | EXISTS — Claude tool-calling loop, no changes needed |
| AgentBridge | `src/lib/agents/agent-bridge.ts` | EXISTS — cross-agent calls with deadlock guard |
| ToolRegistry | `src/lib/agents/tool-registry.ts` | EXISTS — role→tools mapping |
| ConversationManager | `src/lib/agents/conversation-manager.ts` | EXISTS — rolling 50 msgs + summarization |
| dispatcher.ts | `src/lib/agents/dispatcher.ts` | EXISTS — orchestrates per-message pipeline |
| handler-factory.ts | `src/lib/agents/handler-factory.ts` | EXISTS — role→handlers mapping |
| 12 webhook routes | `src/app/api/telegram/{role}/route.ts` | EXISTS — one per agent role |
| agent_definitions | Supabase table | EXISTS — company_id, role, is_active, system_prompt |
| companies | Supabase table | EXISTS — id, name, slug, plan, is_active, settings |
| Middleware | `src/middleware.ts` | EXISTS — auth + rate limiting; needs superadmin route |

---

## System Overview — v4.0 New Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         v4.0 ADDITION MAP                                   │
├────────────────────────────┬────────────────────────────────────────────────┤
│  NEW: Onboarding Bot       │  NEW: Superadmin Panel                         │
│  /api/telegram/sihirbaz    │  /app/(superadmin)/superadmin/                 │
│  (dedicated webhook route) │  companies, subscriptions, agents marketplace  │
├────────────────────────────┴────────────────────────────────────────────────┤
│                         API / ACTION LAYER                                   │
│  NEW: /api/telegram/sihirbaz/route.ts                                       │
│  NEW: /api/onboarding/company/route.ts  (REST endpoint for wizard commits)  │
│  NEW: /api/billing/webhook/route.ts     (Stripe webhook receiver)           │
│  NEW: server actions: create-company.ts, activate-agent.ts                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                         AGENT LAYER (EXISTING)                               │
│  AgentRunner / AgentBridge / ToolRegistry / ConversationManager             │
│                                                                             │
│  NEW: KurulumSihirbazi — does NOT use AgentRunner                           │
│       Uses WizardOrchestrator (custom DB-backed FSM — see below)            │
├─────────────────────────────────────────────────────────────────────────────┤
│                         DATA LAYER                                          │
│  EXISTING: companies, agent_definitions, dealers, users (all with RLS)     │
│  NEW: onboarding_sessions   — wizard state persistence                      │
│  NEW: subscriptions         — plan + agent entitlements per company         │
│  NEW: agent_marketplace     — catalog of available agents with metadata     │
│  NEW: companies.trial_ends_at — trial period column                         │
│  NEW: agent_definitions.subscription_tier — min tier to activate            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Question 1: Kurulum Sihirbazi vs AgentBridge — Architecture Decision

### The Distinction

AgentBridge is a **peer-to-peer cross-agent call** within a live user conversation. It is triggered when Agent A determines it needs data from Agent B to answer the current user message. The call is synchronous within the AgentRunner loop, depth-limited, and uses the caller's conversationId.

KurulumSihirbazi (Setup Wizard) is a **meta-agent** that provisions a new company. It is NOT responding to a dealer message — it is building the infrastructure that other agents will later operate in. Its job is to:

1. Collect company details across multiple Telegram messages
2. Create DB records (companies, users, agent_definitions)
3. Send confirmation and deep links

These are fundamentally different patterns. **Do not use AgentRunner or AgentBridge for the wizard.** Here is why:

| Aspect | AgentRunner (existing agents) | Wizard (Kurulum Sihirbazi) |
|--------|-------------------------------|---------------------------|
| State lifespan | Single message turn | Multiple messages (minutes to hours) |
| Identity | Requires existing dealer + company | The NEW user has no dealer/company yet |
| dispatcher.ts | Resolves dealer via telegram_chat_id in dealers table | Wizard user is NOT in dealers — lookup fails |
| Storage | agent_conversations + agent_messages | onboarding_sessions table (separate) |
| Tools | Domain tools (orders, products, etc.) | Infrastructure tools (create_company, create_user, seed_agents) |
| Claude invocation | Required for every message | Optional — most steps are deterministic prompts |

### Recommended: DB-Backed FSM (WizardOrchestrator)

Use a finite state machine backed by the `onboarding_sessions` table instead of AgentRunner.

**Why not grammY Conversations plugin:** grammY's replay-based architecture requires persistent storage (the plugin's state, not just the conversation) and accumulates replay data. In the existing webhook architecture, the wizard runs inside `after()` with the service role client — there is no grammY Bot instance to attach plugins to. Adding grammY Conversations requires instantiating a full Bot object per webhook invocation, which conflicts with the current thin-adapter route pattern.

**Why not AgentRunner:** The wizard does not need Claude for most steps. "What is your company name?" is a deterministic prompt. Using Claude for every wizard message wastes tokens and adds latency. Only the final summary step (confirming all collected data before commit) benefits from Claude.

**The pattern — WizardOrchestrator:**

```typescript
// src/lib/agents/wizard-orchestrator.ts

export type WizardState =
  | 'AWAITING_COMPANY_NAME'
  | 'AWAITING_COMPANY_SECTOR'
  | 'AWAITING_ADMIN_EMAIL'
  | 'AWAITING_PLAN_SELECTION'
  | 'AWAITING_AGENT_SELECTION'
  | 'AWAITING_CONFIRMATION'
  | 'COMPLETED'
  | 'ABANDONED'

export class WizardOrchestrator {
  // Loads onboarding_sessions row by telegram_chat_id
  // Dispatches to current state handler
  // Saves updated state after each message
  // Returns text response to send back to user
  async handleMessage(chatId: number, text: string): Promise<string>
}
```

**State transitions:**

```
AWAITING_COMPANY_NAME
    → (valid name received) → AWAITING_COMPANY_SECTOR
    → (re-enter requested) → stays

AWAITING_COMPANY_SECTOR
    → (selection received) → AWAITING_ADMIN_EMAIL

AWAITING_ADMIN_EMAIL
    → (valid email format) → AWAITING_PLAN_SELECTION

AWAITING_PLAN_SELECTION
    → (plan selected) → AWAITING_AGENT_SELECTION

AWAITING_AGENT_SELECTION
    → (agents selected OR skip) → AWAITING_CONFIRMATION

AWAITING_CONFIRMATION
    → (confirmed) → COMPLETED (triggers company creation)
    → (cancel requested) → ABANDONED
```

**When to use Claude (optional):** Call Claude Haiku once at AWAITING_CONFIRMATION to generate a human-readable summary of the collected data before the user confirms. This is the only step that benefits from natural language generation.

---

## Question 2: Company Creation Flow — Table Changes and agent_definitions Seeding

### New Tables Required

**`onboarding_sessions` — wizard state persistence:**

```sql
CREATE TABLE onboarding_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id BIGINT NOT NULL UNIQUE,  -- wizard user's Telegram ID
  state           TEXT NOT NULL DEFAULT 'AWAITING_COMPANY_NAME',
  collected_data  JSONB NOT NULL DEFAULT '{}',
  -- collected_data shape:
  -- { company_name, sector, admin_email, plan, selected_agent_roles[] }
  deep_link_token TEXT UNIQUE,   -- the token from ?start=TOKEN that initiated this session
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
-- No RLS needed: service role only. Wizard bot uses service client.
-- No company_id: the company does not exist yet when this row is created.
```

**`subscriptions` — plan + billing state per company:**

```sql
CREATE TABLE subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  plan                TEXT NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial', 'starter', 'pro', 'enterprise')),
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  stripe_customer_id  TEXT,
  stripe_subscription_id TEXT,
  trial_ends_at       TIMESTAMPTZ,
  current_period_end  TIMESTAMPTZ,
  agent_seats         INTEGER NOT NULL DEFAULT 3,  -- how many agents company is paying for
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin full access on subscriptions"
  ON subscriptions FOR ALL TO authenticated USING (is_superadmin());
CREATE POLICY "Company admins read own subscription"
  ON subscriptions FOR SELECT TO authenticated
  USING (company_id = current_company_id() AND is_company_admin());
```

**`agent_marketplace` — catalog of available agents:**

```sql
CREATE TABLE agent_marketplace (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role            TEXT NOT NULL UNIQUE,  -- matches agent_definitions.role
  name            TEXT NOT NULL,
  description     TEXT,
  minimum_plan    TEXT NOT NULL DEFAULT 'starter' CHECK (minimum_plan IN ('trial', 'starter', 'pro', 'enterprise')),
  is_available    BOOLEAN DEFAULT true,
  sort_order      INTEGER DEFAULT 0,
  metadata        JSONB DEFAULT '{}',  -- icon, category, feature list
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- Seeded with all 12 agent roles. Read-only for company admins.
-- Managed only by superadmin.

ALTER TABLE agent_marketplace ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read marketplace"
  ON agent_marketplace FOR SELECT TO authenticated USING (true);
CREATE POLICY "Superadmin manages marketplace"
  ON agent_marketplace FOR ALL TO authenticated USING (is_superadmin());
```

**Modification to `agent_definitions`:**

```sql
-- Add subscription_tier to gate per-agent activation
ALTER TABLE agent_definitions
  ADD COLUMN subscription_tier TEXT DEFAULT 'starter'
    CHECK (subscription_tier IN ('trial', 'starter', 'pro', 'enterprise'));
```

**Modification to `companies`:**

The existing `companies.plan` column already exists. Add trial tracking:

```sql
ALTER TABLE companies
  ADD COLUMN trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days');
```

### Company Creation Flow — Step by Step

When AWAITING_CONFIRMATION transitions to COMPLETED, the wizard calls a single atomic creation function:

```typescript
// src/lib/actions/create-company.ts
// Server Action — uses service role client (bypasses RLS)

export async function createCompanyFromWizard(data: {
  companyName: string
  sector: string
  adminEmail: string
  plan: 'trial' | 'starter' | 'pro' | 'enterprise'
  selectedAgentRoles: string[]
}): Promise<{ companyId: string; adminUserId: string }>
```

**Creation sequence (must be atomic — wrap in DB transaction or sequential with rollback):**

1. INSERT into `companies` (name, slug derived from companyName, plan, trial_ends_at)
2. INSERT into `subscriptions` (company_id, plan='trial', trial_ends_at=14 days from now)
3. Call Supabase Auth Admin API to `createUser({ email: adminEmail, password: generatePassword() })`
4. INSERT into `users` (id=auth_user_id, role='admin', company_id)
5. INSERT into `agent_definitions` — one row per SELECTED agent role from `selectedAgentRoles`
   - Each row gets: company_id, role, name, description, model, system_prompt (from defaults), is_active=true, subscription_tier='starter'
6. INSERT into `agent_definitions` for remaining (unselected) roles — is_active=false
   - Ensures all 12 rows exist for the company from day one (dispatcher.ts requires this)
7. Send welcome email to adminEmail with temp password and login URL

**Why seed all 12 agent_definitions rows even for unselected agents:**

The dispatcher.ts looks up `agent_definitions` to get the system prompt for whichever role the Telegram route forces. If a company activates an agent later, the row must already exist. Creating all 12 upfront with `is_active=false` is simpler than creating rows on activation.

**agent_definitions population — where prompts come from:**

```typescript
// src/lib/agents/agent-defaults.ts  (NEW FILE)
// Exports a map of role -> { name, description, model, system_prompt }
// These are the canonical defaults shared by all companies.
// Companies can customize via superadmin or their own admin panel later.

export const AGENT_DEFAULTS: Record<AgentRole, AgentDefinitionDefaults> = {
  satis_temsilcisi: {
    name: 'Satis Temsilcisi',
    model: HAIKU_MODEL,
    system_prompt: '...canonical Turkish prompt...',
    subscription_tier: 'starter',
  },
  // ... all 12 roles
}
```

---

## Question 3: Per-Agent Activation — Gating Webhook Access

### Current State

`agent_definitions.is_active` already exists. The dispatcher.ts already checks it:

```typescript
// dispatcher.ts (existing)
.eq('is_active', true)
.eq('role', role)
```

If no active definition is found, the agent falls back to a default system prompt. This means a disabled agent still responds — it just uses a generic prompt. That is **not a hard gate.**

### Required Change — Hard Gate in the Webhook Route

The gate must live at the webhook route level, before `dispatchAgentUpdate` is called. Two layers are needed:

**Layer 1 — Subscription enforcement (new middleware-like check):**

Create `src/lib/agents/subscription-guard.ts`:

```typescript
// Checks: (1) is the company's subscription active? (2) does the agent role
// fall within the company's subscribed plan? (3) is agent_definitions.is_active?
// Returns { allowed: boolean; reason?: string }

export async function checkAgentAccess(
  companyId: string,
  agentRole: string,
): Promise<{ allowed: boolean; reason?: string }>
```

**Layer 2 — Modified dispatcher.ts** (or wrap before calling it):

The `dispatchAgentUpdate` currently does the `agent_definitions` lookup but does not enforce `is_active` as a hard block — it falls through to a generic prompt. Change the behavior so that if no active definition is found AND the agent role exists but `is_active=false`, the dispatcher sends a specific Turkish message:

```typescript
if (agentDef && !agentDef.is_active) {
  await sendTelegramMessage(
    chatId,
    'Bu ajan siirdilik aktif degil. Yonetim panelinizden aktiflestirebilirsiniz.',
    token
  )
  return
}
```

**Layer 3 — Subscription check in the webhook route** (before after()):

Resolving company from a chat that has no dealer is the challenge. The wizard bot handles PRE-company users. Post-company users always have a dealer record with a telegram_chat_id. The existing dealer lookup gives us the companyId synchronously before the after() call.

Insert the subscription check between the dealer lookup and the after() dispatch:

```typescript
// In each /api/telegram/{role}/route.ts

after(async () => {
  // dealer lookup already gives companyId
  const access = await checkAgentAccess(companyId, 'satis_temsilcisi')
  if (!access.allowed) {
    await sendTelegramMessage(chatId, access.reason ?? 'Bu ajan aktif degil.', token)
    return
  }
  await dispatchAgentUpdate(update, 'satis_temsilcisi', botToken)
})
```

The subscription check reads from `subscriptions` and `agent_definitions` — two fast indexed lookups. Total overhead: ~10-20ms.

### Trial Period Gate

Trial companies get access to a limited set of agents (e.g., 3 agents from the 'trial' tier). After `trial_ends_at` passes and no paid subscription exists, ALL agents are gated:

```typescript
// subscription-guard.ts logic
if (subscription.plan === 'trial' && subscription.trial_ends_at < new Date()) {
  return { allowed: false, reason: 'Deneme sureciniz doldu...' }
}
if (agentDef.subscription_tier > subscription.plan) {
  return { allowed: false, reason: 'Bu ajan planinizia dahil degil...' }
}
```

---

## Question 4: Billing Integration — Subscription State and Enforcement

### Where Subscription State Lives

All subscription state lives in the `subscriptions` table (defined above). The `companies.plan` column already exists but should be treated as a **cache** — the authoritative source is `subscriptions`. When a Stripe webhook arrives, update both.

### Stripe Integration Architecture

The integration is one-directional from Stripe's perspective: Stripe pushes events to the app via webhook. The app reads `subscriptions` for access decisions. The app calls Stripe API only for customer/subscription creation.

```
Company Admin selects plan (web UI)
    ↓
/api/billing/checkout/route.ts
    → Creates Stripe Checkout Session
    → Redirects user to Stripe-hosted checkout page
    ↓
Stripe processes payment
    ↓
POST /api/billing/webhook/route.ts  (Stripe webhook)
    → Verifies Stripe-Signature header
    → Handles events:
        customer.subscription.created  → upsert subscriptions row
        customer.subscription.updated  → update plan + status + period_end
        customer.subscription.deleted  → set status='canceled'
        invoice.payment_failed         → set status='past_due'
    → Updates companies.plan (cache sync)
    ↓
Agent access checks read from subscriptions table
```

**Critical:** Stripe webhook verification must happen BEFORE any DB writes. Use `stripe.webhooks.constructEvent()` with the raw request body (not parsed JSON). The route must export `export const dynamic = 'force-dynamic'` and read the body as a string.

### Enforcement Decision Points

| Decision Point | What Checks Subscriptions | When |
|----------------|--------------------------|------|
| Telegram agent message | `subscription-guard.ts` via `checkAgentAccess()` | Per incoming message, inside after() |
| Wizard agent selection | Company creation action | At company creation time |
| Superadmin panel | Direct DB read | On page load |
| Company admin panel | Direct DB read via RLS | On page load |
| Trial expiry | `subscription-guard.ts` checks `trial_ends_at` | Per incoming message |

**Performance note:** `subscriptions` is a single-row-per-company table with a unique index on company_id. The lookup is O(1). Cache it in Supabase with a 60-second TTL is not necessary at this scale (< 1000 companies).

---

## Question 5: Telegram Deep Links for Onboarding

### Deep Link Format (Official Telegram Spec)

```
https://t.me/{wizard_bot_username}?start={token}
```

- Allowed characters: A-Z, a-z, 0-9, `_`, `-`
- Maximum length: 64 characters
- The token arrives at the wizard bot as the text `/start {token}`

**Token generation:**

```typescript
// 32 random bytes → base64url → 43 chars (within 64 limit)
const token = Buffer.from(crypto.randomBytes(32)).toString('base64url')
```

### How Deep Link Maps to Company Creation

The wizard bot is an **invitation-gated** onboarding flow. A superadmin generates an invitation token, which creates a pending `onboarding_sessions` row. The deep link embeds that token.

**Flow:**

```
Superadmin generates invite
    → INSERT onboarding_sessions (state='AWAITING_COMPANY_NAME', deep_link_token=token)
    → Returns deep link: https://t.me/BayiYonetimSihirbazi?start={token}
    → Superadmin sends this link to the prospect

Prospect clicks link in Telegram
    → Telegram sends /start {token} to wizard bot
    → Wizard webhook: POST /api/telegram/sihirbaz/route.ts

Wizard bot receives /start {token}
    → Parses token from message.text
    → Looks up onboarding_sessions WHERE deep_link_token = token
    → If found AND state='AWAITING_COMPANY_NAME':
        → Binds session to this telegram_chat_id
        → Sends first wizard prompt
    → If not found:
        → Sends error: 'Gecersiz davet linki.'
    → If already completed:
        → Sends: 'Bu kurulum zaten tamamlandi.'
```

**Alternative (no pre-generated invite):** Allow open registration where anyone can start the wizard by messaging the wizard bot directly. In this case, skip the token lookup and create a fresh `onboarding_sessions` row on first contact. This is simpler but less controlled. Recommended only if the platform allows self-service signups.

### Wizard Bot — Separate Webhook Route

The wizard bot is entirely separate from the 12 agent bots. It has its own Telegram bot token and its own webhook route:

```
src/app/api/telegram/sihirbaz/route.ts
```

**This route does NOT call `dispatchAgentUpdate`.** It calls `WizardOrchestrator.handleMessage()` instead. The wizard has no company context until `COMPLETED`, so it cannot use the dealer-lookup-based identity resolution in dispatcher.ts.

**The route follows the same structural pattern** as existing agent routes (parse, dedup, after(), 200 immediately) but with a different handler.

---

## New vs Modified Components Summary

### New Components (net-new files and tables)

| Component | Location | Purpose |
|-----------|----------|---------|
| WizardOrchestrator | `src/lib/agents/wizard-orchestrator.ts` | DB-backed FSM for multi-step onboarding |
| wizard webhook route | `src/app/api/telegram/sihirbaz/route.ts` | Dedicated route for wizard bot |
| subscription-guard.ts | `src/lib/agents/subscription-guard.ts` | checkAgentAccess() — plan + is_active check |
| agent-defaults.ts | `src/lib/agents/agent-defaults.ts` | Canonical role→{name,model,prompt} defaults |
| create-company.ts | `src/lib/actions/create-company.ts` | Atomic company+user+agents creation |
| activate-agent.ts | `src/lib/actions/activate-agent.ts` | Toggle agent_definitions.is_active + subscription check |
| billing webhook route | `src/app/api/billing/webhook/route.ts` | Stripe event handler |
| billing checkout route | `src/app/api/billing/checkout/route.ts` | Creates Stripe Checkout session |
| superadmin panel | `src/app/(superadmin)/superadmin/` | New route group for platform operator |
| onboarding_sessions | Supabase table | Wizard state persistence |
| subscriptions | Supabase table | Billing state per company |
| agent_marketplace | Supabase table | Available agents catalog |

### Modified Components (existing files that need changes)

| Component | Location | Change Required |
|-----------|----------|----------------|
| dispatcher.ts | `src/lib/agents/dispatcher.ts` | Add hard gate: if agentDef found but is_active=false, block with message instead of fallback to generic prompt |
| All 12 webhook routes | `src/app/api/telegram/{role}/route.ts` | Add subscription-guard check inside after() before calling dispatchAgentUpdate |
| agent_definitions | Supabase table | Add `subscription_tier` column |
| companies | Supabase table | Add `trial_ends_at` column |
| middleware.ts | `src/middleware.ts` | Add `/superadmin` route protection (check is_superadmin() claim) |
| handler-factory.ts | `src/lib/agents/handler-factory.ts` | No change needed — wizard does not use this |

---

## Data Flow: Company Creation via Wizard

```
Telegram: /start {token}
    ↓
POST /api/telegram/sihirbaz
    → idempotency check (processed_telegram_updates)
    → after():
        → WizardOrchestrator.handleMessage(chatId, '/start {token}')
        → Loads onboarding_sessions row by deep_link_token
        → Binds telegram_chat_id to session
        → Returns: "Hosgeldiniz! Sirketinizin adini girin:"
        → sendTelegramMessage(chatId, prompt, WIZARD_BOT_TOKEN)
    → 200 OK immediately

[...multiple message exchanges, state advances through FSM...]

Last message: "Evet, onayliyorum"
    ↓
WizardOrchestrator: state = AWAITING_CONFIRMATION → COMPLETED
    → calls createCompanyFromWizard(collected_data)
        → supabase.from('companies').insert(...)
        → supabase.from('subscriptions').insert({ plan: 'trial', trial_ends_at: +14d })
        → supabase.auth.admin.createUser({ email: adminEmail })
        → supabase.from('users').insert({ role: 'admin', company_id })
        → supabase.from('agent_definitions').insert([...12 rows, selected=active, rest=inactive])
    → Returns welcome message with:
        - Admin panel URL: https://bayi-yonetimi.vercel.app/login
        - Temp password
        - Instructions to connect agent Telegram bots
    → Updates onboarding_sessions.completed_at = NOW()
```

---

## Data Flow: Per-Agent Message with Subscription Check

```
Dealer messages Sales bot (Telegram)
    ↓
POST /api/telegram/satis
    → idempotency check
    → after():
        [1] Dealer lookup: SELECT FROM dealers WHERE telegram_chat_id = chatId
            → yields dealerId, companyId
        [2] subscription-guard:
            checkAgentAccess(companyId, 'satis_temsilcisi')
            → SELECT FROM subscriptions WHERE company_id = ?
            → SELECT FROM agent_definitions WHERE company_id = ? AND role = ?
            → Check trial_ends_at, plan tier, is_active
        [3a] If NOT allowed:
            → sendTelegramMessage('Bu ajan aktif degil...')
            → return
        [3b] If allowed:
            → dispatchAgentUpdate(update, 'satis_temsilcisi', botToken)
    → 200 OK immediately
```

---

## Architectural Patterns

### Pattern 1: Wizard as a Separate Subsystem

**What:** WizardOrchestrator is completely isolated from the existing agent infrastructure. It shares only the Supabase service client. It has no AgentContext, no ConversationManager, no ToolRegistry.

**When to use:** Any bot interaction that happens BEFORE a company+dealer record exists. The existing infrastructure assumes both.

**Trade-offs:** Duplication of some patterns (sendTelegramMessage, idempotency) but complete freedom from the constraints of the agent dispatch pipeline.

### Pattern 2: Subscription Guard at the Route Level

**What:** Access checks happen inside `after()` but before `dispatchAgentUpdate`. This means the check runs in the background (good for latency) but the Telegram 200 is already sent regardless.

**When to use:** This pattern is correct for access gating on established dealer accounts. The user receives a blocking message if denied.

**Trade-offs:** The user waits ~1-2 seconds for the denial message because `after()` is asynchronous. This is acceptable. If synchronous denial is required, move the check before the `after()` call — but this adds latency to the 200 response, risking Telegram retry storms.

### Pattern 3: All-12-Rows Seed at Company Creation

**What:** Create all 12 `agent_definitions` rows at company creation time, with `is_active=false` for unselected agents.

**When to use:** Always. Creating rows on demand when an agent is activated is error-prone.

**Trade-offs:** 12 rows per company at creation. At 1000 companies = 12,000 rows. Trivial at this scale.

### Pattern 4: Stripe as Authoritative, subscriptions as Cache

**What:** Stripe holds the canonical billing state. The app's `subscriptions` table is updated via Stripe webhooks. Access decisions read from `subscriptions` (not Stripe API directly).

**When to use:** Always. Never call Stripe API on the critical path (agent message handling).

**Trade-offs:** The `subscriptions` table can drift from Stripe if webhooks fail. Mitigate by: (1) Stripe webhook retry policy (it retries for 72 hours), (2) nightly reconciliation cron job, (3) idempotent webhook processing.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Using AgentRunner for the Wizard

**What people do:** Run the wizard through AgentRunner because "it's also a conversational bot."

**Why it's wrong:** AgentRunner.run() builds on dispatcher.ts which requires an existing dealer record and company. The wizard has neither. Using AgentRunner means: (a) dealer lookup fails for every wizard message, (b) ConversationManager creates orphaned conversations with no company_id, (c) Claude is invoked for every deterministic prompt step, tripling cost.

**Do this instead:** WizardOrchestrator as a standalone FSM. Call Claude at most once (for confirmation summary).

### Anti-Pattern 2: Checking Subscriptions Inside dispatcher.ts

**What people do:** Add subscription checks to the common dispatcher to reduce code duplication.

**Why it's wrong:** dispatcher.ts is already shared across 12 routes. Each agent role may have different subscription tier requirements. Centralizing this creates a tangle of role-specific conditionals in a module that should be role-agnostic. Also, dispatcher.ts runs after the dealer lookup — checking the subscription there is fine technically, but it couples billing concerns to agent dispatch logic.

**Do this instead:** `subscription-guard.ts` as a separate module called from each webhook route inside `after()`. Routes stay role-aware; dispatcher stays role-agnostic.

### Anti-Pattern 3: Storing Subscription State in companies.plan Only

**What people do:** Update `companies.plan` and treat it as the source of truth.

**Why it's wrong:** `companies.plan` has no Stripe link, no period_end, no seat count, no status (past_due vs active). Trial expiry requires `trial_ends_at`. All of these need the `subscriptions` table. Using only `companies.plan` means losing billing granularity.

**Do this instead:** `subscriptions` table as canonical source. `companies.plan` updated as a cache for fast RLS policies that need to gate by plan tier.

### Anti-Pattern 4: Open Wizard Without Invite Token

**What people do:** Let anyone message the wizard bot and start registration.

**Why it's wrong:** Uncontrolled signups mean you cannot manage sales, trial abuse, or capacity. The wizard creates Auth users (consuming Supabase Auth MAU), companies, and DB rows for each session.

**Do this instead:** Superadmin generates invite tokens. Wizard validates token before starting. Allow "open signups" as an explicit feature flag decision, not the default.

### Anti-Pattern 5: Calling Stripe API on the Message Hot Path

**What people do:** In `subscription-guard.ts`, call `stripe.subscriptions.retrieve(stripeSubscriptionId)` to get the real-time status.

**Why it's wrong:** Every agent message would trigger a Stripe API call. At 700 dealers × 5 messages/day = 3,500 Stripe API calls/day. Stripe has rate limits and introduces latency. More critically, this runs inside `after()` which is already budget-limited.

**Do this instead:** Read from `subscriptions` table. Keep it fresh via Stripe webhooks. Add nightly reconciliation cron.

---

## Build Order — Dependencies

The five v4.0 features have hard dependencies that dictate build order:

**Phase 1: Database Schema (prerequisite for everything)**

Migrations required before any code changes:
- `onboarding_sessions` table
- `subscriptions` table
- `agent_marketplace` table (with seed data for all 12 roles)
- `companies.trial_ends_at` column
- `agent_definitions.subscription_tier` column
- RLS policies for all new tables

**Phase 2: Company Creation Infrastructure**

Prerequisites: Phase 1 schema.

- `agent-defaults.ts` — canonical role defaults (no dependencies)
- `create-company.ts` server action — creates company+user+agents atomically
- Verify creation flow with a manual test (psql or Supabase dashboard)

**Phase 3: Wizard Bot (Kurulum Sihirbazi)**

Prerequisites: Phase 2 (create-company.ts must exist for COMPLETED transition).

- `wizard-orchestrator.ts` — FSM with all states
- `/api/telegram/sihirbaz/route.ts` — webhook route using WizardOrchestrator
- Register wizard bot with BotFather, set webhook URL
- Test end-to-end: deep link → wizard → company creation → confirmation

**Phase 4: Billing Integration**

Prerequisites: Phase 1 schema (subscriptions table), Phase 2 (company creation).

- `/api/billing/checkout/route.ts` — Stripe checkout session creator
- `/api/billing/webhook/route.ts` — Stripe webhook receiver + event handlers
- `subscription-guard.ts` — checkAgentAccess() logic (reads subscriptions table)
- Test with Stripe test mode and CLI webhook forwarding (`stripe listen`)

**Phase 5: Agent Access Gating**

Prerequisites: Phase 4 (subscription-guard.ts must exist).

- Modify all 12 `/api/telegram/{role}/route.ts` to call `checkAgentAccess()` inside `after()`
- Modify `dispatcher.ts` to hard-block on `is_active=false` (instead of falling to generic prompt)
- `activate-agent.ts` server action — toggles is_active + validates subscription allows it

**Phase 6: Superadmin Panel**

Prerequisites: Phase 4 (subscriptions data to display), Phase 5 (agent activation action).

- Add `/superadmin` route protection to `middleware.ts`
- `src/app/(superadmin)/superadmin/` route group
- Pages: companies list, company detail, subscription management, invite generation
- Agent marketplace management (add/edit agent_marketplace rows)

---

## Integration Points Summary

| New Feature | Touches Existing | Integration Point | Change Type |
|-------------|-----------------|-------------------|-------------|
| Wizard bot | processed_telegram_updates | Idempotency (reuse same table) | REUSE |
| Wizard bot | dispatcher.ts | Does NOT use it | NONE |
| Wizard bot | agent-runner.ts | Does NOT use it | NONE |
| Wizard bot | create-company.ts | Calls at COMPLETED state | NEW |
| Subscription guard | dispatcher.ts | Called before dispatchAgentUpdate | MODIFY dispatcher |
| Subscription guard | 12 webhook routes | Added inside after() | MODIFY routes |
| Subscription guard | agent_definitions.is_active | Hard block when false | MODIFY behavior |
| Billing | companies.plan | Updated as cache on Stripe events | MODIFY |
| Billing | Stripe Checkout | New integration | NEW |
| Company creation | agent_definitions | Seeded with all 12 roles | EXTEND |
| Company creation | Auth Admin API | createUser() call | EXTEND |
| Superadmin | middleware.ts | /superadmin route group | MODIFY |
| Superadmin | is_superadmin() | Already exists in DB | REUSE |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 companies | Current approach (all checks inline, no caching) |
| 100-1000 companies | Consider caching subscription status in companies.plan as first-pass gate; subscriptions table for full check only when plan-gating is needed |
| 1000+ companies | Add Redis/Upstash cache for subscription status (5-minute TTL); Stripe webhook processing should be moved to a queue (Upstash QStash) to handle burst events |

---

## Sources

- [Telegram Bot Deep Linking — Official Documentation](https://core.telegram.org/bots/features#deep-linking) — start parameter format, 64-char limit, base64url encoding — HIGH confidence
- [grammY Conversations Plugin](https://grammy.dev/plugins/conversations) — replay-based state machine, storage backend requirement — HIGH confidence
- [Stripe Webhook Integration](https://docs.stripe.com/webhooks) — constructEvent verification, event types — HIGH confidence
- [Stripe Build Subscriptions](https://docs.stripe.com/billing/subscriptions/build-subscriptions) — checkout session, subscription lifecycle — HIGH confidence
- [Telegram API: messages.startBot](https://core.telegram.org/method/messages.startBot) — how /start payload is delivered to bot — HIGH confidence
- [Architecture Patterns for SaaS Billing, RBAC, Onboarding](https://medium.com/appfoster/architecture-patterns-for-saas-platforms-billing-rbac-and-onboarding-964ea071f571) — feature gating patterns — MEDIUM confidence
- Existing codebase: agent-runner.ts, agent-bridge.ts, dispatcher.ts, handler-factory.ts, 009_multi_tenant.sql, 010_agent_tables.sql — analyzed directly — HIGH confidence (ground truth)

---
*Architecture research for: v4.0 Agent-Native SaaS Onboarding & Marketplace*
*Researched: 2026-03-05*
*Scope: Integration points with existing architecture only. Existing patterns from v3.0 ARCHITECTURE.md remain valid.*
