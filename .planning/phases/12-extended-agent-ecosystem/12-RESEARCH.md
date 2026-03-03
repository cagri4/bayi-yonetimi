# Phase 12: Extended Agent Ecosystem - Research

**Researched:** 2026-03-03
**Domain:** Claude tool-use agent implementations for 7 new agent roles + real AgentBridge cross-agent handoff + Vercel cron-based proactive daily briefings + 6 new domain-specific DB tables
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TU-01 | Tahsilat uzmani vadesi gecen alacaklari listeler (get_overdue_payments tool) | Query `dealer_transactions` JOIN `transaction_types` WHERE `due_date < NOW()` AND balance_effect='debit' AND outstanding; scope by `company_id` via dealer JOIN |
| TU-02 | Tahsilat uzmani odeme hatirlatmasi gonderir (send_reminder tool) | INSERT into `collection_activities`; Telegram send message via bot token env var; returns success/error string |
| TU-03 | Tahsilat uzmani tahsilat aktivitesi kaydeder (log_collection_activity tool) | INSERT into `collection_activities` (company_id, dealer_id, activity_type, notes, amount_expected, due_date); `(supabase as any)` pattern |
| TU-04 | Tahsilat uzmani icin collection_activities tablosu olusturulur | New table: `collection_activities` with `company_id`, `dealer_id`, `activity_type`, `notes`, `amount_expected`, `due_date`, `completed_at`, `created_at` |
| DK-01 | Dagitim koordinatoru teslimat durumu sorgular (get_delivery_status tool) | Query `orders` JOIN `order_statuses` scoped by `company_id`; filter by status codes 'kargoya_verildi', 'dagitimda' |
| DK-02 | Dagitim koordinatoru rut bilgisi yonetir (manage_routes tool) | Query or INSERT `delivery_routes` if table exists — otherwise simplify to advisory-only tool returning orders grouped by dealer address region |
| DK-03 | Dagitim koordinatoru kargo takibi yapar (track_shipment tool) | Query `orders` + `order_tracking` (if exists) by `order_number` or `dealer_id`; return tracking info scoped by `company_id` |
| SS-01 | Saha satis sorumlusu bayi ziyaret plani olusturur (plan_visit tool) | Query `dealers` scoped by `company_id`; INSERT into `dealer_visits` (company_id, dealer_id, planned_date, notes, visit_type); `(supabase as any)` pattern |
| SS-02 | Saha satis sorumlusu ziyaret kaydeder (log_visit tool) | INSERT into `dealer_visits` with actual_date, outcome, notes; UPDATE `sales_targets` progress if relevant |
| SS-03 | Saha satis sorumlusu icin dealer_visits ve sales_targets tablolari olusturulur | `dealer_visits`: company_id, dealer_id, planned_date, actual_date, visit_type, outcome, notes. `sales_targets`: company_id, dealer_id, target_amount, achieved_amount, period_start, period_end |
| PZ-01 | Pazarlamaci kampanya analizi yapar (analyze_campaigns tool) | Query `campaigns` + `orders` scoped by `company_id`; aggregate order counts/amounts per campaign period; returns JSON summary |
| PZ-02 | Pazarlamaci bayi segmentasyonu olusturur (segment_dealers tool) | Query `dealers` + `orders` + `dealer_groups` by `company_id`; group by order_total ranges or activity recency |
| PZ-03 | Pazarlamaci kampanya onerisi sunar (suggest_campaign tool) | Advisory tool — reads current `campaigns` + segment data, returns Claude-generated suggestion string (no DB write) |
| UY-01 | Urun yoneticisi katalog analizi yapar (analyze_catalog tool) | Query `products` + `order_items` scoped by `company_id`; aggregate sales volume, revenue per product |
| UY-02 | Urun yoneticisi fiyat stratejisi onerir (suggest_pricing tool) | Advisory tool — reads `products` + `dealer_prices` + `dealer_groups`; returns Claude-generated suggestion (no DB write) |
| UY-03 | Urun yoneticisi urun talep analizi yapar (analyze_requests tool) | Query `product_requests` table (already exists from Phase 7) scoped by `company_id`; aggregate by product/category |
| SA-01 | Satin alma sorumlusu tedarikci siparisi olusturur (create_purchase_order tool) | INSERT into `purchase_orders` (company_id, supplier_id, items JSONB, status, notes); `(supabase as any)` pattern; two-turn confirmation pattern |
| SA-02 | Satin alma sorumlusu stok yenileme onerir (suggest_restock tool) | Query `products` WHERE `stock_quantity <= low_stock_threshold` scoped by `company_id`; returns restock suggestions with estimated quantities |
| SA-03 | Satin alma sorumlusu icin suppliers ve purchase_orders tablolari olusturulur | `suppliers`: company_id, name, contact_name, email, phone, notes. `purchase_orders`: company_id, supplier_id, status, items JSONB, total_amount, notes, ordered_at |
| IK-01 | Iade sorumlusu iade talebi yonetir (manage_return tool) | INSERT or UPDATE `return_requests` (company_id, dealer_id, order_id, reason, status, items JSONB); `(supabase as any)` pattern |
| IK-02 | Iade sorumlusu sikayet takibi yapar (track_complaint tool) | Query or INSERT `quality_complaints` (company_id, dealer_id, complaint_type, description, status, resolved_at) |
| IK-03 | Iade sorumlusu icin return_requests ve quality_complaints tablolari olusturulur | `return_requests`: company_id, dealer_id, order_id (nullable), reason, status, items JSONB, resolved_at. `quality_complaints`: company_id, dealer_id, complaint_type, description, status, resolved_at |
| AO-01 | Tum 12 ajanin Telegram bot'lari kayitli ve webhook'lari aktif | 7 new webhook routes created; 7 new TELEGRAM_BOT_TOKEN_* env vars; 1 SQL seed file for 7 agent definitions |
| AO-02 | Agent-to-agent handoff workflow'lari calisir (Sales -> Warehouse stok kontrolu vb.) | Real AgentBridge.callAgent() implementation: replace Phase 9 placeholder with actual AgentRunner invocation using extended callStack + depth+1 |
| AO-03 | Proaktif bildirim sistemi calisir (gunluk brifing per ajan) | Vercel Cron Job at `0 8 * * *` in `vercel.json`; `GET /api/cron/daily-briefing` route; CRON_SECRET auth header; queries each agent's relevant data and sends Telegram message per enrolled dealer |
</phase_requirements>

---

## Summary

Phase 12 completes the 12-agent ecosystem by implementing 7 remaining agent roles (Tahsilat Uzmani, Dagitim Koordinatoru, Saha Satis Sorumlusu, Pazarlamaci, Urun Yoneticisi, Satin Alma Sorumlusu, Iade Kalite Sorumlusu), activating the real AgentBridge cross-agent handoff, and adding a Vercel Cron-based proactive daily briefing system.

The tool file and dispatcher pattern is already fully proven across Phase 10 (egitimci, satis) and Phase 11 (muhasebeci, depo_sorumlusu, genel_mudur). Each new agent follows the exact same three-artifact pattern: a `*-tools.ts` file with `xxxTools: Tool[]` and `createXxxHandlers(supabase)`, an update to `TOOL_REGISTRY` pointing the role to real tools, and a new `else if (role === ...)` branch in `dispatcher.ts`. Seven new webhook routes at `/api/telegram/{role}/route.ts` replicate the exact `egitimci/route.ts` pattern. Six new domain-specific database tables are required (collection_activities, dealer_visits, sales_targets, suppliers, purchase_orders, return_requests, quality_complaints — 7 tables total but return_requests and quality_complaints count separately).

The two novel technical challenges are: (1) implementing the real `AgentBridge.callAgent()` — replacing the Phase 9 placeholder with an actual `AgentRunner` invocation using the extended `callStack` and `depth + 1`; and (2) the proactive daily briefing, which requires a `vercel.json` cron job, a new `GET /api/cron/daily-briefing` route, and per-role briefing logic that queries the DB and sends Telegram messages via `sendTelegramMessage` without requiring a user trigger.

**Primary recommendation:** Implement in four sequential waves: (1) SQL migration for 7 new domain tables, (2) 7 tool files + TOOL_REGISTRY + dispatcher updates, (3) real AgentBridge.callAgent() implementation + 7 webhook routes + SQL seed, (4) Vercel cron + daily briefing route.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | ^0.78.0 | Tool definitions + handler pattern | Same as Phases 10-11; already installed |
| `@supabase/supabase-js` | ^2.91.1 | All DB queries inside tool handlers | Same as Phases 10-11; service role client mandatory |
| `grammy` | ^1.41.0 | Telegram type definitions for webhook routes | Same as Phases 9-11; already installed |
| `next` | 16.1.4 | `after()` background processing + cron route | `after()` stable since Next.js 15.1.0; cron via GET route |

### No New Packages Required

All dependencies from Phases 9-11 are sufficient. No new npm packages needed for Phase 12.

**Installation:**
```bash
# No new packages — all dependencies already installed
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/api/
│   ├── cron/
│   │   └── daily-briefing/
│   │       └── route.ts          # NEW: Vercel cron endpoint (GET, CRON_SECRET auth)
│   └── telegram/
│       ├── tahsilat-uzmani/
│       │   └── route.ts          # NEW: webhook for tahsilat_uzmani
│       ├── dagitim-koordinatoru/
│       │   └── route.ts          # NEW: webhook for dagitim_koordinatoru
│       ├── saha-satis/
│       │   └── route.ts          # NEW: webhook for saha_satis
│       ├── pazarlamaci/
│       │   └── route.ts          # NEW: webhook for pazarlamaci
│       ├── urun-yoneticisi/
│       │   └── route.ts          # NEW: webhook for urun_yoneticisi
│       ├── satin-alma/
│       │   └── route.ts          # NEW: webhook for satin_alma
│       └── iade-kalite/
│           └── route.ts          # NEW: webhook for iade_kalite (IK role)
├── lib/agents/
│   ├── tools/
│   │   ├── tahsilat-uzmani-tools.ts     # NEW: TU-01, TU-02, TU-03
│   │   ├── dagitim-koordinatoru-tools.ts # NEW: DK-01, DK-02, DK-03
│   │   ├── saha-satis-tools.ts          # NEW: SS-01, SS-02
│   │   ├── pazarlamaci-tools.ts         # NEW: PZ-01, PZ-02, PZ-03
│   │   ├── urun-yoneticisi-tools.ts     # NEW: UY-01, UY-02, UY-03
│   │   ├── satin-alma-tools.ts          # NEW: SA-01, SA-02
│   │   └── iade-kalite-tools.ts         # NEW: IK-01, IK-02
│   ├── agent-bridge.ts           # MODIFY: real callAgent() implementation
│   ├── tool-registry.ts          # MODIFY: 7 roles mapped to real tool arrays
│   └── dispatcher.ts             # MODIFY: 7 new else-if role branches
└── supabase/migrations/
    └── 011_phase12_domain_tables.sql  # NEW: 7 domain tables
SS/
└── 12-agent-definitions-seed.sql     # NEW: 7 agent definitions with Turkish prompts
vercel.json                            # NEW: cron job configuration
```

### Pattern 1: Tool File Structure (identical to Phase 10-11)

**What:** Each agent role has a dedicated file exporting `xxxTools: Tool[]` and `createXxxHandlers(supabase)` factory.

**When to use:** Every new agent role.

**Example (tahsilat-uzmani-tools.ts):**
```typescript
// Source: Established pattern from muhasebeci-tools.ts and depo-sorumlusu-tools.ts
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { AgentContext } from '../types'

type HandlerFn = (input: Record<string, unknown>, context: AgentContext) => Promise<string>

export const getOverduePaymentsTool: Tool = {
  name: 'get_overdue_payments',
  description: 'Vadesi gecmis alacaklari listeler. ONEMLI: Rakam soylemeden once bu araci cagir.',
  input_schema: {
    type: 'object' as const,
    properties: {
      limit: { type: 'number', description: 'Maksimum kayit sayisi (varsayilan: 10)' },
    },
    required: [],
  },
}

export const tahsilatUzmaniTools: Tool[] = [
  getOverduePaymentsTool,
  sendReminderTool,
  logCollectionActivityTool,
]

export function createTahsilatUzmaniHandlers(
  supabase: SupabaseClient<Database>,
): Map<string, HandlerFn> {
  const handlers = new Map<string, HandlerFn>()
  handlers.set('get_overdue_payments', async (input, context) => {
    // query dealer_transactions via dealer JOIN for company_id scope
    // filter WHERE due_date < NOW() AND balance_effect = 'debit'
  })
  handlers.set('send_reminder', async (input, context) => {
    // INSERT collection_activity + sendTelegramMessage to dealer's chat
  })
  handlers.set('log_collection_activity', async (input, context) => {
    // INSERT collection_activities; (supabase as any) pattern
  })
  return handlers
}
```

### Pattern 2: Webhook Route (identical to egitimci/route.ts)

**What:** Each dedicated webhook route is a verbatim copy of `egitimci/route.ts` with three substitutions.

**Substitution table:**
| Role | URL path (kebab) | Role enum (underscore) | Token env var |
|------|-----------------|----------------------|---------------|
| tahsilat_uzmani | tahsilat-uzmani | tahsilat_uzmani | TELEGRAM_BOT_TOKEN_TAHSILAT_UZMANI |
| dagitim_koordinatoru | dagitim-koordinatoru | dagitim_koordinatoru | TELEGRAM_BOT_TOKEN_DAGITIM_KOORDINATORU |
| saha_satis | saha-satis | saha_satis | TELEGRAM_BOT_TOKEN_SAHA_SATIS |
| pazarlamaci | pazarlamaci | pazarlamaci | TELEGRAM_BOT_TOKEN_PAZARLAMACI |
| urun_yoneticisi | urun-yoneticisi | urun_yoneticisi | TELEGRAM_BOT_TOKEN_URUN_YONETICISI |
| satin_alma | satin-alma | satin_alma | TELEGRAM_BOT_TOKEN_SATIN_ALMA |
| iade_kalite | iade-kalite | iade_kalite | TELEGRAM_BOT_TOKEN_IADE_KALITE |

**Note:** `iade_kalite` is not in the current `AgentRole` type — it must be added to `types.ts`. The TOOL_REGISTRY and AGENT_MODELS must also gain this entry. Check if `destek` (support) is also needed — if so, add it too. The current `AgentRole` type has 12 roles but `destek` uses placeholder tools; Phase 12 does NOT implement `destek`.

### Pattern 3: Real AgentBridge.callAgent() Implementation (AO-02)

**What:** Replace the Phase 9 placeholder in `agent-bridge.ts` with an actual `AgentRunner` invocation.

**Why this matters:** The existing implementation only logs and returns a placeholder string. The real implementation must create a proper AgentContext, fetch agent definition from DB, and run the target agent's tool loop.

**Implementation approach:**
```typescript
// Source: agent-bridge.ts callAgent() — replace Phase 9 placeholder block
// Step 3 replacement (after deadlock check and audit logging):

// Fetch target agent definition from DB
const { data: agentDef } = await this.supabase
  .from('agent_definitions')
  .select('role, system_prompt, model')
  .eq('company_id', context.companyId)
  .eq('role', targetRole)
  .eq('is_active', true)
  .maybeSingle()

if (!agentDef) {
  return { success: false, error: `[Ajan tanimlamasi bulunamadi: ${targetRole}]` }
}

// Build synthetic AgentContext for the target agent
const targetContext: AgentContext = {
  companyId: context.companyId,
  dealerId: context.dealerId,          // inherited from caller
  conversationId: context.conversationId,
  agentRole: targetRole as AgentRole,
  telegramChatId: 0,                   // no Telegram reply from sub-agent
  callStack: [...context.callStack, targetRole],
  depth: context.depth + 1,
}

// Get tools for the target role
const toolRegistry = new ToolRegistry()
const tools = toolRegistry.getToolsWithCaching(targetRole as AgentRole)

// Build handler map for target role (re-use dispatcher pattern)
const targetHandlers = buildHandlersForRole(targetRole, this.supabase)

// Run the target agent
const runner = new AgentRunner(agentDef.model, tools, targetHandlers)
const syntheticMessages: MessageParam[] = [{ role: 'user', content: query }]
const result = await runner.run(agentDef.system_prompt, syntheticMessages, targetContext)

return { success: true, result }
```

**Critical: `buildHandlersForRole` helper:** To avoid duplicating the dispatcher's `else-if` chain, extract role-to-handler mapping into a shared helper function. Both `dispatcher.ts` and `agent-bridge.ts` import it.

```typescript
// src/lib/agents/handler-factory.ts (NEW file)
export function buildHandlersForRole(
  role: string,
  supabase: SupabaseClient<Database>,
): Map<string, HandlerFn> {
  if (role === 'egitimci') return createEgitimciHandlers(supabase)
  if (role === 'satis_temsilcisi') return createSatisHandlers(supabase)
  if (role === 'muhasebeci') return createMuhasebeciHandlers(supabase)
  if (role === 'depo_sorumlusu') return createDepoSorumlusuHandlers(supabase)
  if (role === 'genel_mudur_danismani') return createGenelMudurHandlers(supabase)
  // Phase 12 additions:
  if (role === 'tahsilat_uzmani') return createTahsilatUzmaniHandlers(supabase)
  if (role === 'dagitim_koordinatoru') return createDagitimKoordinatoruHandlers(supabase)
  if (role === 'saha_satis') return createSahaSatisHandlers(supabase)
  if (role === 'pazarlamaci') return createPazarlamaciHandlers(supabase)
  if (role === 'urun_yoneticisi') return createUrunYoneticisiHandlers(supabase)
  if (role === 'satin_alma') return createSatinAlmaHandlers(supabase)
  if (role === 'iade_kalite') return createIadeKaliteHandlers(supabase)
  // Fallback placeholder
  return new Map([['echo', async (input) => String(input.message ?? '')]])
}
```

Then `dispatcher.ts` replaces its `else-if` chain with: `toolHandlers = buildHandlersForRole(role, supabase)`.

### Pattern 4: Vercel Cron Daily Briefing (AO-03)

**What:** A Vercel Cron job fires daily at 08:00 UTC. A GET endpoint queries relevant data per agent role and sends Telegram messages to enrolled dealers.

**Constraint (HIGH confidence — verified with official Vercel docs):** Hobby plan cron jobs execute **once per day** only. Expressions like `0 8 * * *` (daily at 8 AM UTC) are valid. The timing precision on Hobby is ±59 minutes (fires anywhere 08:00–08:59 UTC).

**vercel.json configuration:**
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/daily-briefing",
      "schedule": "0 8 * * *"
    }
  ]
}
```

**Route implementation:**
```typescript
// src/app/api/cron/daily-briefing/route.ts
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service-client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  // CRON_SECRET authorization check
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // For each active agent that has a Telegram bot token configured,
  // query relevant data and send a briefing message to enrolled dealers
  // ...implementation per role...

  return Response.json({ success: true, briefingsSent: count })
}
```

**Briefing scope for AO-03 (minimum viable — at least one agent):** Implement for Tahsilat Uzmani as the first proactive agent. Briefing: "Vadesi gecmis alacaklar: X adet, toplam Y TL." Query `collection_activities` + `dealer_transactions` for the company; send via `sendTelegramMessage` to dealers who have `telegram_chat_id` set.

**Important scoping:** The daily briefing is scoped to the company. The cron fires once globally. It must loop over all companies that have active agent definitions and enrolled dealers with `telegram_chat_id`.

### Pattern 5: New Domain Tables (SQL Migration)

**What:** 7 new tables, all with `company_id` scope, RLS enabled (service role only), standard indexes.

**Migration block structure (SQL):**
```sql
-- 011_phase12_domain_tables.sql
-- Each table follows the same structure:
-- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
-- company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE
-- [domain columns]
-- created_at TIMESTAMPTZ DEFAULT NOW()
-- ALTER TABLE xxx ENABLE ROW LEVEL SECURITY
-- CREATE INDEX idx_xxx_company ON xxx(company_id, created_at DESC)

CREATE TABLE collection_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  dealer_id     UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('reminder_sent', 'call_made', 'visit', 'payment_received', 'note')),
  notes         TEXT,
  amount_expected NUMERIC(12,2),
  due_date      DATE,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dealer_visits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  dealer_id     UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  planned_date  DATE NOT NULL,
  actual_date   DATE,
  visit_type    TEXT NOT NULL DEFAULT 'routine' CHECK (visit_type IN ('routine', 'sales', 'complaint', 'delivery')),
  outcome       TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sales_targets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  dealer_id     UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  target_amount NUMERIC(12,2) NOT NULL,
  achieved_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  contact_name  TEXT,
  email         TEXT,
  phone         TEXT,
  notes         TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id   UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'confirmed', 'received', 'cancelled')),
  items         JSONB NOT NULL DEFAULT '[]',
  total_amount  NUMERIC(12,2),
  notes         TEXT,
  ordered_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE return_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  dealer_id     UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  order_id      UUID REFERENCES orders(id) ON DELETE SET NULL,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  items         JSONB NOT NULL DEFAULT '[]',
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quality_complaints (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  dealer_id      UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  complaint_type TEXT NOT NULL CHECK (complaint_type IN ('product_quality', 'delivery', 'packaging', 'other')),
  description    TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### Anti-Patterns to Avoid

- **Sending Telegram replies from AgentBridge sub-agent calls:** When `AgentBridge.callAgent()` runs a sub-agent, it must NOT send Telegram messages. `telegramChatId: 0` and no `sendTelegramMessage` call. Only the top-level dispatcher sends Telegram messages.
- **Using `context.dealerId` in company-wide tools:** Tahsilat Uzmani's `get_overdue_payments` is company-scoped (admin perspective), not dealer-scoped. Use `company_id` JOIN through `dealers` table, not `dealer_id` direct filter.
- **PUT/PATCH verbs in cron route:** Vercel cron calls `GET`. Never implement briefing as POST.
- **Missing `(supabase as any)` on INSERT/UPDATE:** All INSERT/UPDATE operations must use `(supabase as any)` to avoid TypeScript type assertion errors on new tables not in `database.types`.
- **Missing `iade_kalite` in AgentRole type:** The role name `iade_kalite` is NOT currently in `types.ts` AgentRole union. Must add it before `TOOL_REGISTRY` and `AGENT_MODELS` can reference it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Telegram message sending in briefing | Custom HTTP client | Reuse `sendTelegramMessage` from dispatcher.ts | Already handles error logging and non-throwing |
| Handler map per role | New pattern | `buildHandlersForRole` helper (extract from dispatcher) | Avoids duplication between dispatcher and AgentBridge |
| Cron timing | Custom timer or external service | Vercel native cron via `vercel.json` | Already on Vercel; zero ops overhead |
| Cross-agent data queries | Full AgentRunner invocation | Direct DB helpers in AgentBridge for data-only queries | Cheaper and faster; only use full AgentRunner when reasoning is needed |

**Key insight:** The entire Phase 12 tool infrastructure is pure application of the established pattern — no new patterns are invented. The only genuinely new technical elements are the Vercel cron route and the real AgentBridge.callAgent() implementation.

---

## Common Pitfalls

### Pitfall 1: `iade_kalite` Missing from AgentRole Type
**What goes wrong:** TypeScript compile error when TOOL_REGISTRY or AGENT_MODELS references `'iade_kalite'` — "Type 'string' is not assignable to type 'AgentRole'".
**Why it happens:** The current `AgentRole` type in `types.ts` does not include `'iade_kalite'`. It has `destek` but not `iade_kalite`. The Phase 12 requirements use the role name `iade_kalite`.
**How to avoid:** Add `'iade_kalite'` to the `AgentRole` union type AND add `iade_kalite: HAIKU_MODEL` to `AGENT_MODELS` AND `iade_kalite: placeholderTools` to TOOL_REGISTRY (in the migration plan; real tools replace placeholder in the tool file plan).
**Warning signs:** `npx tsc --noEmit` fails with "Property 'iade_kalite' does not exist on type".

### Pitfall 2: Cron Hobby Plan Daily Limit
**What goes wrong:** Deployment fails with "Hobby accounts are limited to daily cron jobs. This cron expression would run more than once per day."
**Why it happens:** Hobby plan only allows cron expressions that fire once per day maximum.
**How to avoid:** Use `0 8 * * *` (once daily at 8 AM UTC). Never use hourly or per-minute expressions on Hobby. If more frequent briefings are needed, upgrade to Pro.
**Warning signs:** Vercel deployment output shows cron validation error.

### Pitfall 3: AgentBridge Sub-Agent Sends Telegram Messages
**What goes wrong:** When `AgentBridge.callAgent()` runs a full AgentRunner, the agent loop replies via Telegram directly — the dealer gets two Telegram messages (one from the sub-agent, one from the top-level agent).
**Why it happens:** AgentRunner uses the context's `telegramChatId` — but the sub-agent context shouldn't have a valid chat ID.
**How to avoid:** Set `telegramChatId: 0` in the target context AND ensure the `AgentBridge.callAgent()` implementation never calls `sendTelegramMessage`. The result is returned as a string to the calling agent, which incorporates it into its own reply.
**Warning signs:** Dealer receives duplicate or out-of-context Telegram messages.

### Pitfall 4: company_id Scoping on Tahsilat Uzmani Data
**What goes wrong:** `get_overdue_payments` returns data from all companies or errors on missing `company_id` filter.
**Why it happens:** `dealer_transactions` has NO `company_id` column (per established pattern from muhasebeci-tools). It must be scoped via `dealer_id` JOIN.
**How to avoid:** For admin/company-wide perspective, query `dealers` first to get all `dealer_id` values for the company, then query `dealer_transactions` where `dealer_id IN (...)`. Or use a CTE/RPC.
**Warning signs:** Returns rows from other companies or empty results on company-wide queries.

### Pitfall 5: Missing `(supabase as any)` on New Table INSERTs
**What goes wrong:** TypeScript error: "Argument of type '{ ... }' is not assignable to parameter of type 'never'" on INSERT into `collection_activities`, `dealer_visits`, etc.
**Why it happens:** `database.types.ts` is not regenerated for new tables. The TypeScript type system doesn't know these tables exist.
**How to avoid:** Always use `(supabase as any).from('collection_activities').insert(...)` for all INSERT/UPDATE operations on Phase 12 tables. This is the established project pattern.
**Warning signs:** TypeScript compile error on `.from('collection_activities')`.

### Pitfall 6: Cron Route Using POST Instead of GET
**What goes wrong:** Vercel cron invocation returns 405 Method Not Allowed.
**Why it happens:** Vercel cron jobs call `GET`, not `POST`.
**How to avoid:** Export `GET` function from the cron route, not `POST`.

### Pitfall 7: Proactive Briefing Loops Over All Dealers Without Bot Token Check
**What goes wrong:** Briefing fails silently or throws for agents whose bot tokens aren't configured yet.
**Why it happens:** The briefing must check that `TELEGRAM_BOT_TOKEN_*` env var is set before attempting to send messages.
**How to avoid:** For each agent in the briefing loop, check `process.env.TELEGRAM_BOT_TOKEN_*`; skip silently if not configured.

---

## Code Examples

Verified patterns from existing codebase:

### Webhook Route Template
```typescript
// Source: src/app/api/telegram/egitimci/route.ts
import { after } from 'next/server'
import type { Update } from 'grammy/types'
import { createServiceClient } from '@/lib/supabase/service-client'
import { dispatchAgentUpdate } from '@/lib/agents/dispatcher'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  let update: Update
  try {
    update = (await request.json()) as Update
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const supabase = createServiceClient()
  const { error: idempotencyError } = await supabase
    .from('processed_telegram_updates')
    .insert({ update_id: update.update_id })

  if (idempotencyError) {
    if (idempotencyError.code === '23505') {
      return new Response('OK', { status: 200 })
    }
    console.error('[telegram/ROLE] idempotency insert error:', idempotencyError)
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN_ROLE || ''
  after(async () => {
    try {
      await dispatchAgentUpdate(update, 'role_enum', botToken)
    } catch (err) {
      console.error('[telegram/ROLE] dispatch error:', err)
    }
  })

  return new Response('OK', { status: 200 })
}
```

### Cron Route with CRON_SECRET
```typescript
// Source: Vercel official docs - https://vercel.com/docs/cron-jobs/manage-cron-jobs
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  // briefing logic here
  return Response.json({ success: true })
}
```

### INSERT with (supabase as any) Pattern
```typescript
// Source: Established project pattern from muhasebeci-tools.ts and satis-tools.ts
const { data, error } = await (supabase as any)
  .from('collection_activities')
  .insert({
    company_id: context.companyId,
    dealer_id: context.dealerId,
    activity_type: 'reminder_sent',
    notes: String(input.notes ?? ''),
    amount_expected: typeof input.amount === 'number' ? input.amount : null,
    due_date: typeof input.due_date === 'string' ? input.due_date : null,
  })
  .select('id')
  .single()
```

### SQL Seed File Pattern
```sql
-- Source: SS/11-agent-definitions-seed.sql — established Phase 10-11 pattern
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_definitions_company_role
  ON agent_definitions (company_id, role);

DO $$
DECLARE v_company_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM companies WHERE slug = 'default' LIMIT 1;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Default company not found.';
  END IF;

  INSERT INTO agent_definitions (company_id, role, name, model, system_prompt, is_active)
  VALUES (v_company_id, 'tahsilat_uzmani', 'Tahsilat Uzmani', 'claude-haiku-4-5',
    'Sen bir tahsilat uzmanisin...', true)
  ON CONFLICT (company_id, role) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    model = EXCLUDED.model,
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;
  -- repeat for 6 more agents...
END $$;
```

### Company-Wide Data Scope via Dealer Join
```typescript
// Pattern for agents that need company-wide data (not dealer-specific)
// dealer_transactions has NO company_id — must join through dealers table
const { data: dealers } = await supabase
  .from('dealers')
  .select('id')
  .eq('company_id', context.companyId)
  .eq('is_active', true)

const dealerIds = (dealers ?? []).map(d => d.id)

const { data: overdueTransactions } = await supabase
  .from('dealer_transactions')
  .select('dealer_id, amount, due_date, reference_number, transaction_type:transaction_types(code, name)')
  .in('dealer_id', dealerIds)
  .lt('due_date', new Date().toISOString().split('T')[0])
  // Additional filtering in JS for payment status
  .order('due_date', { ascending: true })
  .limit(limit)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 9 AgentBridge.callAgent() placeholder | Real AgentRunner invocation in Phase 12 | Phase 12 | Sales can actually query warehouse stock in real time |
| Reactive-only agents (respond to messages) | Proactive agents (initiate daily briefings) | Phase 12 | Tahsilat Uzmani can proactively notify about overdue payments without waiting for a message |
| All tools manually wired in dispatcher | `buildHandlersForRole` shared helper | Phase 12 | Both dispatcher and AgentBridge use the same role-to-handler mapping |

**Deprecated/outdated:**
- `dispatcher.ts` manually duplicating the `else-if` role chain: When Phase 12 adds 7 more roles, the chain grows unwieldy. Refactor to use `buildHandlersForRole` helper. The existing Phase 10-11 chains should be migrated to the helper in the same plan.

---

## Open Questions

1. **Does `iade_kalite` use a different role name?**
   - What we know: The `AgentRole` type has 12 entries. It has `destek` but no `iade_kalite`. The requirements say "Iade Kalite Sorumlusu" for IK-01/IK-02/IK-03.
   - What's unclear: The intended role key — is it `iade_kalite` or something else?
   - Recommendation: Use `iade_kalite` as the role key. Add it to `AgentRole` in `types.ts`. The TOOL_REGISTRY currently has 12 entries (counting `destek`) — `iade_kalite` would make 13. The `destek` role stays as placeholder. This means the final ecosystem has 13 role entries in the registry but only 12 "active" agents.

2. **Should Dagitim Koordinatoru tools use existing orders table or require a new delivery_routes table?**
   - What we know: There's no `delivery_routes` table in the current schema. DK-02 says "manage_routes" but no migration is listed in the requirements (unlike TU-04, SS-03, SA-03, IK-03 which explicitly list new tables for DK-02 it's absent).
   - What's unclear: Whether `delivery_routes` should be created or if route management is advisory-only.
   - Recommendation: Implement `manage_routes` as advisory-only (query `orders` grouped by dealer address city, no write operations, no new table). The absence of DK-04 in requirements confirms no new table is needed for the distribution coordinator.

3. **How many companies does the daily briefing serve?**
   - What we know: The system is multi-tenant (company_id scoped). The cron fires globally.
   - What's unclear: Whether to hard-code to `slug = 'default'` or loop all companies.
   - Recommendation: Loop all companies where at least one agent has `is_active = true` and at least one dealer has `telegram_chat_id IS NOT NULL`. This is the correct multi-tenant approach.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase patterns — `src/lib/agents/dispatcher.ts`, `agent-bridge.ts`, `tool-registry.ts`, `types.ts`
- Existing tool files — `muhasebeci-tools.ts`, `depo-sorumlusu-tools.ts`, `satis-tools.ts`, `egitimci-tools.ts`, `genel-mudur-tools.ts`
- Existing webhook routes — `src/app/api/telegram/egitimci/route.ts`
- Existing SQL migrations — `supabase/migrations/010_agent_tables.sql`
- Existing SQL seeds — `SS/10-agent-definitions-seed.sql`, `SS/11-agent-definitions-seed.sql`
- [Vercel Cron Jobs Quickstart](https://vercel.com/docs/cron-jobs/quickstart) — verified configuration format
- [Vercel Cron Jobs Manage](https://vercel.com/docs/cron-jobs/manage-cron-jobs) — CRON_SECRET pattern, Hobby plan restrictions
- [Vercel Cron Jobs Usage and Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) — Hobby: 100 jobs max, once per day limit, ±59 min precision

### Secondary (MEDIUM confidence)
- Phase 11 RESEARCH.md and PLAN files — confirm established tool/dispatcher patterns
- Phase 10 RESEARCH.md — confirms handler factory pattern and service role client requirement

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — identical to Phases 10-11, no new packages
- Tool file architecture: HIGH — direct extension of verified Phase 10-11 pattern
- New DB tables: HIGH — standard company_id-scoped tables following migration 010 pattern
- AgentBridge.callAgent() real implementation: MEDIUM — the placeholder is clear, the pattern is clear, but `buildHandlersForRole` helper is a new extraction not previously done
- Vercel Cron configuration: HIGH — verified against official Vercel docs
- Hobby plan daily limit constraint: HIGH — explicitly documented in Vercel pricing page
- `iade_kalite` role name: MEDIUM — inferred from requirement names, not explicitly in existing type definitions

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable stack, 30 days)
