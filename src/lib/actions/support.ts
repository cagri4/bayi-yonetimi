'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type {
  SupportMessage,
  SupportMessageWithDealer,
  FaqCategoryWithItems,
  FaqItem,
  ProductRequest,
} from '@/types/database.types'

// ============================================
// VALIDATION SCHEMAS
// ============================================

const sendMessageSchema = z.object({
  subject: z.string().min(1).max(200),
  category: z.enum(['siparis', 'urun', 'odeme', 'teknik', 'diger']),
  body: z.string().min(10).max(5000),
})

const productRequestSchema = z.object({
  product_id: z.string().uuid().optional(),
  product_name: z.string().min(1).max(200),
  product_code: z.string().optional(),
  requested_quantity: z.number().int().min(1).max(9999),
  notes: z.string().max(1000).optional(),
})

export type SendMessageInput = z.infer<typeof sendMessageSchema>
export type ProductRequestInput = z.infer<typeof productRequestSchema>

// ============================================
// HELPERS
// ============================================

/**
 * Helper to verify admin role
 */
async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum acmaniz gerekiyor', user: null }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const userProfile = profile as { role: string } | null
  if (userProfile?.role !== 'admin') {
    return { error: 'Bu islem icin yetkiniz yok', user: null }
  }

  return { error: null, user }
}

/**
 * Helper to get current dealer ID from session
 */
async function getDealerIdForUser(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ dealerId: string | null; userId: string | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { dealerId: null, userId: null, error: 'Oturum acmaniz gerekiyor' }

  const { data: dealer } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!dealer) return { dealerId: null, userId: user.id, error: 'Bayi bulunamadi' }

  return { dealerId: (dealer as { id: string }).id, userId: user.id, error: null }
}

// ============================================
// DEALER MUTATIONS
// ============================================

/**
 * Dealer: Send a new support message to admin
 */
export async function sendSupportMessage(
  input: SendMessageInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { dealerId, error: authError } = await getDealerIdForUser(supabase)
  if (authError || !dealerId) {
    return { success: false, error: authError || 'Bayi bulunamadi' }
  }

  const parsed = sendMessageSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Gecersiz veri: ' + parsed.error.issues[0]?.message }
  }

  const { error } = await (supabase as any)
    .from('support_messages')
    .insert({
      dealer_id: dealerId,
      subject: parsed.data.subject,
      category: parsed.data.category,
      body: parsed.data.body,
      status: 'pending',
    })

  if (error) {
    console.error('Error sending support message:', error)
    return { success: false, error: 'Mesaj gonderilemedi' }
  }

  revalidatePath('/support')
  return { success: true }
}

/**
 * Dealer: Submit a product request
 */
export async function submitProductRequest(
  input: ProductRequestInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { dealerId, error: authError } = await getDealerIdForUser(supabase)
  if (authError || !dealerId) {
    return { success: false, error: authError || 'Bayi bulunamadi' }
  }

  const parsed = productRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Gecersiz veri: ' + parsed.error.issues[0]?.message }
  }

  const { error } = await (supabase as any)
    .from('product_requests')
    .insert({
      dealer_id: dealerId,
      product_id: parsed.data.product_id || null,
      product_name: parsed.data.product_name,
      product_code: parsed.data.product_code || null,
      requested_quantity: parsed.data.requested_quantity,
      notes: parsed.data.notes || null,
      status: 'open',
    })

  if (error) {
    console.error('Error submitting product request:', error)
    return { success: false, error: 'Talep gonderilemedi' }
  }

  revalidatePath('/support/product-requests')
  return { success: true }
}

// ============================================
// DEALER QUERIES
// ============================================

/**
 * Dealer: Get own support message history
 */
export async function getSupportMessages(): Promise<SupportMessage[]> {
  const supabase = await createClient()

  const { dealerId, error: authError } = await getDealerIdForUser(supabase)
  if (authError || !dealerId) return []

  const { data, error } = await supabase
    .from('support_messages')
    .select('*')
    .eq('dealer_id', dealerId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching support messages:', error)
    return []
  }

  return (data || []) as SupportMessage[]
}

/**
 * Global: Get FAQ categories with their active items
 * No auth required — all authenticated users can read FAQ
 */
export async function getFaqWithCategories(): Promise<FaqCategoryWithItems[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('faq_categories')
    .select(`
      id,
      name,
      display_order,
      is_active,
      created_at,
      faq_items(
        id,
        category_id,
        question,
        answer,
        display_order,
        is_active,
        created_at,
        updated_at
      )
    `)
    .eq('is_active', true)
    .order('display_order')

  if (error) {
    console.error('Error fetching FAQ:', error)
    return []
  }

  // Filter active items and sort by display_order
  return (data || []).map((cat: any) => ({
    ...cat,
    faq_items: (cat.faq_items || [])
      .filter((item: any) => item.is_active)
      .sort((a: any, b: any) => a.display_order - b.display_order),
  })) as FaqCategoryWithItems[]
}

/**
 * Dealer: Get own product request history
 */
export async function getDealerProductRequests(): Promise<ProductRequest[]> {
  const supabase = await createClient()

  const { dealerId, error: authError } = await getDealerIdForUser(supabase)
  if (authError || !dealerId) return []

  const { data, error } = await supabase
    .from('product_requests')
    .select('*')
    .eq('dealer_id', dealerId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching product requests:', error)
    return []
  }

  return (data || []) as ProductRequest[]
}

// ============================================
// ADMIN QUERIES
// ============================================

/**
 * Admin: Get all support messages with dealer info
 */
export async function getAllSupportMessages(): Promise<SupportMessageWithDealer[]> {
  const supabase = await createClient()

  const { error: authError } = await verifyAdmin(supabase)
  if (authError) return []

  const { data, error } = await supabase
    .from('support_messages')
    .select(`
      *,
      dealers(company_name)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching all support messages:', error)
    return []
  }

  return (data || []) as SupportMessageWithDealer[]
}

/**
 * Admin: Get single support message with dealer info
 */
export async function getSupportMessageById(
  messageId: string
): Promise<SupportMessageWithDealer | null> {
  const supabase = await createClient()

  const { error: authError } = await verifyAdmin(supabase)
  if (authError) return null

  const { data, error } = await supabase
    .from('support_messages')
    .select(`
      *,
      dealers(company_name)
    `)
    .eq('id', messageId)
    .single()

  if (error) {
    console.error('Error fetching support message:', error)
    return null
  }

  return data as SupportMessageWithDealer
}

// ============================================
// ADMIN MUTATIONS
// ============================================

/**
 * Admin: Reply to a support message (atomic: sets reply + answered status)
 */
export async function replyToMessage(
  messageId: string,
  replyBody: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error: authError, user } = await verifyAdmin(supabase)
  if (authError || !user) {
    return { success: false, error: authError || 'Yetkilendirme hatasi' }
  }

  const replyBodyParsed = z.string().min(1).max(5000).safeParse(replyBody)
  if (!replyBodyParsed.success) {
    return { success: false, error: 'Gecersiz yanit: ' + replyBodyParsed.error.issues[0]?.message }
  }

  // Atomic update: reply_body + status='answered' in single UPDATE
  const { error } = await (supabase as any)
    .from('support_messages')
    .update({
      reply_body: replyBodyParsed.data,
      replied_at: new Date().toISOString(),
      replied_by: user.id,
      status: 'answered',
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId)

  if (error) {
    console.error('Error replying to message:', error)
    return { success: false, error: 'Yanit gonderilemedi' }
  }

  revalidatePath('/admin/support')
  revalidatePath(`/admin/support/${messageId}`)
  return { success: true }
}

/**
 * Admin: Create a new FAQ category
 */
export async function createFaqCategory(
  name: string,
  displayOrder?: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error: authError } = await verifyAdmin(supabase)
  if (authError) return { success: false, error: authError }

  const { error } = await (supabase as any)
    .from('faq_categories')
    .insert({
      name,
      display_order: displayOrder ?? 0,
      is_active: true,
    })

  if (error) {
    console.error('Error creating FAQ category:', error)
    return { success: false, error: 'Kategori olusturulamadi' }
  }

  revalidatePath('/support/faq')
  revalidatePath('/admin/support/faq')
  return { success: true }
}

/**
 * Admin: Create a new FAQ item in a category
 */
export async function createFaqItem(
  categoryId: string,
  question: string,
  answer: string,
  displayOrder?: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error: authError } = await verifyAdmin(supabase)
  if (authError) return { success: false, error: authError }

  const { error } = await (supabase as any)
    .from('faq_items')
    .insert({
      category_id: categoryId,
      question,
      answer,
      display_order: displayOrder ?? 0,
      is_active: true,
    })

  if (error) {
    console.error('Error creating FAQ item:', error)
    return { success: false, error: 'Soru olusturulamadi' }
  }

  revalidatePath('/support/faq')
  revalidatePath('/admin/support/faq')
  return { success: true }
}

/**
 * Admin: Update an existing FAQ item
 */
export async function updateFaqItem(
  id: string,
  updates: { question?: string; answer?: string; is_active?: boolean; display_order?: number }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error: authError } = await verifyAdmin(supabase)
  if (authError) return { success: false, error: authError }

  const { error } = await (supabase as any)
    .from('faq_items')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('Error updating FAQ item:', error)
    return { success: false, error: 'Soru guncellenemedi' }
  }

  revalidatePath('/support/faq')
  revalidatePath('/admin/support/faq')
  return { success: true }
}

/**
 * Admin: Delete (soft-delete) a FAQ item
 */
export async function deleteFaqItem(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error: authError } = await verifyAdmin(supabase)
  if (authError) return { success: false, error: authError }

  // Soft delete by setting is_active = false
  const { error } = await (supabase as any)
    .from('faq_items')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Error deleting FAQ item:', error)
    return { success: false, error: 'Soru silinemedi' }
  }

  revalidatePath('/support/faq')
  revalidatePath('/admin/support/faq')
  return { success: true }
}
