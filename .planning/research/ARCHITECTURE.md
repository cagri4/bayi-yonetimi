# Architecture Research: Multi-Tenant + AI Agent Ecosystem Integration

**Domain:** B2B Dealer Management SaaS with AI Digital Workers
**Researched:** 2026-03-01
**Confidence:** HIGH (multi-tenant patterns) / MEDIUM (agent ecosystem patterns — verified with official docs, some implementation details are project-specific decisions)

---

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER                                     │
├─────────────────────────────────────┬──────────────────────────────────────────┤
│   Next.js 16 App Router (Vercel)    │       Telegram Bot Channels               │
│  ┌────────────┐  ┌────────────┐     │  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │  (admin)/  │  │ (dealer)/  │     │  │ SalesBot │  │StockBot  │  │AcctBot │  │
│  │  admin UI  │  │ dealer UI  │     │  │ (agent1) │  │ (agent2) │  │(agent3)│  │
│  └─────┬──────┘  └─────┬──────┘     │  └────┬─────┘  └────┬─────┘  └───┬────┘  │
│        │               │            │       │              │             │       │
├────────┴───────────────┴────────────┴───────┴──────────────┴─────────────┴───────┤
│                          API / WEBHOOK LAYER                                     │
│  ┌─────────────────────┐  ┌──────────────────────────────────────────────────┐   │
│  │  Next.js Server     │  │         Next.js API Routes                       │   │
│  │  Actions            │  │  /api/telegram/[agentId]  (webhook handler)      │   │
│  │  src/lib/actions/   │  │  /api/agents/[agentId]    (internal calls)       │   │
│  └──────────┬──────────┘  └──────────────────┬───────────────────────────────┘   │
│             │                                 │                                   │
├─────────────┴─────────────────────────────────┴───────────────────────────────────┤
│                          AGENT LAYER                                              │
│  ┌───────────────────────────────────────────────────────────────────────────┐    │
│  │                    Agent Executor Service                                  │    │
│  │  src/lib/agents/                                                           │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │    │
│  │  │  AgentRunner  │  │  ToolRegistry│  │ ConvManager  │  │ AgentBridge  │  │    │
│  │  │  (Claude API) │  │ (tool defs)  │  │ (history DB) │  │ (a2a calls)  │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │    │
│  └───────────────────────────────────────────────────────────────────────────┘    │
│                                                                                   │
├───────────────────────────────────────────────────────────────────────────────────┤
│                          DATA LAYER (Supabase PostgreSQL)                         │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐   │
│  │  Core Tables   │  │  Agent Tables   │  │  Multi-Tenant   │  │   pgvector   │   │
│  │  (existing 24+)│  │  (new: 5 tables)│  │  companies tbl  │  │  (optional)  │   │
│  └────────────────┘  └────────────────┘  └─────────────────┘  └──────────────┘   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Next.js App Router | Web UI for admin/dealer portals | Existing, unchanged for UI |
| Server Actions | Mutations from web UI | Existing `src/lib/actions/` pattern |
| `/api/telegram/[agentId]` | Receive Telegram webhook POSTs per agent | New API Route, validates secret_token |
| `/api/agents/[agentId]` | Internal agent-to-agent HTTP calls | New API Route, authenticated with internal key |
| AgentRunner | Claude API loop: send messages → execute tools → repeat | New `src/lib/agents/runner.ts` |
| ToolRegistry | Tool definitions per agent role | New `src/lib/agents/tools/` directory |
| ConversationManager | Load/save message history to DB | New `src/lib/agents/conversation.ts` |
| AgentBridge | Cross-agent calls (Sales asks Warehouse) | New `src/lib/agents/bridge.ts` |
| companies table | Root tenant record; all other tables get company_id FK | New migration |
| agent_conversations | Per-user, per-agent conversation sessions | New table |
| agent_messages | Individual messages in a conversation | New table |
| agent_definitions | Configuration for each of the 12 agents | New table |

---

## Multi-Tenant Architecture: Adding company_id

### The Migration Strategy

The existing schema is single-tenant (no `company_id`). The migration to multi-tenant uses the **shared schema, single database** approach — all tenants share tables, isolated by `company_id` + RLS.

**This is NOT a schema-per-tenant design.** Shared schema is correct here because:
- Single Supabase project, no per-tenant provisioning needed
- RLS enforces isolation at the DB level
- Simpler operational overhead
- Supabase's recommended pattern for B2B SaaS

### New Root Table

```sql
-- Migration: 009_multi_tenant_foundation.sql

CREATE TABLE companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,        -- URL-safe identifier
  plan        TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Only service role can manage companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read own company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );
```

### Adding company_id to All Tables

```sql
-- Add company_id to users first (the anchor)
ALTER TABLE users ADD COLUMN company_id UUID REFERENCES companies(id);

-- Backfill: create a default company for existing data
INSERT INTO companies (id, name, slug) VALUES (gen_random_uuid(), 'Default Company', 'default');
UPDATE users SET company_id = (SELECT id FROM companies WHERE slug = 'default');
ALTER TABLE users ALTER COLUMN company_id SET NOT NULL;

-- Add to all other tables
ALTER TABLE dealers          ADD COLUMN company_id UUID NOT NULL REFERENCES companies(id) DEFAULT (SELECT id FROM companies WHERE slug = 'default');
ALTER TABLE products         ADD COLUMN company_id UUID NOT NULL REFERENCES companies(id) DEFAULT (SELECT id FROM companies WHERE slug = 'default');
ALTER TABLE orders           ADD COLUMN company_id UUID NOT NULL REFERENCES companies(id) DEFAULT (SELECT id FROM companies WHERE slug = 'default');
ALTER TABLE categories       ADD COLUMN company_id UUID NOT NULL REFERENCES companies(id) DEFAULT (SELECT id FROM companies WHERE slug = 'default');
ALTER TABLE brands           ADD COLUMN company_id UUID NOT NULL REFERENCES companies(id) DEFAULT (SELECT id FROM companies WHERE slug = 'default');
ALTER TABLE campaigns        ADD COLUMN company_id UUID NOT NULL REFERENCES companies(id) DEFAULT (SELECT id FROM companies WHERE slug = 'default');
ALTER TABLE announcements    ADD COLUMN company_id UUID NOT NULL REFERENCES companies(id) DEFAULT (SELECT id FROM companies WHERE slug = 'default');
-- ... repeat for all 24+ existing tables

-- Drop DEFAULT after backfill
ALTER TABLE dealers ALTER COLUMN company_id DROP DEFAULT;
-- ... repeat
```

### Updated RLS Pattern

**Old pattern (existing, single-tenant):**
```sql
CREATE POLICY "Dealers read own orders"
  ON orders FOR SELECT TO authenticated
  USING (
    dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid())
  );
```

**New pattern (multi-tenant):**
```sql
-- Helper function (replaces/extends existing is_admin())
CREATE OR REPLACE FUNCTION current_company_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT company_id FROM users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role = 'admin' FROM users WHERE id = auth.uid();
$$;

CREATE POLICY "Dealers read own orders"
  ON orders FOR SELECT TO authenticated
  USING (
    company_id = current_company_id()
    AND dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins manage orders in company"
  ON orders FOR ALL TO authenticated
  USING (
    company_id = current_company_id()
    AND is_admin()
  );
```

**Key insight:** `company_id = current_company_id()` must be the **first** condition in every policy. PostgreSQL evaluates conditions left-to-right and the index on `company_id` will short-circuit the query before the more expensive subquery runs.

### JWT Custom Claims for Tenant Isolation

Using Supabase Custom Access Token Hook to inject `company_id` into JWT:

```sql
-- Auth Hook function (runs before every JWT issue)
CREATE OR REPLACE FUNCTION inject_company_claim(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  claims JSONB;
  company UUID;
BEGIN
  claims := event -> 'claims';

  SELECT company_id INTO company
  FROM users
  WHERE id = (event ->> 'user_id')::UUID;

  claims := jsonb_set(claims, '{company_id}', to_jsonb(company::text));

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;
```

Then in Supabase Dashboard: Authentication > Hooks > Custom Access Token → select `inject_company_claim`.

This allows RLS policies to use the even faster `(auth.jwt() ->> 'company_id')::UUID` instead of a subquery, but the `current_company_id()` SECURITY DEFINER function is safer for early development (no JWT cache invalidation issues).

### Required Indexes

```sql
-- Critical: index company_id on ALL tables for RLS performance
CREATE INDEX idx_dealers_company_id          ON dealers(company_id);
CREATE INDEX idx_products_company_id         ON products(company_id);
CREATE INDEX idx_orders_company_id           ON orders(company_id);
CREATE INDEX idx_categories_company_id       ON categories(company_id);
CREATE INDEX idx_brands_company_id           ON brands(company_id);
CREATE INDEX idx_campaigns_company_id        ON campaigns(company_id);
CREATE INDEX idx_announcements_company_id    ON announcements(company_id);
-- ... all tables with company_id

-- Composite indexes for frequent query patterns
CREATE INDEX idx_orders_company_dealer       ON orders(company_id, dealer_id);
CREATE INDEX idx_dealers_company_user        ON dealers(company_id, user_id);
```

---

## AI Agent Ecosystem Architecture

### Agent Identity and Configuration

```sql
-- Migration: 010_agent_system.sql

-- 12 role-based agent definitions (seeded, not user-created)
CREATE TABLE agent_definitions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id),
  agent_key    TEXT NOT NULL,          -- 'sales', 'warehouse', 'accounting', etc.
  display_name TEXT NOT NULL,          -- 'Satış Asistanı', 'Depo Yöneticisi', etc.
  role_description TEXT NOT NULL,      -- System prompt base text
  telegram_bot_token TEXT,             -- Encrypted: bot token for this agent's channel
  telegram_bot_username TEXT,          -- @SalesAssistantBot
  telegram_webhook_secret TEXT,        -- X-Telegram-Bot-Api-Secret-Token value
  is_active    BOOLEAN DEFAULT true,
  model        TEXT DEFAULT 'claude-sonnet-4-5',
  max_tokens   INT DEFAULT 4096,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, agent_key)
);

ALTER TABLE agent_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage agent definitions"
  ON agent_definitions FOR ALL TO authenticated
  USING (company_id = current_company_id() AND is_admin());
CREATE POLICY "All authenticated read active agents"
  ON agent_definitions FOR SELECT TO authenticated
  USING (company_id = current_company_id() AND is_active = true);
```

### Conversation Storage Schema

```sql
-- Conversation sessions (one per user per agent, or per Telegram chat_id)
CREATE TABLE agent_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  agent_id        UUID NOT NULL REFERENCES agent_definitions(id),
  user_id         UUID REFERENCES users(id),       -- NULL for dealer Telegram users not in system
  telegram_chat_id BIGINT,                          -- Telegram user's chat_id (stable identifier)
  channel         TEXT NOT NULL CHECK (channel IN ('telegram', 'web', 'internal')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'error')),
  summary         TEXT,                             -- Compressed older context (see context management)
  total_messages  INT DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, agent_id, telegram_chat_id)   -- One conversation per user per bot
);

CREATE INDEX idx_conversations_agent        ON agent_conversations(agent_id);
CREATE INDEX idx_conversations_company      ON agent_conversations(company_id);
CREATE INDEX idx_conversations_telegram     ON agent_conversations(telegram_chat_id);

-- Individual messages (Claude API history format)
CREATE TABLE agent_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id),
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool_result')),
  content         JSONB NOT NULL,    -- Stores Claude API message content array as-is
  tool_calls      JSONB,             -- tool_use blocks from assistant messages
  token_count     INT,               -- Estimated tokens for context window management
  is_archived     BOOLEAN DEFAULT false,  -- Archived messages excluded from active context
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation      ON agent_messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_company           ON agent_messages(company_id);
CREATE INDEX idx_messages_active            ON agent_messages(conversation_id) WHERE is_archived = false;

-- Agent-to-agent call log (audit trail)
CREATE TABLE agent_calls (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id),
  caller_agent_id  UUID NOT NULL REFERENCES agent_definitions(id),
  callee_agent_id  UUID NOT NULL REFERENCES agent_definitions(id),
  conversation_id  UUID REFERENCES agent_conversations(id),
  tool_name        TEXT NOT NULL,     -- Which tool triggered the cross-agent call
  request_payload  JSONB NOT NULL,
  response_payload JSONB,
  duration_ms      INT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'error', 'timeout')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_calls_company        ON agent_calls(company_id, created_at DESC);
CREATE INDEX idx_agent_calls_caller         ON agent_calls(caller_agent_id);
```

### RLS for Agent Tables

```sql
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own conversations"
  ON agent_conversations FOR SELECT TO authenticated
  USING (company_id = current_company_id() AND (user_id = auth.uid() OR is_admin()));
CREATE POLICY "Admins manage all conversations"
  ON agent_conversations FOR ALL TO authenticated
  USING (company_id = current_company_id() AND is_admin());

ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see messages in own conversations"
  ON agent_messages FOR SELECT TO authenticated
  USING (
    company_id = current_company_id()
    AND conversation_id IN (
      SELECT id FROM agent_conversations
      WHERE user_id = auth.uid() OR is_admin()
    )
  );

ALTER TABLE agent_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins see all agent calls"
  ON agent_calls FOR SELECT TO authenticated
  USING (company_id = current_company_id() AND is_admin());
```

---

## Telegram Webhook Architecture

### Webhook Flow

```
Telegram Server
    │  POST /api/telegram/[agentId]
    │  Header: X-Telegram-Bot-Api-Secret-Token: <secret>
    │  Body: { update_id, message: { chat, from, text } }
    ↓
Next.js API Route: src/app/api/telegram/[agentId]/route.ts
    │  1. Validate X-Telegram-Bot-Api-Secret-Token (constant-time compare)
    │  2. Respond HTTP 200 immediately (avoid Telegram retry loop)
    │  3. Kick off background processing via Vercel waitUntil()
    ↓
Background Processing (within Vercel Fluid Compute 800s window)
    │  4. Resolve agentId → load agent_definitions record
    │  5. Find or create agent_conversations record for chat.id
    │  6. Load last N messages from agent_messages
    │  7. Call AgentRunner with loaded context
    ↓
AgentRunner (Claude API loop)
    │  8. Build messages array (system prompt + history + new user message)
    │  9. POST to Claude API with tools definition
    │  10. If stop_reason = 'tool_use':
    │       - Execute tool (DB query, cross-agent call, etc.)
    │       - Append tool_result to messages
    │       - Loop back to step 9
    │  11. If stop_reason = 'end_turn': final response ready
    ↓
Response Delivery
    │  12. Save all new messages to agent_messages table
    │  13. POST final text to Telegram sendMessage API
    │  14. Update agent_conversations.last_message_at
```

### Webhook Route Implementation

```typescript
// src/app/api/telegram/[agentId]/route.ts

import { after } from 'next/server'  // Next.js 16 waitUntil equivalent
import { createServiceClient } from '@/lib/supabase/service'
import { AgentRunner } from '@/lib/agents/runner'
import { validateTelegramWebhook } from '@/lib/agents/telegram'

export async function POST(
  request: Request,
  { params }: { params: { agentId: string } }
) {
  // Step 1: Validate secret immediately
  const secretToken = request.headers.get('x-telegram-bot-api-secret-token')

  const supabase = createServiceClient()  // Service role — bypasses RLS (safe in server-side)
  const { data: agent } = await supabase
    .from('agent_definitions')
    .select('id, telegram_webhook_secret, company_id')
    .eq('id', params.agentId)
    .single()

  if (!agent || !timingSafeEqual(secretToken, agent.telegram_webhook_secret)) {
    return new Response('Unauthorized', { status: 403 })
  }

  // Step 2: Respond 200 immediately to prevent Telegram retry
  const update = await request.json()

  // Step 3: Process in background (Vercel Fluid Compute)
  after(async () => {
    const runner = new AgentRunner(agent.id, agent.company_id)
    await runner.handleTelegramUpdate(update)
  })

  return new Response('OK', { status: 200 })
}
```

### Vercel Timeout Solution

Standard Vercel hobby: 10s timeout. Pro: 60s. Claude API + multi-turn tool calling easily exceeds this.

**Solution: Vercel Fluid Compute + `after()`**

Next.js 16 provides `after()` (stable in 16.x) which continues execution after the response is sent, up to 800s on Pro/Enterprise. This is the correct architectural choice — respond to Telegram immediately, process in background.

```typescript
// next.config.ts — enable fluid compute for API routes
const nextConfig = {
  experimental: {
    after: true,  // already stable in Next.js 16
  },
}
```

**Fallback for heavy workloads:** If agent conversations exceed 800s (unlikely for chat), use Supabase Edge Functions as a separate processing layer. For this project, `after()` is sufficient.

---

## AgentRunner: Claude API Tool Calling Loop

### Core Pattern

```typescript
// src/lib/agents/runner.ts

import Anthropic from '@anthropic-ai/sdk'

export class AgentRunner {
  private client = new Anthropic()
  private agentId: string
  private companyId: string

  constructor(agentId: string, companyId: string) {
    this.agentId = agentId
    this.companyId = companyId
  }

  async run(
    messages: Anthropic.MessageParam[],
    tools: Anthropic.Tool[],
    systemPrompt: string
  ): Promise<string> {
    const currentMessages = [...messages]

    // Tool-calling loop (max 10 iterations to prevent infinite loops)
    for (let iteration = 0; iteration < 10; iteration++) {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages: currentMessages,
      })

      // End of conversation
      if (response.stop_reason === 'end_turn') {
        return extractText(response.content)
      }

      // Tool use requested
      if (response.stop_reason === 'tool_use') {
        // Append assistant message with tool_use blocks
        currentMessages.push({ role: 'assistant', content: response.content })

        // Execute all tool calls
        const toolResults = await this.executeTools(response.content)

        // Append tool results as user message
        currentMessages.push({ role: 'user', content: toolResults })
        continue
      }

      break  // Unknown stop_reason — exit
    }

    throw new Error('Agent exceeded maximum tool-calling iterations')
  }

  private async executeTools(
    content: Anthropic.ContentBlock[]
  ): Promise<Anthropic.ToolResultBlockParam[]> {
    const toolUseBlocks = content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    )

    const results = await Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        try {
          const result = await this.registry.execute(
            toolUse.name,
            toolUse.input,
            this.companyId
          )
          return {
            type: 'tool_result' as const,
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          }
        } catch (error) {
          return {
            type: 'tool_result' as const,
            tool_use_id: toolUse.id,
            content: `Error: ${error.message}`,
            is_error: true,
          }
        }
      })
    )

    return results
  }
}
```

### Tool Registry Architecture

Each agent has a role-specific set of tools. Tools are plain TypeScript functions that query the database using the service role client (bypasses RLS — the agent infrastructure is trusted, company_id is scoped in code).

```typescript
// src/lib/agents/tools/registry.ts

type ToolHandler = (input: Record<string, unknown>, companyId: string) => Promise<unknown>

export class ToolRegistry {
  private tools: Map<string, { definition: Anthropic.Tool; handler: ToolHandler }> = new Map()

  register(name: string, definition: Anthropic.Tool, handler: ToolHandler) {
    this.tools.set(name, { definition, handler })
  }

  getDefinitions(): Anthropic.Tool[] {
    return Array.from(this.tools.values()).map(t => t.definition)
  }

  async execute(name: string, input: Record<string, unknown>, companyId: string) {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`Unknown tool: ${name}`)
    return tool.handler(input, companyId)
  }
}

// Example: Sales agent tools
// src/lib/agents/tools/sales-tools.ts
export const salesTools = new ToolRegistry()

salesTools.register(
  'check_dealer_balance',
  {
    name: 'check_dealer_balance',
    description: 'Check the current account balance for a dealer',
    input_schema: {
      type: 'object',
      properties: {
        dealer_id: { type: 'string', description: 'UUID of the dealer' },
      },
      required: ['dealer_id'],
    },
  },
  async (input, companyId) => {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('dealer_transactions')
      .select('amount, balance_effect')
      .eq('dealer_id', input.dealer_id)
      .eq('company_id', companyId)  // Always scope to company

    const balance = data?.reduce((sum, t) =>
      t.balance_effect === 'debit' ? sum + t.amount : sum - t.amount, 0) ?? 0

    return { balance, currency: 'TRY' }
  }
)
```

---

## Agent-to-Agent Communication (Cross-Functional Workflows)

### Pattern: Database-Mediated Delegation

For simple cross-agent queries (Sales asks Warehouse about stock), use direct internal HTTP calls to the agent's API route. Do NOT spawn a new full agent loop — use a lightweight "tool-only" call.

```
Sales Agent (Claude loop)
    │  Tool: check_stock_for_product
    ↓
AgentBridge.callAgent('warehouse', 'check_stock', { product_id })
    │  Internal HTTP POST to /api/agents/warehouse/tools
    │  Header: Authorization: Bearer <INTERNAL_AGENT_SECRET>
    ↓
Warehouse Agent Tool Handler (no Claude involved — just DB query)
    │  SELECT stock_quantity FROM products WHERE id = ? AND company_id = ?
    ↓
Returns { stock: 42, reserved: 5, available: 37 }
    │
Back to Sales Agent as tool_result
    │
Claude continues: "Yes, we have 37 units available for immediate delivery."
```

**Why this pattern instead of spawning a full Claude loop for the sub-agent:**
- Fast: DB query not another 1-2s Claude API call
- Cheap: No additional API tokens
- Simple: Sub-agents don't need conversation history for tool-only queries
- Auditable: All calls logged to `agent_calls` table

**When to use full Claude sub-agent:** Only for complex reasoning tasks where the sub-agent needs to synthesize multiple pieces of information. Example: Sales asks Accounting to "analyze whether this dealer qualifies for credit extension" — that requires judgment, not just a DB query.

```typescript
// src/lib/agents/bridge.ts

export class AgentBridge {
  async callAgentTool(
    callerAgentId: string,
    calleeAgentKey: string,
    toolName: string,
    input: Record<string, unknown>,
    companyId: string
  ): Promise<unknown> {
    // Log the call
    const supabase = createServiceClient()
    const { data: calleeAgent } = await supabase
      .from('agent_definitions')
      .select('id')
      .eq('company_id', companyId)
      .eq('agent_key', calleeAgentKey)
      .single()

    const { data: callRecord } = await supabase
      .from('agent_calls')
      .insert({
        company_id: companyId,
        caller_agent_id: callerAgentId,
        callee_agent_id: calleeAgent!.id,
        tool_name: toolName,
        request_payload: input,
        status: 'pending',
      })
      .select('id')
      .single()

    const start = Date.now()

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/agents/${calleeAgent!.id}/tools`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.INTERNAL_AGENT_SECRET}`,
          },
          body: JSON.stringify({ tool: toolName, input, companyId }),
        }
      )

      const result = await response.json()

      // Update call log
      await supabase
        .from('agent_calls')
        .update({
          response_payload: result,
          duration_ms: Date.now() - start,
          status: 'success',
        })
        .eq('id', callRecord!.id)

      return result
    } catch (error) {
      await supabase
        .from('agent_calls')
        .update({ status: 'error', duration_ms: Date.now() - start })
        .eq('id', callRecord!.id)
      throw error
    }
  }
}
```

---

## Conversation Memory and Context Window Management

### Problem: Claude context window is finite (200K tokens for Sonnet)

Business chat conversations accumulate. After ~100 turns, the message history itself approaches the context limit, increasing API cost and risking overflow.

### Solution: Rolling Window + Periodic Summarization

```
agent_messages (DB)
  ├── Active messages (last 50, included in every context)
  ├── Archived messages (older than 50, is_archived = true)
  └── Summary (stored in agent_conversations.summary)

Context window assembly:
  [System Prompt]
  [Conversation Summary: "In previous sessions, this dealer ordered X, requested Y..."]
  [Last 50 messages]
  [New user message]
```

**Summarization trigger:** When `total_messages` in `agent_conversations` exceeds 50, archive the oldest 25 messages and generate a summary via a lightweight Claude call.

```typescript
// src/lib/agents/conversation.ts

export class ConversationManager {
  async loadContext(conversationId: string): Promise<{
    messages: Anthropic.MessageParam[]
    summary: string | null
  }> {
    const supabase = createServiceClient()

    const [{ data: conversation }, { data: messages }] = await Promise.all([
      supabase
        .from('agent_conversations')
        .select('summary, total_messages')
        .eq('id', conversationId)
        .single(),
      supabase
        .from('agent_messages')
        .select('role, content, created_at')
        .eq('conversation_id', conversationId)
        .eq('is_archived', false)
        .order('created_at', { ascending: true }),
    ])

    return {
      messages: messages?.map(m => ({ role: m.role, content: m.content })) ?? [],
      summary: conversation?.summary ?? null,
    }
  }

  async saveMessages(
    conversationId: string,
    companyId: string,
    newMessages: Anthropic.MessageParam[]
  ) {
    const supabase = createServiceClient()

    await supabase.from('agent_messages').insert(
      newMessages.map(m => ({
        conversation_id: conversationId,
        company_id: companyId,
        role: m.role,
        content: m.content,
      }))
    )

    // Update conversation metadata
    await supabase
      .from('agent_conversations')
      .update({
        total_messages: supabase.rpc('increment', { x: newMessages.length }),
        last_message_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    // Trigger summarization if needed
    await this.maybeArchiveAndSummarize(conversationId, companyId)
  }

  private async maybeArchiveAndSummarize(conversationId: string, companyId: string) {
    const supabase = createServiceClient()
    const { count } = await supabase
      .from('agent_messages')
      .select('id', { count: 'exact' })
      .eq('conversation_id', conversationId)
      .eq('is_archived', false)

    if ((count ?? 0) > 50) {
      // Archive oldest 25 messages
      const { data: oldest } = await supabase
        .from('agent_messages')
        .select('id, role, content')
        .eq('conversation_id', conversationId)
        .eq('is_archived', false)
        .order('created_at', { ascending: true })
        .limit(25)

      // Generate summary via Claude (lightweight, no tools)
      const client = new Anthropic()
      const summaryResponse = await client.messages.create({
        model: 'claude-haiku-4-5',  // Use cheaper model for summarization
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Summarize this conversation history in 3-5 sentences, preserving key facts about the dealer, their orders, and any commitments made:\n\n${JSON.stringify(oldest)}`,
        }],
      })

      const newSummary = extractText(summaryResponse.content)

      // Mark as archived and update summary
      await Promise.all([
        supabase
          .from('agent_messages')
          .update({ is_archived: true })
          .in('id', oldest!.map(m => m.id)),
        supabase
          .from('agent_conversations')
          .update({ summary: newSummary })
          .eq('id', conversationId),
      ])
    }
  }
}
```

---

## Recommended Project Structure

```
src/
├── app/
│   ├── (admin)/
│   │   └── admin/
│   │       └── agents/              # NEW: agent management UI
│   │           ├── page.tsx          # List all 12 agents
│   │           └── [id]/
│   │               └── page.tsx      # Conversation viewer, logs
│   ├── (dealer)/
│   │   └── agents/                  # NEW: web chat UI (optional)
│   │       └── [agentKey]/
│   │           └── page.tsx
│   └── api/
│       ├── telegram/                # NEW: Telegram webhooks
│       │   └── [agentId]/
│       │       └── route.ts
│       └── agents/                  # NEW: Internal agent tool calls
│           └── [agentId]/
│               └── tools/
│                   └── route.ts
├── lib/
│   ├── supabase/                    # EXISTING: unchanged
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── actions/                     # EXISTING: web UI mutations
│   │   └── ...                      # Add company_id scoping to all
│   └── agents/                      # NEW: entire agent subsystem
│       ├── runner.ts                # Claude API loop
│       ├── conversation.ts          # Load/save DB history
│       ├── bridge.ts                # Cross-agent calls
│       ├── telegram.ts              # Telegram API helpers (send, parse)
│       ├── system-prompts/          # Role-specific system prompts
│       │   ├── sales.ts
│       │   ├── warehouse.ts
│       │   ├── accounting.ts
│       │   └── ...
│       └── tools/                   # Tool implementations
│           ├── registry.ts          # Base ToolRegistry class
│           ├── common-tools.ts      # Shared tools (dealer lookup, etc.)
│           ├── sales-tools.ts       # Sales agent tools
│           ├── warehouse-tools.ts   # Warehouse agent tools
│           ├── accounting-tools.ts  # Accounting agent tools
│           └── ...
├── components/
│   └── admin/
│       └── agents/                  # NEW: admin UI components
│           ├── agent-card.tsx
│           ├── conversation-viewer.tsx
│           └── agent-logs.tsx
└── types/
    └── database.types.ts            # EXISTING: regenerate after migrations
```

### Structure Rationale

- **`src/app/api/telegram/[agentId]/`:** Dynamic route handles all 12 bots with one route definition. `agentId` is the `agent_definitions.id` UUID — unguessable, serves as first layer of security.
- **`src/lib/agents/`:** Entirely new directory, isolated from existing Server Actions. Agents use service role client, not the anon key client used by web UI.
- **`src/lib/agents/tools/`:** One file per agent role. Each exports a pre-configured `ToolRegistry`. Keeps tool definitions close to their handlers.
- **`src/lib/agents/system-prompts/`:** System prompts as TypeScript string templates — they reference company name, agent name, and available tools from `agent_definitions`.

---

## Architectural Patterns

### Pattern 1: Service Role for Agent Layer

**What:** Agent infrastructure uses `SUPABASE_SERVICE_ROLE_KEY`, not the anon key. Agents are trusted internal processes.

**When to use:** All agent code in `src/lib/agents/` — API routes, tool handlers, bridge.

**Trade-offs:** Service role bypasses RLS. This is intentional — agents need cross-table access. The company_id scoping is enforced in code (every tool handler receives `companyId` and applies it to every query).

**Example:**
```typescript
// src/lib/supabase/service.ts  (NEW FILE)
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

### Pattern 2: Immediate Response + Background Processing for Telegram

**What:** Telegram webhook handler responds HTTP 200 within milliseconds, then processes in background using Next.js `after()`.

**When to use:** Every Telegram webhook route. Required to prevent Telegram from retrying failed requests.

**Trade-offs:** If background processing fails, the user sees no error. Add error handling that sends a Telegram message on failure.

**Example:**
```typescript
export async function POST(request: Request) {
  // Validate, parse update
  after(async () => {
    try {
      await processUpdate(update)
    } catch (error) {
      await sendTelegramMessage(chatId, 'Bir hata olustu. Lutfen tekrar deneyin.')
    }
  })
  return new Response('OK', { status: 200 })
}
```

### Pattern 3: Company-Scoped Tool Execution

**What:** Every tool handler receives `companyId` as a parameter and applies it to every DB query. This is the agent-layer equivalent of RLS.

**When to use:** Every tool in `src/lib/agents/tools/`.

**Trade-offs:** Requires discipline. If a developer forgets `company_id` in a query, data leaks across tenants. Mitigate with a typed wrapper.

**Example:**
```typescript
type AgentToolHandler = (
  input: Record<string, unknown>,
  companyId: string  // Non-optional — always required
) => Promise<unknown>
```

### Pattern 4: Lightweight Sub-Agent Calls via Tools

**What:** Cross-agent communication uses direct HTTP to a tools-only endpoint, not a full Claude conversation loop.

**When to use:** When one agent needs factual data from another agent's domain (stock levels, balances, order status).

**Trade-offs:** Sub-agent responses are data, not reasoning. If the cross-agent task requires judgment, escalate to a full Agent loop.

---

## Data Flow

### Telegram Message Flow

```
User message in Telegram
    ↓
Telegram Server (webhook POST)
    ↓
/api/telegram/[agentId]/route.ts
    ├── Validate secret_token
    ├── HTTP 200 immediately
    └── after(): background processing
          ↓
    ConversationManager.loadContext(chat_id)
          ↓
    AgentRunner.run(messages, tools, systemPrompt)
          ├── Claude API call
          ├── If tool_use: execute tool (DB query or AgentBridge call)
          ├── Append tool_result
          └── Loop until end_turn
          ↓
    ConversationManager.saveMessages()
          ↓
    Telegram.sendMessage(chat_id, responseText)
```

### Multi-Tenant Web Request Flow

```
Browser (dealer/admin)
    ↓
Next.js Server Component or Client fetch
    ↓
Server Action (src/lib/actions/)
    ├── createClient() → anon key + user session cookie
    ├── DB query — RLS automatically adds company_id filter
    │   (company_id = current_company_id() in RLS policy)
    └── Returns only company-scoped data
```

### Cross-Agent Communication Flow

```
Sales Agent (Claude loop)
    │  Deciding to check stock
    ↓
Tool call: check_stock_availability({ product_id: "..." })
    ↓
ToolRegistry executes sales-tools.check_stock_availability()
    ↓
AgentBridge.callAgentTool('warehouse', 'get_stock', { product_id }, companyId)
    ↓
Internal POST /api/agents/{warehouseAgentId}/tools
    Header: Authorization: Bearer INTERNAL_AGENT_SECRET
    Body: { tool: 'get_stock', input: { product_id }, companyId }
    ↓
Warehouse tools handler (DB query, no Claude involved)
    ↓
{ available: 37, reserved: 5, location: 'Raf A-12' }
    ↓
Returns to Sales Agent as tool_result
    ↓
Sales Agent Claude: "37 adet stokta mevcut, Raf A-12'de bulunuyor."
```

---

## Existing Components Modified

### 1. Middleware (src/middleware.ts)

**Current:** Checks `users.role` for admin/dealer routing.
**Change needed:** No structural change. After multi-tenant migration, users still have roles. If adding a `superadmin` role (platform owner), add a check here.

### 2. All Server Actions (src/lib/actions/*.ts)

**Current:** No `company_id` filtering — works because single-tenant.
**Change needed:** After migration, RLS policies enforce `company_id` automatically. Actions do NOT need to change if RLS is correctly set up. This is the power of the RLS approach — application code stays clean.

**Exception:** Admin actions that use service role (if any) must add explicit `company_id` filter.

### 3. Supabase Client Files

**Current:** Two clients (browser, server).
**Change needed:** Add a third `service.ts` client for agent layer. Do not change existing clients.

### 4. Database Types (src/types/database.types.ts)

**Current:** Generated from existing schema.
**Change needed:** Regenerate after each migration with `supabase gen types typescript`. All new tables (`companies`, `agent_definitions`, `agent_conversations`, `agent_messages`, `agent_calls`) will appear automatically.

### 5. Nav Links (src/components/layout/nav-links.tsx)

**Current:** Links for dealer portal.
**Change needed:** Add link to agent chat UI if building web-based agent interface.

---

## New Components Required

| Component | Type | Purpose |
|-----------|------|---------|
| `src/lib/supabase/service.ts` | Service client | Agent layer DB access with service role |
| `src/app/api/telegram/[agentId]/route.ts` | API Route | Telegram webhook receiver |
| `src/app/api/agents/[agentId]/tools/route.ts` | API Route | Internal cross-agent tool calls |
| `src/lib/agents/runner.ts` | Class | Claude API tool-calling loop |
| `src/lib/agents/conversation.ts` | Class | DB-backed conversation history |
| `src/lib/agents/bridge.ts` | Class | Cross-agent HTTP calls |
| `src/lib/agents/telegram.ts` | Utilities | Send/receive Telegram API calls |
| `src/lib/agents/tools/registry.ts` | Class | Tool registration and execution |
| `src/lib/agents/tools/{role}-tools.ts` (x12) | Tool sets | One file per agent role |
| `src/lib/agents/system-prompts/{role}.ts` (x12) | Strings | Role-based system prompts |
| `supabase/migrations/009_multi_tenant_foundation.sql` | Migration | companies table + company_id on all tables |
| `supabase/migrations/010_agent_system.sql` | Migration | agent_definitions, conversations, messages, calls |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 company, low volume | Current design — Vercel + Supabase handles all load |
| 5-20 companies, moderate agent use | Monitor Vercel function concurrency; pgvector for semantic memory if needed |
| 50+ companies, heavy agent use | Move agent processing to dedicated service (Fly.io, Railway); Vercel for web UI only; connection pooling via PgBouncer (Supabase has this built-in) |
| 200+ companies | Consider Supabase schema-per-tenant for largest customers; keep shared schema for small tenants |

### Scaling Priorities

1. **First bottleneck:** Vercel cold starts for webhook API routes. Fix with Vercel Pro fluid compute + route warming.
2. **Second bottleneck:** Claude API rate limits across 12 concurrent agents. Fix with exponential backoff retry in AgentRunner + per-company request queuing via Supabase queue table.
3. **Third bottleneck:** PostgreSQL connection exhaustion from many concurrent agent requests. Fix with Supabase's built-in connection pooler (already in the Supabase URL as `:6543` pooler port vs `:5432` direct).

---

## Anti-Patterns

### Anti-Pattern 1: Using Anon Key in Agent Layer

**What people do:** Reuse the existing `createClient()` (anon key) in agent tools, relying on RLS.

**Why it's wrong:** Agents call tools from server-side API routes that don't have a user session cookie. The anon key without session = no `auth.uid()` = RLS policies return zero rows.

**Do this instead:** Create `src/lib/supabase/service.ts` with service role. Always pass `companyId` explicitly to tool handlers as a parameter, and apply it to every query in the tool.

### Anti-Pattern 2: Spawning a Full Claude Loop for Every Cross-Agent Query

**What people do:** When Sales needs stock info, start a full Warehouse agent conversation (load history, call Claude, execute tools, save history).

**Why it's wrong:** Doubles API cost, doubles latency (2x Claude calls), creates orphan conversation records, wastes context window on unrelated history.

**Do this instead:** Use `AgentBridge.callAgentTool()` to call just the tool handler directly. Only spawn a full agent loop when the cross-agent task requires reasoning, not just data retrieval.

### Anti-Pattern 3: Blocking Telegram Webhook Handler

**What people do:** Await the entire agent processing loop before responding to Telegram.

**Why it's wrong:** Claude API calls take 2-15 seconds. Telegram has a 60-second webhook timeout, but more critically, if the response takes >10s on Vercel Hobby, the function times out, returns 504, and Telegram retries — creating duplicate messages.

**Do this instead:** Respond HTTP 200 immediately. Process in `after()`. Handle errors by sending a Telegram message from within the background handler.

### Anti-Pattern 4: Storing Messages as Individual Columns (not JSON)

**What people do:** Create separate columns for message role, text content, image URL, tool name, tool input, tool output — one row per content block.

**Why it's wrong:** Claude's content format is already a typed JSONB array. Decomposing it means reconstructing it for every API call. When Claude adds new content block types, the schema breaks.

**Do this instead:** Store `content JSONB NOT NULL` matching the Claude API format exactly. Load it and pass it directly to the API without transformation.

### Anti-Pattern 5: Updating ALL Existing RLS Policies Manually

**What people do:** After adding `company_id`, manually edit each of the 30+ existing RLS policies.

**Why it's wrong:** High chance of missing a policy. Inconsistent security.

**Do this instead:** Create `current_company_id()` as a SECURITY DEFINER function. Update policies by prepending `company_id = current_company_id() AND` to each policy's USING clause. Write a migration script that does this programmatically using `pg_policies` catalog.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Claude API (Anthropic) | `@anthropic-ai/sdk` npm package, REST | Add `ANTHROPIC_API_KEY` to env. Use `claude-sonnet-4-5` as default, `claude-haiku-4-5` for summarization to cut cost. |
| Telegram Bot API | `grammy` npm package (TypeScript-first) or raw `fetch` to `https://api.telegram.org/bot{token}/` | One bot token per agent (12 tokens total). Register webhooks on deploy using `/setWebhook`. |
| Supabase | Existing `@supabase/ssr` + `@supabase/supabase-js` | Add service role client only for agents. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Web UI ↔ Database | Server Actions + anon client + RLS | Unchanged from existing |
| Telegram Webhook ↔ Agent Layer | API Route → `AgentRunner` (same process, function call) | No network hop |
| Agent ↔ Database | Service client (bypasses RLS, company_id in code) | Agents never use anon client |
| Agent ↔ Agent (data) | HTTP POST to `/api/agents/[id]/tools` + `INTERNAL_AGENT_SECRET` | Lightweight, no Claude invocation |
| Agent ↔ Agent (reasoning) | Full `AgentRunner.run()` spawned by caller | Only for complex cross-agent tasks |
| Agent Layer ↔ Claude API | `@anthropic-ai/sdk` messages.create() | Keep client instance in module scope, not per-request |

---

## Build Order (Dependency-Aware)

| Step | Task | Depends On | Why This Order |
|------|------|-----------|----------------|
| 1 | Migration 009: companies table + company_id columns | Nothing | Foundation for all tenancy |
| 2 | Update `current_company_id()` RLS helper function | Step 1 | All policy updates depend on this |
| 3 | Update RLS policies on all existing tables | Step 2 | Before any web UI changes |
| 4 | Regenerate database.types.ts | Step 3 | TypeScript types need new schema |
| 5 | Migration 010: agent tables (definitions, conversations, messages, calls) | Step 1 | Needs companies table |
| 6 | Create `src/lib/supabase/service.ts` | Step 4 | Service client for agents |
| 7 | Create `src/lib/agents/conversation.ts` | Steps 5, 6 | Needs agent tables + service client |
| 8 | Create `src/lib/agents/tools/registry.ts` + common tools | Step 6 | Core tool infrastructure |
| 9 | Create `src/lib/agents/runner.ts` | Steps 7, 8 | Needs conversation + tool registry |
| 10 | Create `src/lib/agents/bridge.ts` + `/api/agents/[id]/tools` route | Step 9 | Needs runner to exist first |
| 11 | Create `src/lib/agents/telegram.ts` helpers | Nothing | Independent utility |
| 12 | Create `/api/telegram/[agentId]/route.ts` | Steps 9, 10, 11 | Needs full agent stack |
| 13 | Implement agent-specific tool sets (one per role) | Step 8 | Can be done in parallel |
| 14 | Seed `agent_definitions` for all 12 agents | Step 5 | Need table to exist |
| 15 | Register webhooks with Telegram for each bot | Steps 12, 14 | Need routes + bot tokens |
| 16 | Admin UI for agent monitoring | Step 5 | Nice-to-have, can build last |

---

## Sources

**Multi-Tenant RLS Patterns:**
- [Multi-Tenant Applications with RLS on Supabase | AntStack](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/)
- [Custom Access Token Hook | Supabase Docs](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Multi-Tenancy with Detail + Template Project | Medium](https://medium.com/@itsuki.enjoy/supabase-support-multi-tenancy-with-detail-template-project-34f3a3d97ee4)
- [Custom Claims & RBAC | Supabase Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)

**Claude API Tool Calling:**
- [How to implement tool use | Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use)
- [Agent SDK reference TypeScript | Claude API Docs](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Handling stop reasons | Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons)

**Telegram Bot Architecture:**
- [Telegram Bot API Official Docs](https://core.telegram.org/bots/api)
- [Marvin's Guide to Telegram Webhooks](https://core.telegram.org/bots/webhooks)
- [grammY — TypeScript Bot Framework](https://grammy.dev/)
- [Create Telegram Bot in Next.js App Router | LaunchFast](https://www.launchfa.st/blog/telegram-nextjs-app-router/)
- [Secret Token Webhook Verification](https://nguyenthanhluan.com/en/glossary/secret_token-for-setwebhook-en/)

**Vercel Serverless + After():**
- [Vercel Functions Timeout Guide](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out)
- [Upstash: Get Rid of Function Timeouts](https://upstash.com/blog/vercel-cost-workflow)

**Multi-Agent Patterns:**
- [Agent2Agent Protocol | IBM](https://www.ibm.com/think/topics/agent2agent-protocol)
- [Multi-agent Orchestration Patterns | Microsoft Learn](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)
- [Orchestrator and Subagent Patterns | Microsoft Copilot Studio](https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/architecture/multi-agent-orchestrator-sub-agent)

**Agent Memory & Context Management:**
- [Context Window Management Strategies | Maxim AI](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/)
- [Building Stateful Conversations with Postgres and LLMs | Medium](https://medium.com/@levi_stringer/building-stateful-conversations-with-postgres-and-llms-e6bb2a5ff73e)
- [How Letta builds production-ready AI agents with Aurora PostgreSQL | AWS](https://aws.amazon.com/blogs/database/how-letta-builds-production-ready-ai-agents-with-amazon-aurora-postgresql/)

**pgvector / Semantic Memory:**
- [pgvector: Embeddings and vector similarity | Supabase Docs](https://supabase.com/docs/guides/database/extensions/pgvector)
- [RAG with Permissions | Supabase Docs](https://supabase.com/docs/guides/ai/rag-with-permissions)

---

*Architecture research for: B2B Dealer Management SaaS — Multi-Tenant + AI Agent Ecosystem*
*Researched: 2026-03-01*
*Confidence: HIGH for multi-tenant patterns (verified official Supabase docs), MEDIUM for agent ecosystem (official Claude API docs verified, implementation architecture is design judgment)*
