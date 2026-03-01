/**
 * Egitimci (Trainer) agent tool definitions and handler implementations.
 *
 * TR-04 READ-ONLY ENFORCEMENT: This file contains ONLY SELECT-based tools.
 * No INSERT, UPDATE, or DELETE operations exist in this file — by design.
 * The Egitimci agent is a read-only agent that answers product and FAQ queries.
 *
 * Exports:
 *   - egitimciTools: Tool[] — array of exactly 2 tool definitions
 *   - createEgitimciHandlers: factory function returning Map<string, HandlerFn>
 */
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { AgentContext } from '../types'

// ─── Handler Type ──────────────────────────────────────────────────────────

type HandlerFn = (input: Record<string, unknown>, context: AgentContext) => Promise<string>

// ─── Tool Definitions ──────────────────────────────────────────────────────

/**
 * get_product_info tool — searches products by name or code.
 * Company-scoped: results are filtered by context.companyId for tenant isolation.
 * Dealer-specific pricing: returns custom price or group discount-adjusted price.
 */
const getProductInfoTool: Tool = {
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

/**
 * get_faq tool — searches FAQ items globally (no company_id scope).
 * faq_items is a global table — no company_id column exists on this table.
 */
const getFaqTool: Tool = {
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

/**
 * egitimciTools — exported array of exactly 2 read-only tool definitions.
 * TR-04: No mutating tools exist in this array — only SELECT-based tools.
 */
export const egitimciTools: Tool[] = [getProductInfoTool, getFaqTool]

// ─── Handler Implementations ───────────────────────────────────────────────

/**
 * Handles get_product_info tool calls.
 * - Validates query is non-empty
 * - Queries products table scoped by company_id and filtered by is_active
 * - Fetches dealer-specific custom prices from dealer_prices
 * - Fetches dealer group discount from dealers.dealer_groups
 * - Calculates final dealer price: custom price > group discount > base price
 */
async function handleGetProductInfo(
  input: Record<string, unknown>,
  context: AgentContext,
  supabase: SupabaseClient<Database>,
): Promise<string> {
  const query = input['query']

  if (typeof query !== 'string' || query.trim() === '') {
    return '[Hata: Urun sorgusu bos olamaz]'
  }

  // Sanitize query to prevent SQL injection via ilike wildcard abuse
  const safeQuery = query.trim().replace(/[%_]/g, '')

  // Query products table with company_id scope for tenant isolation
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, code, name, description, base_price, stock_quantity, low_stock_threshold')
    .eq('company_id', context.companyId)
    .eq('is_active', true)
    .or(`name.ilike.%${safeQuery}%,code.ilike.%${safeQuery}%`)
    .limit(5)

  if (productsError) {
    return `[Hata: ${productsError.message}]`
  }

  if (!products || products.length === 0) {
    return '[Urun bulunamadi]'
  }

  // Fetch dealer-specific custom prices
  const { data: dealerPrices } = await supabase
    .from('dealer_prices')
    .select('product_id, custom_price')
    .eq('dealer_id', context.dealerId)
    .in('product_id', products.map((p) => p.id))

  const priceMap = new Map(
    (dealerPrices ?? []).map((dp) => [dp.product_id, dp.custom_price]),
  )

  // Fetch dealer group discount
  const { data: dealerData } = await supabase
    .from('dealers')
    .select('dealer_group:dealer_groups(discount_percent)')
    .eq('id', context.dealerId)
    .single()

  // Type-safe extraction of discount_percent from join result
  const dealerGroup = dealerData?.dealer_group as { discount_percent: number } | null
  const discountPercent = dealerGroup?.discount_percent ?? 0

  // Build result with calculated dealer price
  const result = products.map((product) => {
    const customPrice = priceMap.get(product.id)
    const dealerPrice =
      customPrice !== undefined
        ? customPrice
        : Math.round(product.base_price * (1 - discountPercent / 100) * 100) / 100

    return {
      code: product.code,
      name: product.name,
      description: product.description,
      base_price: product.base_price,
      dealer_price: dealerPrice,
      stock: product.stock_quantity,
      low_stock: product.stock_quantity <= product.low_stock_threshold,
    }
  })

  return JSON.stringify(result)
}

/**
 * Handles get_faq tool calls.
 * - Validates query is non-empty
 * - Queries faq_items table WITHOUT company_id filter (global table — no company_id column)
 * - Returns matched Q&A pairs with category name
 */
async function handleGetFaq(
  input: Record<string, unknown>,
  context: AgentContext,
  supabase: SupabaseClient<Database>,
): Promise<string> {
  // Suppress unused context warning — context may be used for future audit logging
  void context

  const query = input['query']

  if (typeof query !== 'string' || query.trim() === '') {
    return '[Hata: Arama sorgusu bos olamaz]'
  }

  // Sanitize query to prevent SQL injection via ilike wildcard abuse
  const safeQuery = query.trim().replace(/[%_]/g, '')

  // Query faq_items globally — NO company_id filter (faq_items has no company_id column)
  const { data: items, error } = await supabase
    .from('faq_items')
    .select('question, answer, category:faq_categories(name)')
    .eq('is_active', true)
    .or(`question.ilike.%${safeQuery}%,answer.ilike.%${safeQuery}%`)
    .limit(5)

  if (error) {
    return `[Hata: ${error.message}]`
  }

  if (!items || items.length === 0) {
    return '[Ilgili SSS bulunamadi]'
  }

  return JSON.stringify(items)
}

// ─── Handler Factory ───────────────────────────────────────────────────────

/**
 * createEgitimciHandlers — factory that accepts a Supabase client and returns
 * a Map of handler functions keyed by tool name.
 *
 * Handler names MUST match tool names exactly to sync with TOOL_REGISTRY lookup.
 * Returns exactly 2 entries: 'get_product_info' and 'get_faq'.
 *
 * @param supabase - Service role Supabase client for bypassing RLS
 * @returns Map<string, HandlerFn> with 2 read-only handlers
 */
export function createEgitimciHandlers(
  supabase: SupabaseClient<Database>,
): Map<string, HandlerFn> {
  const handlers = new Map<string, HandlerFn>()

  handlers.set('get_product_info', (input, context) =>
    handleGetProductInfo(input, context, supabase),
  )

  handlers.set('get_faq', (input, context) =>
    handleGetFaq(input, context, supabase),
  )

  return handlers
}
