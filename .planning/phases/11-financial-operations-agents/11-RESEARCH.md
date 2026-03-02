# Phase 11: Financial and Operations Agents - Research

**Researched:** 2026-03-02
**Domain:** Claude tool-use agent implementations — financial queries (Muhasebeci), warehouse/inventory operations (Depo Sorumlusu), and cross-domain executive analysis (Genel Mudur Danismani)
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MH-01 | Muhasebeci cari hesap bilgisi sorgular (get_financials tool) | Direct Supabase query: `dealer_transactions` JOIN `transaction_types` scoped by `dealer_id`; use `get_dealer_balance_breakdown` RPC for net balance |
| MH-02 | Muhasebeci odeme gecmisi sorgular (get_payment_history tool) | Query `dealer_transactions` filtered by `transaction_type.code IN ('payment', 'credit_note')` scoped by `dealer_id`; date-range filters optional |
| MH-03 | Muhasebeci fatura bilgisi sorgular (get_invoices tool) | Query `dealer_invoices` scoped by `dealer_id`; return invoice_number, invoice_date, total_amount, file_name; NO signed URL generation (file download is web-only) |
| MH-04 | Muhasebeci bayi bakiyesi sorgular (get_dealer_balance tool) | Call `supabase.rpc('get_dealer_balance_breakdown', { p_dealer_id: context.dealerId })`; returns total_debit, total_credit, net_balance |
| MH-05 | Muhasebeci finansal rapor export eder (export_report tool) | Generate plain-text formatted summary of transactions (NOT CSV — Telegram is text-only); aggregate from dealer_transactions with date range |
| MH-06 | Muhasebeci tool olmadan asla finansal rakam soylemez (hallucination prevention) | System prompt enforcement: KRITIK KURAL — "Hicbir finansal rakam vermeden once mutlaka ilgili araci cagir. Tahmin yapma, veri tabanindan sorgulamadan rakam verme." |
| DS-01 | Depo sorumlusu envanter durumu sorgular (get_inventory_status tool) | Query `products` table scoped by `company_id`; return `stock_quantity`, `low_stock_threshold`, `low_stock` boolean; optionally filter by category |
| DS-02 | Depo sorumlusu bekleyen siparisleri listeler (get_pending_orders tool) | Query `orders` JOIN `order_statuses` WHERE `code IN ('pending', 'confirmed', 'preparing')` scoped by `company_id`; includes order items |
| DS-03 | Depo sorumlusu stok gunceller (update_stock tool — write operation) | UPDATE `products SET stock_quantity = $new_value WHERE id = $product_id AND company_id = $company_id`; requires explicit confirmation prompt before execution |
| DS-04 | Depo sorumlusu yeniden siparis seviyesi kontrol eder (check_reorder_level tool) | Query `products WHERE stock_quantity <= low_stock_threshold AND company_id = $company_id`; returns all products below reorder level |
| DS-05 | Depo sorumlusu sevkiyat bilgisi sorgular (get_shipments tool) | Query `orders` with cargo fields: `vehicle_plate`, `driver_name`, `driver_phone`, `cargo_notes` scoped by `company_id`; filter by order status or date |
| GM-01 | GM danismani tum ajanlarin read-only tool'larini kullanir (cross-domain sorgu) | Include read-only tools from Muhasebeci (get_financials, get_dealer_balance) AND Satis (get_catalog, get_order_status) domains in GM tool set; no write tools |
| GM-02 | GM danismani dashboard ozeti sunar (get_dashboard_summary tool) | Aggregate: active dealer count, total orders (30d), top 5 products, company-level balance; use `get_dealer_performance` RPC + `get_top_products` RPC + custom dealer count query |
| GM-03 | GM danismani rapor export eder (export_report tool) | Same export pattern as Muhasebeci but company-wide scope; use `get_dealer_performance` RPC + `get_sales_report` RPC; format as plain text |
| GM-04 | GM danismani Sonnet 4.6 ile karmasik analiz yapar (complex reasoning) | Already assigned SONNET_MODEL in `AGENT_MODELS['genel_mudur_danismani']` in `types.ts`; no change needed to model assignment |
| GM-05 | GM danismani KPI ve trend analizi sunar | Multi-tool query: get_dashboard_summary + get_financials (for trend data from dealer_spending_summary materialized view) + get_dealer_performance; Claude synthesizes KPI narrative |
</phase_requirements>

---

## Summary

Phase 11 follows the identical structural pattern from Phase 10: create tool definition files for each new agent role, implement handler factories, register them in `TOOL_REGISTRY`, wire the dispatcher's `else-if` chain, create dedicated webhook routes, and seed `agent_definitions`. The entire Phase 9-10 infrastructure (AgentRunner, ConversationManager, TokenBudget, dispatcher, ToolRegistry) remains unchanged.

The critical new complexity in Phase 11 is the **update_stock write operation** (DS-03). Unlike Phase 10 where only `create_order` wrote to the DB, `update_stock` directly mutates a product's stock quantity. This requires a two-turn confirmation pattern: the agent must present the change for dealer approval in one conversation turn before executing the UPDATE in the next. The system prompt (not code logic) enforces this — Claude must ask "X urununu stok miktarini Y olarak guncelleyeyim mi?" and only call `update_stock` after the dealer replies with an affirmative.

The **Genel Mudur Danismani** (GM-01) is the most architecturally interesting requirement: it needs a read-only superset of tools from multiple domains. The cleanest implementation is a **composite tool set** — the GM tool file imports and re-exports tool definitions from both `muhasebeci-tools.ts` and `satis-tools.ts` (read-only subset only), supplemented by its own GM-specific tools (`get_dashboard_summary`, `export_report`). This does NOT require cross-agent calls — the GM agent directly executes all tools using the same direct-DB-query pattern. The `agent-bridge.ts` cross-agent calling mechanism is NOT needed for Phase 11.

The **Muhasebeci** maps precisely onto existing DB tables: `dealer_transactions`, `transaction_types`, `dealer_invoices`, and the `get_dealer_balance_breakdown` RPC. All data access patterns exist in `src/lib/actions/financials.ts` and only need to be adapted for service role client + AgentContext. The success criterion for MH-06 (hallucination prevention) is enforced purely at the system prompt level — Claude must not state any financial number without having called a tool first.

**Primary recommendation:** Three tool files (`muhasebeci-tools.ts`, `depo-sorumlusu-tools.ts`, `genel-mudur-tools.ts`), three webhook routes, one dispatcher update (extending the role switch), one TOOL_REGISTRY update, and one SQL seed file. No new migrations required — all necessary tables already exist.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | ^0.78.0 | Tool definitions (`Tool` type) + handler pattern | Same as Phase 10; already installed |
| `@supabase/supabase-js` | ^2.91.1 | All DB queries inside tool handlers | Same as Phase 10; service role client is mandatory |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | (project default) | Strong typing for tool inputs and handler return types | Always — use explicit interfaces for complex return shapes |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct Supabase queries in handlers | `supabase.rpc()` for RPCs | RPCs are preferred for balance calculations (get_dealer_balance_breakdown) because they encapsulate the debit/credit logic in SQL — less risk of arithmetic errors in TypeScript |
| Plain-text export in Muhasebeci | CSV stringify (csv-stringify/sync) | Telegram is a text-only channel — CSV files cannot be sent via sendMessage. Format as a human-readable text table instead. |
| Composite GM tool set (import + re-export) | Cross-agent calls via AgentBridge | Direct DB queries are faster, cheaper, and simpler. AgentBridge cross-agent calling is Phase 9 infrastructure but NOT needed for Phase 11 — the GM agent can call all tools directly. |

**Installation:** No new packages required. All dependencies from Phases 9-10 are sufficient.

---

## Architecture Patterns

### Recommended Project Structure

```
src/lib/agents/
├── tools/
│   ├── index.ts                     # (existing) placeholder tools — unchanged
│   ├── egitimci-tools.ts            # (existing, Phase 10)
│   ├── satis-tools.ts               # (existing, Phase 10)
│   ├── muhasebeci-tools.ts          # NEW: 5 financial tools + handler factory
│   ├── depo-sorumlusu-tools.ts      # NEW: 5 warehouse tools (1 write) + handler factory
│   └── genel-mudur-tools.ts         # NEW: 5 GM tools (cross-domain read-only superset) + handler factory
├── tool-registry.ts                 # UPDATE: muhasebeci, depo_sorumlusu, genel_mudur_danismani entries
├── dispatcher.ts                    # UPDATE: extend role switch for 3 new roles
├── agent-runner.ts                  # No change
├── conversation-manager.ts          # No change
├── agent-bridge.ts                  # No change (NOT used in Phase 11)
├── token-budget.ts                  # No change
└── types.ts                         # No change (roles already defined)

src/app/api/telegram/
├── egitimci/route.ts                # (existing, Phase 10)
├── satis/route.ts                   # (existing, Phase 10)
├── muhasebeci/route.ts              # NEW: dedicated webhook for Muhasebeci bot
├── depo-sorumlusu/route.ts          # NEW: dedicated webhook for Depo Sorumlusu bot
└── genel-mudur/route.ts             # NEW: dedicated webhook for Genel Mudur bot
```

### Pattern 1: Muhasebeci Tool File Structure

**What:** Muhasebeci has 5 tools: `get_financials`, `get_payment_history`, `get_invoices`, `get_dealer_balance`, `export_report`. All are read-only (SELECT / RPC). No write operations.

**When to use:** All financial data queries from dealer's perspective.

**Example — get_dealer_balance handler:**
```typescript
// src/lib/agents/tools/muhasebeci-tools.ts
handlers.set('get_dealer_balance', async (_input, context) => {
  const { data, error } = await (supabase as any)
    .rpc('get_dealer_balance_breakdown', { p_dealer_id: context.dealerId })
    .single()

  if (error || !data) {
    return '[Hata: Bakiye hesaplanamadi]'
  }

  const result = data as { total_debit: number; total_credit: number; net_balance: number }

  return JSON.stringify({
    total_debit: result.total_debit ?? 0,
    total_credit: result.total_credit ?? 0,
    net_balance: result.net_balance ?? 0,
    interpretation: result.net_balance > 0
      ? 'Borc (dealer owes)'
      : result.net_balance < 0
      ? 'Alacak (dealer has credit)'
      : 'Esit (no balance)',
  })
})
```

**Example — get_financials handler (transactions):**
```typescript
handlers.set('get_financials', async (input, context) => {
  const limit = typeof input.limit === 'number' ? Math.min(input.limit, 20) : 10
  const startDate = input.start_date ? String(input.start_date) : null
  const endDate = input.end_date ? String(input.end_date) : null

  let query = supabase
    .from('dealer_transactions')
    .select(`
      amount,
      description,
      reference_number,
      transaction_date,
      due_date,
      transaction_type:transaction_types(code, name, balance_effect)
    `)
    .eq('dealer_id', context.dealerId)
    .order('transaction_date', { ascending: false })
    .limit(limit)

  if (startDate) query = query.gte('transaction_date', startDate)
  if (endDate) query = query.lte('transaction_date', endDate)

  const { data, error } = await query

  if (error) return `[Hata: ${error.message}]`
  if (!data || data.length === 0) return '[Kayit bulunamadi]'

  return JSON.stringify(data)
})
```

**Example — export_report handler (plain text, Telegram-compatible):**
```typescript
handlers.set('export_report', async (input, context) => {
  const startDate = input.start_date ? String(input.start_date) : null
  const endDate = input.end_date ? String(input.end_date) : null

  // Fetch balance
  const { data: balanceData } = await (supabase as any)
    .rpc('get_dealer_balance_breakdown', { p_dealer_id: context.dealerId })
    .single()

  // Fetch recent transactions
  let txQuery = supabase
    .from('dealer_transactions')
    .select('amount, description, transaction_date, transaction_type:transaction_types(name, balance_effect)')
    .eq('dealer_id', context.dealerId)
    .order('transaction_date', { ascending: false })
    .limit(20)

  if (startDate) txQuery = txQuery.gte('transaction_date', startDate)
  if (endDate) txQuery = txQuery.lte('transaction_date', endDate)

  const { data: transactions } = await txQuery

  // Format as plain text (Telegram-safe)
  const balance = balanceData as { total_debit: number; total_credit: number; net_balance: number } | null
  const lines: string[] = [
    '=== FINANSAL RAPOR ===',
    `Donem: ${startDate ?? 'Baslangic'} - ${endDate ?? 'Bugun'}`,
    '',
    `Toplam Borc: ${balance?.total_debit?.toFixed(2) ?? '0.00'} TL`,
    `Toplam Odeme: ${balance?.total_credit?.toFixed(2) ?? '0.00'} TL`,
    `Net Bakiye: ${balance?.net_balance?.toFixed(2) ?? '0.00'} TL`,
    '',
    '--- SON ISLEMLER ---',
  ]

  for (const tx of (transactions ?? [])) {
    const txAny = tx as any
    const effect = txAny?.transaction_type?.balance_effect === 'debit' ? 'Borc' : 'Odeme'
    lines.push(`${txAny.transaction_date} | ${effect} | ${Number(txAny.amount).toFixed(2)} TL | ${txAny.description}`)
  }

  return lines.join('\n')
})
```

### Pattern 2: Depo Sorumlusu — update_stock Write Operation with Confirmation

**What:** `update_stock` is the only write tool in Phase 11 outside of Muhasebeci. It directly UPDATEs `products.stock_quantity`. The two-turn confirmation is enforced at the system prompt level, NOT in code.

**When to use:** Whenever stock quantity must be changed.

**Critical detail:** The tool's `description` must tell Claude to always confirm with the dealer BEFORE calling it. The handler itself has no confirmation logic — it executes immediately when called.

**Example — update_stock tool definition:**
```typescript
export const updateStockTool: Tool = {
  name: 'update_stock',
  description: 'Urun stok miktarini gunceller. BU ARACI CAGIRMADAN ONCE bayiye guncelleme detaylarini goster ve onay al. Onay alinmadan bu araci cagirma.',
  input_schema: {
    type: 'object' as const,
    properties: {
      product_code: {
        type: 'string',
        description: 'Guncellenecek urunun kodu',
      },
      new_stock_quantity: {
        type: 'number',
        description: 'Yeni stok miktari (negatif olamaz)',
      },
    },
    required: ['product_code', 'new_stock_quantity'],
  },
}
```

**Example — update_stock handler:**
```typescript
handlers.set('update_stock', async (input, context) => {
  const productCode = input.product_code ? String(input.product_code).trim() : ''
  const newQuantity = typeof input.new_stock_quantity === 'number' ? input.new_stock_quantity : -1

  if (!productCode) return '[Hata: Urun kodu bos olamaz]'
  if (newQuantity < 0) return '[Hata: Stok miktari negatif olamaz]'

  // Find product by code, scoped to company
  const { data: product, error: findError } = await supabase
    .from('products')
    .select('id, name, stock_quantity')
    .eq('code', productCode)
    .eq('company_id', context.companyId)
    .eq('is_active', true)
    .single()

  if (findError || !product) {
    return `[Hata: Urun bulunamadi: ${productCode}]`
  }

  // Execute the update
  const { error: updateError } = await (supabase as any)
    .from('products')
    .update({ stock_quantity: newQuantity, updated_at: new Date().toISOString() })
    .eq('id', (product as any).id)
    .eq('company_id', context.companyId) // Double-scope for safety

  if (updateError) {
    return `[Hata: Stok guncellenemedi: ${updateError.message}]`
  }

  return JSON.stringify({
    success: true,
    product_code: productCode,
    product_name: (product as any).name,
    previous_quantity: (product as any).stock_quantity,
    new_quantity: newQuantity,
  })
})
```

### Pattern 3: Genel Mudur Danismani — Composite Tool Set (Cross-Domain, Read-Only)

**What:** The GM agent's tool array is composed by importing read-only tool definitions from other tool files and adding GM-specific tools. The handler factory merges handler maps from all source factories.

**When to use:** Any agent that needs cross-domain read access without write capabilities.

**Example — genel-mudur-tools.ts structure:**
```typescript
import { getFinancialsTool, getPaymentHistoryTool, getDealerBalanceTool } from './muhasebeci-tools'
import { getCatalogTool, getOrderStatusTool, getCampaignsTool, checkStockTool } from './satis-tools'
import { createMuhasebeciHandlers } from './muhasebeci-tools'
import { createSatisHandlers } from './satis-tools'

// GM-specific tools
export const getDashboardSummaryTool: Tool = { name: 'get_dashboard_summary', ... }
export const exportReportTool: Tool = { name: 'export_report', ... }  // Company-wide scope

// Composite tool array: GM gets read-only financial + read-only sales + GM-specific tools
export const genelMudurTools: Tool[] = [
  // From Muhasebeci (read-only):
  getFinancialsTool,
  getDealerBalanceTool,
  // From Satis (read-only — no create_order):
  getCatalogTool,
  getOrderStatusTool,
  getCampaignsTool,
  checkStockTool,
  // GM-specific:
  getDashboardSummaryTool,
  exportReportTool,
]

export function createGenelMudurHandlers(supabase: SupabaseClient<Database>): Map<string, HandlerFn> {
  const muhasebeciHandlers = createMuhasebeciHandlers(supabase)
  const satisHandlers = createSatisHandlers(supabase)

  const handlers = new Map<string, HandlerFn>()

  // Merge muhasebeci read-only handlers
  for (const [name, fn] of muhasebeciHandlers) {
    if (['get_financials', 'get_dealer_balance'].includes(name)) {
      handlers.set(name, fn)
    }
  }

  // Merge satis read-only handlers (no create_order)
  for (const [name, fn] of satisHandlers) {
    if (['get_catalog', 'get_order_status', 'get_campaigns', 'check_stock'].includes(name)) {
      handlers.set(name, fn)
    }
  }

  // Add GM-specific handlers
  handlers.set('get_dashboard_summary', createGetDashboardSummaryHandler(supabase))
  handlers.set('export_report', createGMExportReportHandler(supabase))

  return handlers
}
```

**Example — get_dashboard_summary handler:**
```typescript
// Uses existing RPCs: get_dealer_performance, get_top_products, get_dealer_balance_breakdown
async function createGetDashboardSummaryHandler(supabase: SupabaseClient<Database>): HandlerFn {
  return async (_input, context) => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(now.getDate() - 30)
    const startDate = thirtyDaysAgo.toISOString().split('T')[0]
    const endDate = now.toISOString().split('T')[0]

    // Parallel: active dealer count + top products + dealer performance
    const [dealerCountResult, topProductsResult, dealerPerfResult] = await Promise.all([
      supabase
        .from('dealers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', context.companyId)
        .eq('is_active', true),
      (supabase as any).rpc('get_top_products', { start_date: startDate, end_date: endDate, limit_count: 5 }),
      (supabase as any).rpc('get_dealer_performance', { start_date: startDate, end_date: endDate }),
    ])

    const activeDeaerCount = dealerCountResult.count ?? 0
    const topProducts = topProductsResult.data ?? []
    const dealerPerf = dealerPerfResult.data ?? []
    const totalRevenue = (dealerPerf as any[]).reduce((sum: number, d: any) => sum + (d.total_sales ?? 0), 0)
    const totalOrders = (dealerPerf as any[]).reduce((sum: number, d: any) => sum + (d.order_count ?? 0), 0)

    return JSON.stringify({
      period: `${startDate} - ${endDate}`,
      active_dealers: activeDeaerCount,
      total_orders_30d: totalOrders,
      total_revenue_30d: totalRevenue,
      top_5_products: topProducts,
      top_3_dealers_by_sales: (dealerPerf as any[]).slice(0, 3).map((d: any) => ({
        company_name: d.company_name,
        total_sales: d.total_sales,
        order_count: d.order_count,
      })),
    })
  }
}
```

### Pattern 4: Cross-Domain Query — GM-01 Success Criterion

**What:** The success criterion "En cok siparis veren bayinin cari bakiyesi ne?" requires the GM to call `get_dashboard_summary` (to find top dealer) AND `get_dealer_balance` (for that dealer's balance). Both tools are in the GM tool set.

**Critical design decision:** `get_dealer_balance` in the Muhasebeci context uses `context.dealerId` (the requesting dealer). In the GM context, the GM must be able to query ANY dealer's balance (not just the requesting dealer's). This means the GM version of `get_dealer_balance` needs a `dealer_id` input parameter, not just `context.dealerId`.

**Solution:** The GM tool set has a separate `get_any_dealer_balance` tool (or a `get_dealer_balance` tool with an optional `dealer_id` parameter). This is distinct from the Muhasebeci version which always scopes to `context.dealerId`.

```typescript
// GM-specific version of balance lookup — accepts any dealer_id (within company)
export const getAnyDealerBalanceTool: Tool = {
  name: 'get_any_dealer_balance',
  description: 'Belirtilen bayinin cari bakiyesini getirir. Bayi ID veya bayi adi ile sorgulama yapilabilir.',
  input_schema: {
    type: 'object' as const,
    properties: {
      dealer_id: {
        type: 'string',
        description: 'Bakiyesi sorgulanacak bayinin UUID kimlik numarasi',
      },
    },
    required: ['dealer_id'],
  },
}

// Handler enforces company_id scope
handlers.set('get_any_dealer_balance', async (input, context) => {
  const targetDealerId = input.dealer_id ? String(input.dealer_id) : ''
  if (!targetDealerId) return '[Hata: dealer_id gerekli]'

  // Verify dealer belongs to same company
  const { data: dealerCheck } = await supabase
    .from('dealers')
    .select('id')
    .eq('id', targetDealerId)
    .eq('company_id', context.companyId) // Tenant isolation enforced
    .single()

  if (!dealerCheck) {
    return `[Hata: Bu sirketde ${targetDealerId} ID'li bayi bulunamadi]`
  }

  const { data, error } = await (supabase as any)
    .rpc('get_dealer_balance_breakdown', { p_dealer_id: targetDealerId })
    .single()

  if (error || !data) return '[Hata: Bakiye hesaplanamadi]'

  return JSON.stringify(data)
})
```

### Pattern 5: get_shipments — Using Existing Cargo Fields

**What:** The `orders` table already has `vehicle_plate`, `driver_name`, `driver_phone`, `cargo_notes` columns (added in migration 007). The `get_shipments` tool queries orders with these fields populated.

```typescript
handlers.set('get_shipments', async (input, context) => {
  const statusCode = input.status ? String(input.status) : null
  const limit = typeof input.limit === 'number' ? input.limit : 10

  let query = supabase
    .from('orders')
    .select(`
      order_number,
      vehicle_plate,
      driver_name,
      driver_phone,
      cargo_notes,
      created_at,
      status:order_statuses(name, code)
    `)
    .eq('company_id', context.companyId)
    .eq('dealer_id', context.dealerId) // Depo shows only this dealer's shipments
    .not('vehicle_plate', 'is', null) // Only orders with shipping info
    .order('created_at', { ascending: false })
    .limit(limit)

  if (statusCode) {
    const { data: statusRow } = await supabase
      .from('order_statuses')
      .select('id')
      .eq('code', statusCode)
      .single()
    if (statusRow) {
      query = query.eq('status_id', (statusRow as any).id)
    }
  }

  const { data, error } = await query
  if (error) return `[Hata: Sevkiyat bilgisi alinamadi: ${error.message}]`
  if (!data || data.length === 0) return '[Sevkiyat kaydı bulunamadı]'

  return JSON.stringify(data)
})
```

### Pattern 6: Webhook Route — Identical to Phase 10 Pattern

New routes follow the exact same template as Phase 10:

```typescript
// src/app/api/telegram/muhasebeci/route.ts
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
    console.error('[telegram/muhasebeci] idempotency insert error:', idempotencyError)
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN_MUHASEBECI || ''

  after(async () => {
    try {
      await dispatchAgentUpdate(update, 'muhasebeci', botToken)
    } catch (err) {
      console.error('[telegram/muhasebeci] dispatch error:', err)
    }
  })

  return new Response('OK', { status: 200 })
}
```

Three routes needed: `/api/telegram/muhasebeci/route.ts`, `/api/telegram/depo-sorumlusu/route.ts`, `/api/telegram/genel-mudur/route.ts`.

### Pattern 7: Dispatcher Extension

The dispatcher's role switch extends with 3 new `else if` branches:

```typescript
// In dispatcher.ts — extend the existing role switch
if (role === 'egitimci') {
  toolHandlers = createEgitimciHandlers(supabase)
} else if (role === 'satis_temsilcisi') {
  toolHandlers = createSatisHandlers(supabase)
} else if (role === 'muhasebeci') {                     // NEW
  toolHandlers = createMuhasebeciHandlers(supabase)
} else if (role === 'depo_sorumlusu') {                 // NEW
  toolHandlers = createDepoSorumlusuHandlers(supabase)
} else if (role === 'genel_mudur_danismani') {           // NEW
  toolHandlers = createGenelMudurHandlers(supabase)
} else {
  // Fallback placeholder handlers for unimplemented roles
  toolHandlers = new Map([...])
}
```

### Pattern 8: agent_definitions SQL Seed

```sql
INSERT INTO agent_definitions (company_id, role, name, model, system_prompt, is_active)
VALUES
  (
    '<company_uuid>',
    'muhasebeci',
    'Muhasebeci',
    'claude-sonnet-4-6',
    'Sen bir bayi muhasebe asistanisin...',
    true
  ),
  (
    '<company_uuid>',
    'depo_sorumlusu',
    'Depo Sorumlusu',
    'claude-haiku-4-5',
    'Sen bir depo sorumlususun...',
    true
  ),
  (
    '<company_uuid>',
    'genel_mudur_danismani',
    'Genel Mudur Danismani',
    'claude-sonnet-4-6',
    'Sen bir genel mudur danismanisin...',
    true
  )
ON CONFLICT (company_id, role) DO UPDATE SET
  system_prompt = EXCLUDED.system_prompt,
  model = EXCLUDED.model,
  is_active = EXCLUDED.is_active;
```

### Anti-Patterns to Avoid

- **Calling create_order from GM tool set:** GM-01 says "read-only tools." Never include `create_order` or `update_stock` in the GM tool array. Use a whitelist, not a blacklist, when composing the GM tool set.
- **Using context.dealerId for GM balance queries:** The GM must query any dealer's balance. The Muhasebeci version of `get_dealer_balance` uses `context.dealerId` (always the requesting dealer). Create a separate `get_any_dealer_balance` tool for GM that accepts an explicit `dealer_id` parameter.
- **Generating signed URLs for invoices in Telegram:** `getInvoiceDownloadUrl` from `financials.ts` generates time-limited signed URLs. These URLs cannot be meaningfully used in Telegram (no PDF viewer). The `get_invoices` tool should only return invoice metadata (number, date, amount, filename) — not download URLs.
- **update_stock with no company_id double-scope:** Always include `.eq('company_id', context.companyId)` on the UPDATE statement, not just on the product lookup. Defense in depth prevents a rogue dealer_id from mutating another company's stock.
- **Muhasebeci dealer_transactions has no company_id column:** The `dealer_transactions` table (from migration 006) uses `dealer_id` for scoping, not `company_id`. The dealer is already company-scoped by virtue of the `dealers.company_id` FK. When querying `dealer_transactions`, scope by `dealer_id` (from `context.dealerId`), not `company_id` directly on the transactions table.
- **get_top_products RPC does not accept company_id:** The `get_top_products` RPC (from migration 003) does NOT filter by `company_id`. In Phase 8 (single-tenant) this was acceptable. In multi-tenant, the GM's `get_dashboard_summary` handler must either use a company-scoped alternative query or filter the RPC results to the company's dealers post-query. Safest: avoid the global `get_top_products` RPC, query `order_items JOIN orders JOIN products` with `.eq('orders.company_id', context.companyId)` directly.
- **get_dealer_performance RPC does not accept company_id:** Same issue as get_top_products. The GM handler for `get_dashboard_summary` should use direct Supabase queries instead of these single-tenant RPCs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dealer balance calculation | Custom debit/credit summation in TypeScript | `supabase.rpc('get_dealer_balance_breakdown', { p_dealer_id })` | Already exists in migration 006; handles edge cases (NULL values, empty history) correctly |
| Monthly spending aggregates | Custom GROUP BY in handler | Query `dealer_spending_summary` materialized view | Already built in migration 007; significantly faster than on-the-fly aggregation |
| Financial report formatting | CSV library (csv-stringify) | Plain-text string formatting with newlines | Telegram sendMessage only accepts text. CSV bytes cannot be sent via the Bot API without file upload support (not wired). |
| Order number generation | Custom counter | `supabase.rpc('generate_order_number')` | Already exists from Phase 10; applies to Depo Sorumlusu `get_pending_orders` indirectly |
| Top products aggregation | Custom ORDER BY SUM | Query order_items with joins and manual aggregation | Simpler than RPC for company-scoped results; avoids the single-tenant RPC problem |

**Key insight:** The financial RPCs (`get_dealer_balance_breakdown`, `get_dealer_balance`) are single-dealer-scoped and safe to use from agent handlers. The reporting RPCs (`get_top_products`, `get_dealer_performance`, `get_sales_report`) are platform-wide (no company_id) and MUST NOT be used in multi-tenant GM handlers — write direct queries instead.

---

## Common Pitfalls

### Pitfall 1: dealer_transactions Has No company_id — Use dealer_id Scope
**What goes wrong:** Developer tries `.eq('company_id', context.companyId)` on `dealer_transactions` and gets a TypeScript type error — the column doesn't exist on that table.
**Why it happens:** Migration 006 was written before the multi-tenant migration (009). `dealer_transactions` is scoped via `dealer_id` → `dealers.company_id` relationship.
**How to avoid:** Scope `dealer_transactions` queries by `dealer_id = context.dealerId`. The dealer is already company-isolated. No company_id filter is needed or available.
**Warning signs:** TypeScript error "Property 'company_id' does not exist on type..." when building dealer_transactions query.

### Pitfall 2: Reporting RPCs Are Not company_id-Scoped
**What goes wrong:** GM's `get_dashboard_summary` calls `get_top_products` RPC, which returns products across ALL companies — revealing competitor data.
**Why it happens:** Migration 003 RPCs (`get_top_products`, `get_dealer_performance`, `get_sales_report`) were built for a single-tenant context and have no `company_id` parameter.
**How to avoid:** In GM handlers, write direct Supabase queries with `.eq('company_id', context.companyId)` instead of using these RPCs. For the dealer_performance equivalent, query `orders JOIN dealers WHERE dealers.company_id = context.companyId`.
**Warning signs:** Dashboard summary showing products or dealers from other companies.

### Pitfall 3: MH-06 Hallucination Prevention Depends on System Prompt, Not Code
**What goes wrong:** The Muhasebeci agent states a financial number without calling a tool ("Bakiyeniz yaklasik 5,000 TL civarinda olabilir").
**Why it happens:** Without a strong system prompt instruction, Claude may attempt to answer from conversation history or general knowledge.
**How to avoid:** The Muhasebeci system prompt must include an explicit critical rule: "KRITIK KURAL: Hicbir finansal rakam (bakiye, borc, alacak, fatura tutari) vermeden once mutlaka ilgili araci cagir. 'Yaklasik', 'tahminim', veya 'gecmiste gordugum' gibi ifadeler kullanma. Her zaman arac cagrisini yap, sonucu aldiktan sonra yanit ver."
**Warning signs:** Agent provides numbers without the tool-use pattern appearing in conversation logs.

### Pitfall 4: update_stock Requires Admin-Level Access
**What goes wrong:** Dealers updating stock is unusual (usually admins do this). The DS-03 requirement states "dealer approval" for the confirmation, but the system prompt should clarify WHO the Depo Sorumlusu serves.
**Why it happens:** The phase requirements don't specify if Depo Sorumlusu is a dealer-facing or admin-facing agent. The success criterion says "shows a confirmation prompt and only updates the database after explicit dealer approval."
**How to avoid:** Based on the success criterion, Depo Sorumlusu IS dealer-facing. The dealer is the one managing their own warehouse stock. The system prompt should clarify this. The `update_stock` handler uses `context.dealerId` to find the product, but NOTE: `products.company_id` is the company's scope, not dealer's. The Depo Sorumlusu must have company_id scope for stock updates (it's managing company inventory, not per-dealer inventory). The agent runs with the dealer's `companyId` from `AgentContext`, which is correct.
**Warning signs:** update_stock fails if the handler tries to scope by `dealer_id` on products (products don't have dealer_id — they belong to the company).

### Pitfall 5: Telegram Bot Token Environment Variable Naming
**What goes wrong:** New webhook routes reference env vars that aren't set in Vercel.
**Why it happens:** Each new bot needs a distinct env var. Easy to forget in the Vercel dashboard.
**How to avoid:** For each new route, define:
- `TELEGRAM_BOT_TOKEN_MUHASEBECI`
- `TELEGRAM_BOT_TOKEN_DEPO_SORUMLUSU`
- `TELEGRAM_BOT_TOKEN_GENEL_MUDUR`
Document these in the SQL seed file comment block so they're discoverable.
**Warning signs:** Bot receives messages but replies never arrive (empty token → sendTelegramMessage logs "No bot token provided").

### Pitfall 6: GM Tool Name Conflicts When Merging Handler Maps
**What goes wrong:** GM imports `get_dealer_balance` from Muhasebeci (scoped to context.dealerId) but also needs `get_any_dealer_balance` for cross-dealer queries. If both are named `get_dealer_balance`, one overwrites the other in the Map.
**Why it happens:** Tool names in the handler Map are keyed by string; merging from two sources without renaming causes silent overwrites.
**How to avoid:** Give the GM-specific multi-dealer variant a distinct name: `get_any_dealer_balance`. The GM tool array should NOT include the Muhasebeci's `get_dealer_balance` (which uses context.dealerId implicitly) — replace it with `get_any_dealer_balance` that accepts explicit `dealer_id`.
**Warning signs:** GM's dealer balance query always returns the current dealer's balance, not the specified dealer's.

### Pitfall 7: get_pending_orders for Depo vs. Dealer Scope
**What goes wrong:** The Depo Sorumlusu's `get_pending_orders` returns only the current dealer's orders, but logically a warehouse manager might need to see all company pending orders (to plan warehouse operations).
**Why it happens:** The AgentContext only contains the requesting dealer's ID. The Depo Sorumlusu bot is accessed by a dealer, so it defaults to dealer-scoped queries.
**How to avoid:** Based on the success criterion (dealer asks for stock update), the Depo Sorumlusu IS dealer-facing. The `get_pending_orders` tool should return orders for the requesting dealer's company (all orders at this company, not just this dealer's) — since warehouse operations are company-wide. Use `.eq('company_id', context.companyId)` WITHOUT a `dealer_id` filter for `get_pending_orders`.
**Warning signs:** A dealer asking "sirketin bekleyen siparisleri neler?" gets only their own orders, not all company orders.

---

## Code Examples

Verified patterns from existing codebase:

### Existing: get_dealer_balance_breakdown RPC Usage

```typescript
// Source: src/lib/actions/financials.ts lines 92-108
const { data, error } = await (supabase as any)
  .rpc('get_dealer_balance_breakdown', { p_dealer_id: dealerId })
  .single()

const result = data as { total_debit: number; total_credit: number; net_balance: number }
// net_balance > 0 means dealer owes (borc); < 0 means dealer has credit (alacak)
```

### Existing: dealer_transactions Query with Type and Date Filters

```typescript
// Source: src/lib/actions/financials.ts lines 162-196
let query = supabase
  .from('dealer_transactions')
  .select(`
    id, amount, description, reference_number,
    transaction_date, due_date, notes, created_at,
    transaction_type:transaction_types(code, name, balance_effect),
    order:orders(id, order_number)
  `, { count: 'exact' })
  .eq('dealer_id', dealerId) // Note: dealer_id scope, NOT company_id
  .order('transaction_date', { ascending: false })
  .range(offset, offset + pageSize - 1)

if (filters.startDate) query = query.gte('transaction_date', filters.startDate)
if (filters.endDate) query = query.lte('transaction_date', filters.endDate)
```

### Existing: dealer_invoices Query

```typescript
// Source: src/lib/actions/financials.ts lines 263-281
const { data } = await supabase
  .from('dealer_invoices')
  .select('id, invoice_number, invoice_date, total_amount, file_name, created_at, transaction_id')
  .eq('dealer_id', dealerId)
  .order('invoice_date', { ascending: false })
```

### Existing: orders Table with Cargo Fields (for get_shipments)

```typescript
// Source: supabase/migrations/007_dashboard_campaigns.sql lines 83-86
// These columns exist on orders after migration 007:
// vehicle_plate TEXT
// driver_name TEXT
// driver_phone TEXT
// cargo_notes TEXT

// Query pattern:
const { data } = await supabase
  .from('orders')
  .select('order_number, vehicle_plate, driver_name, driver_phone, cargo_notes, created_at, status:order_statuses(name, code)')
  .eq('company_id', context.companyId) // Orders DO have company_id (added in migration 009)
  .not('vehicle_plate', 'is', null)
  .order('created_at', { ascending: false })
  .limit(10)
```

### Existing: products Update Pattern (for update_stock)

```typescript
// Inferred from existing schema — products table has stock_quantity INT and updated_at TIMESTAMPTZ
const { error } = await (supabase as any)
  .from('products')
  .update({ stock_quantity: newQuantity, updated_at: new Date().toISOString() })
  .eq('id', productId)
  .eq('company_id', context.companyId) // products DO have company_id (migration 009)
```

### Existing: Pending Orders Query Pattern

```typescript
// Source: src/lib/queries/dashboard.ts lines 224-248
const { data: statuses } = await supabase
  .from('order_statuses')
  .select('id')
  .in('code', ['pending', 'confirmed', 'preparing'])

const statusIds = statuses.map((s: any) => s.id)

const { data: orders } = await supabase
  .from('orders')
  .select('order_number, total_amount, created_at, status:order_statuses(name, code), items:order_items(product_name, quantity)')
  .eq('company_id', context.companyId)  // For Depo: company-wide, not dealer-scoped
  .in('status_id', statusIds)
  .order('created_at', { ascending: false })
```

### Existing: Dispatcher Role Switch (to be extended)

```typescript
// Source: src/lib/agents/dispatcher.ts lines 203-225
if (role === 'egitimci') {
  toolHandlers = createEgitimciHandlers(supabase)
} else if (role === 'satis_temsilcisi') {
  toolHandlers = createSatisHandlers(supabase)
} else {
  // Extend with 3 new else-if branches before this fallback
  toolHandlers = new Map([...placeholder handlers...])
}
```

### Existing: TOOL_REGISTRY to be Updated

```typescript
// Source: src/lib/agents/tool-registry.ts lines 20-33
export const TOOL_REGISTRY: Record<AgentRole, Tool[]> = {
  egitimci: egitimciTools,
  satis_temsilcisi: satisTools,
  muhasebeci: placeholderTools,           // UPDATE → muhasebeciTools
  depo_sorumlusu: placeholderTools,       // UPDATE → depoSorumlusuTools
  destek: placeholderTools,
  genel_mudur_danismani: placeholderTools, // UPDATE → genelMudurTools
  ...
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All unimplemented roles use placeholder tools | Phase 11 adds 3 more real role implementations | Phase 11 | muhasebeci, depo_sorumlusu, genel_mudur_danismani exit placeholder state |
| get_dashboard_summary not available via agent | GM agent can call get_dashboard_summary tool | Phase 11 | Executive can get KPIs via Telegram |
| No write operations except create_order | update_stock adds second write operation | Phase 11 | Warehouse stock management enabled via Telegram |
| Cross-domain data access required AgentBridge | GM agent uses composite tool set with direct DB queries | Phase 11 | Simpler, faster, cheaper than agent-to-agent calls |

**Deprecated/outdated in Phase 11:**
- Phase 9 placeholder entries for `muhasebeci`, `depo_sorumlusu`, `genel_mudur_danismani` in TOOL_REGISTRY: replaced with real tool arrays.
- Placeholder handler map fallback in dispatcher.ts for these 3 roles: replaced with factory function calls.

---

## Open Questions

1. **Depo Sorumlusu audience: dealer-facing or admin-facing?**
   - What we know: Phase success criterion SC-2 says "A dealer asks the Depo Sorumlusu bot for stock update" — explicitly dealer-facing.
   - What's unclear: Should `get_pending_orders` show only this dealer's orders or all company orders? Warehouse managers typically need company-wide visibility.
   - Recommendation: Use company-wide scope (`.eq('company_id', context.companyId)` without dealer_id filter) for `get_pending_orders` and `check_reorder_level` — these are operational queries. Use dealer scope for `get_shipments` — a dealer only cares about their own shipments.

2. **export_report for Muhasebeci — what date range by default?**
   - What we know: MH-05 says "export_report tool." The tool needs a date range parameter.
   - What's unclear: What should the default range be when the dealer doesn't specify?
   - Recommendation: Default to current month (first day of current month to today). Make `start_date` and `end_date` optional parameters with this default.

3. **GM agent — should it operate in admin mode or dealer mode?**
   - What we know: The GM success criterion refers to "cross-domain questions" and "KPI summary with trend analysis." This implies company-wide admin visibility.
   - What's unclear: What telegram_chat_id maps to the GM bot? Admins, not dealers, should have access.
   - Recommendation: The GM bot should only respond to admins. The dispatcher's dealer lookup (`dealers WHERE telegram_chat_id = chatId`) will fail for admin users because admins don't have dealer records. A new lookup path is needed: check `users WHERE telegram_chat_id = chatId AND role = 'admin'`. This requires either (a) adding `telegram_chat_id` to the `users` table, or (b) creating an `admin_telegram_accounts` table. This is a potential DB migration need for Phase 11. MEDIUM confidence — needs validation.

4. **MH-04 vs MH-01 — are these the same tool?**
   - What we know: MH-01 is "get_financials" (transaction listing); MH-04 is "get_dealer_balance" (balance). These are distinct operations with different return shapes.
   - What's unclear: Could a single `get_financials` tool return both balance and transactions?
   - Recommendation: Keep them separate. `get_dealer_balance` returns just the balance numbers (fast RPC call). `get_financials` returns transaction history (paginated). Claude will call `get_dealer_balance` for quick balance queries and `get_financials` for detailed history — matching user intent efficiently.

5. **GM admin Telegram identity resolution — may need a DB migration**
   - What we know: The dispatcher resolves identity via `dealers.telegram_chat_id`. Admins don't have dealer records.
   - What's unclear: Is this required for Phase 11, or can the GM bot be restricted to dealer users who are also "admin dealers" (not typical)?
   - Recommendation: For MVP Phase 11, add `telegram_chat_id BIGINT` to the `users` table, or create a simple `admin_telegram_links (user_id, telegram_chat_id)` table. The dispatcher needs a second lookup path for admin users. This IS a required migration unless the GM bot is dealer-accessible (which seems wrong given executive KPI scope).

---

## Sources

### Primary (HIGH confidence)

- Existing codebase: `src/lib/agents/` — all Phase 9-10 agent infrastructure (verified via Phase 10 VERIFICATION.md)
- Existing codebase: `src/lib/actions/financials.ts` — full dealer transaction + invoice + balance data access patterns
- Existing codebase: `src/lib/queries/dashboard.ts` — SpendingSummary pattern with dealer_spending_summary materialized view
- Existing codebase: `src/lib/agents/tools/egitimci-tools.ts` + `satis-tools.ts` — Phase 10 handler patterns (verified 12/12 truths per VERIFICATION.md)
- Existing codebase: `src/lib/agents/dispatcher.ts` — confirmed forcedRole + botToken pattern; role switch structure
- Existing codebase: `src/lib/agents/tool-registry.ts` — TOOL_REGISTRY with placeholders for Phase 11 roles
- Migration: `supabase/migrations/006_financial_tables.sql` — dealer_transactions, dealer_invoices, get_dealer_balance RPC, get_dealer_balance_breakdown RPC
- Migration: `supabase/migrations/007_dashboard_campaigns.sql` — orders cargo fields, dealer_spending_summary materialized view, get_top_products_for_dealer RPC
- Migration: `supabase/migrations/003_reporting_functions.sql` — get_top_products, get_dealer_performance, get_sales_report RPCs (single-tenant, company_id-unsafe for GM)
- Phase 10 VERIFICATION.md — confirmed all infrastructure wiring patterns

### Secondary (MEDIUM confidence)

- Pattern inference: GM composite tool set (import + re-export + merge handler maps) — derived from Phase 10 handler factory pattern; no direct precedent in codebase but architecturally consistent
- Pattern inference: get_any_dealer_balance as distinct tool from get_dealer_balance — inferred from GM-01 cross-domain requirement; no direct precedent

### Tertiary (LOW confidence)

- Open Question 3 (GM admin telegram identity resolution): inferred from dispatcher code; no current admin telegram linking mechanism exists in codebase; may require migration

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — identical packages to Phase 10; no new dependencies
- Architecture: HIGH — all tool patterns, handler factories, dispatcher extension derived directly from verified Phase 10 implementation; DB tables and RPCs verified in migrations
- Financial domain: HIGH — dealer_transactions, dealer_invoices, balance RPCs fully documented in financials.ts and migrations
- Warehouse domain: HIGH — products table verified, cargo fields verified in migration 007, pending orders pattern verified in dashboard.ts
- GM composite tool set: MEDIUM — architecturally derived, no direct precedent in codebase
- GM admin identity resolution: LOW — open question, potential migration required

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable stack — no fast-moving dependencies)
