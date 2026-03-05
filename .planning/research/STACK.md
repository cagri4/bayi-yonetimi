# Stack Research — v4.0 Agent-Native SaaS Onboarding & Marketplace

**Project:** B2B Bayi Yönetimi — v4.0 milestone additions only
**Domain:** Conversational onboarding + per-agent billing + agent marketplace + superadmin panel
**Researched:** 2026-03-05
**Confidence:** HIGH for all primary decisions (verified via npm, official docs, official provider docs)

---

## Context: What Already Exists (DO NOT RE-RESEARCH)

The v3.0 stack is frozen and validated in production. This document covers ONLY net-new additions.

| Existing Technology | Version | Status |
|--------------------|---------|--------|
| Next.js | 16.1.4 | KEEP |
| React | 19.2.3 | KEEP |
| @supabase/supabase-js | ^2.91.1 | KEEP |
| @anthropic-ai/sdk | ^0.78.0 | KEEP |
| grammy | ^1.41.0 | KEEP |
| TypeScript | ^5 | KEEP |
| Tailwind CSS | ^4 | KEEP |
| Zustand | ^5.0.10 | KEEP |
| Zod | ^4.3.6 | KEEP |
| Vercel | current, Fluid Compute enabled | KEEP |
| Vitest | current | KEEP |
| Sentry | @sentry/nextjs | KEEP |

---

## New Stack Additions

### 1. Payment Processing — iyzico (Turkish Market)

#### `iyzipay` ^2.0.65 — REQUIRED

**Purpose:** Subscription billing with trial periods, per-agent monthly charges for Turkish companies

**Why iyzico over alternatives:**

Stripe does not support Turkish business entities (no native Turkish merchant accounts as of 2026). Stripe requires foreign entity incorporation (US LLC, UK Ltd, EU e-Residency) — not viable for a Turkey-first B2B SaaS selling to Turkish companies paying in TRY. PayTR has no reliable maintained npm package (community packages last updated 2022). iyzico is:
- The dominant payment processor in Turkey (market leader, licensed by TCMB under Law No. 6493)
- Supports full subscription/recurring billing API natively
- Has an actively maintained official npm package (`iyzipay` 2.0.65, published February 2026)
- Has a subscription product with `trialPeriodDays` configuration at the plan level
- Supports WEEKLY/MONTHLY/YEARLY billing intervals

**What iyzico Subscription API supports:**
- Products + pricing plans with `paymentIntervalCount` (e.g., monthly per agent)
- `trialPeriodDays` on pricing plan — card validated via 1 TL refundable charge, no billing during trial
- Subscription status lifecycle: PENDING → ACTIVE → CANCELLED
- Plan upgrades/downgrades (same product, same interval, applied NOW or NEXT_PERIOD)
- Initialize Subscription, Activate, Retry, Upgrade, Cancel, Get Details, Search, Card Update

**TypeScript limitation:** Official `iyzipay` package uses callback-based API (no native TypeScript types). Use `@types/iyzipay` (v2.0.3, community DefinitelyTyped) and promisify callbacks manually with a thin wrapper.

**Critical architectural note:** iyzico does NOT support per-seat billing natively. The billing model for this project must be implemented at the application layer: one subscription per company, fixed monthly price calculated from active agent count, managed via a Supabase `company_subscriptions` table. iyzico handles the recurring card charge; the app handles the agent count → price calculation.

**Confidence:** HIGH — npm version verified (2.0.65, February 2026), official iyzico docs verified subscription API, TCMB license confirmed

**Sources:**
- [iyzipay npm package](https://www.npmjs.com/package/iyzipay) — version 2.0.65, last published Feb 2026
- [iyzico Subscription Product docs](https://docs.iyzico.com/en/products/subscription)
- [iyzico Subscription Transactions](https://docs.iyzico.com/en/products/subscription/subscription-implementation/subscription-transactions)
- [@types/iyzipay npm](https://www.npmjs.com/package/@types/iyzipay)

---

### 2. Telegram Conversations Plugin — Onboarding Wizard State

#### `@grammyjs/conversations` ^2.1.1 — REQUIRED

**Purpose:** Multi-step conversational state machine for the Kurulum Sihirbazi (13th agent — Setup Wizard). Enables the bot to ask sequential questions, wait for user replies, and advance through onboarding steps without managing state manually.

**Why this over manual state machines:**
Without `@grammyjs/conversations`, every message requires reading a `wizard_step` column from Supabase and branching on it — O(N) branching code for N steps, hard to maintain. The conversations plugin models the entire onboarding flow as a sequential async function that "pauses" between messages, making the code read exactly like the conversation flows.

**Serverless caveat — requires external storage adapter:**
The conversations plugin warns against serverless use with in-memory storage due to race conditions. On Vercel (serverless), conversation state must be persisted externally. The `@grammyjs/storage-supabase` adapter (v2.5.0) solves this — conversation state is stored in Supabase, already in the stack.

**Setup with Supabase adapter:**
```typescript
import { conversations } from '@grammyjs/conversations';
import { SupabaseAdapter } from '@grammyjs/storage-supabase';

const supabaseAdapter = new SupabaseAdapter(supabaseClient, {
  tableName: 'grammy_conversations',
});

bot.use(conversations({
  storage: supabaseAdapter,
}));
```

**Conversation flow pattern for onboarding wizard:**
```typescript
async function setupWizard(conversation: Conversation, ctx: Context) {
  await ctx.reply("Firma adınız nedir?");
  const companyName = await conversation.waitFor('message:text');

  await ctx.reply("Kaç bayiniz var?");
  const dealerCount = await conversation.waitFor('message:text');

  // ... additional steps for each agent domain
  // then: create company in DB, configure all 12 agents, send completion message
}

bot.use(createConversation(setupWizard));
```

**Version compatibility:** `@grammyjs/conversations` 2.1.1 requires `grammy ^1.20.1` — compatible with existing `grammy ^1.41.0`.

**Confidence:** HIGH — npm version 2.1.1 verified (last updated November 2025), Supabase adapter v2.5.0 confirmed, peer dependency compatibility verified

**Sources:**
- [@grammyjs/conversations npm](https://www.npmjs.com/package/@grammyjs/conversations) — v2.1.1
- [grammY Conversations Plugin docs](https://grammy.dev/plugins/conversations)
- [@grammyjs/storage-supabase npm](https://www.npmjs.com/package/@grammyjs/storage-supabase) — v2.5.0

---

### 3. Supabase Storage Adapter for grammY

#### `@grammyjs/storage-supabase` ^2.5.0 — REQUIRED (companion to conversations)

**Purpose:** Persists multi-step conversation state between serverless function invocations. Required because Vercel functions are stateless — without external storage, the wizard loses its position on every message.

**Why this over other storage adapters:**
Supabase is already in the stack. Using the Supabase storage adapter means zero new infrastructure — conversation state lives in the same Postgres database as all other app data. Alternatives (Redis, file storage, Firestore) would add a new infrastructure dependency for a single-purpose store.

**Requires a `grammy_conversations` table in Supabase:**
```sql
CREATE TABLE grammy_conversations (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);
-- Exclude from RLS — accessed via service role from webhook handler
```

**Confidence:** HIGH — npm version 2.5.0 verified (last updated July 2025), official grammY storage package

**Sources:**
- [@grammyjs/storage-supabase npm](https://www.npmjs.com/package/@grammyjs/storage-supabase) — v2.5.0

---

### 4. Telegram Deep Links — No New Package (grammY built-in)

**Purpose:** Superadmin panel generates a unique onboarding link per company. Clicking the link opens the Setup Wizard bot pre-seeded with the company ID, so the wizard knows which company to configure.

**How it works (Telegram-native, no library needed):**
- Link format: `https://t.me/{BOT_USERNAME}?start={payload}` where payload is base64url-encoded company token
- Payload limit: **64 characters** (Telegram enforces this — design tokens accordingly)
- Bot receives `/start {payload}` — grammY handles with `bot.command('start', handler)`
- Payload contains: a short-lived JWT or UUID lookup key pointing to `onboarding_tokens` table

**Token design for 64-char limit:**
```typescript
// UUID (36 chars) fits comfortably within 64-char limit
const token = crypto.randomUUID(); // e.g., "a1b2c3d4-..."
// Store: { token, company_id, expires_at } in onboarding_tokens table
// Link: `https://t.me/BayiYonetimBot?start=${token}`
```

**Superadmin generates the link; grammY's existing `bot.command('start')` receives it.** No new package needed.

**Confidence:** HIGH — Telegram Bot API official docs confirm deep link format and 64-char payload limit

**Sources:**
- [Telegram Bot Features — Deep Linking](https://core.telegram.org/bots/features#deep-linking)
- [Telegram API Links reference](https://core.telegram.org/api/links)

---

### 5. Superadmin Panel — No New Package (Next.js + Supabase service role)

**Purpose:** Isolated admin interface at `/superadmin/*` for creating companies, generating onboarding links, viewing all tenants, enabling/disabling agents per company.

**Why no new package:**
The pattern is: Next.js Server Actions with a Supabase client initialized with the **service role key** (bypasses RLS entirely) — standard Supabase pattern for admin operations. Combined with a custom `is_superadmin()` check on the calling user, this provides cross-tenant read/write access without any new library.

**Route isolation pattern:**
```typescript
// src/app/superadmin/layout.tsx
import { isSuperadmin } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function SuperadminLayout({ children }) {
  const authorized = await isSuperadmin();
  if (!authorized) redirect('/');
  return <>{children}</>;
}
```

**Supabase service role client for cross-tenant operations:**
```typescript
// src/lib/supabase/superadmin.ts
import { createClient } from '@supabase/supabase-js';

export const superadminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // bypasses all RLS
);
```

**Confidence:** HIGH — Supabase official docs confirm service role bypasses RLS, standard pattern

**Sources:**
- [Supabase RLS Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Service Role Key security](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z)

---

### 6. Agent Marketplace — Database Pattern, No New Package

**Purpose:** Per-company toggle of which AI agents are active ("Dijital Ekibim" / My Digital Team). Drives billing (active agents = monthly charge), conversation routing (only route to active agents), and UI display.

**Schema pattern:**
```sql
-- One row per company-agent pair, tracks enabled state and trial
CREATE TABLE company_agents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid REFERENCES companies(id) ON DELETE CASCADE,
  agent_role     text NOT NULL,  -- 'sales_rep' | 'accountant' | etc. (12 values)
  enabled        boolean NOT NULL DEFAULT true,
  trial_ends_at  timestamptz,
  hired_at       timestamptz DEFAULT now(),
  UNIQUE (company_id, agent_role)
);

-- RLS: company members see only their agents
CREATE POLICY "company_isolation" ON company_agents
  USING (company_id = (auth.jwt() ->> 'company_id')::uuid);

-- Superadmin sees all (service role bypasses RLS)
```

**Why a table over JSONB column on companies:**
- Per-agent queries ("which companies have sales_rep enabled?") are indexed
- Audit trail possible (add `enabled_at`, `disabled_at` columns)
- RLS policies apply cleanly
- `unique(company_id, agent_role)` prevents duplicate rows naturally

**Monthly cost calculation (application layer):**
```typescript
const AGENT_PRICE_TRY = 299; // per agent per month
const activeAgents = await getEnabledAgentCount(companyId);
const monthlyTotal = activeAgents * AGENT_PRICE_TRY;
// Update iyzico subscription plan price when agent count changes
```

**Confidence:** HIGH — standard Supabase table pattern, no external dependency

---

## Complete Installation

```bash
# New production dependencies for v4.0
npm install iyzipay @grammyjs/conversations @grammyjs/storage-supabase

# Type definitions (no native TypeScript in iyzipay)
npm install -D @types/iyzipay
```

**Total new packages: 3 production + 1 dev type definition**

All packages are server-side only (API routes, Server Actions). No client bundle impact.

---

## Environment Variables to Add

```bash
# iyzico Payment
IYZICO_API_KEY=sandbox-...
IYZICO_SECRET_KEY=sandbox-...
IYZICO_BASE_URL=https://sandbox-api.iyzipay.com  # switch to https://api.iyzipay.com in prod

# Superadmin access control
SUPERADMIN_USER_IDS=uuid1,uuid2  # comma-separated Supabase user UUIDs
```

No new Telegram variables needed — existing `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` carry over.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Payment (Turkey) | iyzipay ^2.0.65 | PayTR | No official npm package; community packages abandoned since 2022 (last update October 2022). PayTR's recurring API exists but requires raw HTTP calls — builds same wrapper work as iyzico but without maintained SDK. |
| Payment (Turkey) | iyzipay ^2.0.65 | Stripe | Turkey not in Stripe's supported countries for merchant accounts. Foreign entity workaround (US LLC, Estonia e-Residency) adds legal/tax complexity inappropriate for a Turkish-market B2B product. |
| Payment (Turkey) | iyzipay ^2.0.65 | Paddle / Lemon Squeezy | Both are Merchant of Record services optimized for SaaS sold globally. Overkill for TRY-denominated B2B sales to Turkish companies; adds foreign currency conversion costs. |
| Wizard state | @grammyjs/conversations | Manual wizard_step column | Manual step tracking requires O(N) switch-case branching and step re-validation logic. Conversations plugin models flow as linear async code — dramatically simpler, less error-prone. |
| Conversation storage | @grammyjs/storage-supabase | Redis | Redis adds new infrastructure. Supabase already in stack. Only viable if conversation volume exceeds Postgres capacity (not a concern at 700 dealers). |
| Superadmin access | Service role + is_superadmin() | Separate Supabase project | Single project is simpler. Service role bypasses RLS cleanly. Separate project creates deployment complexity and cross-project auth. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Paddle / Lemon Squeezy** | MoR services priced for global SaaS, add currency conversion fees on TRY transactions. Not designed for B2B invoice-based Turkish market. | `iyzipay` |
| **node-paytr / paytr-js** | Community packages, both last published October 2022. No TypeScript types, no maintenance, no subscription API coverage. | `iyzipay` |
| **@types/iyzipay community fork** | Use official DefinitelyTyped `@types/iyzipay` instead. Third-party forks vary in completeness. | `@types/iyzipay` from DefinitelyTyped |
| **grammY Scenes plugin** | Older pattern superseded by conversations plugin. Less expressive for multi-step flows. grammY docs explicitly recommend conversations over scenes for complex flows. | `@grammyjs/conversations` |
| **Separate feature flag service (LaunchDarkly, etc.)** | Agent enable/disable is a core billing feature, not a deployment flag. Billing state belongs in the app database, not an external flag service. | `company_agents` table in Supabase |
| **Clerk / Auth0 for superadmin** | Already have Supabase Auth. Adding a second auth system for superadmin creates session management complexity. Simple `is_superadmin()` function checking against a `superadmins` table is sufficient. | Supabase service role + custom role check |
| **BullMQ / job queue for billing** | iyzico subscription API handles recurring charge scheduling autonomously. No queue needed for billing triggers. Webhook callback from iyzico notifies of payment events. | iyzico webhook callbacks + Supabase |

---

## Version Compatibility Matrix

| Package | Version | grammy 1.41 | Next.js 16 | Supabase JS 2.91 | Node.js |
|---------|---------|-------------|-----------|-----------------|---------|
| `iyzipay` | ^2.0.65 | N/A | ✅ (server only) | N/A | 18+ |
| `@grammyjs/conversations` | ^2.1.1 | ✅ (requires grammy ^1.20.1) | ✅ (webhook) | N/A | 18+ |
| `@grammyjs/storage-supabase` | ^2.5.0 | ✅ | ✅ | ✅ | 18+ |
| `@types/iyzipay` | ^2.0.3 | N/A | ✅ | N/A | N/A (dev only) |

**Known constraint:** `@grammyjs/conversations` requires external storage in serverless environments. `@grammyjs/storage-supabase` satisfies this requirement with zero new infrastructure.

---

## Architecture Integration Map

```
Superadmin Panel (/superadmin/*)
  │── Next.js Server Actions
  │── Supabase service role client (bypasses RLS)
  │── Creates: companies, onboarding_tokens, company_agents
  └── Generates: t.me/BayiYonetimBot?start={UUID} deep links

Telegram Webhook (POST /api/telegram/webhook)
  │── grammy bot.command('start', handler)  ← receives deep link payload
  │── Looks up onboarding_tokens table → gets company_id
  │── Launches setupWizard conversation (13th agent)
  │   └── @grammyjs/conversations persists state via @grammyjs/storage-supabase
  │── After completion: populates DB, activates company_agents, sends web panel link
  └── For non-onboarding messages: existing AgentRunner/AgentBridge (unchanged)

Agent Marketplace (Admin Panel — /admin/agents)
  │── Next.js Server Actions with company-scoped Supabase client
  │── Reads/writes company_agents table (enable/disable toggles)
  │── Calculates monthly cost (activeAgents × AGENT_PRICE_TRY)
  └── Updates iyzico subscription plan when agent count changes

Billing (iyzico)
  │── iyzipay SDK for subscription creation (company signs up → subscription initialized)
  │── Trial period: trialPeriodDays configured per pricing plan
  │── Recurring charge: iyzico autonomously charges monthly
  │── Webhook callback → POST /api/billing/iyzico-webhook → updates company status
  └── Plan upgrade/downgrade when agent count changes (same product, same interval)
```

---

## New Database Tables Required

```sql
-- Onboarding deep link tokens (short-lived, consumed once)
CREATE TABLE onboarding_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid REFERENCES companies(id) ON DELETE CASCADE,
  token       text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '7 days',
  used_at     timestamptz,  -- null = unused
  created_by  uuid REFERENCES auth.users(id)  -- superadmin who generated it
);

-- Per-company per-agent enable/disable state
CREATE TABLE company_agents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid REFERENCES companies(id) ON DELETE CASCADE,
  agent_role     text NOT NULL,
  enabled        boolean NOT NULL DEFAULT true,
  trial_ends_at  timestamptz,
  hired_at       timestamptz DEFAULT now(),
  UNIQUE (company_id, agent_role)
);

-- Subscription billing state (synced from iyzico webhooks)
CREATE TABLE company_subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  iyzico_subscription_ref  text UNIQUE,  -- iyzico's subscription reference code
  status                text NOT NULL DEFAULT 'trial',  -- trial | active | cancelled | past_due
  trial_ends_at         timestamptz,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  active_agent_count    int NOT NULL DEFAULT 12,  -- all agents active during trial
  monthly_amount_try    numeric(10,2),
  updated_at            timestamptz DEFAULT now()
);

-- grammY conversation state storage (required by @grammyjs/storage-supabase)
CREATE TABLE grammy_conversations (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);
-- No RLS — accessed via service role key from webhook handler
```

---

## Sources

- [iyzipay npm](https://www.npmjs.com/package/iyzipay) — v2.0.65 verified, February 2026
- [iyzico Subscription Docs](https://docs.iyzico.com/en/products/subscription) — subscription features, trial period
- [iyzico Subscription Transactions](https://docs.iyzico.com/en/products/subscription/subscription-implementation/subscription-transactions) — lifecycle, trial mechanics
- [iyzico Subscription Product API](https://docs.iyzico.com/en/products/subscription/subscription-implementation/subscription-product) — billing intervals, trialPeriodDays
- [Stripe Turkey availability](https://stripe.com/resources/more/payments-in-turkey) — confirms no native Turkish merchant support
- [@grammyjs/conversations npm](https://www.npmjs.com/package/@grammyjs/conversations) — v2.1.1 verified
- [grammY Conversations Plugin](https://grammy.dev/plugins/conversations) — serverless warning, storage adapters confirmed
- [@grammyjs/storage-supabase npm](https://www.npmjs.com/package/@grammyjs/storage-supabase) — v2.5.0 verified
- [Telegram Deep Linking](https://core.telegram.org/bots/features#deep-linking) — 64-char payload limit confirmed
- [Supabase RLS + Service Role](https://supabase.com/docs/guides/database/postgres/row-level-security) — superadmin bypass pattern
- [PayTR node-paytr](https://www.npmjs.com/package/node-paytr) — abandoned 2022, not recommended

---

*Stack research for: v4.0 Agent-Native SaaS Onboarding & Marketplace*
*Scope: NEW additions to existing Next.js 16 + Supabase + grammY + Anthropic stack*
*Researched: 2026-03-05*
