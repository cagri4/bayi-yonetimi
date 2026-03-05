'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type OrderActionState = {
  success?: boolean
  message?: string
  orderId?: string
  orderNumber?: string
  errors?: Record<string, string[]>
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

export async function createOrder(
  items: Array<{
    productId: string
    productCode: string
    productName: string
    quantity: number
    price: number
  }>,
  notes?: string
): Promise<OrderActionState> {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { message: 'Oturum acmaniz gerekiyor' }
  }

  // Get dealer info
  const dealerResult = await supabase
    .from('dealers')
    .select(`
      id,
      company_id,
      dealer_group:dealer_groups(
        id,
        min_order_amount
      )
    `)
    .eq('user_id', user.id)
    .single()

  const dealer = dealerResult.data as (DealerForOrder & { company_id: string }) | null
  if (!dealer) {
    return { message: 'Bayi kaydı bulunamadı' }
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
      message: `Minimum siparis tutari ${minOrderAmount} TL'dir. Mevcut tutar: ${subtotal.toFixed(2)} TL`,
    }
  }

  // Get pending status ID
  const statusResult = await supabase
    .from('order_statuses')
    .select('id')
    .eq('code', 'pending')
    .single()

  const pendingStatus = statusResult.data as StatusRow | null
  if (!pendingStatus) {
    return { message: 'Siparis durumu bulunamadi' }
  }

  // Generate order number
  const { data: orderNumberResult } = await supabase
    .rpc('generate_order_number')

  const orderNumber = orderNumberResult || `ORD-${Date.now()}`

  // Create order
  const orderResult = await (supabase as any)
    .from('orders')
    .insert({
      order_number: orderNumber,
      dealer_id: dealer.id,
      company_id: dealer.company_id,
      status_id: pendingStatus.id,
      subtotal: subtotal,
      discount_amount: 0,
      total_amount: subtotal,
      notes: notes || null,
    })
    .select()
    .single()

  const order = orderResult.data as OrderFromDB | null
  const orderError = orderResult.error

  if (orderError || !order) {
    return { message: 'Siparis olusturulurken hata olustu: ' + (orderError?.message || 'Bilinmeyen hata') }
  }

  // Create order items
  const orderItems = items.map((item) => ({
    order_id: order.id,
    company_id: dealer.company_id,
    product_id: item.productId,
    product_code: item.productCode,
    product_name: item.productName,
    quantity: item.quantity,
    unit_price: item.price,
    total_price: item.price * item.quantity,
  }))

  const { error: itemsError } = await (supabase as any)
    .from('order_items')
    .insert(orderItems)

  if (itemsError) {
    // Rollback order if items fail
    await (supabase as any).from('orders').delete().eq('id', order.id)
    return { message: 'Siparis kalemleri olusturulurken hata olustu' }
  }

  // Create initial status history
  await (supabase as any)
    .from('order_status_history')
    .insert({
      order_id: order.id,
      company_id: dealer.company_id,
      status_id: pendingStatus.id,
      changed_by: user.id,
      notes: 'Siparis olusturuldu',
    })

  revalidatePath('/orders')

  return {
    success: true,
    message: 'Siparisizin basariyla olusturuldu',
    orderId: order.id,
    orderNumber: order.order_number,
  }
}

interface DealerIdRow {
  id: string
}

export async function getDealerOrders() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const dealerResult = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  const dealer = dealerResult.data as DealerIdRow | null
  if (!dealer) return []

  const { data: orders } = await supabase
    .from('orders')
    .select(`
      *,
      status:order_statuses(code, name),
      items:order_items(*)
    `)
    .eq('dealer_id', dealer.id)
    .order('created_at', { ascending: false })

  return orders || []
}
