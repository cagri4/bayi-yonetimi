# Technology Stack — Multi-Tenant + AI Agent Ecosystem

**Project:** B2B Dealer Management SaaS (Bayi Yönetimi) — AI Agent Milestone
**Research Scope:** NEW additions only — multi-tenant architecture + 12 AI agents via Telegram + Claude API
**Researched:** 2026-03-01
**Confidence:** HIGH (primary sources verified for all core additions)

---

## Context: What Already Exists (DO NOT CHANGE)

The validated production stack is frozen. This document only covers additions.

| Existing Technology | Version | Status |
|--------------------|---------|--------|
| Next.js | 16.1.4 | KEEP — App Router, Server Actions |
| React | 19.2.3 | KEEP |
| Supabase | @supabase/ssr ^0.8.0, @supabase/supabase-js ^2.91.1 | KEEP — Auth, DB, RLS, Realtime, Storage |
| TypeScript | ^5 | KEEP |
| Tailwind CSS | ^4 | KEEP |
| Zustand | ^5.0.10 | KEEP |
| Zod | ^4.3.6 | KEEP — already works with Claude tool schemas |
| React Hook Form | ^7.71.1 | KEEP |
| Recharts | ^2.15.4 | KEEP |
| Sonner | ^2.0.7 | KEEP |
| Vercel | current | KEEP — deployment target, add Fluid Compute |

---

## New Stack Additions

### 1. Claude API — Core AI Engine

#### `@anthropic-ai/sdk` ^0.78.0 — REQUIRED
**Purpose:** Direct API access to Claude models for all 12 AI agents
**Why this over Vercel AI SDK:** This is a Claude-only project. Raw Anthropic SDK gives direct access to Anthropic-specific features (prompt caching, tool use with beta helpers, extended thinking) without abstraction overhead. Vercel AI SDK adds value when switching providers — irrelevant here.

**Key capabilities used:**
- `messages.create()` with tool definitions per agent role
- `betaZodTool()` helper — wraps Zod schemas as tool definitions (Zod v4 already in stack)
- `messages.toolRunner()` — automatic tool call loop until final text response
- `cache_control` on system prompt — 90% cost reduction on repeated agent calls

**Model selection per agent role:**
| Agent Role | Model | Rationale |
|------------|-------|-----------|
| Executive Advisor, Accountant | claude-sonnet-4-6 | Complex reasoning, financial analysis |
| Sales Rep, Field Sales, Collections | claude-haiku-4-5 | High volume, conversational, cost-sensitive |
| Warehouse, Distribution, Procurement | claude-haiku-4-5 | Tool-heavy, structured queries |
| Marketing, Campaigns, Trainer | claude-sonnet-4-6 | Creative and instructional tasks |
| Quality/Returns, Product Manager | claude-haiku-4-5 | Pattern matching, catalog queries |

**Pricing reality check (multi-tenant scale):**
- Haiku 4.5: $1.00/$5.00 per million input/output tokens
- Sonnet 4.6: $3.00/$15.00 per million input/output tokens
- With prompt caching (90% savings on cached system prompts): effectively $0.10/$0.50 and $0.30/$1.50
- Batch API: additional 50% discount for non-real-time agent work

**Confidence:** HIGH — Verified via npm (0.78.0 published Feb 2026), official Anthropic docs confirm all features

**Sources:**
- [Anthropic TypeScript SDK — GitHub](https://github.com/anthropics/anthropic-sdk-typescript)
- [@anthropic-ai/sdk — npm](https://www.npmjs.com/package/@anthropic-ai/sdk)
- [Claude API Pricing — Official](https://platform.claude.com/docs/en/about-claude/pricing)
- [Prompt Caching — Official](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)

---

### 2. Telegram Bot Framework

#### `grammy` ^1.41.0 — REQUIRED
**Purpose:** Receive and respond to dealer Telegram messages, route to appropriate AI agent
**Why grammY over Telegraf:** grammY is TypeScript-first with clean, consistent types throughout. Telegraf v4's TypeScript migration resulted in complex, hard-to-understand types. grammY is actively maintained (1.41.0 published March 2026) and has explicit Vercel serverless webhook support via `webhookCallback`. grammY also has a plugin ecosystem for conversation state, sessions, and menus.

**Deployment mode: WEBHOOK (not long polling)**
- Vercel serverless = no persistent process for long polling
- Telegram pushes updates as HTTP POST to `POST /api/telegram/webhook`
- grammY's `webhookCallback` converts incoming Next.js route handler request to bot update

**Integration pattern (Next.js App Router):**
```typescript
// src/app/api/telegram/webhook/route.ts
import { Bot, webhookCallback } from 'grammy';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

bot.on('message:text', async (ctx) => {
  const tenantId = await resolveTenantFromChat(ctx.chat.id);
  const agentRole = await resolveAgentRole(ctx.chat.id, tenantId);
  await dispatchToAgent(ctx, agentRole, tenantId);
});

const handler = webhookCallback(bot, 'std/http'); // std/http = Web API Request/Response

export const POST = handler;
export const dynamic = 'force-dynamic'; // required for webhook
```

**Local development:** Use `ngrok` to expose HTTPS tunnel → set Telegram webhook to ngrok URL. Switch to production URL on deploy.

**Confidence:** HIGH — grammY 1.41.0 verified on npm, official Vercel hosting guide exists in grammY docs

**Sources:**
- [grammY — Official](https://grammy.dev/)
- [grammY npm — current version](https://www.npmjs.com/package/grammy)
- [grammY Vercel Hosting Guide](https://grammy.dev/hosting/vercel)
- [grammY Deployment Types — Long Polling vs Webhook](https://grammy.dev/guide/deployment-types)

---

### 3. Vercel Configuration Change

#### Fluid Compute — ENABLE (config change, not a package)
**Purpose:** AI agent processing requires up to 800 seconds execution time vs default 10-15s
**Why needed:** Claude tool-calling loops for complex agent tasks (e.g., Accountant analyzing financial history, Procurement checking supplier catalog) can chain multiple tool calls taking 60-120 seconds each. Standard serverless timeout of 15s (Pro default) kills these mid-execution.

**Configuration:**
```typescript
// src/app/api/telegram/webhook/route.ts
export const maxDuration = 300; // seconds, up to 800 on Pro plan with Fluid Compute
```

**Fluid Compute limits (Pro plan):**
- Default: 300 seconds
- Maximum configurable: 800 seconds
- Standard serverless: 300 seconds max

**Recommendation:** Set `maxDuration = 300` initially. Increase to 800 only for async/batch agent tasks that justify it.

**Confidence:** HIGH — Verified via Vercel official docs and changelog

**Sources:**
- [Vercel Fluid Compute](https://vercel.com/docs/fluid-compute)
- [Configuring maxDuration](https://vercel.com/docs/functions/configuring-functions/duration)

---

### 4. Multi-Tenant Architecture — Database Pattern

**No new package required.** Multi-tenancy is implemented via Supabase RLS + schema additions.

#### Database schema additions (SQL migrations):

```sql
-- organizations table (each company = one tenant)
CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,       -- for URL routing: /org/{slug}
  plan        text DEFAULT 'starter',     -- starter | pro | enterprise
  settings    jsonb DEFAULT '{}',         -- org-level config
  created_at  timestamptz DEFAULT now()
);

-- organization_members (users belong to orgs)
CREATE TABLE organization_members (
  organization_id  uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role             text CHECK (role IN ('owner', 'admin', 'dealer')),
  PRIMARY KEY (organization_id, user_id)
);

-- All existing tables get organization_id column
ALTER TABLE dealers      ADD COLUMN organization_id uuid REFERENCES organizations(id);
ALTER TABLE products     ADD COLUMN organization_id uuid REFERENCES organizations(id);
ALTER TABLE orders       ADD COLUMN organization_id uuid REFERENCES organizations(id);
-- ... etc for all tables

-- RLS policy pattern on every table
CREATE POLICY "tenant_isolation" ON dealers
  USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);
```

#### Supabase Custom Access Token Hook (JWT enrichment):

```sql
-- Postgres function runs before JWT issuance, injects organization_id into token
CREATE OR REPLACE FUNCTION inject_organization_claim(event jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  org_id uuid;
  claims jsonb;
BEGIN
  SELECT organization_id INTO org_id
  FROM organization_members
  WHERE user_id = (event->>'user_id')::uuid
  LIMIT 1;

  claims := event->'claims';
  IF org_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{organization_id}', to_jsonb(org_id::text));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;
```

**Why JWT injection over per-query lookup:** RLS policies using `auth.jwt() ->> 'organization_id'` are evaluated by PostgreSQL — no application-level join needed. Every query is automatically scoped to the tenant without any code change in Server Actions.

**Important caveat:** JWT is stale until refreshed. If a user is removed from an organization, their token remains valid until expiry. Mitigate by keeping token TTL short (1 hour, Supabase default) and triggering client-side refresh on sensitive operations.

**Confidence:** HIGH — Supabase official docs confirm Custom Access Token Hook and JWT RLS pattern

**Sources:**
- [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
- [Supabase RLS Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Multi-Tenant Applications with RLS on Supabase](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/)

---

### 5. Agent Conversation Storage — Database Pattern

**No new package.** Uses existing Supabase PostgreSQL with JSONB.

#### Schema for agent conversations:

```sql
-- One session per dealer-agent pair
CREATE TABLE agent_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid REFERENCES organizations(id) ON DELETE CASCADE,
  dealer_id        uuid REFERENCES dealers(id) ON DELETE CASCADE,
  agent_role       text NOT NULL,  -- 'sales_rep' | 'accountant' | etc.
  telegram_chat_id bigint NOT NULL,
  started_at       timestamptz DEFAULT now(),
  last_active_at   timestamptz DEFAULT now(),
  context_summary  text,           -- compressed memory after N turns
  UNIQUE (dealer_id, agent_role)   -- one active session per dealer-agent pair
);

-- Messages (full conversation history for API calls)
CREATE TABLE agent_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid REFERENCES agent_sessions(id) ON DELETE CASCADE,
  role        text CHECK (role IN ('user', 'assistant', 'tool')),
  content     jsonb NOT NULL,     -- Anthropic message format stored directly
  tokens_used int,
  created_at  timestamptz DEFAULT now()
);

-- Index for fast session retrieval
CREATE INDEX idx_agent_messages_session ON agent_messages(session_id, created_at DESC);

-- RLS: agents can only read their own organization's conversations
CREATE POLICY "org_isolation" ON agent_sessions USING (
  organization_id = (auth.jwt() ->> 'organization_id')::uuid
);
```

**Why JSONB for content:** Anthropic API message format (`ContentBlock[]`) maps directly to JSONB. No transformation needed — store what API returns, feed what API expects.

**Context window management:** Load last N messages per session (e.g., 20 turns). When context grows large, summarize older turns into `context_summary` and truncate `agent_messages`. This prevents unbounded token cost growth.

**Confidence:** HIGH — Pattern confirmed by VoltAgent, LangChain, and direct Supabase AI docs

**Sources:**
- [VoltAgent Supabase Memory Pattern](https://voltagent.dev/docs/agents/memory/supabase/)
- [PostgreSQL as AI Agent Memory](https://www.oreateai.com/blog/postgresql-as-the-cornerstone-of-the-ai-agent-operating-system-memory-storage-and-the-future-of-agent-infrastructure/318c62d30a90b6cd22df70af44eaf44d)
- [Supabase Postgres Best Practices for AI Agents](https://supabase.com/blog/postgres-best-practices-for-ai-agents)

---

### 6. Agent Tool Definitions — Integration Point, No New Package

**How existing Server Actions become Claude tools:**

Every Server Action (`/src/lib/actions/*.ts`) can be exposed as a Claude tool. No new package needed — `@anthropic-ai/sdk` accepts Zod schemas (already in stack via `betaZodTool`).

```typescript
// src/lib/agents/tools/order-tools.ts
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { getOrdersByDealer } from '@/lib/actions/orders';
import { createOrder } from '@/lib/actions/orders';

export const getOrdersTool = betaZodTool({
  name: 'get_orders',
  description: 'Retrieve recent orders for the current dealer',
  inputSchema: z.object({
    limit: z.number().optional().default(10),
    status: z.enum(['pending', 'confirmed', 'shipped', 'delivered']).optional(),
  }),
  run: async (input, context) => {
    // context carries dealerId + organizationId from session
    const orders = await getOrdersByDealer(context.dealerId, input);
    return JSON.stringify(orders);
  }
});
```

**Tool set per agent role:**

| Agent Role | Tools Exposed |
|------------|---------------|
| Sales Rep | `get_catalog`, `create_order`, `get_order_status`, `get_campaigns` |
| Accountant | `get_financials`, `get_payment_history`, `get_invoices`, `export_report` |
| Warehouse Manager | `get_inventory_status`, `get_pending_orders`, `update_stock` |
| Field Sales | `get_dealer_profile`, `get_order_history`, `create_campaign_target` |
| Distribution Coordinator | `get_pending_shipments`, `update_delivery_status` |
| Collections | `get_overdue_payments`, `create_payment_plan`, `send_reminder` |
| Procurement | `get_product_catalog`, `create_purchase_request`, `get_supplier_list` |
| Marketing | `get_campaigns`, `create_announcement`, `get_dealer_segments` |
| Product Manager | `get_products`, `update_product_info`, `get_sales_by_product` |
| Trainer | `get_dealer_onboarding_status`, `get_product_info`, `create_announcement` |
| Quality/Returns | `get_return_requests`, `update_return_status`, `get_quality_metrics` |
| Executive Advisor | ALL read-only tools + `get_dashboard_summary`, `export_report` |

**Confidence:** HIGH — `betaZodTool` confirmed in Anthropic SDK docs, Zod already in stack

**Sources:**
- [Claude API Tool Calling Docs](https://platform.claude.com/docs/en/build-with-claude/tool-use)
- [Anthropic SDK Tool Helpers Beta](https://github.com/anthropics/anthropic-sdk-typescript)

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Vercel AI SDK** (`ai` package) | Adds abstraction for multi-provider switching — irrelevant (Claude-only). Adds 19KB+ bundle. | Raw `@anthropic-ai/sdk` |
| **LangChain / LangGraph** | Heavyweight framework (300+ packages), complex debugging, slower iteration. Over-engineered for 12 fixed agent roles. | Custom orchestration with `@anthropic-ai/sdk` + `messages.toolRunner()` |
| **OpenAI SDK** | No role here — not using OpenAI | `@anthropic-ai/sdk` |
| **Telegraf** | TypeScript types are complex and inconsistent in v4; actively maintained alternative (grammY) exists | `grammy` |
| **pgvector / semantic search** | Dealers don't need semantic product search — they search by catalog code or product name. Vector embeddings add complexity without business value at this scale. | Supabase full-text search (`tsvector`) already available |
| **Redis / separate cache** | Prompt caching in Claude API eliminates need for external cache for system prompts. Conversation state in Postgres is sufficient. | Supabase PostgreSQL JSONB for sessions |
| **Separate message queue (Bull, BullMQ)** | Telegram webhook → Next.js API route → Claude API is synchronous enough for MVP. Telegram allows 30s for bot responses. | Direct async handler in route, Vercel Fluid Compute for timeout |
| **Separate vector DB (Pinecone, Weaviate)** | PostgreSQL handles sub-100M vector workloads. Supabase pgvector available if needed later. | Postgres JSONB for conversation, full-text search for products |
| **Separate tenant schema per company** | Schema-per-tenant adds deployment complexity. Row-level isolation with `organization_id` column scales to 1000s of tenants. | Single schema + RLS |
| **`@anthropic-ai/claude-agent-sdk`** | Claude Code SDK — built for coding agents (file system, bash). Wrong tool for business domain agents. | `@anthropic-ai/sdk` directly |

---

## Complete Installation

```bash
# New production dependencies
npm install @anthropic-ai/sdk grammy

# No dev dependency additions required
```

**Total new packages: 2**
**Estimated bundle impact:** ~50KB (server-side only, no client bundle impact — both libraries used exclusively in API routes)

---

## Environment Variables to Add

```bash
# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Telegram Bot
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...  # grammy webhook secret for request verification
```

---

## Version Compatibility Matrix

| Package | Version | Next.js 16 | React 19 | Supabase | Zod v4 | Node.js |
|---------|---------|-----------|---------|---------|--------|---------|
| `@anthropic-ai/sdk` | ^0.78.0 | ✅ | N/A (server) | ✅ | ✅ (betaZodTool) | 20 LTS+ |
| `grammy` | ^1.41.0 | ✅ | N/A (server) | ✅ | N/A | 18+ |

**Note:** Both packages run exclusively in Next.js API routes (server-side). No client bundle impact.

---

## Architecture Topology

```
Dealer                Telegram            Next.js (Vercel)         Supabase
  │                      │                      │                      │
  │──── message ────────>│                      │                      │
  │                      │──── POST /webhook ──>│                      │
  │                      │                      │── load session ─────>│
  │                      │                      │<─ messages[] ────────│
  │                      │                      │                      │
  │                      │                      │── Claude API ──────> Anthropic
  │                      │                      │<─ tool_call ─────────│
  │                      │                      │                      │
  │                      │                      │── Server Action ────>│ (Supabase DB)
  │                      │                      │<─ result ────────────│
  │                      │                      │                      │
  │                      │                      │── Claude API ──────> Anthropic
  │                      │                      │<─ final text ────────│
  │                      │                      │                      │
  │                      │                      │── save message ─────>│
  │                      │                      │                      │
  │<── bot reply ────────│<── sendMessage ──────│                      │
```

**Key design decision:** Agent dispatch happens inside the Next.js webhook handler. No separate agent server. All 12 agent roles are instantiated on-demand per incoming message. Session state persists in Supabase.

---

## Confidence Assessment

| Area | Level | Reasoning |
|------|-------|-----------|
| Claude API (`@anthropic-ai/sdk`) | HIGH | npm version 0.78.0 confirmed, official docs verify tool calling, betaZodTool, prompt caching |
| Telegram (grammy) | HIGH | npm version 1.41.0 confirmed March 2026, official Vercel hosting guide exists |
| Multi-tenant RLS pattern | HIGH | Supabase official docs + multiple production references confirm organization_id + JWT pattern |
| Agent conversation storage | HIGH | JSONB pattern confirmed by VoltAgent, multiple Supabase AI guides |
| Vercel Fluid Compute | HIGH | Official Vercel docs confirm 800s max on Pro plan |
| Tool-to-Server-Action mapping | MEDIUM | Pattern is straightforward but the 12-agent tool taxonomy is project-specific and untested |
| Prompt caching cost reduction | HIGH | Official Anthropic docs confirm 90% reduction on cached system prompts |

---

## Sources

- [Anthropic TypeScript SDK — GitHub](https://github.com/anthropics/anthropic-sdk-typescript)
- [@anthropic-ai/sdk — npm 0.78.0](https://www.npmjs.com/package/@anthropic-ai/sdk)
- [Claude API Pricing 2026 — Official](https://platform.claude.com/docs/en/about-claude/pricing)
- [Claude Prompt Caching — Official](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [grammY — Official](https://grammy.dev/)
- [grammY npm 1.41.0](https://www.npmjs.com/package/grammy)
- [grammY Vercel Hosting Guide](https://grammy.dev/hosting/vercel)
- [grammY vs Telegraf Comparison](https://grammy.dev/resources/comparison)
- [Vercel Fluid Compute](https://vercel.com/docs/fluid-compute)
- [Vercel Function maxDuration](https://vercel.com/docs/functions/configuring-functions/duration)
- [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
- [Supabase RLS Multi-Tenant](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/)
- [Supabase Postgres Best Practices for AI Agents](https://supabase.com/blog/postgres-best-practices-for-ai-agents)
- [VoltAgent Supabase Memory](https://voltagent.dev/docs/agents/memory/supabase/)
- [AI SDK 6 — Vercel](https://vercel.com/blog/ai-sdk-6)
- [Vercel AI SDK vs Anthropic SDK — Strapi](https://strapi.io/blog/langchain-vs-vercel-ai-sdk-vs-openai-sdk-comparison-guide)

---

*Stack research for: Multi-tenant SaaS + AI Agent Ecosystem*
*Researched: 2026-03-01*
*Scope: NEW additions to existing Next.js 16 + Supabase stack*
