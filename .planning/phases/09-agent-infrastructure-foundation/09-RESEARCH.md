# Phase 9: Agent Infrastructure Foundation - Research

**Researched:** 2026-03-01
**Domain:** Telegram webhook + Claude tool-use agentic loop + Supabase agent tables + cost controls + deadlock prevention
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AI-01 | AgentRunner class with Claude API tool-calling loop (max 10 iterations, per-role model selection) | @anthropic-ai/sdk tool_use loop pattern; stop_reason === 'tool_use' iteration; max_iterations guard |
| AI-02 | ToolRegistry loads 4-7 tools per agent role (not all tools) | Discriminated union per role ID; registry Map<RoleId, Tool[]>; tools array in messages.create() |
| AI-03 | ConversationManager DB-backed message history (rolling 50 + auto-summarization) | agent_conversations + agent_messages tables; Haiku 4.5 summarization call when window > 50 |
| AI-04 | Telegram webhook route returns immediate HTTP 200 + after() background processing | Next.js after() from 'next/server'; grammY webhookCallback std/http adapter; Fluid Compute 300s default |
| AI-05 | update_id idempotency prevents duplicate message processing | UNIQUE constraint on processed_telegram_updates(update_id); INSERT + catch 23505 pattern |
| AI-06 | AgentBridge makes cross-agent tool calls (direct DB query, not Claude invocation) | Supabase service role client; direct SQL query to relevant tables; typed return value |
| AI-07 | Per-dealer daily token budget tracking (50K soft / 100K hard limit) | daily_token_usage table; SUM(tokens_used) WHERE date = today; atomic UPSERT pattern |
| AI-08 | Agent-to-agent deadlock protection (depth limit 5, cycle detection, 10 tool call cap) | call_stack: string[] parameter; cycle check via includes(); depth counter in agent_calls table |
| AI-09 | agent_definitions, agent_conversations, agent_messages, agent_calls tables created | SQL schema with company_id, RLS, indexes |
| AI-10 | Prompt caching (cache_control on system prompt + tool definitions) | Anthropic cache_control: { type: 'ephemeral' } on tools array last element + system content block |
| AI-11 | Service role client (createServiceClient) for agent layer only | createClient(URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } }) pattern |
</phase_requirements>

---

## Summary

Phase 9 builds the shared execution infrastructure that all 12 future agent roles will use. The core contract is: a Telegram message arrives at a webhook, the route returns HTTP 200 within milliseconds, and a background job runs a Claude tool-use loop that produces a reply — all within 60 seconds and with no duplicate processing if Telegram retries.

The five technical pillars are: (1) **AgentRunner** — a class that drives the Claude tool-use loop with a max-iterations guard and per-role model selection; (2) **ConversationManager** — Supabase-backed message history with a rolling 50-message window and Haiku-powered auto-summarization; (3) **webhook + after()** — grammY `webhookCallback` returning HTTP 200 with all agent logic deferred to Next.js `after()` (Vercel Fluid Compute's `waitUntil`); (4) **cost controls** — per-dealer daily token budget tracked in PostgreSQL with a hard-stop at 100K tokens; (5) **AgentBridge deadlock guard** — call stack tracking that detects cycles and enforces depth ≤ 5 before any cross-agent call.

No new orchestration framework is needed. The architecture is intentionally thin: raw `@anthropic-ai/sdk`, standard Next.js Route Handlers, and Supabase as both the database and the async message bus.

**Primary recommendation:** Build AgentRunner, ToolRegistry, ConversationManager, AgentBridge, and the token budget checker as independent TypeScript classes in `src/lib/agents/`. The webhook route at `src/app/api/telegram/route.ts` is a thin adapter (grammY parse + idempotency check + after() dispatch). All agent logic runs server-side with the service role client; the anon client never touches agent tables.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | ^0.78.0 | Claude API tool-use loop | Raw SDK per prior decision; not Vercel AI SDK |
| `grammy` | ^1.41.0 | Telegram Bot framework | TypeScript-first; explicit Vercel/serverless webhook support; `std/http` adapter for Next.js App Router |
| `next` | 16.1.4 | `after()` for background processing | Already in use; `after` stable since Next.js 15.1.0 |
| `@supabase/supabase-js` | ^2.91.1 | Agent table reads/writes | Already in use; service role client for agent layer |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/ssr` | ^0.8.0 | Server-side Supabase client | Webhook route auth check only (not agent execution) |

### Alternatives Considered (and rejected per prior decisions)
| Instead of | Could Use | Why Rejected |
|------------|-----------|-------------|
| `@anthropic-ai/sdk` raw | Vercel AI SDK | Prior decision: raw SDK gives full tool_use loop control |
| `grammy` | Telegraf, node-telegram-bot-api | Prior decision: grammY is TypeScript-first with Vercel webhook adapter |
| Supabase | Redis queue | Prior decision: no Redis; Supabase handles state |
| LangChain/LangGraph | Custom agent loop | Prior decision: rejected; adds unnecessary abstraction |

**Installation:**
```bash
npm install @anthropic-ai/sdk grammy
# after() and @supabase/supabase-js already installed
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── api/
│       └── telegram/
│           └── route.ts           # Webhook handler — thin adapter only
├── lib/
│   └── agents/
│       ├── agent-runner.ts        # AgentRunner class — tool-use loop
│       ├── tool-registry.ts       # ToolRegistry — maps role to tool array
│       ├── conversation-manager.ts # ConversationManager — DB-backed history
│       ├── agent-bridge.ts        # AgentBridge — cross-agent DB queries
│       ├── token-budget.ts        # TokenBudget — daily limit enforcement
│       ├── tools/
│       │   ├── order-tools.ts     # Tools for order-related agents
│       │   ├── product-tools.ts   # Tools for product-related agents
│       │   └── index.ts           # Re-exports all tool definitions
│       └── types.ts               # Shared agent types (AgentRole, AgentContext)
├── lib/
│   └── supabase/
│       └── service-client.ts      # createServiceClient — agent layer only

supabase/
└── migrations/
    └── 010_agent_tables.sql       # agent_definitions, agent_conversations, etc.
```

---

### Pattern 1: AgentRunner — Tool-Use Loop

**What:** A class that drives the Claude `messages.create()` → tool execution → `tool_result` feedback loop until `stop_reason === 'end_turn'` or the iteration cap is hit.

**When to use:** Every agent invocation goes through AgentRunner. Never call `anthropic.messages.create()` directly from a route handler.

```typescript
// Source: @anthropic-ai/sdk GitHub README + Anthropic tool use docs
// src/lib/agents/agent-runner.ts

import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam, Tool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages'

const MAX_ITERATIONS = 10  // AI-01 requirement

export class AgentRunner {
  private client: Anthropic
  private model: string
  private tools: Tool[]

  constructor(model: string, tools: Tool[]) {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    this.model = model
    this.tools = tools
  }

  async run(
    systemPrompt: string,
    messages: MessageParam[],
    toolHandlers: Map<string, (input: unknown) => Promise<string>>,
    context: AgentContext
  ): Promise<string> {
    const workingMessages = [...messages]
    let iterations = 0

    while (iterations < MAX_ITERATIONS) {
      iterations++

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' },  // AI-10: cache system prompt
          },
        ],
        tools: this.tools.map((tool, idx) =>
          // AI-10: cache_control on last tool definition
          idx === this.tools.length - 1
            ? { ...tool, cache_control: { type: 'ephemeral' } }
            : tool
        ),
        messages: workingMessages,
        cache_control: { type: 'ephemeral' },  // AI-10: auto-cache conversation history
      })

      // Log token usage for budget tracking (AI-07)
      await context.tokenBudget.recordUsage({
        dealerId: context.dealerId,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
      })

      if (response.stop_reason === 'end_turn') {
        // Extract final text response
        const textBlock = response.content.find(b => b.type === 'text')
        return textBlock ? (textBlock as { type: 'text'; text: string }).text : ''
      }

      if (response.stop_reason === 'tool_use') {
        // Add assistant turn
        workingMessages.push({ role: 'assistant', content: response.content })

        // Execute all tool calls in this turn
        const toolResults: Anthropic.ToolResultBlockParam[] = []

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            const toolBlock = block as ToolUseBlock
            const handler = toolHandlers.get(toolBlock.name)
            let result: string

            if (handler) {
              try {
                result = await handler(toolBlock.input)
              } catch (err) {
                result = `Error: ${err instanceof Error ? err.message : String(err)}`
              }
            } else {
              result = `Unknown tool: ${toolBlock.name}`
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolBlock.id,
              content: result,
            })
          }
        }

        // Add tool results as user turn
        workingMessages.push({ role: 'user', content: toolResults })
        continue
      }

      // max_tokens or unexpected stop reason
      break
    }

    return '[Agent: max iterations reached]'
  }
}
```

---

### Pattern 2: ToolRegistry — Per-Role Tool Loading

**What:** A registry that maps each agent role identifier to its specific 4-7 tool definitions. Tools are defined once and referenced by multiple roles.

**When to use:** Called by AgentRunner at construction time. Never load all tools — only role-specific ones.

```typescript
// Source: Architecture decision + @anthropic-ai/sdk Tool type
// src/lib/agents/tool-registry.ts

import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { orderTools } from './tools/order-tools'
import { productTools } from './tools/product-tools'

// Agent roles (matches agent_definitions.role column)
export type AgentRole =
  | 'order_specialist'
  | 'product_advisor'
  | 'support_agent'
  | 'financial_advisor'
  | 'trainer'
  | 'accountant'
  | 'marketing'
  | 'executive'

// Model per role (prior decision: Haiku 4.5 for 8 roles, Sonnet 4.6 for 4)
export const AGENT_MODELS: Record<AgentRole, string> = {
  order_specialist:  'claude-haiku-4-5',   // claude-haiku-4-5-20251001 alias
  product_advisor:   'claude-haiku-4-5',
  support_agent:     'claude-haiku-4-5',
  financial_advisor: 'claude-haiku-4-5',
  trainer:           'claude-sonnet-4-6',  // Sonnet for complex reasoning
  accountant:        'claude-sonnet-4-6',
  marketing:         'claude-sonnet-4-6',
  executive:         'claude-sonnet-4-6',
}

// Tool registry: each role gets only its relevant tools
export const TOOL_REGISTRY: Record<AgentRole, Tool[]> = {
  order_specialist:  [orderTools.getOrder, orderTools.listOrders, orderTools.updateOrderStatus, productTools.getProduct],
  product_advisor:   [productTools.getProduct, productTools.listProducts, productTools.searchProducts],
  support_agent:     [orderTools.getOrder, productTools.getProduct],
  financial_advisor: [orderTools.getDealerBalance, orderTools.listTransactions],
  trainer:           [productTools.getProduct, productTools.listProducts, productTools.getCategory],
  accountant:        [orderTools.getDealerBalance, orderTools.listTransactions, orderTools.generateInvoice],
  marketing:         [productTools.listProducts, productTools.getCampaign],
  executive:         [orderTools.getOrder, orderTools.getDealerBalance, productTools.listProducts],
}

export class ToolRegistry {
  getTools(role: AgentRole): Tool[] {
    return TOOL_REGISTRY[role] ?? []
  }

  getModel(role: AgentRole): string {
    return AGENT_MODELS[role] ?? 'claude-haiku-4-5'
  }
}
```

---

### Pattern 3: Telegram Webhook — Immediate 200 + after() Background

**What:** The webhook route parses the update, checks idempotency, returns HTTP 200, and defers all agent work to `after()`.

**When to use:** This is the only pattern for the Telegram webhook. Never await agent logic before returning the response.

```typescript
// Source: Next.js after() docs (stable v15.1+) + grammY std/http adapter docs
// src/app/api/telegram/route.ts

import { after } from 'next/server'
import { Bot } from 'grammy'
import type { Update } from 'grammy/types'
import { createServiceClient } from '@/lib/supabase/service-client'
import { dispatchAgentUpdate } from '@/lib/agents/dispatcher'

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!, { botInfo: undefined as any })

export async function POST(request: Request): Promise<Response> {
  // 1. Parse the Telegram update
  let update: Update
  try {
    update = await request.json() as Update
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  // 2. Idempotency check — BEFORE returning 200 (AI-05)
  const supabase = createServiceClient()
  const { error: dupError } = await supabase
    .from('processed_telegram_updates')
    .insert({ update_id: update.update_id })

  if (dupError) {
    // PostgreSQL error 23505 = unique_violation (already processed)
    if (dupError.code === '23505') {
      return new Response('OK', { status: 200 })  // Silent dedup
    }
    // Other error — still return 200 to prevent Telegram retry storm
    console.error('idempotency insert error', dupError)
    return new Response('OK', { status: 200 })
  }

  // 3. Schedule background processing — after() runs after response is sent (AI-04)
  after(async () => {
    try {
      await dispatchAgentUpdate(update)
    } catch (err) {
      console.error('agent dispatch error', err)
    }
  })

  // 4. Return 200 immediately — Telegram gets this before agent runs
  return new Response('OK', { status: 200 })
}

// Required for grammY + Next.js App Router
export const dynamic = 'force-dynamic'
```

**Key constraints:**
- `after()` is imported from `'next/server'` (stable since Next.js 15.1.0)
- On Vercel with Fluid Compute enabled, `after()` internally uses `waitUntil` — the function stays alive for up to 300s (default) or 800s (Pro plan max) after the response is sent
- Idempotency check must happen BEFORE `return new Response()` to ensure the DB write is committed
- Never call `bot.start()` in webhook mode — grammY's `webhookCallback` (or manual JSON parsing) handles update dispatch

---

### Pattern 4: ConversationManager — Rolling 50-Message Window

**What:** Loads conversation history from `agent_messages`, enforces a 50-message rolling window, and triggers Haiku-based summarization when the window is exceeded.

**When to use:** Called at the start of every AgentRunner.run() call to build the `messages` array.

```typescript
// Source: Anthropic multi-turn conversation docs + project architecture decision
// src/lib/agents/conversation-manager.ts

import { createServiceClient } from '@/lib/supabase/service-client'
import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'

const ROLLING_WINDOW = 50
const SUMMARIZE_THRESHOLD = 50  // Summarize when history hits this count

export class ConversationManager {
  private supabase = createServiceClient()

  async getMessages(conversationId: string): Promise<MessageParam[]> {
    const { data: messages } = await this.supabase
      .from('agent_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(ROLLING_WINDOW)

    return (messages ?? []).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content as string,
    }))
  }

  async saveMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<void> {
    await this.supabase
      .from('agent_messages')
      .insert({ conversation_id: conversationId, role, content })

    // Check if we need to summarize (AI-03)
    const { count } = await this.supabase
      .from('agent_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)

    if ((count ?? 0) > SUMMARIZE_THRESHOLD) {
      await this.summarizeAndTruncate(conversationId)
    }
  }

  private async summarizeAndTruncate(conversationId: string): Promise<void> {
    // Get all messages for summarization
    const { data: allMessages } = await this.supabase
      .from('agent_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (!allMessages || allMessages.length <= ROLLING_WINDOW) return

    // Messages to summarize: all except the last 25 (keep recent context)
    const toSummarize = allMessages.slice(0, -25)
    const toKeep = allMessages.slice(-25)

    // Haiku summarization call (cheap + fast)
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const summaryResponse = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: 'Summarize the following conversation history concisely in 3-5 sentences. Focus on key decisions, requests, and outcomes.',
      messages: [{
        role: 'user',
        content: toSummarize.map(m => `${m.role}: ${m.content}`).join('\n'),
      }],
    })

    const summary = summaryResponse.content[0].type === 'text'
      ? summaryResponse.content[0].text
      : 'Previous conversation summarized.'

    // Delete summarized messages and insert summary as system message
    const idsToDelete = toSummarize.map(m => m.id)
    await this.supabase
      .from('agent_messages')
      .delete()
      .in('id', idsToDelete)

    await this.supabase
      .from('agent_messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: `[Context summary: ${summary}]`,
        created_at: toSummarize[0].created_at,  // Keep chronological order
      })
  }
}
```

---

### Pattern 5: Token Budget — Daily Limit Enforcement

**What:** Checks the dealer's daily token consumption before each AgentRunner call. Rejects at 100K hard limit; logs a warning at 50K soft limit.

**When to use:** Called in `dispatchAgentUpdate()` before constructing AgentRunner. If hard limit is exceeded, send refusal message and return.

```typescript
// Source: Project architecture decision + Supabase upsert pattern
// src/lib/agents/token-budget.ts

import { createServiceClient } from '@/lib/supabase/service-client'

const SOFT_LIMIT = 50_000
const HARD_LIMIT = 100_000

export class TokenBudget {
  private supabase = createServiceClient()

  async checkBudget(dealerId: string): Promise<{ allowed: boolean; reason?: string }> {
    const today = new Date().toISOString().slice(0, 10)  // 'YYYY-MM-DD'

    const { data } = await this.supabase
      .from('daily_token_usage')
      .select('tokens_used')
      .eq('dealer_id', dealerId)
      .eq('date', today)
      .single()

    const used = data?.tokens_used ?? 0

    if (used >= HARD_LIMIT) {
      return {
        allowed: false,
        reason: `Gunluk token limitinize ulastiniz (${HARD_LIMIT.toLocaleString()} token). Yarin tekrar deneyin.`,
      }
    }

    if (used >= SOFT_LIMIT) {
      // Allowed but log warning (could trigger notification in future)
      console.warn(`Dealer ${dealerId} at soft limit: ${used} tokens used today`)
    }

    return { allowed: true }
  }

  async recordUsage(params: {
    dealerId: string
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
  }): Promise<void> {
    const today = new Date().toISOString().slice(0, 10)
    // Total billable tokens: cache_read is 0.1x but still count for budget purposes
    const totalTokens = params.inputTokens + params.outputTokens +
                        params.cacheReadTokens + params.cacheWriteTokens

    // Atomic UPSERT: insert or increment existing row
    await this.supabase.rpc('increment_daily_token_usage', {
      p_dealer_id: params.dealerId,
      p_date: today,
      p_tokens: totalTokens,
    })
  }
}
```

**Required SQL function (in migration):**
```sql
-- Atomic increment to avoid race conditions on concurrent requests
CREATE OR REPLACE FUNCTION increment_daily_token_usage(
  p_dealer_id UUID,
  p_date DATE,
  p_tokens INTEGER
) RETURNS VOID AS $$
  INSERT INTO daily_token_usage (dealer_id, date, tokens_used)
  VALUES (p_dealer_id, p_date, p_tokens)
  ON CONFLICT (dealer_id, date)
  DO UPDATE SET
    tokens_used = daily_token_usage.tokens_used + EXCLUDED.tokens_used,
    updated_at = NOW()
$$ LANGUAGE sql;
```

---

### Pattern 6: AgentBridge — Cross-Agent Calls with Deadlock Guard

**What:** Handles agent-to-agent calls (A asks B for data) using direct DB queries. For calls that require Claude reasoning (not just data retrieval), wraps AgentRunner with call stack tracking.

**When to use:** When one agent needs data from another agent's domain. Never invoke another agent's full Claude loop for simple data lookups — use direct DB queries instead.

```typescript
// Source: Project architecture decision + deadlock prevention pattern
// src/lib/agents/agent-bridge.ts

import { createServiceClient } from '@/lib/supabase/service-client'

const MAX_DEPTH = 5
const MAX_TOOL_CALLS = 10  // Shared with AgentRunner

export interface AgentCallContext {
  callStack: string[]    // Tracks the chain: ['order_specialist', 'financial_advisor', ...]
  depth: number          // Current recursion depth
  parentCallId?: string  // References agent_calls table for logging
}

export class AgentBridge {
  private supabase = createServiceClient()

  // Check for deadlock before making a cross-agent call (AI-08)
  checkDeadlock(
    targetRole: string,
    context: AgentCallContext
  ): { allowed: boolean; reason?: string } {
    // Cycle detection: is targetRole already in the call stack?
    if (context.callStack.includes(targetRole)) {
      return {
        allowed: false,
        reason: `Cycle detected: ${context.callStack.join(' -> ')} -> ${targetRole}`,
      }
    }

    // Depth limit
    if (context.depth >= MAX_DEPTH) {
      return {
        allowed: false,
        reason: `Max agent depth (${MAX_DEPTH}) reached. Call stack: ${context.callStack.join(' -> ')}`,
      }
    }

    return { allowed: true }
  }

  // Log the cross-agent call to agent_calls table (AI-09)
  async logAgentCall(params: {
    callerRole: string
    calleeRole: string
    depth: number
    companyId: string
    conversationId: string
    success: boolean
    errorMessage?: string
  }): Promise<string> {
    const { data } = await this.supabase
      .from('agent_calls')
      .insert({
        caller_role: params.callerRole,
        callee_role: params.calleeRole,
        depth: params.depth,
        company_id: params.companyId,
        conversation_id: params.conversationId,
        success: params.success,
        error_message: params.errorMessage ?? null,
      })
      .select('id')
      .single()

    return data?.id ?? ''
  }

  // Example: Get dealer financial data directly from DB (no Claude invocation)
  async getDealerBalance(dealerId: string): Promise<{ balance: number; creditLimit: number }> {
    const { data } = await this.supabase
      .from('dealers')
      .select('current_balance, credit_limit')
      .eq('id', dealerId)
      .single()

    return {
      balance: data?.current_balance ?? 0,
      creditLimit: data?.credit_limit ?? 0,
    }
  }
}
```

---

### Pattern 7: Service Role Client — Agent Layer Only

**What:** A Supabase client initialized with `SUPABASE_SERVICE_ROLE_KEY` that bypasses RLS. Used exclusively by the agent layer; never used in user-facing routes.

**When to use:** All agent code (AgentRunner tool handlers, ConversationManager, TokenBudget, AgentBridge). Requires `companyId` parameter passed explicitly on every tool handler to enforce isolation at the application level instead of RLS.

```typescript
// Source: Supabase service role docs + project security requirement (AI-11)
// src/lib/supabase/service-client.ts

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

let serviceClient: ReturnType<typeof createClient<Database>> | null = null

export function createServiceClient() {
  if (serviceClient) return serviceClient

  serviceClient = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,     // No session needed — service role uses static key
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )

  return serviceClient
}
```

**Security contract:** Every tool handler that uses `createServiceClient()` MUST accept `companyId: string` as a parameter and filter all queries by it. The service role bypasses RLS — company isolation becomes the tool handler's responsibility.

```typescript
// Example tool handler enforcing company isolation manually
async function getOrderTool(input: { orderId: string }, companyId: string): Promise<string> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('id', input.orderId)
    .eq('company_id', companyId)  // MANDATORY: application-level isolation
    .single()

  return data ? JSON.stringify(data) : 'Order not found'
}
```

---

### Pattern 8: Agent Tables SQL Schema

**What:** The four required tables for agent infrastructure (AI-09).

```sql
-- Source: Phase 9 architecture design + existing migration conventions
-- Migration: 010_agent_tables.sql

-- ============================================
-- agent_definitions: Role catalog (seeded once, read-only in operation)
-- ============================================
CREATE TABLE agent_definitions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  model       TEXT NOT NULL DEFAULT 'claude-haiku-4-5',
  system_prompt TEXT NOT NULL DEFAULT '',
  is_active   BOOLEAN DEFAULT true,
  settings    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, role)
);

ALTER TABLE agent_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company admins manage agent definitions"
  ON agent_definitions FOR ALL TO authenticated
  USING (company_id = current_company_id() AND (SELECT is_company_admin()));

CREATE POLICY "Service role bypasses RLS on agent_definitions"
  ON agent_definitions FOR ALL TO service_role USING (true);

-- ============================================
-- agent_conversations: One per dealer-bot conversation thread
-- ============================================
CREATE TABLE agent_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  dealer_id   UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  agent_role  TEXT NOT NULL,
  telegram_chat_id BIGINT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'error')),
  summary     TEXT,               -- Populated by auto-summarization
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access agent_conversations"
  ON agent_conversations FOR ALL TO service_role USING (true);

CREATE INDEX idx_agent_conversations_dealer ON agent_conversations(company_id, dealer_id);
CREATE INDEX idx_agent_conversations_chat ON agent_conversations(telegram_chat_id);

-- ============================================
-- agent_messages: Individual messages in a conversation
-- ============================================
CREATE TABLE agent_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}',  -- token counts, tool_use IDs, etc.
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access agent_messages"
  ON agent_messages FOR ALL TO service_role USING (true);

CREATE INDEX idx_agent_messages_conversation ON agent_messages(conversation_id, created_at);

-- ============================================
-- agent_calls: Cross-agent call log for deadlock detection audit
-- ============================================
CREATE TABLE agent_calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  caller_role     TEXT NOT NULL,
  callee_role     TEXT NOT NULL,
  depth           INTEGER NOT NULL DEFAULT 0,
  success         BOOLEAN NOT NULL DEFAULT true,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access agent_calls"
  ON agent_calls FOR ALL TO service_role USING (true);

CREATE INDEX idx_agent_calls_company ON agent_calls(company_id, created_at DESC);

-- ============================================
-- processed_telegram_updates: Idempotency log (AI-05)
-- ============================================
CREATE TABLE processed_telegram_updates (
  update_id   BIGINT PRIMARY KEY,  -- Telegram's update_id is globally unique
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-cleanup old entries after 7 days (prevent unbounded growth)
-- Run as a scheduled job or Supabase cron extension

-- ============================================
-- daily_token_usage: Per-dealer daily budget tracking (AI-07)
-- ============================================
CREATE TABLE daily_token_usage (
  dealer_id   UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (dealer_id, date)
);

ALTER TABLE daily_token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access daily_token_usage"
  ON daily_token_usage FOR ALL TO service_role USING (true);

CREATE INDEX idx_daily_token_usage_dealer ON daily_token_usage(dealer_id, date DESC);
```

---

### Pattern 9: Prompt Caching Configuration

**What:** Applies `cache_control: { type: 'ephemeral' }` to system prompts and tool definitions to reduce token costs on repeated calls.

**When to use:** Every `messages.create()` call in AgentRunner. Cache invalidates when tools or system prompt changes.

```typescript
// Source: Anthropic prompt caching official docs (verified 2026-03-01)
// Minimum cacheable tokens: 2048 for Sonnet 4.6, 4096 for Haiku 4.5

// Method 1: Automatic caching (simplest — recommended for conversation history)
const response = await client.messages.create({
  model: 'claude-haiku-4-5',
  max_tokens: 2048,
  cache_control: { type: 'ephemeral' },    // Top-level: auto-caches last block
  system: systemPrompt,
  messages: conversationHistory,
})

// Method 2: Explicit breakpoints on system + tools (for fine-grained control)
const response = await client.messages.create({
  model: 'claude-haiku-4-5',
  max_tokens: 2048,
  system: [
    {
      type: 'text',
      text: systemPrompt,
      cache_control: { type: 'ephemeral' },  // Cache system prompt (static)
    }
  ],
  tools: [
    ...toolsExceptLast,
    {
      ...lastTool,
      cache_control: { type: 'ephemeral' },  // Cache tools array (static)
    }
  ],
  messages: conversationHistory,
  cache_control: { type: 'ephemeral' },      // Auto-cache conversation history (dynamic)
})
```

**Pricing impact (verified from Anthropic docs, as of 2026-03-01):**
- Haiku 4.5: $1/MTok input → $0.10/MTok cache read (10x cost reduction on hits)
- Sonnet 4.6: $3/MTok input → $0.30/MTok cache read (10x cost reduction on hits)
- Cache write: 1.25x base price (5-min TTL); refreshed for free on each hit within window
- Minimum tokens to be eligible: 4096 for Haiku 4.5, 2048 for Sonnet 4.6

**Important:** System prompt + tools must be identical across requests for cache hits. Any tool definition change invalidates the entire cache. Keep tool names, descriptions, and input_schema stable.

---

### Anti-Patterns to Avoid

- **Running agent logic before returning HTTP 200:** Telegram will time out (60s) and retry, causing duplicate processing. Always use `after()`.
- **Loading all tools for every agent:** Increases token count, degrades performance, and risks tool name collisions. Load only role-specific tools via ToolRegistry.
- **Using the anon/SSR Supabase client in agent handlers:** The service role client is required for agent tables because they are not user-session-scoped.
- **Infinite after() nesting:** Do not call `after()` from within `after()` callbacks. Nest synchronously if needed.
- **Swallowing errors in after() callbacks:** Always wrap with try/catch and log; unhandled rejections in `after()` are silently dropped.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tool-use loop | Custom state machine for Claude turns | `@anthropic-ai/sdk` tool_use loop (stop_reason check) | SDK handles message format; hand-rolled breaks on edge cases |
| Telegram bot webhook | Raw JSON parsing + manual update routing | `grammy` Bot + `webhookCallback` | grammY handles Telegram API version changes, update routing, error recovery |
| Background processing | Promises without keepalive | `after()` from 'next/server' (uses Vercel `waitUntil`) | Without waitUntil the serverless function exits before async work completes |
| Conversation history | In-memory array | Supabase `agent_messages` table | Serverless functions have no shared memory between invocations |
| Token counting | Character estimation | Use `response.usage.input_tokens` from SDK response | Anthropic counts tokens server-side; client estimation diverges significantly |
| Idempotency tracking | Checking Telegram timestamp | `UNIQUE constraint on processed_telegram_updates(update_id)` | update_id is guaranteed unique by Telegram; timestamp comparison has race conditions |
| Atomic token increment | Read-modify-write in TypeScript | PostgreSQL `INSERT ... ON CONFLICT DO UPDATE SET tokens_used = tokens_used + $1` | TypeScript read-modify-write has race conditions under concurrent requests |
| Deadlock detection | Global lock registry | Call stack array passed through context | No shared memory between serverless invocations; must be local to the call chain |

**Key insight:** The stateless nature of serverless functions means ALL shared state must live in the database (Supabase). The agent infrastructure is therefore a thin TypeScript layer over Supabase + Anthropic API — not a framework.

---

## Common Pitfalls

### Pitfall 1: Telegram Retry Storm from Slow Webhook Response
**What goes wrong:** Agent logic runs synchronously in the webhook handler. Claude API call takes 5-30 seconds. Telegram's 60-second timeout is breached. Telegram retries the same update every 60 seconds indefinitely. Each retry triggers another agent invocation.

**Why it happens:** Developers treat webhook handlers like normal server actions.

**How to avoid:** Always use the pattern: parse update → idempotency check → `return new Response('OK', { status: 200 })` → `after(() => runAgent())`. The idempotency check (UNIQUE constraint on `processed_telegram_updates`) ensures retries are silently discarded.

**Warning signs:** Multiple identical agent responses appearing in Telegram chat; database logs showing the same `update_id` processed more than once.

---

### Pitfall 2: after() Callback Exits Early on Vercel Without Fluid Compute
**What goes wrong:** `after()` callback starts running but the Vercel function instance is recycled before the Claude API call completes. The response was already sent, so `after()` silently dies.

**Why it happens:** Without Fluid Compute enabled, serverless function instances exit immediately after the response is sent. `after()` needs `waitUntil` to keep the instance alive.

**How to avoid:** Enable Fluid Compute for the project (Vercel Dashboard → Project Settings → Functions → Fluid Compute toggle). As of April 23, 2025, all new Vercel projects have Fluid Compute enabled by default. Verify with: check project settings or add `"fluid": true` to `vercel.json`.

**Warning signs:** `after()` callback logs never appear; agent responses never arrive in Telegram despite HTTP 200 being sent.

---

### Pitfall 3: AgentRunner Infinite Loop Without Iteration Cap
**What goes wrong:** A badly-formed tool always returns a value that causes Claude to call another tool, which returns another value, forever. Claude's API is billed per call. A runaway agent with no cap can exhaust the daily budget in one conversation.

**Why it happens:** Missing `while (iterations < MAX_ITERATIONS)` guard in the tool-use loop.

**How to avoid:** Set `MAX_ITERATIONS = 10` (AI-01 requirement). Return a fallback message when cap is reached. Log iteration count per conversation to detect agents consistently hitting the cap (indicator of prompt or tool design problem).

**Warning signs:** Agent conversations that never complete; API bills spiking on a single conversation.

---

### Pitfall 4: Prompt Cache Miss Due to Tool Definition Instability
**What goes wrong:** Each request generates a slightly different tools array (different key ordering, dynamic description text, etc.). Cache is never hit. You pay full input token price on every request despite `cache_control` being set.

**Why it happens:** JavaScript object key ordering is not guaranteed; tool descriptions include dynamic content; `cache_control` is placed inconsistently.

**How to avoid:** Define tool objects as `const` literals at module level, never inline. Ensure `cache_control` is always placed on the same (last) tool. Verify cache hits by checking `response.usage.cache_read_input_tokens > 0` in logs.

**Warning signs:** `cache_read_input_tokens` in API responses is always 0; costs not decreasing despite repeated conversations.

---

### Pitfall 5: Service Role Client Exposed to User-Facing Routes
**What goes wrong:** A developer imports `createServiceClient()` in a route that handles user requests. The service role bypasses RLS. User A can query User B's data by crafting the right request payload.

**Why it happens:** Convenience — the service client is simpler (no cookie handling).

**How to avoid:** `createServiceClient()` is only imported in `src/lib/agents/`. Linting rule: flag any import of `service-client` outside `src/lib/agents/`. Every tool handler using the service client MUST accept `companyId: string` as a required parameter.

**Warning signs:** Service client import appearing in `src/app/` directory files.

---

### Pitfall 6: ConversationManager Builds Wrong message Array Format
**What goes wrong:** Claude API requires alternating `user`/`assistant` roles. If DB has two consecutive `user` messages (e.g., tool results merged wrong), the API returns a 400 error.

**Why it happens:** The rolling window truncation cuts the array at a non-alternating boundary; or the summarization inserts a `user` message that immediately precedes another `user` message.

**How to avoid:** After loading from DB, validate that messages alternate user/assistant. If not, merge or drop the violating message. The summarization inserts a special `[Context summary: ...]` prefix to the first remaining user message rather than adding a standalone user message.

**Warning signs:** `400 Bad Request` from Claude API with message about message roles.

---

### Pitfall 7: Token Budget Race Condition Under Concurrent Messages
**What goes wrong:** Dealer sends two messages in rapid succession. Both pass the budget check (50K check returns `allowed: true`). Both run to completion. Combined usage pushes to 110K — over the 100K hard limit.

**Why it happens:** Read-then-check logic is not atomic. Two requests read the same `tokens_used` value before either writes back.

**How to avoid:** Use the PostgreSQL `increment_daily_token_usage` RPC function (INSERT ... ON CONFLICT DO UPDATE) to atomically increment. The hard limit enforcement is a best-effort guard, not a guarantee — for strict enforcement, use a DB-level CHECK constraint or accept small overages as acceptable.

**Warning signs:** `daily_token_usage.tokens_used` exceeding 100K on some days despite the hard limit check.

---

## Code Examples

### Complete Webhook Route (verified pattern)
```typescript
// Source: Next.js after() docs + grammY std/http pattern (2026-03-01)
// src/app/api/telegram/route.ts

import { after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service-client'
import { dispatchAgentUpdate } from '@/lib/agents/dispatcher'
import type { Update } from 'grammy/types'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  let update: Update
  try {
    update = await request.json() as Update
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  // Idempotency: unique insert; catch 23505 for duplicates
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('processed_telegram_updates')
    .insert({ update_id: update.update_id })

  if (error?.code === '23505') {
    return new Response('OK', { status: 200 })  // Duplicate — silently ignore
  }

  // Dispatch to agent layer after response is sent
  after(async () => {
    try {
      await dispatchAgentUpdate(update)
    } catch (err) {
      console.error('[telegram webhook] agent dispatch failed:', err)
    }
  })

  return new Response('OK', { status: 200 })
}
```

### Minimal AgentRunner Call (verified tool_use loop)
```typescript
// Source: @anthropic-ai/sdk GitHub README (verified 2026-03-01)
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const messages: Anthropic.MessageParam[] = [{ role: 'user', content: 'What is my order status?' }]

let iterations = 0
const MAX = 10

while (iterations < MAX) {
  iterations++

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2048,
    tools: myTools,
    messages,
  })

  if (response.stop_reason === 'end_turn') {
    const text = response.content.find(b => b.type === 'text')
    console.log(text?.text)
    break
  }

  if (response.stop_reason === 'tool_use') {
    messages.push({ role: 'assistant', content: response.content })
    const results: Anthropic.ToolResultBlockParam[] = []

    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const result = await executeTool(block.name, block.input)
        results.push({ type: 'tool_result', tool_use_id: block.id, content: result })
      }
    }

    messages.push({ role: 'user', content: results })
  }
}
```

### Idempotency Check Pattern
```typescript
// Source: PostgreSQL unique_violation error code (23505) — standard
const { error } = await supabase
  .from('processed_telegram_updates')
  .insert({ update_id: telegramUpdateId })

if (error?.code === '23505') {
  // Already processed — this is a Telegram retry
  return  // or return 200
}
// else: proceed with processing
```

### Service Role Client (createServiceClient)
```typescript
// Source: Supabase service role docs (supabase.com/docs/guides/troubleshooting)
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
```

### Prompt Caching — Automatic Mode (simplest)
```typescript
// Source: Anthropic prompt caching docs (verified 2026-03-01)
// Works for Sonnet 4.6 (min 2048 tokens) and Haiku 4.5 (min 4096 tokens)
const response = await client.messages.create({
  model: 'claude-haiku-4-5',
  max_tokens: 2048,
  cache_control: { type: 'ephemeral' },  // Auto-caches last cacheable block
  system: SYSTEM_PROMPT,                  // Must be >= min tokens to be cached
  messages: conversationHistory,
})

// Check if cache hit occurred
const cacheHit = response.usage.cache_read_input_tokens ?? 0
console.log(`Cache hit: ${cacheHit} tokens (saves ~90% on those tokens)`)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual polling (bot.start()) | Webhook + immediate 200 + after() | Next.js 15.1 (stable after()); Vercel Fluid Compute (2025) | No long-polling threads; serverless-safe; no duplicate processing |
| LangChain/LangGraph orchestration | Raw @anthropic-ai/sdk tool-use loop | 2024-2025 (ecosystem matured) | Full control, no abstraction overhead, direct tool call errors |
| Vercel AI SDK streaming | @anthropic-ai/sdk direct | Project decision | Tool-use loop requires non-streaming control flow; streaming adds complexity |
| In-memory conversation history | DB-backed via Supabase agent_messages | Serverless architecture requirement | Stateless functions require external state; rolling window prevents unbounded growth |
| No prompt caching | cache_control: ephemeral on tools + system | Anthropic cache GA (2024) | 10x cost reduction on cache hits for static content |
| Haiku 3 / Sonnet 3.5 | Haiku 4.5 / Sonnet 4.6 | 2025 (model releases) | Haiku 4.5: $1/MTok (vs $0.25 for Haiku 3 but significantly more capable); Sonnet 4.6 is latest |

**Current model IDs (verified from Anthropic docs 2026-03-01):**
- `claude-haiku-4-5` (alias) = `claude-haiku-4-5-20251001` — for 8 of 12 agent roles
- `claude-sonnet-4-6` (alias, no snapshot suffix for latest) — for Trainer, Accountant, Marketing, Executive roles

**Deprecated for this project:**
- `claude-3-haiku-20240307`: Deprecated, will retire April 19, 2026. Use `claude-haiku-4-5`.
- LangChain, LangGraph: Rejected by prior project decision. Not used.
- Redis: Rejected by prior project decision. Supabase handles state.

---

## Vercel Fluid Compute Configuration

Fluid Compute is **enabled by default for all new Vercel projects as of April 23, 2025**.

**Duration limits (verified from Vercel docs 2026-03-01):**
| Plan | Default Duration | Max Duration |
|------|-----------------|--------------|
| Hobby | 300s | 300s |
| Pro | 300s | 800s |
| Enterprise | 300s | 800s |

The 60-second success criterion (agent reply within 60s) is well within the 300s default. No special `maxDuration` configuration needed unless Claude API is consistently slow.

**To verify Fluid Compute is active:**
```json
// vercel.json — explicitly opt in
{
  "fluid": true
}
```

**How `after()` works on Vercel:** Calls `waitUntil(promise)` internally, which registers the promise with Vercel's runtime. The function instance stays alive until the promise resolves or the max duration is reached.

---

## Environment Variables Required

```bash
# Already in project
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # Used only by createServiceClient() in agent layer

# New for Phase 9
ANTHROPIC_API_KEY=sk-ant-...    # @anthropic-ai/sdk authentication
TELEGRAM_BOT_TOKEN=...          # grammY bot authentication

# Telegram webhook setup (run once after deployment)
# curl https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://{VERCEL_URL}/api/telegram
```

---

## Open Questions

1. **What is the `telegram_chat_id` to `dealer_id` mapping strategy?**
   - What we know: When a dealer first messages the Telegram bot, we have their `chat_id` but not their `dealer_id`.
   - What's unclear: How do dealers authenticate? Do they link their Telegram account to their dealer account via a one-time code?
   - Recommendation: Phase 9 creates a `telegram_chat_id` column on the `dealers` table (nullable). The first message from an unknown chat_id should reply with a link command (e.g., `/start CODE`) where CODE is a one-time token generated from the dealer dashboard. Out of scope for Phase 9 but the schema must not assume the mapping already exists.

2. **Should `processed_telegram_updates` be cleaned up automatically?**
   - What we know: Telegram's update_id is a globally increasing integer. Without cleanup, this table grows forever.
   - What's unclear: Supabase does not have built-in cron by default (pg_cron extension is available).
   - Recommendation: Add a row TTL of 7 days via a Supabase scheduled function or pg_cron. For Phase 9, the table can grow freely — cleanup is a Phase 10+ concern.

3. **Does the 4096-token minimum for Haiku 4.5 prompt caching affect the architecture?**
   - What we know: System prompt + tool definitions must be >= 4096 tokens for Haiku 4.5 cache to activate (vs 2048 for Sonnet 4.6).
   - What's unclear: Agent system prompts may be <4096 tokens initially, making caching a no-op for Haiku agents.
   - Recommendation: Start with automatic caching anyway — it becomes effective as conversation history grows past the threshold. For Haiku agents with short system prompts, accept that early conversations won't benefit from caching.

4. **What happens when the Telegram Bot Token is leaked/rotated?**
   - Recommendation: Store `TELEGRAM_BOT_TOKEN` in Vercel environment variables (encrypted at rest). After rotation, redeploy and re-register the webhook URL. No code changes required.

---

## Sources

### Primary (HIGH confidence)
- [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) — Exact model IDs for claude-haiku-4-5 and claude-sonnet-4-6 (verified 2026-03-01)
- [Anthropic Prompt Caching Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — cache_control API, minimum token thresholds, pricing table (verified 2026-03-01)
- [@anthropic-ai/sdk GitHub](https://github.com/anthropics/anthropic-sdk-typescript) — Tool-use loop pattern, MessageParam types, ToolUseBlock, ToolResultBlockParam (verified 2026-03-01)
- [Next.js after() API Reference](https://nextjs.org/docs/app/api-reference/functions/after) — Stable in 15.1.0, waitUntil integration, Route Handler usage (verified 2026-03-01)
- [Vercel Fluid Compute Docs](https://vercel.com/docs/fluid-compute) — Default 300s duration, waitUntil, default enabled April 23 2025 (verified 2026-03-01)
- [Supabase service role troubleshooting](https://supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side-with-the-servicerole-secret-BYM4Fa) — createClient with service_role + auth config (verified 2026-03-01)

### Secondary (MEDIUM confidence)
- [grammY webhookCallback docs](https://grammy.dev/guide/deployment-types) — std/http adapter, immediate response pattern, serverless usage (fetched 2026-03-01, content consistent with v1.41)
- [grammY Next.js App Router guide](https://www.launchfa.st/blog/telegram-nextjs-app-router/) — webhookCallback(bot, 'std/http') as POST export, dynamic = 'force-dynamic' (verified pattern consistent with grammY docs)
- Phase 8 research (RESEARCH.md already in project) — Supabase RLS patterns, service role client, company_id scoping

### Tertiary (LOW confidence)
- Webhook idempotency pattern using PostgreSQL error code 23505 — industry-standard pattern, cross-verified with Hookdeck docs and PostgreSQL error code reference
- Token budget race condition analysis — derived from first-principles concurrency analysis, not from a single authoritative source

---

## Metadata

**Confidence breakdown:**
- Standard stack (SDK versions, model IDs): HIGH — verified from official Anthropic and npm sources
- after() webhook pattern: HIGH — verified from official Next.js docs
- Vercel Fluid Compute duration limits: HIGH — verified from official Vercel docs
- grammY webhookCallback pattern: MEDIUM — verified from grammY docs + community guide (consistent)
- Prompt caching minimum tokens: HIGH — verified from official Anthropic docs
- Token budget atomic UPSERT: HIGH — standard PostgreSQL INSERT ON CONFLICT pattern
- Deadlock prevention (call stack array): MEDIUM — derived from architecture requirements, no authoritative source for this exact pattern
- Telegram update_id idempotency (PG 23505): MEDIUM — standard webhook pattern, consistent across sources

**Research date:** 2026-03-01
**Valid until:** 2026-09-01 (Anthropic model aliases are stable; grammY 1.x API is stable; Next.js after() is stable since 15.1)
