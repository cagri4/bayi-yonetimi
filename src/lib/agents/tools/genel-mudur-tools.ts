/**
 * Genel Mudur Danismani (Executive Advisor) agent tool definitions and handler implementations.
 * Phase 11 — Plan 03
 *
 * GM-READ-ONLY ENFORCEMENT: This file exports ONLY read-only tools — no create_order,
 * no update_stock, no INSERT/UPDATE/DELETE operations. The GM is a strategic advisor
 * with cross-domain read access only.
 *
 * GM-04 (Model Assignment): ALREADY SATISFIED by AGENT_MODELS['genel_mudur_danismani'] = SONNET_MODEL
 * in src/lib/agents/types.ts — no code change needed here.
 *
 * GM-05 (KPI + Trend Analysis): Satisfied by get_dashboard_summary tool providing structured
 * data. Claude Sonnet 4.6's reasoning capability synthesizes trend narratives from tool output.
 *
 * Architecture: Composite tool set — imports read-only tool definitions from muhasebeci-tools
 * and satis-tools, merges their handlers from those factories, adds GM-specific tools.
 * This avoids AgentBridge overhead (direct imports are faster and cheaper).
 *
 * Anti-patterns avoided:
 *   - NO get_top_products or get_dealer_performance RPCs (not company_id-scoped, Pitfall 2)
 *   - NO create_order or update_stock in GM tool set
 *   - get_any_dealer_balance uses dealer_id parameter (NOT context.dealerId — that is Muhasebeci)
 *
 * 10 tools total:
 *   - From Muhasebeci (3): get_financials, get_payment_history, get_dealer_balance
 *   - From Satis (4): get_catalog, get_order_status, get_campaigns, check_stock
 *   - GM-specific (3): get_any_dealer_balance, get_dashboard_summary, export_report
 *
 * Exports:
 *   - genelMudurTools: Tool[] — composite array of exactly 10 read-only tool definitions
 *   - createGenelMudurHandlers: factory function returning Map<string, HandlerFn> with 10 entries
 */
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { AgentContext } from '../types'

// Import read-only tool definitions from Muhasebeci (3 tools, no export_report, no get_invoices)
import {
  getFinancialsTool,
  getPaymentHistoryTool,
  getDealerBalanceTool,
  createMuhasebeciHandlers,
} from './muhasebeci-tools'

// Import read-only tool definitions from Satis (4 tools, NOT create_order, NOT get_dealer_profile)
import {
  getCatalogTool,
  getOrderStatusTool,
  getCampaignsTool,
  checkStockTool,
  createSatisHandlers,
} from './satis-tools'

// ─── Handler Type ──────────────────────────────────────────────────────────

type HandlerFn = (input: Record<string, unknown>, context: AgentContext) => Promise<string>

// ─── GM-Specific Tool Definitions ─────────────────────────────────────────

/**
 * get_any_dealer_balance tool (GM-01) — queries balance for ANY dealer by dealer_id.
 * DISTINCT from Muhasebeci's get_dealer_balance which uses context.dealerId.
 * Handler MUST verify the target dealer belongs to the same company before RPC call.
 * Tool name is different from 'get_dealer_balance' to avoid Map key collision (Pitfall 6).
 */
const getAnyDealerBalanceTool: Tool = {
  name: 'get_any_dealer_balance',
  description:
    'Belirtilen bayinin cari bakiyesini getirir. Bayi ID ile sorgulama yapilabilir. ' +
    'Genel Mudur olarak herhangi bir bayinin bakiyesini gorebilirsiniz.',
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

/**
 * get_dashboard_summary tool (GM-02, GM-05) — company-wide KPI dashboard.
 * Returns: active dealer count, orders in last 30d, revenue in last 30d, top 5 products.
 * IMPORTANT: Uses DIRECT Supabase queries (NOT get_top_products or get_dealer_performance
 * RPCs which lack company_id scope — Pitfall 2 in research).
 */
const getDashboardSummaryTool: Tool = {
  name: 'get_dashboard_summary',
  description:
    'Sirketin genel durumu: aktif bayi sayisi, siparis ozeti, en cok satan urunler ve gelir bilgisi. ' +
    'Son 30 gunun verileri gosterilir. KPI analizi icin bu araci cagirin.',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
}

/**
 * export_report tool (GM-03) — company-wide financial and sales report.
 * Queries all dealers scoped by company_id. Returns plain text (Telegram-compatible).
 * Default date range: current month.
 */
const gmExportReportTool: Tool = {
  name: 'export_report',
  description:
    'Sirket geneli finansal ve satis raporu olusturur. Tum bayileri kapsar. ' +
    'Tarih belirtilmezse mevcut ay kullanilir. ' +
    'ONEMLI: Rapor olusturmadan once bu araci cagir. Tahmin yapma.',
  input_schema: {
    type: 'object' as const,
    properties: {
      start_date: {
        type: 'string',
        description: 'Rapor baslangic tarihi (ISO 8601 formati, ornek: 2026-01-01)',
      },
      end_date: {
        type: 'string',
        description: 'Rapor bitis tarihi (ISO 8601 formati, ornek: 2026-01-31)',
      },
    },
    required: [],
  },
}

// ─── Composite Tool Array (WHITELIST — read-only only) ─────────────────────

/**
 * genelMudurTools — composite array of exactly 10 read-only tool definitions.
 * GM-READ-ONLY: create_order and update_stock are NOT included — by design.
 * Muhasebeci tools: 3 (no get_invoices, no export_report — GM has its own export_report)
 * Satis tools: 4 (no create_order, no get_dealer_profile)
 * GM-specific tools: 3
 */
export const genelMudurTools: Tool[] = [
  // From Muhasebeci (read-only financial tools):
  getFinancialsTool,        // cross-domain financial history (MH-01)
  getPaymentHistoryTool,    // cross-domain payment history (MH-02)
  getDealerBalanceTool,     // requesting dealer's own balance (MH-04)
  // From Satis (read-only catalog/order tools — NO create_order):
  getCatalogTool,           // catalog lookup
  getOrderStatusTool,       // order tracking
  getCampaignsTool,         // campaign info
  checkStockTool,           // stock check
  // GM-specific tools:
  getAnyDealerBalanceTool,  // cross-dealer balance lookup (GM-01)
  getDashboardSummaryTool,  // KPI dashboard (GM-02, GM-05)
  gmExportReportTool,       // company-wide export (GM-03)
]

// ─── Internal helper interfaces ────────────────────────────────────────────

interface BalanceResult {
  total_debit: number
  total_credit: number
  net_balance: number
}

interface DealerIdRow {
  id: string
  company_name: string
}

interface OrderItemAgg {
  product_name: string
  quantity: number
}

interface OrderRow {
  id: string
  total_amount: number
}

// ─── GM-Specific Handler Implementations ──────────────────────────────────

/**
 * Handles get_any_dealer_balance tool calls (GM-01).
 * - Verifies the target dealer belongs to context.companyId (security check)
 * - Calls get_dealer_balance_breakdown RPC with the target dealer_id
 * - Returns same breakdown format as Muhasebeci's get_dealer_balance handler
 */
async function handleGetAnyDealerBalance(
  input: Record<string, unknown>,
  context: AgentContext,
  supabase: SupabaseClient<Database>,
): Promise<string> {
  const targetDealerId = typeof input['dealer_id'] === 'string' ? input['dealer_id'].trim() : ''

  if (!targetDealerId) {
    return '[Hata: dealer_id bos olamaz]'
  }

  // Security: verify dealer belongs to same company (tenant isolation)
  const { data: dealerRow, error: dealerError } = await supabase
    .from('dealers')
    .select('id, company_name')
    .eq('id', targetDealerId)
    .eq('company_id', context.companyId)
    .single()

  if (dealerError || !dealerRow) {
    return `[Hata: Bayi bulunamadi veya bu sirkete ait degil: ${targetDealerId}]`
  }

  const dealer = dealerRow as DealerIdRow

  // Call balance RPC with the verified target dealer_id
  const { data, error } = await (supabase as any)
    .rpc('get_dealer_balance_breakdown', { p_dealer_id: targetDealerId })
    .single()

  if (error) {
    return `[Hata: ${error.message}]`
  }
  if (!data) {
    return `[${dealer.company_name} icin bakiye bilgisi bulunamadi]`
  }

  const balance = data as BalanceResult

  let interpretation: string
  if (balance.net_balance > 0) {
    interpretation = 'Borc (bayi borcu)'
  } else if (balance.net_balance < 0) {
    interpretation = 'Alacak (bayi alacagi)'
  } else {
    interpretation = 'Sifir bakiye'
  }

  return JSON.stringify({
    dealer_id: targetDealerId,
    dealer_name: dealer.company_name,
    total_debit: balance.total_debit,
    total_credit: balance.total_credit,
    net_balance: balance.net_balance,
    interpretation,
  })
}

/**
 * Handles get_dashboard_summary tool calls (GM-02, GM-05).
 * - Uses DIRECT Supabase queries (NOT get_top_products or get_dealer_performance RPCs)
 * - These RPCs are excluded because they lack company_id scope (Pitfall 2 in research)
 * - Runs parallel queries for active dealer count, orders, top products, revenue
 * - Date range: last 30 days
 */
async function handleGetDashboardSummary(
  input: Record<string, unknown>,
  context: AgentContext,
  supabase: SupabaseClient<Database>,
): Promise<string> {
  void input // no input required; context.companyId provides scope

  const now = new Date()
  const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const endDate = now.toISOString()

  // Query 1: Active dealer count
  const dealerCountPromise = supabase
    .from('dealers')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', context.companyId)
    .eq('is_active', true)

  // Query 2 + 3: Orders + Revenue in last 30 days
  // Fetch order IDs and total_amount for revenue aggregation
  const ordersPromise = supabase
    .from('orders')
    .select('id, total_amount')
    .eq('company_id', context.companyId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)

  const [dealerCountResult, ordersResult] = await Promise.all([
    dealerCountPromise,
    ordersPromise,
  ])

  // Active dealer count
  const activeDealers = dealerCountResult.count ?? 0

  // Order metrics
  const orders = (ordersResult.data as OrderRow[] | null) ?? []
  const totalOrders = orders.length
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount ?? 0), 0)

  // Query 4: Top 5 products by quantity sold (via order_items IN order IDs from last 30d)
  let top5Products: Array<{ product_name: string; total_quantity: number }> = []

  if (orders.length > 0) {
    const orderIds = orders.map(o => o.id)

    const { data: itemsData } = await supabase
      .from('order_items')
      .select('product_name, quantity')
      .in('order_id', orderIds)
      .limit(500) // fetch enough rows to aggregate accurately

    if (itemsData && itemsData.length > 0) {
      // Aggregate product quantities in JS
      const qtyMap = new Map<string, number>()
      for (const item of itemsData as OrderItemAgg[]) {
        const existing = qtyMap.get(item.product_name) ?? 0
        qtyMap.set(item.product_name, existing + item.quantity)
      }

      // Sort by quantity descending, take top 5
      top5Products = Array.from(qtyMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([product_name, total_quantity]) => ({ product_name, total_quantity }))
    }
  }

  const periodLabel = `${startDate.substring(0, 10)} - ${endDate.substring(0, 10)}`

  return JSON.stringify({
    period: periodLabel,
    active_dealers: activeDealers,
    total_orders_30d: totalOrders,
    total_revenue_30d: Math.round(totalRevenue * 100) / 100,
    top_5_products: top5Products,
    summary: `Son 30 gunde ${activeDealers} aktif bayi, ${totalOrders} siparis, ${totalRevenue.toFixed(2)} TL gelir.`,
  })
}

/**
 * Handles export_report tool calls (GM-03).
 * - Company-wide scope (all dealers in context.companyId)
 * - Queries active dealer count, orders, revenue, top products for the period
 * - Returns Telegram-compatible plain text with === SIRKET RAPORU === header
 * - Default date range: current month
 */
async function handleGmExportReport(
  input: Record<string, unknown>,
  context: AgentContext,
  supabase: SupabaseClient<Database>,
): Promise<string> {
  // Default to current month if dates omitted
  const now = new Date()
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const defaultEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const startDate = typeof input['start_date'] === 'string' ? input['start_date'] : defaultStart
  const endDate = typeof input['end_date'] === 'string' ? input['end_date'] : defaultEnd

  // Active dealer count
  const { count: activeDealers } = await supabase
    .from('dealers')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', context.companyId)
    .eq('is_active', true)

  // Orders + revenue for the period
  const { data: ordersData } = await supabase
    .from('orders')
    .select('id, total_amount')
    .eq('company_id', context.companyId)
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59Z')

  const orders = (ordersData as OrderRow[] | null) ?? []
  const totalOrders = orders.length
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount ?? 0), 0)

  // Top products for the period
  let topProductLines: string[] = []

  if (orders.length > 0) {
    const orderIds = orders.map(o => o.id)

    const { data: itemsData } = await supabase
      .from('order_items')
      .select('product_name, quantity')
      .in('order_id', orderIds)
      .limit(500)

    if (itemsData && itemsData.length > 0) {
      const qtyMap = new Map<string, number>()
      for (const item of itemsData as OrderItemAgg[]) {
        const existing = qtyMap.get(item.product_name) ?? 0
        qtyMap.set(item.product_name, existing + item.quantity)
      }

      topProductLines = Array.from(qtyMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, qty], i) => `  ${i + 1}. ${name}: ${qty} adet`)
    }
  }

  // Build plain-text report (Telegram-compatible)
  const lines: string[] = []
  lines.push('=== SIRKET RAPORU ===')
  lines.push(`Donem: ${startDate} - ${endDate}`)
  lines.push('')

  lines.push('--- GENEL DURUM ---')
  lines.push(`Aktif Bayi Sayisi: ${activeDealers ?? 0}`)
  lines.push(`Toplam Siparis: ${totalOrders}`)
  lines.push(`Toplam Gelir: ${totalRevenue.toFixed(2)} TL`)
  lines.push('')

  if (topProductLines.length > 0) {
    lines.push('--- EN COK SATAN URUNLER (Top 5) ---')
    lines.push(...topProductLines)
    lines.push('')
  }

  lines.push('=====================')

  return lines.join('\n')
}

// ─── Handler Factory ───────────────────────────────────────────────────────

/**
 * createGenelMudurHandlers — factory that accepts a Supabase service-role client
 * and returns a Map of handler functions keyed by tool name.
 *
 * Handler names MUST match tool names exactly to sync with TOOL_REGISTRY lookup.
 * Returns exactly 10 entries:
 *   - 3 cherry-picked from createMuhasebeciHandlers: get_financials, get_payment_history, get_dealer_balance
 *   - 4 cherry-picked from createSatisHandlers: get_catalog, get_order_status, get_campaigns, check_stock
 *   - 3 GM-specific: get_any_dealer_balance, get_dashboard_summary, export_report
 *
 * Note: 'export_report' key from Muhasebeci is NOT cherry-picked — GM uses its own
 * company-wide export handler under the same key name (company-scoped vs dealer-scoped).
 *
 * GM-READ-ONLY: No write handler (create_order, update_stock) is included.
 *
 * @param supabase - Service role Supabase client for bypassing RLS
 * @returns Map<string, HandlerFn> with 10 read-only handlers
 */
export function createGenelMudurHandlers(
  supabase: SupabaseClient<Database>,
): Map<string, HandlerFn> {
  const handlers = new Map<string, HandlerFn>()

  // Cherry-pick read-only handlers from Muhasebeci factory
  const muhasebeciHandlers = createMuhasebeciHandlers(supabase)
  handlers.set('get_financials', muhasebeciHandlers.get('get_financials')!)
  handlers.set('get_payment_history', muhasebeciHandlers.get('get_payment_history')!)
  handlers.set('get_dealer_balance', muhasebeciHandlers.get('get_dealer_balance')!)
  // Note: get_invoices and export_report from Muhasebeci are NOT included
  // GM has its own company-wide export_report below

  // Cherry-pick read-only handlers from Satis factory (NO create_order, NO get_dealer_profile)
  const satisHandlers = createSatisHandlers(supabase)
  handlers.set('get_catalog', satisHandlers.get('get_catalog')!)
  handlers.set('get_order_status', satisHandlers.get('get_order_status')!)
  handlers.set('get_campaigns', satisHandlers.get('get_campaigns')!)
  handlers.set('check_stock', satisHandlers.get('check_stock')!)

  // GM-specific handlers
  handlers.set('get_any_dealer_balance', (input, context) =>
    handleGetAnyDealerBalance(input, context, supabase),
  )

  handlers.set('get_dashboard_summary', (input, context) =>
    handleGetDashboardSummary(input, context, supabase),
  )

  handlers.set('export_report', (input, context) =>
    handleGmExportReport(input, context, supabase),
  )

  return handlers
}
