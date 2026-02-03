import { supabase } from './supabase'

// ============================================
// TYPES
// ============================================

export interface CartItem {
  productId: string
  productCode: string
  productName: string
  quantity: number
  price: number
}

export interface OrderStatus {
  code: string
  name: string
}

export interface OrderItem {
  id: string
  product_id: string
  product_code: string
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
}

export interface Order {
  id: string
  order_number: string
  dealer_id: string
  status_id: string
  subtotal: number
  discount_amount: number
  total_amount: number
  notes: string | null
  created_at: string
  updated_at: string
  status: OrderStatus
  items?: OrderItem[]
}

export interface OrderStatusHistoryItem {
  id: string
  order_id: string
  status_id: string
  notes: string | null
  created_at: string
  status: OrderStatus
}

interface DealerForOrder {
  id: string
  dealer_group: {
    id: string
    min_order_amount: number
  } | null
}

interface OrderFromDB {
  id: string
  order_number: string
}

interface StatusRow {
  id: string
}

// ============================================
// DEALER QUERIES
// ============================================

export async function getCurrentDealer() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: dealer } = await supabase
    .from('dealers')
    .select(`
      id,
      company_name,
      email,
      phone,
      address,
      dealer_group:dealer_groups(
        id,
        name,
        discount_percent,
        min_order_amount
      )
    `)
    .eq('user_id', user.id)
    .single()

  return dealer
}

// ============================================
// ORDER QUERIES
// ============================================

export type CreateOrderResult = {
  success: boolean
  message: string
  orderId?: string
  orderNumber?: string
}

export async function createOrder(
  items: CartItem[],
  notes?: string
): Promise<CreateOrderResult> {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, message: 'Oturum acmaniz gerekiyor' }
  }

  // Get dealer info
  const { data: dealerData } = await supabase
    .from('dealers')
    .select(`
      id,
      dealer_group:dealer_groups(
        id,
        min_order_amount
      )
    `)
    .eq('user_id', user.id)
    .single()

  const dealer = dealerData as unknown as DealerForOrder | null
  if (!dealer) {
    return { success: false, message: 'Bayi kaydi bulunamadi' }
  }

  // Calculate totals
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )

  // Validate minimum order amount
  const minOrderAmount = dealer.dealer_group?.min_order_amount || 0
  if (subtotal < minOrderAmount) {
    return {
      success: false,
      message: `Minimum siparis tutari ${minOrderAmount} TL'dir. Mevcut tutar: ${subtotal.toFixed(2)} TL`,
    }
  }

  // Get pending status ID
  const { data: statusData } = await supabase
    .from('order_statuses')
    .select('id')
    .eq('code', 'pending')
    .single()

  const pendingStatus = statusData as StatusRow | null
  if (!pendingStatus) {
    return { success: false, message: 'Siparis durumu bulunamadi' }
  }

  // Generate order number
  const { data: orderNumberResult } = await supabase.rpc('generate_order_number')
  const orderNumber = (orderNumberResult as string) || `ORD-${Date.now()}`

  // Create order
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      dealer_id: dealer.id,
      status_id: pendingStatus.id,
      subtotal: subtotal,
      discount_amount: 0,
      total_amount: subtotal,
      notes: notes || null,
    })
    .select()
    .single()

  const order = orderData as unknown as OrderFromDB | null
  if (orderError || !order) {
    return {
      success: false,
      message: 'Siparis olusturulurken hata olustu: ' + (orderError?.message || 'Bilinmeyen hata'),
    }
  }

  // Create order items
  const orderItems = items.map((item) => ({
    order_id: order.id,
    product_id: item.productId,
    product_code: item.productCode,
    product_name: item.productName,
    quantity: item.quantity,
    unit_price: item.price,
    total_price: item.price * item.quantity,
  }))

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems)

  if (itemsError) {
    // Rollback order if items fail
    await supabase.from('orders').delete().eq('id', order.id)
    return { success: false, message: 'Siparis kalemleri olusturulurken hata olustu' }
  }

  // Create initial status history
  await supabase
    .from('order_status_history')
    .insert({
      order_id: order.id,
      status_id: pendingStatus.id,
      changed_by: user.id,
      notes: 'Siparis olusturuldu',
    })

  return {
    success: true,
    message: 'Siparisiniz basariyla olusturuldu',
    orderId: order.id,
    orderNumber: order.order_number,
  }
}

export async function getDealerOrders(): Promise<Order[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: dealerData } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  const dealer = dealerData as { id: string } | null
  if (!dealer) return []

  const { data: orders } = await supabase
    .from('orders')
    .select(`
      *,
      status:order_statuses(code, name)
    `)
    .eq('dealer_id', dealer.id)
    .order('created_at', { ascending: false })

  return (orders as unknown as Order[]) || []
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: dealerData } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  const dealer = dealerData as { id: string } | null
  if (!dealer) return null

  const { data: order } = await supabase
    .from('orders')
    .select(`
      *,
      status:order_statuses(code, name),
      items:order_items(*)
    `)
    .eq('id', orderId)
    .eq('dealer_id', dealer.id)
    .single()

  return (order as unknown as Order) || null
}

export async function getOrderStatusHistory(orderId: string): Promise<OrderStatusHistoryItem[]> {
  const { data: history } = await supabase
    .from('order_status_history')
    .select(`
      *,
      status:order_statuses(code, name)
    `)
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  return (history as unknown as OrderStatusHistoryItem[]) || []
}

// ============================================
// PRODUCT QUERIES
// ============================================

export interface Product {
  id: string
  sku: string
  name: string
  description: string | null
  base_price: number
  stock_quantity: number
  image_url: string | null
  category_id: string | null
  is_active: boolean
  dealer_price?: number
}

export interface DealerProfile {
  id: string
  company_name: string
  contact_name: string
  email: string
  phone: string | null
  address: string | null
  tax_id: string | null
  dealer_group_id: string | null
  is_active: boolean
  dealer_groups: {
    name: string
    discount_percentage: number
    min_order_amount: number
  } | null
}

export async function getProducts(dealerId?: string): Promise<Product[]> {
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (!products) return []

  // If no dealerId, return products without dealer pricing
  if (!dealerId) {
    return products as unknown as Product[]
  }

  // Fetch dealer prices for each product
  const productsWithPrices = await Promise.all(
    products.map(async (product) => {
      const { data: priceData } = await supabase.rpc('get_dealer_price', {
        p_dealer_id: dealerId,
        p_product_id: product.id,
      })
      return {
        ...product,
        dealer_price: priceData ?? product.base_price,
      }
    })
  )

  return productsWithPrices as unknown as Product[]
}

export async function getProduct(productId: string, dealerId?: string): Promise<Product | null> {
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single()

  if (error || !product) {
    console.error('Error fetching product:', error)
    return null
  }

  if (!dealerId) {
    return product as unknown as Product
  }

  const { data: priceData } = await supabase.rpc('get_dealer_price', {
    p_dealer_id: dealerId,
    p_product_id: product.id,
  })

  return {
    ...product,
    dealer_price: priceData ?? product.base_price,
  } as unknown as Product
}

export async function getDealerProfile(userId: string): Promise<DealerProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('dealer_id')
    .eq('id', userId)
    .single()

  if (error || !data?.dealer_id) return null

  const { data: dealer, error: dealerError } = await supabase
    .from('dealers')
    .select('*, dealer_groups(name, discount_percentage, min_order_amount)')
    .eq('id', data.dealer_id)
    .single()

  if (dealerError || !dealer) return null

  return dealer as unknown as DealerProfile
}

export async function getDealerPrice(dealerId: string, productId: string): Promise<number> {
  const { data } = await supabase.rpc('get_dealer_price', {
    p_dealer_id: dealerId,
    p_product_id: productId,
  })

  return (data as number) || 0
}
