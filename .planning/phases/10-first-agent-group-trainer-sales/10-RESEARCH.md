# Phase 10: First Agent Group — Trainer + Sales - Research

**Researched:** 2026-03-01
**Domain:** Claude tool-use agent implementations — read-only product/FAQ tools (Egitimci) + transactional order/catalog tools (Satis Temsilcisi)
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TR-01 | Egitimci ajani urun bilgisi sorgusuna yanitlar verir (get_product_info tool) | Direct Supabase query: `products` table with `company_id` scope; `get_dealer_price` RPC for dealer-specific price; returns JSON string |
| TR-02 | Egitimci ajani FAQ sorularina yanitlar verir (get_faq tool) | Direct Supabase query: `faq_items` joined with `faq_categories`; full-text search via `.ilike`; returns Q&A pairs |
| TR-03 | Egitimci ajani Telegram uzerinden bayilerle Turkce konusur | System prompt in Turkish + explicit "respond only in Turkish" instruction; model is Sonnet 4.6 (per AGENT_MODELS) |
| TR-04 | Egitimci ajani read-only calisir, hicbir veriyi degistirmez | Tool enforcement: Egitimci's tool list contains ONLY SELECT-based tools (get_product_info, get_faq); no insert/update tool registered in ToolRegistry |
| SR-01 | Satis temsilcisi urun katalogu sorgular (get_catalog tool) | Mirrors `getCatalogProducts` action but uses service role client; query `products` + `dealer_prices` tables scoped by `company_id` and `dealer_id` |
| SR-02 | Satis temsilcisi siparis olusturur (create_order tool) | Mirrors `createOrder` action: RPC `generate_order_number`, insert into `orders` + `order_items` + `order_status_history`; uses service role client (no auth.getUser()) |
| SR-03 | Satis temsilcisi siparis durumu sorgular (get_order_status tool) | Query `orders` joined with `order_statuses` and `order_items`; scoped by `dealer_id` + `company_id` |
| SR-04 | Satis temsilcisi kampanya bilgisi verir (get_campaigns tool) | Query `campaigns` with date range filter (active + within start_date/end_date); optionally join `campaign_products` |
| SR-05 | Satis temsilcisi stok kontrolu yapar (check_stock tool) | Query `products.stock_quantity` + `products.low_stock_threshold` by product code or name; scoped by `company_id` |
| SR-06 | Satis temsilcisi bayi profil bilgisi sorgular (get_dealer_profile tool) | Query `dealers` with `dealer_groups` join; return company_name, email, phone, address, discount_percent |
| SR-07 | Satis temsilcisi Telegram uzerinden siparis akisini yonetir | Multi-turn conversation via ConversationManager; Claude confirms order details before create_order is called; system prompt defines the flow |
</phase_requirements>

---

## Summary

Phase 10 replaces the three placeholder tools from Phase 9 with real, role-specific tool implementations for two agent roles: Egitimci (Trainer) and Satis Temsilcisi (Sales). The infrastructure from Phase 9 is fully wired and verified — `AgentRunner`, `ConversationManager`, `TokenBudget`, `ToolRegistry`, and the dispatcher are all live. This phase is purely about filling in the `TOOL_REGISTRY` entries for `egitimci` and `satis_temsilcisi` with real `Tool` definitions and their corresponding handler functions.

The core pattern is identical for both agents: define `Tool[]` using the `@anthropic-ai/sdk` `Tool` type (with `input_schema`), implement handler functions as `(input, context) => Promise<string>`, register them in the `ToolRegistry`, and update the dispatcher to provide role-specific tool handler maps. All tool handlers use the service role Supabase client and MUST scope every query with `company_id` (since service role bypasses RLS).

The critical correctness requirement is TR-04: Egitimci must be read-only at the tool level, not just at the prompt level. This is achieved by never giving Egitimci access to any mutating tool — the `TOOL_REGISTRY['egitimci']` array must contain only SELECT-based tools. The dispatcher already routes to role-specific handlers, so no new infrastructure is needed.

**Primary recommendation:** Implement tools in two files — `src/lib/agents/tools/egitimci-tools.ts` and `src/lib/agents/tools/satis-tools.ts` — then update `TOOL_REGISTRY` and the dispatcher's `toolHandlers` map construction. No new API routes, no new DB tables, no new migrations.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | ^0.78.0 | Tool definitions (`Tool` type) + handler pattern | Already installed in Phase 9; `Tool` type from `@anthropic-ai/sdk/resources/messages` is the contract |
| `@supabase/supabase-js` | ^2.91.1 | All DB queries inside tool handlers | Already installed; service role client (createServiceClient) is the only client allowed in agent layer |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | (project default) | Strong typing for tool inputs and handler return types | Always — input_schema shapes must match handler input types |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct Supabase queries in handlers | Reuse existing `src/lib/actions/*.ts` functions | Actions use `createClient()` (user session) not `createServiceClient()` (service role) — cannot reuse directly. Must re-implement queries with service role client. |
| JSON string return from handlers | Structured object return | AgentRunner accepts `string` from handlers; Claude receives the JSON as a string and parses context from it. Keep string returns. |

**Installation:** No new packages required. All dependencies from Phase 9 are sufficient.

---

## Architecture Patterns

### Recommended Project Structure

```
src/lib/agents/
├── tools/
│   ├── index.ts              # (existing) placeholder tools — will be emptied/replaced
│   ├── egitimci-tools.ts     # NEW: Egitimci tool definitions + handler factories
│   └── satis-tools.ts        # NEW: Satis Temsilcisi tool definitions + handler factories
├── tool-registry.ts          # UPDATE: egitimci + satis_temsilcisi entries point to real tools
├── dispatcher.ts             # UPDATE: toolHandlers map built per role using real handlers
├── agent-runner.ts           # No change
├── conversation-manager.ts   # No change
├── agent-bridge.ts           # No change
├── token-budget.ts           # No change
└── types.ts                  # No change (AgentRole already defined)
```

### Pattern 1: Tool Definition File Structure

**What:** Each agent role gets a dedicated file that exports (a) `Tool[]` array and (b) a handler factory function that accepts a Supabase client and returns a `Map<string, HandlerFn>`.

**When to use:** Whenever adding tools for a new agent role. Handler factories keep the Supabase client injection clean and avoid creating new clients inside each handler.

**Example:**
```typescript
// src/lib/agents/tools/egitimci-tools.ts
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { AgentContext } from '../types'

type HandlerFn = (input: Record<string, unknown>, context: AgentContext) => Promise<string>

// ─── Tool Definitions ─────────────────────────────────────────────────────

export const getProductInfoTool: Tool = {
  name: 'get_product_info',
  description: 'Urun hakkinda detayli bilgi getirir. Urun adi, kodu, aciklama, fiyat ve stok durumu dahildir.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Urun adi veya kodu (kismi esleme desteklenir)',
      },
    },
    required: ['query'],
  },
}

export const getFaqTool: Tool = {
  name: 'get_faq',
  description: 'Sik sorulan sorulari (SSS) arar ve ilgili sorulari ve cevaplari dondurur.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Aranacak konu veya soru',
      },
    },
    required: ['query'],
  },
}

export const egitimciTools: Tool[] = [getProductInfoTool, getFaqTool]

// ─── Handler Factory ──────────────────────────────────────────────────────

export function createEgitimciHandlers(
  supabase: SupabaseClient<Database>
): Map<string, HandlerFn> {
  return new Map([
    ['get_product_info', createGetProductInfoHandler(supabase)],
    ['get_faq', createGetFaqHandler(supabase)],
  ])
}

function createGetProductInfoHandler(supabase: SupabaseClient<Database>): HandlerFn {
  return async (input, context) => {
    const query = String(input.query ?? '').trim()
    if (!query) return '[Hata: Urun sorgusu bos olamaz]'

    const { data: products, error } = await supabase
      .from('products')
      .select('id, code, name, description, base_price, stock_quantity, low_stock_threshold')
      .eq('company_id', context.companyId)
      .eq('is_active', true)
      .or(`name.ilike.%${query}%,code.ilike.%${query}%`)
      .limit(5)

    if (error) return `[Hata: ${error.message}]`
    if (!products || products.length === 0) return '[Urun bulunamadi]'

    // Fetch dealer-specific price for each product
    const { data: dealerPrices } = await supabase
      .from('dealer_prices')
      .select('product_id, custom_price')
      .eq('dealer_id', context.dealerId)
      .in('product_id', products.map(p => p.id))

    const priceMap = new Map((dealerPrices ?? []).map(dp => [dp.product_id, dp.custom_price]))

    // Also get dealer group discount
    const { data: dealer } = await supabase
      .from('dealers')
      .select('dealer_group:dealer_groups(discount_percent)')
      .eq('id', context.dealerId)
      .single()

    const discountPercent = (dealer as any)?.dealer_group?.discount_percent ?? 0

    const result = products.map(p => {
      const customPrice = priceMap.get(p.id)
      const dealerPrice = customPrice !== undefined
        ? customPrice
        : p.base_price * (1 - discountPercent / 100)
      return {
        code: p.code,
        name: p.name,
        description: p.description,
        base_price: p.base_price,
        dealer_price: Math.round(dealerPrice * 100) / 100,
        stock: p.stock_quantity,
        low_stock: p.stock_quantity <= p.low_stock_threshold,
      }
    })

    return JSON.stringify(result)
  }
}

function createGetFaqHandler(supabase: SupabaseClient<Database>): HandlerFn {
  return async (input) => {
    const query = String(input.query ?? '').trim()
    if (!query) return '[Hata: Arama sorgusu bos olamaz]'

    // faq_items does not have company_id — it's global FAQ
    const { data: items, error } = await supabase
      .from('faq_items')
      .select('question, answer, category:faq_categories(name)')
      .eq('is_active', true)
      .or(`question.ilike.%${query}%,answer.ilike.%${query}%`)
      .limit(5)

    if (error) return `[Hata: ${error.message}]`
    if (!items || items.length === 0) return '[Ilgili SSS bulunamadi]'

    return JSON.stringify(items)
  }
}
```

### Pattern 2: Tool Handler for create_order (SR-02)

**What:** The `create_order` handler replicates the server action logic from `src/lib/actions/orders.ts` but uses the service role client (no `auth.getUser()`) and already knows `dealerId` and `companyId` from `AgentContext`.

**When to use:** Any write operation that already exists as a server action must be adapted for agent use by replacing the user-session Supabase client with the service role client and using context for identity.

**Example:**
```typescript
// Inside satis-tools.ts: create_order handler
async (input, context) => {
  const items = input.items as Array<{
    product_code: string
    quantity: number
  }>

  if (!items || items.length === 0) {
    return '[Hata: Siparis kalemleri bos olamaz]'
  }

  // 1. Resolve product IDs and prices from product codes
  const productCodes = items.map(i => i.product_code)
  const { data: products } = await supabase
    .from('products')
    .select('id, code, name, base_price, stock_quantity')
    .eq('company_id', context.companyId)
    .eq('is_active', true)
    .in('code', productCodes)

  if (!products || products.length === 0) {
    return '[Hata: Urunler bulunamadi]'
  }

  // 2. Get dealer group for pricing
  const { data: dealer } = await supabase
    .from('dealers')
    .select('dealer_group:dealer_groups(discount_percent, min_order_amount)')
    .eq('id', context.dealerId)
    .single()

  const discountPercent = (dealer as any)?.dealer_group?.discount_percent ?? 0
  const minOrderAmount = (dealer as any)?.dealer_group?.min_order_amount ?? 0

  // 3. Get dealer-specific price overrides
  const { data: dealerPrices } = await supabase
    .from('dealer_prices')
    .select('product_id, custom_price')
    .eq('dealer_id', context.dealerId)
    .in('product_id', products.map(p => p.id))

  const priceMap = new Map((dealerPrices ?? []).map(dp => [dp.product_id, dp.custom_price]))

  // 4. Build order items
  const productMap = new Map(products.map(p => [p.code, p]))
  const orderItems = items.map(item => {
    const product = productMap.get(item.product_code)
    if (!product) return null
    const customPrice = priceMap.get(product.id)
    const unitPrice = customPrice !== undefined
      ? customPrice
      : product.base_price * (1 - discountPercent / 100)
    return {
      product_id: product.id,
      product_code: product.code,
      product_name: product.name,
      quantity: item.quantity,
      unit_price: Math.round(unitPrice * 100) / 100,
      total_price: Math.round(unitPrice * item.quantity * 100) / 100,
    }
  }).filter(Boolean) as Array<{
    product_id: string; product_code: string; product_name: string
    quantity: number; unit_price: number; total_price: number
  }>

  const subtotal = orderItems.reduce((s, i) => s + i.total_price, 0)

  if (subtotal < minOrderAmount) {
    return `[Minimum siparis tutari ${minOrderAmount} TL. Mevcut tutar: ${subtotal.toFixed(2)} TL]`
  }

  // 5. Get pending status ID
  const { data: pendingStatus } = await supabase
    .from('order_statuses')
    .select('id')
    .eq('code', 'pending')
    .single()

  if (!pendingStatus) return '[Hata: Siparis durumu bulunamadi]'

  // 6. Generate order number via RPC
  const { data: orderNumber } = await supabase.rpc('generate_order_number')
  const orderNum = orderNumber || `ORD-${Date.now()}`

  // 7. Insert order
  const { data: order, error: orderError } = await (supabase as any)
    .from('orders')
    .insert({
      company_id: context.companyId,
      order_number: orderNum,
      dealer_id: context.dealerId,
      status_id: pendingStatus.id,
      subtotal,
      discount_amount: 0,
      total_amount: subtotal,
    })
    .select()
    .single()

  if (orderError || !order) {
    return `[Hata: Siparis olusturulamadi: ${orderError?.message ?? 'Bilinmeyen hata'}]`
  }

  // 8. Insert order items
  const { error: itemsError } = await (supabase as any)
    .from('order_items')
    .insert(orderItems.map(item => ({ ...item, company_id: context.companyId, order_id: order.id })))

  if (itemsError) {
    // Rollback
    await (supabase as any).from('orders').delete().eq('id', order.id)
    return `[Hata: Siparis kalemleri olusturulamadi: ${itemsError.message}]`
  }

  // 9. Insert status history
  await (supabase as any).from('order_status_history').insert({
    company_id: context.companyId,
    order_id: order.id,
    status_id: pendingStatus.id,
    notes: 'Siparis Telegram uzerinden olusturuldu',
  })

  return JSON.stringify({
    success: true,
    order_number: order.order_number,
    order_id: order.id,
    total_amount: subtotal,
    items_count: orderItems.length,
  })
}
```

### Pattern 3: Dispatcher Tool Handler Map per Role

**What:** The dispatcher currently builds a single `toolHandlers` Map with 3 placeholder handlers. In Phase 10, it must build role-specific handler maps using the handler factories from each tool file.

**When to use:** Any time a new role's tools are added.

**Example:**
```typescript
// In dispatcher.ts — replace the existing toolHandlers construction:

import { createEgitimciHandlers } from './tools/egitimci-tools'
import { createSatisHandlers } from './tools/satis-tools'

// After resolving `role` and `supabase`:
let toolHandlers: Map<string, HandlerFn>

if (role === 'egitimci') {
  toolHandlers = createEgitimciHandlers(supabase)
} else if (role === 'satis_temsilcisi') {
  toolHandlers = createSatisHandlers(supabase, context.dealerId, context.companyId)
} else {
  // Fallback for unimplemented roles — placeholder handlers
  toolHandlers = createPlaceholderHandlers()
}
```

### Pattern 4: System Prompt Design for Turkish-Only Responses

**What:** Each role's `system_prompt` stored in `agent_definitions` must instruct the model to respond only in Turkish, regardless of input language.

**When to use:** TR-03 and SR-07 — both agents must respond in Turkish.

**Example system prompt (Egitimci):**
```
Sen bir bayi egitim asistanisin. Gorevın: bayilere urun bilgisi ve SSS sorularini yanıtlamak.

KRITIK KURALLAR:
1. Her zaman Turkce cevap ver. Bayi hangi dilde yazarsa yazsin, sen Turkce yanitrlasin.
2. Yalnizca get_product_info ve get_faq araclari ile dogrulanmis bilgileri paylas.
3. Hic bir siparisi olusturma, degistirme veya silme islemi yapma — bu yetkinin disindadir.
4. Bilmedigın sorulara "Bu konuda bilgim bulunmuyor, lutfen yetkiliye basvurun" de.
5. Urun fiyatlarini her zaman araclari kullanarak sorgula, ezbere bilgi verme.
```

**Example system prompt (Satis Temsilcisi):**
```
Sen bir bayi satis temsilcisisin. Gorevın: bayilerin siparis vermesine, kampanyalari ogrenmesine ve urun katalogunu incelemesine yardimci olmak.

KRITIK KURALLAR:
1. Her zaman Turkce cevap ver.
2. Siparis olusturmadan once bayi ile urunleri ve miktarlari dogrula.
3. Stok durumunu her zaman siparisten once kontrol et.
4. Fiyat bilgisi icin her zaman get_catalog veya get_dealer_profile araclarini kullan.
5. Kampanya bilgisi icin get_campaigns aracini kullan.
```

### Pattern 5: Seeding agent_definitions for Phase 10

**What:** The `agent_definitions` table needs rows for `egitimci` and `satis_temsilcisi` roles with appropriate `system_prompt` and `model` values. Without these rows, the dispatcher falls back to `role='destek'` (Phase 9 behavior).

**When to use:** Required for the dispatcher to route to the correct role. Needs a SQL seed script run in Supabase Dashboard.

**Example SQL:**
```sql
-- Run in Supabase Dashboard SQL Editor for the test company
INSERT INTO agent_definitions (company_id, role, name, model, system_prompt, is_active)
VALUES
  (
    '<company_uuid>',
    'egitimci',
    'Egitimci',
    'claude-sonnet-4-6',
    'Sen bir bayi egitim asistanisin...',
    true
  ),
  (
    '<company_uuid>',
    'satis_temsilcisi',
    'Satis Temsilcisi',
    'claude-haiku-4-5',
    'Sen bir bayi satis temsilcisisin...',
    true
  )
ON CONFLICT (company_id, role) DO UPDATE SET
  system_prompt = EXCLUDED.system_prompt,
  model = EXCLUDED.model,
  is_active = EXCLUDED.is_active;
```

### Anti-Patterns to Avoid

- **Sharing a single tool handler map for all roles:** The dispatcher must build role-specific maps. Sharing one map means Egitimci gets access to `create_order`, violating TR-04.
- **Using `createClient()` (user session) inside tool handlers:** Tool handlers run server-side outside of any user session. Always use `createServiceClient()` or accept the client as a factory parameter.
- **Forgetting `company_id` scope in queries:** Service role bypasses RLS. Every query in a tool handler that touches multi-tenant tables (products, orders, campaigns, dealers) MUST have `.eq('company_id', context.companyId)`.
- **Returning raw objects from handlers:** `AgentRunner` expects `string` from handlers. Always `JSON.stringify()` objects.
- **FAQ table has no company_id:** `faq_items` and `faq_categories` are global (no `company_id` column in the DB schema). Do not try to scope them by company. This is intentional — FAQ is platform-wide.
- **Registering Egitimci in TOOL_REGISTRY before handlers exist:** If `TOOL_REGISTRY['egitimci']` has tools but the dispatcher's handler map for `egitimci` doesn't have the handlers, Claude calls a tool and gets `[Hata: '...' araci bulunamadi]`. Both must be updated together.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Order number generation | Custom counter or timestamp-based ID | `supabase.rpc('generate_order_number')` | Already exists as `generate_order_number` RPC function in DB; already used in `src/lib/actions/orders.ts` |
| Dealer-specific pricing | New pricing logic | Mirror the pattern from `src/lib/actions/catalog.ts` — check `dealer_prices` first, fall back to `dealer_groups.discount_percent` | This exact logic is already implemented and tested |
| Turkish language enforcement | Custom language detection/forcing middleware | System prompt instruction + rely on Claude's instruction-following | Claude (Sonnet 4.6 and Haiku 4.5) reliably follows "always respond in Turkish" if stated clearly in system prompt |
| Tool input validation | Zod schemas in handlers | Simple null/type checks (`String(input.query ?? '').trim()`) + early return with Turkish error string | AgentRunner already handles handler errors via try/catch; Claude re-asks the user on bad inputs naturally |

**Key insight:** The handlers return strings to Claude, not HTTP responses. Error messages returned by handlers are shown to Claude, which then formulates a user-facing Turkish message. Keep handler error messages informational (not user-facing).

---

## Common Pitfalls

### Pitfall 1: dispatcher.ts Role Resolution Uses First Active Agent Definition
**What goes wrong:** The current dispatcher queries `agent_definitions` with `.limit(1)` and takes the first result. If a company has both `egitimci` and `satis_temsilcisi` definitions active, only one bot (whichever was created first) will work correctly — both Telegram messages go to the same role.
**Why it happens:** Phase 9 was single-bot. Phase 10 has two distinct bots.
**How to avoid:** The dispatcher must resolve the bot-to-role mapping. Two approaches: (a) each bot has a distinct `TELEGRAM_BOT_TOKEN_EGITIMCI` and `TELEGRAM_BOT_TOKEN_SATIS` env var and distinct webhook routes; OR (b) the Telegram bot token from the incoming Update is used to look up the role in `agent_definitions.settings` (store bot token hash there). For Phase 10, the simpler approach is two webhook routes: `/api/telegram/egitimci` and `/api/telegram/satis`.
**Warning signs:** Both bots return the same type of response regardless of which one the dealer messages.

### Pitfall 2: faq_items Has No company_id
**What goes wrong:** If you write `supabase.from('faq_items').select('*').eq('company_id', context.companyId)`, you'll get a TypeScript type error — `company_id` doesn't exist on `faq_items`. The table is global.
**Why it happens:** FAQ is a platform-level feature, not a per-company feature (see DB schema in `database.types.ts` lines 948-988).
**How to avoid:** Query `faq_items` without any `company_id` filter. The data is already global.
**Warning signs:** TypeScript compiler error: `company_id is not assignable` on faq_items query.

### Pitfall 3: create_order Tool Must Confirm Before Creating
**What goes wrong:** Without confirmation flow, Claude may interpret ambiguous messages ("5 adet istiyorum" without specifying the product) as a complete order request and call `create_order` with incomplete data.
**Why it happens:** Claude is eager to complete user intents. The system prompt must require confirmation before calling `create_order`.
**How to avoid:** SR-07 requires "manages the order flow via Telegram." The system prompt must instruct Satis Temsilcisi to confirm order details (product, quantity, total price) with the dealer before calling `create_order`. Claude must ask "X adet Y urununu Z TL toplam tutarla siparis olusturayim mi?" before executing.
**Warning signs:** Orders created in the DB with wrong products or quantities.

### Pitfall 4: TOOL_REGISTRY and dispatcher toolHandlers Must Stay in Sync
**What goes wrong:** `TOOL_REGISTRY['egitimci']` advertises `get_product_info` and `get_faq` to Claude, but the dispatcher's handler map only has the old placeholder handlers. Claude calls `get_product_info`, gets `[Hata: 'get_product_info' araci bulunamadi]`, and loops trying other approaches.
**Why it happens:** `AgentRunner` looks up handlers in the `toolHandlers` Map by name. If the name in `Tool.name` doesn't match a key in `toolHandlers`, it returns the Turkish error string.
**How to avoid:** Keep `Tool.name` values in definitions exactly matching handler map keys. Add a startup assertion or TypeScript check.
**Warning signs:** `[Hata: 'get_product_info' araci bulunamadi]` in agent logs.

### Pitfall 5: Stock Quantity Check Before Order Creation
**What goes wrong:** If `check_stock` is a separate tool and `create_order` doesn't also check stock, a dealer could order more than available.
**Why it happens:** Tools are independent; Claude may call `create_order` without calling `check_stock` first.
**How to avoid:** The `create_order` handler should internally check that each `product.stock_quantity >= requested quantity` before inserting. Return a descriptive error if stock is insufficient, e.g., `[Stok yetersiz: X urununden sadece Y adet mevcut]`.
**Warning signs:** Orders with quantities exceeding stock.

### Pitfall 6: Markdown in Telegram Messages
**What goes wrong:** The dispatcher sends messages with `parse_mode: 'Markdown'`. If Claude returns markdown with unbalanced asterisks, backticks, or underscores, Telegram will reject the message with a 400 error.
**Why it happens:** Telegram's Markdown mode is strict about balanced markers.
**How to avoid:** Either use `parse_mode: 'MarkdownV2'` (stricter but more predictable) or `parse_mode: undefined` (plain text). Alternatively, add a system prompt instruction: "Telegram mesajlarinda yalnizca duz metin kullan, markdown isaretleri kullanma." For Phase 10, switching to no parse_mode is safest.
**Warning signs:** Telegram API error 400 with "can't parse entities" in Vercel logs.

---

## Code Examples

Verified patterns from existing codebase:

### Existing: Order Number Generation RPC

```typescript
// Source: src/lib/actions/orders.ts lines 93-97
const { data: orderNumberResult } = await supabase.rpc('generate_order_number')
const orderNumber = orderNumberResult || `ORD-${Date.now()}`
```

### Existing: Dealer Price Calculation Pattern

```typescript
// Source: src/lib/actions/catalog.ts lines 153-179
const pricesResult = await supabase
  .from('dealer_prices')
  .select('product_id, custom_price')
  .eq('dealer_id', dealer.id)

const priceMap = new Map(dealerPrices.map((dp) => [dp.product_id, dp.custom_price]))
const discountPercent = dealer.dealer_group?.discount_percent || 0

const dealerPrice = customPrice !== undefined
  ? customPrice
  : product.base_price * (1 - discountPercent / 100)
```

### Existing: Active Campaign Query with Date Range

```typescript
// Source: src/lib/actions/campaigns.ts lines 41-56
const now = new Date().toISOString()
const { data } = await supabase
  .from('campaigns')
  .select('*')
  .eq('is_active', true)
  .lte('start_date', now)
  .gte('end_date', now)
  .order('created_at', { ascending: false })
```

### Existing: AgentRunner Tool Definition Type

```typescript
// Source: src/lib/agents/tools/index.ts lines 6-16
import type { Tool } from '@anthropic-ai/sdk/resources/messages'

const myTool: Tool = {
  name: 'tool_name',
  description: '...',
  input_schema: {
    type: 'object' as const,
    properties: {
      param: { type: 'string', description: '...' },
    },
    required: ['param'],
  },
}
```

### Existing: Tool Handler Signature (AgentRunner contract)

```typescript
// Source: src/lib/agents/dispatcher.ts lines 177-180
const toolHandlers = new Map<
  string,
  (input: Record<string, unknown>, context: AgentContext) => Promise<string>
>([...])
```

### Existing: Service Role Client Pattern in Agent Layer

```typescript
// Source: src/lib/agents/agent-bridge.ts lines 42-44
private get supabase() {
  return createServiceClient()
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Placeholder tools for all roles | Role-specific tool implementations | Phase 10 | ToolRegistry entries for egitimci and satis_temsilcisi filled with real tools |
| Single dispatcher toolHandlers map (3 placeholder handlers) | Per-role handler map construction | Phase 10 | Role isolation enforced at the tool level |
| AgentBridge.callAgent() returns placeholder string | Real cross-agent invocation | Phase 10+ (future) | Not needed for Phase 10 — these two agents don't call each other |

**Deprecated/outdated in Phase 10:**
- `placeholderTools` (from `tools/index.ts`): Still used by the 10 unimplemented agent roles, but egitimci and satis_temsilcisi entries in `TOOL_REGISTRY` no longer point to it.
- `echo`, `get_current_time`, `lookup_dealer` handlers in dispatcher.ts: These were Phase 9 placeholders. After Phase 10, the dispatcher builds role-specific handler maps and the placeholder handlers are only reachable for roles not yet implemented.

---

## Open Questions

1. **Two bots or one bot with role routing?**
   - What we know: Phase 9 dispatcher resolves role by looking up the first active `agent_definitions` for the company. This works for one bot.
   - What's unclear: How does the webhook know which bot received the message? The Telegram Update contains `update.message.chat.id` (the dealer) but not which bot token received it.
   - Recommendation: Two separate webhook routes (`/api/telegram/egitimci` and `/api/telegram/satis`), each with its own `TELEGRAM_BOT_TOKEN_EGITIMCI` / `TELEGRAM_BOT_TOKEN_SATIS` env var. Each route passes a `forcedRole` parameter to the dispatcher. This is the cleanest Phase 10 approach and avoids bot token detection complexity.

2. **Should create_order be atomic (transaction)?**
   - What we know: The existing `createOrder` server action uses insert-then-delete-on-failure, not a true DB transaction. The service role client supports `.rpc()` calls.
   - What's unclear: Whether a Supabase RPC transaction is worth the complexity for Phase 10.
   - Recommendation: Mirror the existing pattern (insert order + insert items; on item failure, delete order). True transactions add DB migration complexity and aren't needed for Phase 10 reliability requirements.

3. **How many products can be in a single Telegram order?**
   - What we know: `create_order` tool takes `items: Array<{product_code, quantity}>`. Claude will pass whatever the dealer requested.
   - What's unclear: Token cost for large orders (10+ items) in the multi-turn confirmation flow.
   - Recommendation: Limit `items` array to max 20 items in the tool's `input_schema` (add `maxItems: 20`). Document this limit in the tool description.

---

## Sources

### Primary (HIGH confidence)

- Existing codebase: `src/lib/agents/` — all Phase 9 agent infrastructure
- Existing codebase: `src/lib/actions/orders.ts` — createOrder implementation pattern
- Existing codebase: `src/lib/actions/catalog.ts` — getCatalogProducts + dealer pricing pattern
- Existing codebase: `src/lib/actions/campaigns.ts` — getActiveCampaigns + getCampaignDetail
- Existing codebase: `src/types/database.types.ts` — full table schema for products, orders, order_items, campaigns, faq_items, faq_categories, dealers, dealer_prices
- Existing codebase: `supabase/migrations/010_agent_tables.sql` — agent table definitions
- Phase 9 verification report: `.planning/phases/09-agent-infrastructure-foundation/09-VERIFICATION.md` — confirmed all Phase 9 infrastructure is live

### Secondary (MEDIUM confidence)

- Phase 9 research: `.planning/phases/09-agent-infrastructure-foundation/09-RESEARCH.md` — @anthropic-ai/sdk tool-use patterns, Haiku/Sonnet model assignments

### Tertiary (LOW confidence)

- N/A — all findings verified from primary codebase sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — same packages as Phase 9, verified installed in package.json
- Architecture: HIGH — tool file structure, handler factory pattern, dispatcher update derived directly from existing Phase 9 implementation patterns
- Pitfalls: HIGH — faq_items no company_id verified from database.types.ts; order creation pattern verified from orders.ts; handler/registry sync pitfall derived from AgentRunner source
- Tool implementations: HIGH — all Supabase queries derived from existing server actions with identical table structure

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (stable stack — no fast-moving dependencies)
