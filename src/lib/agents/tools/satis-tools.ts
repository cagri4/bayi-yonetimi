/**
 * Satis Temsilcisi (Sales Representative) tool definitions and handler implementations.
 * Phase 10 — Plan 02
 *
 * 6 tools: get_catalog, create_order, get_order_status, get_campaigns, check_stock, get_dealer_profile
 *
 * Handler factory receives a Supabase service-role client. Every handler receives
 * AgentContext for tenant isolation (companyId + dealerId on every multi-tenant query).
 */
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { AgentContext } from '../types'

// ─── Handler type ─────────────────────────────────────────────────────────────

type HandlerFn = (input: Record<string, unknown>, context: AgentContext) => Promise<string>

// ─── Tool definitions ──────────────────────────────────────────────────────────

export const getCatalogTool: Tool = {
  name: 'get_catalog',
  description: 'Urun katalogunu sorgular. Urun adi veya kategoriye gore filtreleme yapilabilir.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Urun adi veya kodu ile arama',
      },
      category: {
        type: 'string',
        description: 'Kategori adina gore filtreleme',
      },
      limit: {
        type: 'number',
        description: 'Maksimum sonuc sayisi (varsayilan: 10)',
      },
    },
    required: [],
  },
}

export const createOrderTool: Tool = {
  name: 'create_order',
  description: 'Yeni siparis olusturur. Siparis olusturmadan once bayiye urunleri ve miktarlari dogrulayin.',
  input_schema: {
    type: 'object' as const,
    properties: {
      items: {
        type: 'array',
        description: 'Siparis kalemleri',
        maxItems: 20,
        items: {
          type: 'object',
          properties: {
            product_code: { type: 'string', description: 'Urun kodu' },
            quantity: { type: 'number', description: 'Siparis miktari' },
          },
          required: ['product_code', 'quantity'],
        },
      },
    },
    required: ['items'],
  },
}

export const getOrderStatusTool: Tool = {
  name: 'get_order_status',
  description: 'Siparis durumunu sorgular. Siparis numarasi ile arama yapilabilir.',
  input_schema: {
    type: 'object' as const,
    properties: {
      order_number: {
        type: 'string',
        description: 'Siparis numarasi (belirtilmezse son siparisler listelenir)',
      },
      limit: {
        type: 'number',
        description: 'Listeleme limiti (varsayilan: 5)',
      },
    },
    required: [],
  },
}

export const getCampaignsTool: Tool = {
  name: 'get_campaigns',
  description: 'Aktif kampanya bilgilerini getirir.',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
}

export const checkStockTool: Tool = {
  name: 'check_stock',
  description: 'Urun stok durumunu kontrol eder. Urun adi veya kodu ile sorgulama yapilabilir.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Urun adi veya kodu',
      },
    },
    required: ['query'],
  },
}

export const getDealerProfileTool: Tool = {
  name: 'get_dealer_profile',
  description: 'Bayi profil bilgilerini getirir (sirket adi, iletisim, indirim orani).',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
}

/** All 6 Satis Temsilcisi tools in order. Prompt caching should be applied externally. */
export const satisTools: Tool[] = [
  getCatalogTool,
  createOrderTool,
  getOrderStatusTool,
  getCampaignsTool,
  checkStockTool,
  getDealerProfileTool,
]

// ─── Internal helper types ─────────────────────────────────────────────────────

interface ProductRow {
  id: string
  code: string
  name: string
  description: string | null
  base_price: number
  stock_quantity: number
  low_stock_threshold: number
  category: { name: string } | null
}

interface ProductForOrder {
  id: string
  code: string
  name: string
  base_price: number
  stock_quantity: number
}

interface DealerPriceRow {
  product_id: string
  custom_price: number
}

interface DealerGroupRow {
  name: string
  discount_percent: number
  min_order_amount: number
}

interface DealerRow {
  company_name: string
  email: string
  phone: string | null
  address: string | null
  dealer_group: DealerGroupRow | null
}

interface OrderRow {
  order_number: string
  total_amount: number
  created_at: string
  status: { name: string; code: string } | null
  items: Array<{
    product_name: string
    quantity: number
    unit_price: number
    total_price: number
  }>
}

interface InsertedOrder {
  id: string
  order_number: string
}

interface OrderStatusRow {
  id: string
}

interface CategoryRow {
  id: string
}

// ─── Handler factory ───────────────────────────────────────────────────────────

/**
 * Creates a Map of tool handlers for the Satis Temsilcisi agent.
 *
 * @param supabase - Service-role Supabase client (bypasses RLS; handlers enforce
 *   multi-tenant scoping manually via companyId / dealerId from AgentContext)
 */
export function createSatisHandlers(supabase: SupabaseClient<Database>): Map<string, HandlerFn> {
  const handlers = new Map<string, HandlerFn>()

  // ─── get_catalog ──────────────────────────────────────────────────────────

  handlers.set('get_catalog', async (input, context) => {
    const safeQuery = input.query
      ? String(input.query).replace(/[%_]/g, '')
      : null
    const safeCategory = input.category
      ? String(input.category).replace(/[%_]/g, '')
      : null
    const limit = typeof input.limit === 'number' ? input.limit : 10

    // Resolve category to an ID if provided
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
      categoryId = (catData as CategoryRow).id
    }

    // Build products query
    let query = supabase
      .from('products')
      .select('id, code, name, description, base_price, stock_quantity, low_stock_threshold, category:categories(name)')
      .eq('company_id', context.companyId)
      .eq('is_active', true)
      .limit(limit)

    if (safeQuery) {
      query = query.or(`name.ilike.%${safeQuery}%,code.ilike.%${safeQuery}%`)
    }
    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    const { data: products, error } = await query

    if (error) {
      return `[Hata: Katalog sorgulanamadi: ${error.message}]`
    }
    if (!products || products.length === 0) {
      return '[Urun bulunamadi]'
    }

    // Get dealer pricing
    const productIds = (products as ProductRow[]).map(p => p.id)

    const { data: dealerPricesData } = await supabase
      .from('dealer_prices')
      .select('product_id, custom_price')
      .eq('dealer_id', context.dealerId)
      .in('product_id', productIds)

    const dealerPrices = (dealerPricesData as DealerPriceRow[] | null) || []
    const priceMap = new Map(dealerPrices.map(dp => [dp.product_id, dp.custom_price]))

    // Get dealer group discount
    const { data: dealerData } = await supabase
      .from('dealers')
      .select('dealer_group:dealer_groups(discount_percent)')
      .eq('id', context.dealerId)
      .eq('company_id', context.companyId)
      .single()

    const discountPercent = (dealerData as any)?.dealer_group?.discount_percent ?? 0

    const result = (products as ProductRow[]).map(p => {
      const customPrice = priceMap.get(p.id)
      const dealerPrice = customPrice !== undefined
        ? customPrice
        : Math.round(p.base_price * (1 - discountPercent / 100) * 100) / 100

      return {
        code: p.code,
        name: p.name,
        description: p.description,
        category: p.category?.name ?? null,
        base_price: p.base_price,
        dealer_price: dealerPrice,
        stock: p.stock_quantity,
        low_stock: p.stock_quantity <= p.low_stock_threshold,
      }
    })

    return JSON.stringify(result)
  })

  // ─── get_order_status ─────────────────────────────────────────────────────

  handlers.set('get_order_status', async (input, context) => {
    const orderNumber = input.order_number ? String(input.order_number) : null
    const limit = typeof input.limit === 'number' ? input.limit : 5

    let query = supabase
      .from('orders')
      .select('order_number, total_amount, created_at, status:order_statuses(name, code), items:order_items(product_name, quantity, unit_price, total_price)')
      .eq('dealer_id', context.dealerId)
      .eq('company_id', context.companyId)

    if (orderNumber) {
      query = query.eq('order_number', orderNumber)
    } else {
      query = query.order('created_at', { ascending: false }).limit(limit)
    }

    const { data: orders, error } = await query

    if (error) {
      return `[Hata: Siparis sorgulanamadi: ${error.message}]`
    }
    if (!orders || orders.length === 0) {
      return orderNumber
        ? `[Siparis bulunamadi: ${orderNumber}]`
        : '[Henuz siparisiniz bulunmuyor]'
    }

    return JSON.stringify(orders as OrderRow[])
  })

  // ─── get_campaigns ────────────────────────────────────────────────────────

  handlers.set('get_campaigns', async (_input, context) => {
    const now = new Date().toISOString()

    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('name, description, discount_type, discount_value, start_date, end_date, min_order_amount')
      .eq('company_id', context.companyId)
      .eq('is_active', true)
      .lte('start_date', now)
      .gte('end_date', now)
      .order('created_at', { ascending: false })

    if (error) {
      return `[Hata: Kampanyalar sorgulanamadi: ${error.message}]`
    }
    if (!campaigns || campaigns.length === 0) {
      return '[Aktif kampanya bulunamadi]'
    }

    return JSON.stringify(campaigns)
  })

  // ─── check_stock ──────────────────────────────────────────────────────────

  handlers.set('check_stock', async (input, context) => {
    const rawQuery = input.query ? String(input.query).trim() : ''
    if (!rawQuery) {
      return '[Hata: Urun sorgusu bos olamaz]'
    }
    const safeQuery = rawQuery.replace(/[%_]/g, '')

    const { data: products, error } = await supabase
      .from('products')
      .select('code, name, stock_quantity, low_stock_threshold')
      .eq('company_id', context.companyId)
      .eq('is_active', true)
      .or(`name.ilike.%${safeQuery}%,code.ilike.%${safeQuery}%`)
      .limit(5)

    if (error) {
      return `[Hata: Stok sorgulanamadi: ${error.message}]`
    }
    if (!products || products.length === 0) {
      return `[Urun bulunamadi: ${input.query}]`
    }

    const result = (products as Array<{
      code: string
      name: string
      stock_quantity: number
      low_stock_threshold: number
    }>).map(p => ({
      code: p.code,
      name: p.name,
      stock_quantity: p.stock_quantity,
      low_stock: p.stock_quantity <= p.low_stock_threshold,
    }))

    return JSON.stringify(result)
  })

  // ─── get_dealer_profile ───────────────────────────────────────────────────

  handlers.set('get_dealer_profile', async (_input, context) => {
    const { data: dealer, error } = await supabase
      .from('dealers')
      .select('company_name, email, phone, address, dealer_group:dealer_groups(name, discount_percent, min_order_amount)')
      .eq('id', context.dealerId)
      .eq('company_id', context.companyId)
      .single()

    if (error || !dealer) {
      return '[Bayi profili bulunamadi]'
    }

    return JSON.stringify(dealer as DealerRow)
  })

  // ─── create_order ─────────────────────────────────────────────────────────

  handlers.set('create_order', async (input, context) => {
    // Step 1 — Validate items array
    const items = input.items as Array<{ product_code: string; quantity: number }> | undefined
    if (!Array.isArray(items) || items.length === 0) {
      return '[Hata: Siparis kalemleri bos olamaz]'
    }
    if (items.length > 20) {
      return '[Hata: Tek sipariste en fazla 20 urun olabilir]'
    }

    // Step 2 — Resolve products by code
    const productCodes = [...new Set(items.map(i => i.product_code))]

    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('id, code, name, base_price, stock_quantity')
      .eq('company_id', context.companyId)
      .eq('is_active', true)
      .in('code', productCodes)

    if (productsError) {
      return `[Hata: Urunler sorgulanamadi: ${productsError.message}]`
    }
    if (!productsData || productsData.length === 0) {
      return '[Hata: Belirtilen urunler bulunamadi]'
    }

    const products = productsData as ProductForOrder[]
    const foundCodes = new Set(products.map(p => p.code))
    const missingCodes = productCodes.filter(c => !foundCodes.has(c))
    if (missingCodes.length > 0) {
      return `[Hata: Su urunler bulunamadi: ${missingCodes.join(', ')}]`
    }

    // Step 3 — Stock validation
    for (const item of items) {
      const product = products.find(p => p.code === item.product_code)
      if (!product) continue
      if (product.stock_quantity < item.quantity) {
        return `[Stok yetersiz: ${product.name} icin sadece ${product.stock_quantity} adet mevcut, ${item.quantity} adet istendi]`
      }
    }

    // Step 4 — Dealer pricing
    const productIds = products.map(p => p.id)

    const { data: dealerPricesData } = await supabase
      .from('dealer_prices')
      .select('product_id, custom_price')
      .eq('dealer_id', context.dealerId)
      .in('product_id', productIds)

    const dealerPrices = (dealerPricesData as DealerPriceRow[] | null) || []
    const priceMap = new Map(dealerPrices.map(dp => [dp.product_id, dp.custom_price]))

    const { data: dealerData } = await supabase
      .from('dealers')
      .select('dealer_group:dealer_groups(discount_percent, min_order_amount)')
      .eq('id', context.dealerId)
      .eq('company_id', context.companyId)
      .single()

    const discountPercent = (dealerData as any)?.dealer_group?.discount_percent ?? 0
    const minOrderAmount = (dealerData as any)?.dealer_group?.min_order_amount ?? 0

    // Step 5 — Build order items + subtotal
    interface OrderItemInput {
      product_id: string
      product_code: string
      product_name: string
      quantity: number
      unit_price: number
      total_price: number
    }

    const orderItemsInput: OrderItemInput[] = []
    let subtotal = 0

    for (const item of items) {
      const product = products.find(p => p.code === item.product_code)!
      const customPrice = priceMap.get(product.id)
      const unitPrice = customPrice !== undefined
        ? customPrice
        : Math.round(product.base_price * (1 - discountPercent / 100) * 100) / 100
      const totalPrice = Math.round(unitPrice * item.quantity * 100) / 100

      orderItemsInput.push({
        product_id: product.id,
        product_code: product.code,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
      })

      subtotal += totalPrice
    }
    subtotal = Math.round(subtotal * 100) / 100

    // Step 6 — Minimum order amount check
    if (subtotal < minOrderAmount) {
      return `[Minimum siparis tutari ${minOrderAmount} TL. Mevcut tutar: ${subtotal.toFixed(2)} TL]`
    }

    // Step 7 — Get pending status ID
    const { data: statusData, error: statusError } = await supabase
      .from('order_statuses')
      .select('id')
      .eq('code', 'pending')
      .single()

    if (statusError || !statusData) {
      return '[Hata: Siparis durumu bulunamadi]'
    }
    const pendingStatus = statusData as OrderStatusRow

    // Step 8 — Generate order number
    const { data: orderNumberResult } = await supabase.rpc('generate_order_number')
    const orderNumber = (orderNumberResult as string | null) || `ORD-${Date.now()}`

    // Step 9 — Insert order
    const { data: orderData, error: orderError } = await (supabase as any)
      .from('orders')
      .insert({
        company_id: context.companyId,
        order_number: orderNumber,
        dealer_id: context.dealerId,
        status_id: pendingStatus.id,
        subtotal: subtotal,
        discount_amount: 0,
        total_amount: subtotal,
        notes: 'Siparis Telegram uzerinden olusturuldu',
      })
      .select()
      .single()

    if (orderError || !orderData) {
      return `[Hata: Siparis olusturulamadi: ${orderError?.message ?? 'Bilinmeyen hata'}]`
    }
    const order = orderData as InsertedOrder

    // Step 10 — Insert order items
    const orderItemsWithOrderId = orderItemsInput.map(item => ({
      company_id: context.companyId,
      order_id: order.id,
      ...item,
    }))

    const { error: itemsError } = await (supabase as any)
      .from('order_items')
      .insert(orderItemsWithOrderId)

    if (itemsError) {
      // Rollback: delete the order
      await (supabase as any).from('orders').delete().eq('id', order.id)
      return `[Hata: Siparis kalemleri kaydedilemedi: ${itemsError.message}]`
    }

    // Step 11 — Insert status history
    await (supabase as any)
      .from('order_status_history')
      .insert({
        company_id: context.companyId,
        order_id: order.id,
        status_id: pendingStatus.id,
        notes: 'Siparis Telegram uzerinden olusturuldu',
      })

    // Step 12 — Return success
    return JSON.stringify({
      success: true,
      order_number: order.order_number,
      order_id: order.id,
      total_amount: subtotal,
      items_count: orderItemsInput.length,
    })
  })

  return handlers
}
