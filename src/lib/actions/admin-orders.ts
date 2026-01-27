'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Types for admin orders
export interface AdminOrderFilters {
  page?: number
  status?: string
  dealerId?: string
  from?: string
  to?: string
}

interface OrderWithRelations {
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
  dealer: {
    id: string
    company_name: string
    email: string
  } | null
  status: {
    id: string
    code: string
    name: string
  } | null
}

interface ValidStatus {
  id: string
  code: string
  name: string
}

export type AdminOrderActionState = {
  success?: boolean
  error?: string
}

/**
 * Get all orders with filters for admin
 * Admin-only function
 */
export async function getAdminOrders(filters: AdminOrderFilters = {}) {
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { orders: [], count: 0, error: 'Oturum acmaniz gerekiyor' }
  }

  // Verify admin role
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile = userProfile as { role: string } | null
  if (profile?.role !== 'admin') {
    return { orders: [], count: 0, error: 'Bu islem icin yetkiniz yok' }
  }

  // Build query with pagination
  const pageSize = 50
  const page = filters.page || 1
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('orders')
    .select(`
      *,
      dealer:dealers(id, company_name, email),
      status:order_statuses(id, code, name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  // Apply filters conditionally
  if (filters.status) {
    query = query.eq('status_id', filters.status)
  }

  if (filters.dealerId) {
    query = query.eq('dealer_id', filters.dealerId)
  }

  if (filters.from) {
    query = query.gte('created_at', filters.from)
  }

  if (filters.to) {
    // Add time to include the whole day
    query = query.lte('created_at', `${filters.to}T23:59:59.999Z`)
  }

  const { data: orders, count, error } = await query

  if (error) {
    return { orders: [], count: 0, error: 'Siparisler yuklenirken hata olustu' }
  }

  return {
    orders: (orders || []) as OrderWithRelations[],
    count: count || 0,
    error: null
  }
}

/**
 * Update order status with validation
 * Admin-only function - validates transition via database function
 */
export async function updateOrderStatus(
  orderId: string,
  newStatusId: string,
  notes?: string
): Promise<AdminOrderActionState> {
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Oturum acmaniz gerekiyor' }
  }

  // Verify admin role
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile = userProfile as { role: string } | null
  if (profile?.role !== 'admin') {
    return { error: 'Bu islem icin yetkiniz yok' }
  }

  // Validate transition using database function
  const { data: isValid, error: rpcError } = await (supabase as any)
    .rpc('validate_order_status_transition', {
      p_order_id: orderId,
      p_new_status_id: newStatusId,
    })

  if (rpcError) {
    return { error: 'Durum dogrulamasi sirasinda hata olustu' }
  }

  if (!isValid) {
    return { error: 'Gecersiz durum degisikligi' }
  }

  // Update order status
  const { error: updateError } = await (supabase as any)
    .from('orders')
    .update({ status_id: newStatusId })
    .eq('id', orderId)

  if (updateError) {
    return { error: 'Durum guncellenirken hata olustu' }
  }

  // Add notes to status history if provided
  // Note: The status history entry is created by database trigger
  // We update it with the notes if provided
  if (notes) {
    // Get the latest status history entry for this order/status
    const { data: historyEntry } = await supabase
      .from('order_status_history')
      .select('id')
      .eq('order_id', orderId)
      .eq('status_id', newStatusId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const entry = historyEntry as { id: string } | null
    if (entry) {
      await (supabase as any)
        .from('order_status_history')
        .update({ notes, changed_by: user.id })
        .eq('id', entry.id)
    }
  }

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)

  return { success: true }
}

/**
 * Cancel an order
 * Admin-only function - only allows cancellation from pending or confirmed status
 */
export async function cancelOrder(
  orderId: string,
  reason?: string
): Promise<AdminOrderActionState> {
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Oturum acmaniz gerekiyor' }
  }

  // Verify admin role
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile3 = userProfile as { role: string } | null
  if (profile3?.role !== 'admin') {
    return { error: 'Bu islem icin yetkiniz yok' }
  }

  // Get current order status
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      status_id,
      status:order_statuses(code)
    `)
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    return { error: 'Siparis bulunamadi' }
  }

  // Check if current status allows cancellation
  const orderData = order as { status_id: string; status: { code: string } | null }
  const currentStatusCode = orderData.status?.code
  if (!currentStatusCode || !['pending', 'confirmed'].includes(currentStatusCode)) {
    return { error: 'Bu siparis iptal edilemez. Sadece beklemede veya onaylanmis siparisler iptal edilebilir.' }
  }

  // Get cancelled status ID
  const { data: cancelledStatus, error: statusError } = await supabase
    .from('order_statuses')
    .select('id')
    .eq('code', 'cancelled')
    .single()

  if (statusError || !cancelledStatus) {
    return { error: 'Iptal durumu bulunamadi' }
  }

  // Update order status to cancelled
  const cancelStatus = cancelledStatus as { id: string }
  const { error: updateError } = await (supabase as any)
    .from('orders')
    .update({ status_id: cancelStatus.id })
    .eq('id', orderId)

  if (updateError) {
    return { error: 'Siparis iptal edilirken hata olustu' }
  }

  // Update status history with reason
  const cancelNotes = reason ? `Iptal sebebi: ${reason}` : 'Siparis iptal edildi'

  // Get the latest status history entry
  const { data: historyEntry } = await supabase
    .from('order_status_history')
    .select('id')
    .eq('order_id', orderId)
    .eq('status_id', cancelStatus.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const entry2 = historyEntry as { id: string } | null
  if (entry2) {
    await (supabase as any)
      .from('order_status_history')
      .update({ notes: cancelNotes, changed_by: user.id })
      .eq('id', entry2.id)
  }

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)

  return { success: true }
}

/**
 * Get valid next statuses for an order
 * Used to populate status dropdown with only valid transitions
 */
export async function getValidNextStatuses(orderId: string): Promise<ValidStatus[]> {
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return []
  }

  // Verify admin role
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile4 = userProfile as { role: string } | null
  if (profile4?.role !== 'admin') {
    return []
  }

  // Get current order status
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('status_id')
    .eq('id', orderId)
    .single()

  const orderRecord = order as { status_id: string } | null
  if (orderError || !orderRecord) {
    return []
  }

  // Get valid transitions from current status
  const { data: transitions, error: transitionsError } = await supabase
    .from('order_status_transitions')
    .select(`
      to_status_id,
      to_status:order_statuses!order_status_transitions_to_status_id_fkey(id, code, name)
    `)
    .eq('from_status_id', orderRecord.status_id)

  if (transitionsError || !transitions) {
    return []
  }

  // Map to valid status array
  type TransitionRecord = { to_status_id: string; to_status: { id: string; code: string; name: string } | null }
  return (transitions as TransitionRecord[])
    .filter(t => t.to_status !== null)
    .map(t => ({
      id: t.to_status!.id,
      code: t.to_status!.code,
      name: t.to_status!.name,
    }))
}
