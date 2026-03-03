/**
 * Dagitim Koordinatoru (Distribution Coordinator) agent tool definitions and handler implementations.
 * Phase 12 — Plan 02
 *
 * Tools:
 *   - get_delivery_status (DK-01): Lists orders in shipping/delivery status.
 *   - manage_routes (DK-02): Advisory-only route grouping by dealer city. NO DB writes.
 *   - track_shipment (DK-03): Tracks order by order_number or dealer_id.
 *
 * Scope rules:
 *   - All handlers scoped by company_id for tenant isolation.
 *   - manage_routes is advisory-only — no new tables, no DB writes, pure grouping logic.
 *   - track_shipment optionally scoped by dealer_id (dealer views their own shipments).
 *
 * Exports:
 *   - dagitimKoordinatoruTools: Tool[] — array of exactly 3 tool definitions
 *   - createDagitimKoordinatoruHandlers: factory function returning Map<string, HandlerFn>
 */
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { AgentContext } from '../types'

// ─── Handler Type ──────────────────────────────────────────────────────────

type HandlerFn = (input: Record<string, unknown>, context: AgentContext) => Promise<string>

// ─── Tool Definitions ──────────────────────────────────────────────────────

/**
 * get_delivery_status tool (DK-01) — lists orders currently in shipping/delivery.
 * Company-scoped with optional single-dealer filter.
 * Returns recent orders ordered by creation date descending.
 */
const getDeliveryStatusTool: Tool = {
  name: 'get_delivery_status',
  description:
    'Dagitimda olan veya kargoya verilen siparisleri listeler.',
  input_schema: {
    type: 'object' as const,
    properties: {
      dealer_id: {
        type: 'string',
        description: 'Belirli bayi UUID (opsiyonel — bos birakinca tum siparisler)',
      },
      limit: {
        type: 'number',
        description: 'Maksimum siparis sayisi (varsayilan: 10)',
      },
    },
    required: [],
  },
}

/**
 * manage_routes tool (DK-02) — advisory route grouping by dealer city/address.
 * ADVISORY-ONLY: No DB writes, no new tables. Pure read + JavaScript grouping.
 * Groups active dealers by city (or first word of address) and suggests routes.
 */
const manageRoutesTool: Tool = {
  name: 'manage_routes',
  description:
    'Bayi adreslerine gore dagitim rotalarini gruplar ve oneri sunar. Sadece danismanlik — veritabanina yazma yapmaz.',
  input_schema: {
    type: 'object' as const,
    properties: {
      date: {
        type: 'string',
        description: 'Planlanan dagitim tarihi (YYYY-MM-DD, varsayilan: bugun)',
      },
    },
    required: [],
  },
}

/**
 * track_shipment tool (DK-03) — tracks shipment by order_number or dealer_id.
 * Accepts either order_number (single order lookup) or dealer_id (recent 5 orders).
 * Returns error if neither parameter is provided.
 */
const trackShipmentTool: Tool = {
  name: 'track_shipment',
  description:
    'Siparis numarasi veya bayi ID ile kargo takibi yapar.',
  input_schema: {
    type: 'object' as const,
    properties: {
      order_number: {
        type: 'string',
        description: 'Siparis numarasi (OR kullan)',
      },
      dealer_id: {
        type: 'string',
        description: 'Bayi UUID (OR kullan)',
      },
    },
    required: [],
  },
}

/**
 * dagitimKoordinatoruTools — exported array of exactly 3 tool definitions.
 * All tools are read-only (SELECT only). manage_routes is advisory with no DB writes.
 */
export const dagitimKoordinatoruTools: Tool[] = [
  getDeliveryStatusTool,
  manageRoutesTool,
  trackShipmentTool,
]

// ─── Internal helper interfaces ────────────────────────────────────────────

interface OrderRow {
  id: string
  order_number: string
  dealer_id: string
  total_amount: number
  created_at: string
  status_id: string | null
}

interface DealerRow {
  id: string
  company_name: string
  address: string | null
}

// ─── Handler Factory ───────────────────────────────────────────────────────

/**
 * createDagitimKoordinatoruHandlers — factory that accepts a Supabase service-role client
 * and returns a Map of handler functions keyed by tool name.
 *
 * Handler names MUST match tool names exactly to sync with TOOL_REGISTRY lookup.
 * Returns exactly 3 entries: 'get_delivery_status', 'manage_routes', 'track_shipment'.
 *
 * @param supabase - Service role Supabase client for bypassing RLS
 * @returns Map<string, HandlerFn> with 3 handlers
 */
export function createDagitimKoordinatoruHandlers(
  supabase: SupabaseClient<Database>,
): Map<string, HandlerFn> {
  const handlers = new Map<string, HandlerFn>()

  // ─── get_delivery_status (DK-01) ──────────────────────────────────────────

  handlers.set('get_delivery_status', async (input, context) => {
    const limit = typeof input.limit === 'number' ? Math.min(input.limit, 50) : 10

    let query = supabase
      .from('orders')
      .select('id, order_number, dealer_id, total_amount, created_at, status_id')
      .eq('company_id', context.companyId)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Optional single-dealer filter
    if (typeof input.dealer_id === 'string' && input.dealer_id) {
      query = query.eq('dealer_id', input.dealer_id)
    }

    const { data: orders, error } = await query

    if (error) {
      return `[Hata: ${error.message}]`
    }
    if (!orders || orders.length === 0) {
      return '[Siparis bulunamadi]'
    }

    return JSON.stringify(orders as OrderRow[])
  })

  // ─── manage_routes (DK-02) — ADVISORY ONLY, NO DB WRITES ──────────────────

  handlers.set('manage_routes', async (input, context) => {
    // Advisory tool: query dealers then group by city in JavaScript — no DB writes
    const date =
      typeof input.date === 'string' && input.date
        ? input.date
        : new Date().toISOString().split('T')[0]

    const { data: dealers, error } = await supabase
      .from('dealers')
      .select('id, company_name, address')
      .eq('company_id', context.companyId)
      .eq('is_active', true)

    if (error) {
      return `[Hata: ${error.message}]`
    }
    if (!dealers || dealers.length === 0) {
      return '[Aktif bayi bulunamadi]'
    }

    // Group dealers by city (fall back to first word of address if city is null)
    const groups = new Map<string, string[]>()

    for (const dealer of dealers as DealerRow[]) {
      let region: string
      if (dealer.address && dealer.address.trim()) {
        // Use first word of address as region key (city is not a separate column)
        region = dealer.address.trim().split(/\s+/)[0] ?? 'Diger'
      } else {
        region = 'Diger'
      }

      const existing = groups.get(region) ?? []
      existing.push(dealer.company_name)
      groups.set(region, existing)
    }

    // Format as readable route suggestion string
    const lines: string[] = [`Rota onerisi (${date}):`]
    for (const [region, dealerNames] of groups.entries()) {
      lines.push(`  ${region}: ${dealerNames.join(', ')}`)
    }

    return lines.join('\n')
  })

  // ─── track_shipment (DK-03) ───────────────────────────────────────────────

  handlers.set('track_shipment', async (input, context) => {
    const orderNumber = typeof input.order_number === 'string' ? input.order_number.trim() : ''
    const dealerId = typeof input.dealer_id === 'string' ? input.dealer_id.trim() : ''

    if (!orderNumber && !dealerId) {
      return '[Hata: order_number veya dealer_id gerekli]'
    }

    let query = supabase
      .from('orders')
      .select('id, order_number, dealer_id, status_id, total_amount, created_at')
      .eq('company_id', context.companyId)

    if (orderNumber) {
      // Single order by order_number
      query = query.eq('order_number', orderNumber)
    } else {
      // Recent orders by dealer_id (latest 5)
      query = query.eq('dealer_id', dealerId).order('created_at', { ascending: false }).limit(5)
    }

    const { data: orders, error } = await query

    if (error) {
      return `[Hata: ${error.message}]`
    }
    if (!orders || orders.length === 0) {
      return '[Siparis bulunamadi]'
    }

    return JSON.stringify(orders as OrderRow[])
  })

  return handlers
}
