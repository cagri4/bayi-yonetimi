/**
 * Urun Yoneticisi (Product Manager) agent tool definitions and handler implementations.
 * Phase 12 — Plan 04
 *
 * UY-READ-ONLY ENFORCEMENT:
 * analyze_catalog, analyze_requests: SELECT-only, no mutations.
 * suggest_pricing: advisory ONLY — zero DB writes, returns recommendation text.
 *
 * 3 tools: analyze_catalog, suggest_pricing, analyze_requests
 *
 * Handler factory receives a Supabase service-role client. Every handler receives
 * AgentContext for tenant isolation (companyId on every query).
 *
 * Exports:
 *   - urunYoneticisiTools: Tool[] — array of exactly 3 tool definitions
 *   - createUrunYoneticisiHandlers: factory function returning Map<string, HandlerFn>
 */
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { AgentContext } from '../types'

// ─── Handler Type ──────────────────────────────────────────────────────────

type HandlerFn = (input: Record<string, unknown>, context: AgentContext) => Promise<string>

// ─── Tool Definitions ──────────────────────────────────────────────────────

/**
 * analyze_catalog tool (UY-01) — aggregates sales volume and revenue per product.
 * Queries order_items joined with orders (company_id scoped), aggregates in JS.
 * Returns top {limit} products by total_revenue DESC.
 */
const analyzeCatalogTool: Tool = {
  name: 'analyze_catalog',
  description: 'Urun katalogu satis analizini yapar. En cok satan urunleri, ciro ve satis adetlerini raporlar.',
  input_schema: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'number',
        description: 'Analiz edilecek urun sayisi (varsayilan: 10)',
      },
      period_days: {
        type: 'number',
        description: 'Analiz donemi gun sayisi (varsayilan: 30)',
      },
    },
    required: [],
  },
}

/**
 * suggest_pricing tool (UY-02) — advisory-only pricing strategy.
 * Reads current product price and dealer group overrides.
 * CRITICAL: NO DB writes in this tool — returns recommendation text only.
 */
const suggestPricingTool: Tool = {
  name: 'suggest_pricing',
  description:
    'Urun fiyat stratejisi onerisi sunar. Mevcut fiyatlari ve bayi gruplarini analiz ederek tavsiye verir. ' +
    'Sadece danismanlik — veritabanina yazmaz.',
  input_schema: {
    type: 'object' as const,
    properties: {
      product_id: {
        type: 'string',
        description: 'Analiz edilecek urun UUID (opsiyonel)',
      },
      strategy: {
        type: 'string',
        description: 'Fiyatlama stratejisi: cost_plus | competitive | value_based',
      },
    },
    required: [],
  },
}

/**
 * analyze_requests tool (UY-03) — queries product_requests for demand analysis.
 * Company_id scoped. Returns top requested products/categories.
 */
const analyzeRequestsTool: Tool = {
  name: 'analyze_requests',
  description: 'Bayi urun taleplerini analiz eder. En cok talep edilen urunler ve kategoriler raporlanir.',
  input_schema: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'number',
        description: 'Talep sayisi (varsayilan: 10)',
      },
    },
    required: [],
  },
}

/**
 * urunYoneticisiTools — exported array of exactly 3 read-only tool definitions.
 * All tools are read-only (SELECT / advisory). No mutating tools in this array.
 */
export const urunYoneticisiTools: Tool[] = [
  analyzeCatalogTool,
  suggestPricingTool,
  analyzeRequestsTool,
]

// ─── Internal Types ────────────────────────────────────────────────────────

interface OrderItemRow {
  product_id: string
  quantity: number
  unit_price: number
  order_id: string
}

interface OrderRow {
  id: string
  company_id: string
  created_at: string
}

interface ProductAgg {
  product_id: string
  total_sold: number
  total_revenue: number
}

interface ProductPriceRow {
  id: string
  name: string
  base_price: number
}

interface DealerPriceRow {
  product_id: string
  custom_price: number
  dealer_id: string
}

interface ProductRequestRow {
  id: string
  product_name: string
  notes: string | null
  created_at: string
  status: string
}

// ─── Handler Factory ───────────────────────────────────────────────────────

/**
 * createUrunYoneticisiHandlers — factory that accepts a Supabase service-role client
 * and returns a Map of handler functions keyed by tool name.
 *
 * Handler names MUST match tool names exactly.
 * Returns exactly 3 entries: 'analyze_catalog', 'suggest_pricing', 'analyze_requests'.
 * All handlers are read-only (SELECT / advisory). No INSERT/UPDATE/DELETE.
 *
 * @param supabase - Service role Supabase client for bypassing RLS
 * @returns Map<string, HandlerFn> with 3 read-only handlers
 */
export function createUrunYoneticisiHandlers(
  supabase: SupabaseClient<Database>,
): Map<string, HandlerFn> {
  const handlers = new Map<string, HandlerFn>()

  // ─── analyze_catalog (UY-01) ──────────────────────────────────────────────

  handlers.set('analyze_catalog', async (input, context) => {
    const limit = typeof input.limit === 'number' ? Math.min(input.limit, 20) : 10
    const periodDays = typeof input.period_days === 'number' ? input.period_days : 30
    const sinceDate = new Date(Date.now() - periodDays * 86400000).toISOString()

    // Step 1: Get order IDs for this company within the time period
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, company_id, created_at')
      .eq('company_id', context.companyId)
      .gte('created_at', sinceDate)

    if (ordersError) {
      return `[Hata: ${ordersError.message}]`
    }
    if (!orders || orders.length === 0) {
      return '[Bu donemde siparis bulunamadi]'
    }

    const orderIds = (orders as OrderRow[]).map((o) => o.id)

    // Step 2: Get order items for those orders
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('product_id, quantity, unit_price, order_id')
      .in('order_id', orderIds)

    if (itemsError) {
      return `[Hata: ${itemsError.message}]`
    }
    if (!items || items.length === 0) {
      return '[Bu donemde siparis kalemi bulunamadi]'
    }

    // Step 3: Aggregate by product_id in JavaScript
    const aggMap = new Map<string, ProductAgg>()
    for (const item of items as OrderItemRow[]) {
      const existing = aggMap.get(item.product_id)
      if (existing) {
        existing.total_sold += item.quantity
        existing.total_revenue += item.quantity * item.unit_price
      } else {
        aggMap.set(item.product_id, {
          product_id: item.product_id,
          total_sold: item.quantity,
          total_revenue: item.quantity * item.unit_price,
        })
      }
    }

    // Step 4: Sort by total_revenue DESC, take top {limit}
    const sorted = Array.from(aggMap.values())
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, limit)

    return JSON.stringify({
      period_days: periodDays,
      since_date: sinceDate,
      top_products: sorted,
    })
  })

  // ─── suggest_pricing (UY-02) — ADVISORY ONLY, NO DB WRITES ───────────────

  handlers.set('suggest_pricing', async (input, context) => {
    const strategy = typeof input.strategy === 'string' ? input.strategy : 'competitive'
    const productId = typeof input.product_id === 'string' ? input.product_id : null

    let currentPrice: number | null = null
    let productName = 'Belirtilmedi'
    let groupOverrideNote = ''

    if (productId) {
      // Query current product price (READ ONLY)
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, name, base_price')
        .eq('id', productId)
        .eq('company_id', context.companyId)
        .single()

      if (productError || !product) {
        return `[Hata: Urun bulunamadi: ${productId}]`
      }

      const productRow = product as unknown as ProductPriceRow
      currentPrice = productRow.base_price
      productName = productRow.name

      // Also query dealer custom price overrides if they exist (READ ONLY)
      const { data: dealerPrices } = await supabase
        .from('dealer_prices')
        .select('product_id, custom_price, dealer_id')
        .eq('product_id', productId)
        .limit(5)

      if (dealerPrices && dealerPrices.length > 0) {
        const overridePrices = (dealerPrices as unknown as DealerPriceRow[]).map((dp) => dp.custom_price)
        const minOverride = Math.min(...overridePrices)
        const maxOverride = Math.max(...overridePrices)
        groupOverrideNote = ` Ozel bayi fiyatlari: ${minOverride.toFixed(2)} TL - ${maxOverride.toFixed(2)} TL araliginda (${dealerPrices.length} kayit).`
      }
    }

    const priceInfo = currentPrice !== null
      ? `Mevcut fiyat: ${currentPrice.toFixed(2)} TL. Tavsiye edilen aralik: ${(currentPrice * 0.9).toFixed(2)} TL - ${(currentPrice * 1.2).toFixed(2)} TL (+/- %%10-20).`
      : 'Urun secilmedi. Genel strateji tavsiyesi verilecektir.'

    return `Fiyat Stratejisi Onerisi (${strategy}): ${priceInfo}${groupOverrideNote} Strateji aciklamasi: ${
      strategy === 'cost_plus'
        ? 'Maliyet uzerine sabit kar marji eklenir (%20-40 onerilir).'
        : strategy === 'value_based'
        ? 'Musteri algilanan degerine gore fiyatlama yapilir; premium segmentte %30-50 daha yuksek fiyat uygulanabilir.'
        : 'Pazar fiyatlarini takip ederek rekabetci konumlama yapilir; dusuk-orta fiyat bandi hedeflenir.'
    } Urun: ${productName}.`
  })

  // ─── analyze_requests (UY-03) ─────────────────────────────────────────────

  handlers.set('analyze_requests', async (input, context) => {
    const limit = typeof input.limit === 'number' ? Math.min(input.limit, 20) : 10

    const { data: requests, error } = await supabase
      .from('product_requests')
      .select('id, product_name, notes, created_at, status')
      .eq('company_id', context.companyId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return `[Hata: ${error.message}]`
    }
    if (!requests || requests.length === 0) {
      return '[Urun talebi bulunamadi]'
    }

    // Aggregate by product_name to find most requested
    const nameCount = new Map<string, number>()
    for (const req of requests as ProductRequestRow[]) {
      const name = req.product_name ?? 'Bilinmiyor'
      nameCount.set(name, (nameCount.get(name) ?? 0) + 1)
    }

    const topRequested = Array.from(nameCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([product_name, request_count]) => ({ product_name, request_count }))

    return JSON.stringify({
      total_requests: requests.length,
      top_requested: topRequested,
      recent_requests: requests as ProductRequestRow[],
    })
  })

  return handlers
}
