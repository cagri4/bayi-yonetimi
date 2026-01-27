import { createClient } from '@/lib/supabase/server'

export interface FrequentProduct {
  product_id: string
  product_code: string
  product_name: string
  total_quantity: number
  order_count: number
  current_price: number
}

interface OrderIdResult {
  id: string
}

interface OrderItemResult {
  product_id: string
  product_code: string
  product_name: string
  quantity: number
}

/**
 * Get frequently ordered products for a dealer
 * Aggregates order items from the last 90 days
 * Returns top N products sorted by order count
 */
export async function getFrequentProducts(
  dealerId: string,
  limit = 10
): Promise<FrequentProduct[]> {
  const supabase = await createClient()

  // Calculate date 90 days ago
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const dateThreshold = ninetyDaysAgo.toISOString()

  // First, get orders for this dealer in the last 90 days
  const { data: ordersData, error: ordersError } = await supabase
    .from('orders')
    .select('id')
    .eq('dealer_id', dealerId)
    .gte('created_at', dateThreshold)

  if (ordersError || !ordersData || ordersData.length === 0) {
    return []
  }

  const orders = ordersData as unknown as OrderIdResult[]
  const orderIds = orders.map((o) => o.id)

  // Get order items for these orders
  const { data: orderItemsData, error: itemsError } = await supabase
    .from('order_items')
    .select('product_id, product_code, product_name, quantity')
    .in('order_id', orderIds)

  if (itemsError || !orderItemsData) {
    return []
  }

  const orderItems = orderItemsData as unknown as OrderItemResult[]

  // Group by product and aggregate
  const productMap = new Map<
    string,
    {
      product_id: string
      product_code: string
      product_name: string
      total_quantity: number
      order_count: number
    }
  >()

  for (const item of orderItems) {
    const existing = productMap.get(item.product_id)
    if (existing) {
      existing.total_quantity += item.quantity
      existing.order_count += 1
    } else {
      productMap.set(item.product_id, {
        product_id: item.product_id,
        product_code: item.product_code,
        product_name: item.product_name,
        total_quantity: item.quantity,
        order_count: 1,
      })
    }
  }

  // Sort by order count and get top N
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.order_count - a.order_count)
    .slice(0, limit)

  // Get current prices for each product
  const frequentProducts: FrequentProduct[] = []

  for (const product of topProducts) {
    const { data: priceData } = await (supabase as any).rpc('get_dealer_price', {
      p_product_id: product.product_id,
      p_dealer_id: dealerId,
    })

    frequentProducts.push({
      ...product,
      current_price: priceData || 0,
    })
  }

  return frequentProducts
}
