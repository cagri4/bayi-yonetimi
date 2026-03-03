/**
 * Satin Alma Sorumlusu (Procurement) agent tool definitions and handler implementations.
 * Phase 12 — Plan 04
 *
 * SA-01 TWO-TURN CONFIRMATION: create_purchase_order checks input.confirmed flag.
 * Without confirmed=true the tool returns a summary and asks for confirmation.
 * Only after confirmed=true does it perform the DB INSERT.
 *
 * SA-02 READ-ONLY: suggest_restock is SELECT-only, no mutations.
 *
 * 2 tools: create_purchase_order (write+confirm), suggest_restock (read)
 *
 * All DB writes use (supabase as any) pattern for Phase 12 tables not yet in
 * generated Database types (purchase_orders).
 *
 * Exports:
 *   - satinAlmaTools: Tool[] — array of exactly 2 tool definitions
 *   - createSatinAlmaHandlers: factory function returning Map<string, HandlerFn>
 */
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { AgentContext } from '../types'

// ─── Handler Type ──────────────────────────────────────────────────────────

type HandlerFn = (input: Record<string, unknown>, context: AgentContext) => Promise<string>

// ─── Tool Definitions ──────────────────────────────────────────────────────

/**
 * create_purchase_order tool (SA-01) — inserts into purchase_orders table.
 * TWO-TURN CONFIRMATION PATTERN: confirmed=false (default) shows summary only.
 * confirmed=true triggers the INSERT. This prevents accidental order creation.
 */
const createPurchaseOrderTool: Tool = {
  name: 'create_purchase_order',
  description:
    'Tedarikci siparisi olusturur. ONEMLI: Once kullanicidan onay al, sonra confirmed=true ile cagir. ' +
    'Onaysiz cagri sadece ozet gosterir.',
  input_schema: {
    type: 'object' as const,
    properties: {
      supplier_id: {
        type: 'string',
        description: 'Tedarikci UUID (opsiyonel)',
      },
      items: {
        type: 'array',
        description: 'Siparis kalemleri: [{product_id, quantity, unit_price}]',
        items: { type: 'object' },
      },
      notes: {
        type: 'string',
        description: 'Siparis notlari (opsiyonel)',
      },
      confirmed: {
        type: 'boolean',
        description: 'true ise siparis olusturulur, false/eksik ise onay ozeti gosterilir',
      },
    },
    required: ['items'],
  },
}

/**
 * suggest_restock tool (SA-02) — lists products below their stock threshold.
 * READ-ONLY: SELECT only, no mutations.
 * Falls back to stock_quantity < 10 if low_stock_threshold column is absent.
 */
const suggestRestockTool: Tool = {
  name: 'suggest_restock',
  description: 'Stok seviyesi esik degerinin altinda olan urunleri listeler ve yenileme onerisi sunar.',
  input_schema: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'number',
        description: 'Maksimum urun sayisi (varsayilan: 10)',
      },
    },
    required: [],
  },
}

/**
 * satinAlmaTools — exported array of exactly 2 tool definitions.
 * SA-01 (create_purchase_order) is the only write operation — uses two-turn confirm.
 * SA-02 (suggest_restock) is read-only.
 */
export const satinAlmaTools: Tool[] = [createPurchaseOrderTool, suggestRestockTool]

// ─── Internal Types ────────────────────────────────────────────────────────

interface PurchaseOrderItem {
  product_id?: string
  quantity?: number
  unit_price?: number
  [key: string]: unknown
}

interface RestockProductRow {
  id: string
  name: string
  stock_quantity: number
  low_stock_threshold: number
  sku: string | null
}

// ─── Handler Factory ───────────────────────────────────────────────────────

/**
 * createSatinAlmaHandlers — factory that accepts a Supabase service-role client
 * and returns a Map of handler functions keyed by tool name.
 *
 * Handler names MUST match tool names exactly.
 * Returns exactly 2 entries: 'create_purchase_order', 'suggest_restock'.
 *
 * create_purchase_order uses two-turn confirmation via input.confirmed flag.
 * All INSERT operations use (supabase as any) for Phase 12 tables.
 *
 * @param supabase - Service role Supabase client for bypassing RLS
 * @returns Map<string, HandlerFn> with 2 handlers
 */
export function createSatinAlmaHandlers(
  supabase: SupabaseClient<Database>,
): Map<string, HandlerFn> {
  const handlers = new Map<string, HandlerFn>()

  // ─── create_purchase_order (SA-01) — TWO-TURN WRITE ──────────────────────

  handlers.set('create_purchase_order', async (input, context) => {
    const items: PurchaseOrderItem[] = Array.isArray(input.items) ? input.items : []
    const confirmed = input.confirmed === true

    // Guard: items must not be empty
    if (items.length === 0) {
      return '[Hata: Siparis kalemleri bos olamaz]'
    }

    // First turn: show summary, ask for confirmation
    if (!confirmed) {
      const itemSummary = items.map((item, idx) =>
        `${idx + 1}. Urun: ${item.product_id ?? 'belirtilmedi'}, Adet: ${item.quantity ?? '?'}, Birim Fiyat: ${item.unit_price ?? '?'}`
      ).join('\n')

      return (
        'Satin alma siparisi ozeti:\n' +
        itemSummary + '\n' +
        (typeof input.supplier_id === 'string' ? `Tedarikci: ${input.supplier_id}\n` : '') +
        (typeof input.notes === 'string' ? `Notlar: ${input.notes}\n` : '') +
        '\nOnaylamak icin: confirmed=true ile tekrar cagirin.'
      )
    }

    // Second turn: create the purchase order
    const { data, error } = await (supabase as any)
      .from('purchase_orders')
      .insert({
        company_id: context.companyId,
        supplier_id: typeof input.supplier_id === 'string' ? input.supplier_id : null,
        status: 'draft',
        items: items,
        notes: typeof input.notes === 'string' ? input.notes : null,
      })
      .select('id')
      .single()

    if (error) {
      return `[Hata: ${error.message}]`
    }

    return `Satin alma siparisi olusturuldu. ID: ${data.id}`
  })

  // ─── suggest_restock (SA-02) — READ-ONLY ─────────────────────────────────

  handlers.set('suggest_restock', async (input, context) => {
    const limit = typeof input.limit === 'number' ? Math.min(input.limit, 20) : 10

    // Query active products with stock info; use low_stock_threshold column
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, stock_quantity, low_stock_threshold, sku')
      .eq('company_id', context.companyId)
      .eq('is_active', true)
      .order('stock_quantity', { ascending: true })
      .limit(200) // Fetch broad set, filter client-side (Supabase JS doesn't support column-column comparison)

    if (error) {
      return `[Hata: ${error.message}]`
    }
    if (!products || products.length === 0) {
      return '[Urun bulunamadi]'
    }

    // Filter products below their low_stock_threshold, fallback to < 10
    const belowThreshold = (products as unknown as RestockProductRow[])
      .filter((p) => {
        const threshold = p.low_stock_threshold ?? 10
        return p.stock_quantity <= threshold
      })
      .slice(0, limit)

    if (belowThreshold.length === 0) {
      return '[Stok yenileme gerektiren urun bulunamadi]'
    }

    const suggestions = belowThreshold.map((p) => ({
      product_id: p.id,
      product_name: p.name,
      sku: p.sku,
      current_stock: p.stock_quantity,
      low_stock_threshold: p.low_stock_threshold ?? 10,
      suggested_restock_quantity: Math.max(50 - p.stock_quantity, 10),
    }))

    return JSON.stringify(suggestions)
  })

  return handlers
}
