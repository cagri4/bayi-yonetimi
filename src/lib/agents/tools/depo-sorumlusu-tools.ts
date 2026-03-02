/**
 * Depo Sorumlusu (Warehouse Manager) agent tool definitions and handler implementations.
 * Phase 11 — Plan 02
 *
 * DS-03 WRITE OPERATION: update_stock is the only mutating tool in this file.
 * All other tools (get_inventory_status, get_pending_orders, check_reorder_level,
 * get_shipments) are SELECT-only read operations.
 *
 * Scope rules:
 *   - get_inventory_status, get_pending_orders, check_reorder_level: company_id scope
 *     (warehouse manages company-wide inventory and all pending orders)
 *   - get_shipments: dealer_id scope (dealer views their own delivery tracking)
 *   - update_stock: company_id scope on both lookup AND update (defense in depth)
 *
 * Exports:
 *   - depoSorumlusuTools: Tool[] — array of exactly 5 tool definitions
 *   - createDepoSorumlusuHandlers: factory function returning Map<string, HandlerFn>
 */
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { AgentContext } from '../types'

// ─── Handler Type ──────────────────────────────────────────────────────────

type HandlerFn = (input: Record<string, unknown>, context: AgentContext) => Promise<string>

// ─── Tool Definitions ──────────────────────────────────────────────────────

/**
 * get_inventory_status tool (DS-01) — queries products with stock and low_stock info.
 * Company-scoped: warehouse manages inventory across all dealers in the company.
 * Supports optional text search and category filter.
 */
const getInventoryStatusTool: Tool = {
  name: 'get_inventory_status',
  description: 'Envanter durumunu sorgular. Urun stok miktarlari, dusuk stok uyarilari ve kategori bilgileri dahildir.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Urun adi veya kodu ile arama (kismi esleme desteklenir)',
      },
      category: {
        type: 'string',
        description: 'Kategori adina gore filtreleme',
      },
      low_stock_only: {
        type: 'boolean',
        description: 'Yalnizca dusuk stoklu urunleri listele',
      },
    },
    required: [],
  },
}

/**
 * get_pending_orders tool (DS-02) — lists orders awaiting warehouse action.
 * Company-wide scope: warehouse handles all orders regardless of dealer.
 * Filters to status codes: pending, confirmed, preparing.
 */
const getPendingOrdersTool: Tool = {
  name: 'get_pending_orders',
  description: 'Bekleyen, onaylanan ve hazirlanmakta olan siparisleri listeler. Depo islemleri icin sirket geneli tum siparisler gosterilir.',
  input_schema: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'number',
        description: 'Maksimum sonuc sayisi (varsayilan: 10)',
      },
    },
    required: [],
  },
}

/**
 * update_stock tool (DS-03) — WRITE OPERATION that updates product stock quantity.
 * Description instructs Claude to confirm with dealer BEFORE calling this tool.
 * Company_id scope enforced on both product lookup AND the UPDATE statement.
 */
const updateStockTool: Tool = {
  name: 'update_stock',
  description: 'Urun stok miktarini gunceller. BU ARACI CAGIRMADAN ONCE bayiye guncelleme detaylarini goster ve onay al. Onay alinmadan bu araci ASLA cagirma.',
  input_schema: {
    type: 'object' as const,
    properties: {
      product_code: {
        type: 'string',
        description: 'Guncellenecek urunun kodu',
      },
      new_stock_quantity: {
        type: 'number',
        description: 'Yeni stok miktari (0 veya daha buyuk olmalidir)',
      },
    },
    required: ['product_code', 'new_stock_quantity'],
  },
}

/**
 * check_reorder_level tool (DS-04) — returns products below their reorder threshold.
 * Company-wide scope. No required input — always returns all below-threshold products.
 */
const checkReorderLevelTool: Tool = {
  name: 'check_reorder_level',
  description: 'Yeniden siparis seviyesinin altindaki urunleri listeler. Stok miktari, minimum stok esiginin altindaki tum urunler gosterilir.',
  input_schema: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'number',
        description: 'Maksimum sonuc sayisi (varsayilan: 20)',
      },
    },
    required: [],
  },
}

/**
 * get_shipments tool (DS-05) — queries orders with cargo/delivery information.
 * Dealer-scoped: a dealer asks about their own shipments only.
 * Filters to orders that have vehicle_plate set (confirmed shipping info).
 */
const getShipmentsTool: Tool = {
  name: 'get_shipments',
  description: 'Sevkiyat bilgilerini getirir. Arac plakasi, surucu bilgileri ve kargo notlari dahildir. Yalnizca bayinin kendi siparisleri gosterilir.',
  input_schema: {
    type: 'object' as const,
    properties: {
      status: {
        type: 'string',
        description: 'Siparis durumuna gore filtreleme (ornegin: shipped)',
      },
      limit: {
        type: 'number',
        description: 'Maksimum sonuc sayisi (varsayilan: 10)',
      },
    },
    required: [],
  },
}

/**
 * depoSorumlusuTools — exported array of exactly 5 tool definitions.
 * DS-03 (update_stock) is the only write operation — all others are read-only.
 */
export const depoSorumlusuTools: Tool[] = [
  getInventoryStatusTool,
  getPendingOrdersTool,
  updateStockTool,
  checkReorderLevelTool,
  getShipmentsTool,
]

// ─── Internal helper interfaces ────────────────────────────────────────────

interface ProductRow {
  id: string
  code: string
  name: string
  stock_quantity: number
  low_stock_threshold: number
  is_active: boolean
}

interface OrderStatusIdRow {
  id: string
}

interface CategoryIdRow {
  id: string
}

interface PendingOrderRow {
  order_number: string
  total_amount: number
  created_at: string
  status: { name: string; code: string } | null
  items: Array<{ product_name: string; quantity: number }>
  dealer: { company_name: string } | null
}

interface ShipmentRow {
  order_number: string
  created_at: string
  vehicle_plate: string | null
  driver_name: string | null
  driver_phone: string | null
  cargo_notes: string | null
  status: { name: string; code: string } | null
}

// ─── Handler Factory ───────────────────────────────────────────────────────

/**
 * createDepoSorumlusuHandlers — factory that accepts a Supabase service-role client
 * and returns a Map of handler functions keyed by tool name.
 *
 * Handler names MUST match tool names exactly to sync with TOOL_REGISTRY lookup.
 * Returns exactly 5 entries: 4 read-only + 1 write (update_stock).
 *
 * @param supabase - Service role Supabase client for bypassing RLS
 * @returns Map<string, HandlerFn> with 5 handlers
 */
export function createDepoSorumlusuHandlers(
  supabase: SupabaseClient<Database>,
): Map<string, HandlerFn> {
  const handlers = new Map<string, HandlerFn>()

  // ─── get_inventory_status (DS-01) ─────────────────────────────────────────

  handlers.set('get_inventory_status', async (input, context) => {
    const safeQuery = input.query
      ? String(input.query).trim().replace(/[%_]/g, '')
      : null
    const safeCategory = input.category
      ? String(input.category).trim().replace(/[%_]/g, '')
      : null
    const lowStockOnly = input.low_stock_only === true

    // Resolve category to ID if provided
    let categoryId: string | null = null
    if (safeCategory) {
      const { data: catData } = await supabase
        .from('categories')
        .select('id')
        .eq('company_id', context.companyId)
        .ilike('name', `%${safeCategory}%`)
        .limit(1)
        .single()

      if (!catData) {
        return `[Kategori bulunamadi: ${input.category}]`
      }
      categoryId = (catData as CategoryIdRow).id
    }

    let query = supabase
      .from('products')
      .select('id, code, name, stock_quantity, low_stock_threshold, is_active')
      .eq('company_id', context.companyId)
      .eq('is_active', true)
      .limit(20)

    if (safeQuery) {
      query = query.or(`name.ilike.%${safeQuery}%,code.ilike.%${safeQuery}%`)
    }
    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    const { data: products, error } = await query

    if (error) {
      return `[Hata: ${error.message}]`
    }
    if (!products || products.length === 0) {
      return '[Kayit bulunamadi]'
    }

    const rows = products as ProductRow[]

    const result = rows
      .map(p => ({
        code: p.code,
        name: p.name,
        stock_quantity: p.stock_quantity,
        low_stock_threshold: p.low_stock_threshold,
        low_stock: p.stock_quantity <= p.low_stock_threshold,
      }))
      .filter(p => !lowStockOnly || p.low_stock)

    if (result.length === 0) {
      return '[Dusuk stoklu urun bulunamadi]'
    }

    return JSON.stringify(result)
  })

  // ─── get_pending_orders (DS-02) ───────────────────────────────────────────

  handlers.set('get_pending_orders', async (input, context) => {
    const limit = typeof input.limit === 'number' ? input.limit : 10

    // First: resolve status IDs for pending, confirmed, preparing
    const { data: statusRows, error: statusError } = await supabase
      .from('order_statuses')
      .select('id')
      .in('code', ['pending', 'confirmed', 'preparing'])

    if (statusError || !statusRows || statusRows.length === 0) {
      return '[Hata: Siparis durumlari sorgulanamadi]'
    }

    const statusIds = (statusRows as OrderStatusIdRow[]).map(s => s.id)

    // Query orders company-wide (NOT dealer_id scoped — warehouse needs all orders)
    const { data: orders, error } = await supabase
      .from('orders')
      .select('order_number, total_amount, created_at, status:order_statuses(name, code), items:order_items(product_name, quantity), dealer:dealers(company_name)')
      .eq('company_id', context.companyId)
      .in('status_id', statusIds)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      return `[Hata: ${error.message}]`
    }
    if (!orders || orders.length === 0) {
      return '[Bekleyen siparis bulunamadi]'
    }

    return JSON.stringify(orders as PendingOrderRow[])
  })

  // ─── update_stock (DS-03) — WRITE OPERATION ───────────────────────────────

  handlers.set('update_stock', async (input, context) => {
    const productCode = input.product_code ? String(input.product_code).trim() : ''
    const newQuantity = typeof input.new_stock_quantity === 'number'
      ? input.new_stock_quantity
      : -1

    // Validate inputs
    if (!productCode) {
      return '[Hata: Urun kodu bos olamaz]'
    }
    if (newQuantity < 0) {
      return '[Hata: Stok miktari 0 veya daha buyuk olmalidir]'
    }

    // Find product by code with company_id scope
    const { data: product, error: findError } = await supabase
      .from('products')
      .select('id, code, name, stock_quantity')
      .eq('code', productCode)
      .eq('company_id', context.companyId)
      .eq('is_active', true)
      .single()

    if (findError || !product) {
      return `[Hata: Urun bulunamadi: ${productCode}]`
    }

    const productRow = product as { id: string; code: string; name: string; stock_quantity: number }
    const previousQuantity = productRow.stock_quantity

    // Execute UPDATE with double company_id scope (defense in depth)
    const { error: updateError } = await (supabase as any)
      .from('products')
      .update({
        stock_quantity: newQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productRow.id)
      .eq('company_id', context.companyId)

    if (updateError) {
      return `[Hata: Stok guncellenemedi: ${updateError.message}]`
    }

    return JSON.stringify({
      success: true,
      product_code: productRow.code,
      product_name: productRow.name,
      previous_quantity: previousQuantity,
      new_quantity: newQuantity,
    })
  })

  // ─── check_reorder_level (DS-04) ──────────────────────────────────────────

  handlers.set('check_reorder_level', async (input, context) => {
    const limit = typeof input.limit === 'number' ? input.limit : 20

    // Supabase JS does not support column-to-column comparisons directly.
    // Fetch all active products (capped at 200) and filter client-side.
    const { data: allProducts, error } = await supabase
      .from('products')
      .select('code, name, stock_quantity, low_stock_threshold')
      .eq('company_id', context.companyId)
      .eq('is_active', true)
      .limit(200)

    if (error) {
      return `[Hata: ${error.message}]`
    }
    if (!allProducts || allProducts.length === 0) {
      return '[Kayit bulunamadi]'
    }

    const belowThreshold = (allProducts as Array<{
      code: string
      name: string
      stock_quantity: number
      low_stock_threshold: number
    }>)
      .filter(p => p.stock_quantity <= p.low_stock_threshold)
      .slice(0, limit)

    if (belowThreshold.length === 0) {
      return '[Yeniden siparis gerektiren urun bulunamadi]'
    }

    return JSON.stringify(belowThreshold)
  })

  // ─── get_shipments (DS-05) ────────────────────────────────────────────────

  handlers.set('get_shipments', async (input, context) => {
    const safeStatus = input.status ? String(input.status).trim() : null
    const limit = typeof input.limit === 'number' ? input.limit : 10

    let query = supabase
      .from('orders')
      .select('order_number, created_at, vehicle_plate, driver_name, driver_phone, cargo_notes, status:order_statuses(name, code)')
      .eq('dealer_id', context.dealerId)
      .not('vehicle_plate', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit)

    // If status filter provided, resolve the status ID first
    if (safeStatus) {
      const { data: statusRow, error: statusError } = await supabase
        .from('order_statuses')
        .select('id')
        .eq('code', safeStatus)
        .single()

      if (statusError || !statusRow) {
        return `[Hata: Siparis durumu bulunamadi: ${input.status}]`
      }

      query = query.eq('status_id', (statusRow as OrderStatusIdRow).id)
    }

    const { data: shipments, error } = await query

    if (error) {
      return `[Hata: ${error.message}]`
    }
    if (!shipments || shipments.length === 0) {
      return '[Sevkiyat bilgisi bulunamadi]'
    }

    return JSON.stringify(shipments as ShipmentRow[])
  })

  return handlers
}
