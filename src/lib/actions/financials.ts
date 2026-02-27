'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ============================================
// TYPES
// ============================================

export interface DealerBalance {
  totalDebit: number   // Toplam Borc
  totalCredit: number  // Toplam Alacak
  netBalance: number   // Net Bakiye (positive = owes, negative = credit)
}

export interface TransactionType {
  id: string
  code: string
  name: string
  balanceEffect: 'debit' | 'credit'
}

export interface DealerTransaction {
  id: string
  amount: number
  description: string
  referenceNumber: string | null
  transactionDate: string
  dueDate: string | null
  notes: string | null
  createdAt: string
  transactionType: {
    code: string
    name: string
    balanceEffect: 'debit' | 'credit'
  }
  order: {
    id: string
    orderNumber: string
  } | null
}

export interface TransactionFilters {
  startDate?: string
  endDate?: string
  typeCode?: string
  page?: number
  pageSize?: number
}

export interface DealerInvoice {
  id: string
  invoiceNumber: string
  invoiceDate: string
  totalAmount: number
  fileName: string
  createdAt: string
  transactionId: string | null
}

// ============================================
// SERVER ACTIONS
// ============================================

/**
 * Get dealer's current balance breakdown
 * Uses get_dealer_balance_breakdown RPC for consistency
 */
export async function getDealerBalance(): Promise<DealerBalance> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { totalDebit: 0, totalCredit: 0, netBalance: 0 }
  }

  // Get dealer ID
  const { data: dealer } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!dealer) {
    return { totalDebit: 0, totalCredit: 0, netBalance: 0 }
  }

  const dealerId = (dealer as { id: string }).id

  // Use database function for consistency
  const { data, error } = await (supabase as any)
    .rpc('get_dealer_balance_breakdown', { p_dealer_id: dealerId })
    .single()

  if (error || !data) {
    console.error('Error fetching balance:', error)
    return { totalDebit: 0, totalCredit: 0, netBalance: 0 }
  }

  const result = data as { total_debit: number; total_credit: number; net_balance: number }

  return {
    totalDebit: result.total_debit ?? 0,
    totalCredit: result.total_credit ?? 0,
    netBalance: result.net_balance ?? 0,
  }
}

/**
 * Get all active transaction types for filter dropdown
 */
export async function getTransactionTypes(): Promise<TransactionType[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('transaction_types')
    .select('id, code, name, balance_effect')
    .eq('is_active', true)
    .order('display_order')

  if (error || !data) return []

  return data.map((t: any) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    balanceEffect: t.balance_effect as 'debit' | 'credit',
  }))
}

/**
 * Get dealer's transaction history with filters and pagination
 */
export async function getDealerTransactions(
  filters: TransactionFilters = {}
): Promise<{ transactions: DealerTransaction[]; totalCount: number }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { transactions: [], totalCount: 0 }
  }

  // Get dealer ID
  const { data: dealer } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!dealer) {
    return { transactions: [], totalCount: 0 }
  }

  const dealerId = (dealer as { id: string }).id
  const page = filters.page || 1
  const pageSize = filters.pageSize || 20
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('dealer_transactions')
    .select(`
      id,
      amount,
      description,
      reference_number,
      transaction_date,
      due_date,
      notes,
      created_at,
      transaction_type:transaction_types(
        code,
        name,
        balance_effect
      ),
      order:orders(
        id,
        order_number
      )
    `, { count: 'exact' })
    .eq('dealer_id', dealerId)
    .order('transaction_date', { ascending: false })
    .range(offset, offset + pageSize - 1)

  // Apply date filters
  if (filters.startDate) {
    query = query.gte('transaction_date', filters.startDate)
  }
  if (filters.endDate) {
    query = query.lte('transaction_date', filters.endDate)
  }

  // Apply type filter
  if (filters.typeCode) {
    const { data: typeData } = await supabase
      .from('transaction_types')
      .select('id')
      .eq('code', filters.typeCode)
      .single()

    if (typeData) {
      query = query.eq('transaction_type_id', (typeData as { id: string }).id)
    }
  }

  const { data, count, error } = await query

  if (error) {
    console.error('Error fetching transactions:', error)
    return { transactions: [], totalCount: 0 }
  }

  const transactions: DealerTransaction[] = (data || []).map((t: any) => ({
    id: t.id,
    amount: t.amount,
    description: t.description,
    referenceNumber: t.reference_number,
    transactionDate: t.transaction_date,
    dueDate: t.due_date,
    notes: t.notes,
    createdAt: t.created_at,
    transactionType: t.transaction_type ? {
      code: t.transaction_type.code,
      name: t.transaction_type.name,
      balanceEffect: t.transaction_type.balance_effect,
    } : { code: 'unknown', name: 'Bilinmeyen', balanceEffect: 'debit' as const },
    order: t.order ? {
      id: t.order.id,
      orderNumber: t.order.order_number,
    } : null,
  }))

  return {
    transactions,
    totalCount: count || 0,
  }
}

/**
 * Get dealer's invoices list
 */
export async function getDealerInvoices(): Promise<DealerInvoice[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Get dealer ID
  const { data: dealer } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!dealer) return []

  const dealerId = (dealer as { id: string }).id

  const { data, error } = await supabase
    .from('dealer_invoices')
    .select(`
      id,
      invoice_number,
      invoice_date,
      total_amount,
      file_name,
      created_at,
      transaction_id
    `)
    .eq('dealer_id', dealerId)
    .order('invoice_date', { ascending: false })

  if (error || !data) return []

  return data.map((inv: any) => ({
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    invoiceDate: inv.invoice_date,
    totalAmount: inv.total_amount,
    fileName: inv.file_name,
    createdAt: inv.created_at,
    transactionId: inv.transaction_id,
  }))
}

/**
 * Get signed URL for invoice download
 * Verifies dealer ownership before generating URL
 */
export async function getInvoiceDownloadUrl(
  invoiceId: string
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum acmaniz gerekiyor' }

  // Get dealer ID
  const { data: dealer } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!dealer) return { error: 'Bayi bulunamadi' }

  const dealerId = (dealer as { id: string }).id

  // Get invoice (RLS will ensure dealer ownership)
  const { data: invoice, error } = await supabase
    .from('dealer_invoices')
    .select('file_path, file_name')
    .eq('id', invoiceId)
    .eq('dealer_id', dealerId) // Extra safety check
    .single()

  if (error || !invoice) {
    return { error: 'Fatura bulunamadi' }
  }

  const invoiceData = invoice as { file_path: string; file_name: string }

  // Generate signed URL (valid for 1 hour)
  const { data: signedUrl, error: urlError } = await supabase.storage
    .from('dealer-invoices')
    .createSignedUrl(invoiceData.file_path, 3600) // 1 hour

  if (urlError || !signedUrl) {
    console.error('Error generating signed URL:', urlError)
    return { error: 'Indirme linki olusturulamadi' }
  }

  return { url: signedUrl.signedUrl }
}

// ============================================
// ADMIN SERVER ACTIONS
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

// Schema for creating transactions
const createTransactionSchema = z.object({
  dealerId: z.string().uuid(),
  transactionTypeCode: z.enum(['payment', 'credit_note', 'debit_note', 'opening_balance']),
  amount: z.number().positive(),
  description: z.string().min(1),
  referenceNumber: z.string().optional(),
  transactionDate: z.string(),
  notes: z.string().optional(),
})

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>

/**
 * Admin: Create a transaction (payment, adjustment) for a dealer
 */
export async function createDealerTransaction(
  input: CreateTransactionInput
): Promise<{ success: boolean; error?: string; transactionId?: string }> {
  const supabase = await createClient()

  const { error: authError, user } = await verifyAdmin(supabase)
  if (authError || !user) {
    return { success: false, error: authError || 'Yetkilendirme hatasi' }
  }

  // Validate input
  const parsed = createTransactionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Gecersiz veri: ' + parsed.error.issues[0]?.message }
  }

  const data = parsed.data

  // Get transaction type
  const { data: txType } = await supabase
    .from('transaction_types')
    .select('id')
    .eq('code', data.transactionTypeCode)
    .single()

  if (!txType) {
    return { success: false, error: 'Gecersiz islem tipi' }
  }

  const txTypeData = txType as { id: string }

  // Create transaction
  const { data: transaction, error } = await (supabase as any)
    .from('dealer_transactions')
    .insert({
      dealer_id: data.dealerId,
      transaction_type_id: txTypeData.id,
      amount: data.amount,
      reference_number: data.referenceNumber || null,
      description: data.description,
      transaction_date: data.transactionDate,
      notes: data.notes || null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !transaction) {
    console.error('Error creating transaction:', error)
    return { success: false, error: 'Islem olusturulamadi' }
  }

  const txData = transaction as { id: string }

  revalidatePath(`/admin/dealers/${data.dealerId}/financials`)
  revalidatePath(`/financials`)

  return { success: true, transactionId: txData.id }
}

// Schema for uploading invoices
const uploadInvoiceSchema = z.object({
  dealerId: z.string().uuid(),
  invoiceNumber: z.string().min(1),
  invoiceDate: z.string(),
  totalAmount: z.number().positive(),
  description: z.string().min(1),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
})

/**
 * Admin: Upload invoice with PDF file
 */
export async function uploadInvoice(
  formData: FormData
): Promise<{ success: boolean; error?: string; invoiceId?: string }> {
  const supabase = await createClient()

  const { error: authError, user } = await verifyAdmin(supabase)
  if (authError || !user) {
    return { success: false, error: authError || 'Yetkilendirme hatasi' }
  }

  // Parse form data
  const file = formData.get('file') as File | null
  const rawData = {
    dealerId: formData.get('dealerId') as string,
    invoiceNumber: formData.get('invoiceNumber') as string,
    invoiceDate: formData.get('invoiceDate') as string,
    totalAmount: parseFloat(formData.get('totalAmount') as string),
    description: formData.get('description') as string,
    dueDate: (formData.get('dueDate') as string) || undefined,
    notes: (formData.get('notes') as string) || undefined,
  }

  // Validate
  const parsed = uploadInvoiceSchema.safeParse(rawData)
  if (!parsed.success) {
    return { success: false, error: 'Gecersiz veri: ' + parsed.error.issues[0]?.message }
  }

  if (!file || file.type !== 'application/pdf') {
    return { success: false, error: 'Lutfen PDF dosyasi yukleyin' }
  }

  if (file.size > 10 * 1024 * 1024) {
    return { success: false, error: 'Dosya boyutu 10MB\'dan buyuk olamaz' }
  }

  const data = parsed.data

  // Get invoice transaction type
  const { data: invoiceType } = await supabase
    .from('transaction_types')
    .select('id')
    .eq('code', 'invoice')
    .single()

  if (!invoiceType) {
    return { success: false, error: 'Fatura islem tipi bulunamadi' }
  }

  const invoiceTypeData = invoiceType as { id: string }

  // 1. Create transaction record
  const { data: transaction, error: txError } = await (supabase as any)
    .from('dealer_transactions')
    .insert({
      dealer_id: data.dealerId,
      transaction_type_id: invoiceTypeData.id,
      amount: data.totalAmount,
      reference_number: data.invoiceNumber,
      description: data.description,
      transaction_date: data.invoiceDate,
      due_date: data.dueDate || null,
      notes: data.notes || null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (txError || !transaction) {
    console.error('Error creating transaction:', txError)
    return { success: false, error: 'Islem kaydi olusturulamadi' }
  }

  const txData = transaction as { id: string }

  // 2. Upload file to storage
  const fileName = `${data.invoiceNumber.replace(/\//g, '-')}_${Date.now()}.pdf`
  const filePath = `${data.dealerId}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('dealer-invoices')
    .upload(filePath, file, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadError) {
    console.error('Error uploading file:', uploadError)
    // Rollback transaction
    await (supabase as any)
      .from('dealer_transactions')
      .delete()
      .eq('id', txData.id)
    return { success: false, error: 'Dosya yuklenemedi' }
  }

  // 3. Create invoice record
  const { data: invoice, error: invoiceError } = await (supabase as any)
    .from('dealer_invoices')
    .insert({
      dealer_id: data.dealerId,
      transaction_id: txData.id,
      invoice_number: data.invoiceNumber,
      invoice_date: data.invoiceDate,
      total_amount: data.totalAmount,
      file_name: fileName,
      file_path: filePath,
      file_size: file.size,
      mime_type: 'application/pdf',
      uploaded_by: user.id,
    })
    .select('id')
    .single()

  if (invoiceError || !invoice) {
    console.error('Error creating invoice record:', invoiceError)
    // Rollback: delete file and transaction
    await supabase.storage.from('dealer-invoices').remove([filePath])
    await (supabase as any).from('dealer_transactions').delete().eq('id', txData.id)
    return { success: false, error: 'Fatura kaydi olusturulamadi' }
  }

  const invoiceData = invoice as { id: string }

  revalidatePath(`/admin/dealers/${data.dealerId}/financials`)
  revalidatePath(`/financials`)

  return { success: true, invoiceId: invoiceData.id }
}

/**
 * Admin: Get any dealer's balance
 */
export async function getAdminDealerBalance(
  dealerId: string
): Promise<DealerBalance & { error?: string }> {
  const supabase = await createClient()

  const { error: authError } = await verifyAdmin(supabase)
  if (authError) {
    return { totalDebit: 0, totalCredit: 0, netBalance: 0, error: authError }
  }

  const { data, error } = await (supabase as any)
    .rpc('get_dealer_balance_breakdown', { p_dealer_id: dealerId })
    .single()

  if (error || !data) {
    console.error('Error fetching admin balance:', error)
    return { totalDebit: 0, totalCredit: 0, netBalance: 0 }
  }

  const result = data as { total_debit: number; total_credit: number; net_balance: number }

  return {
    totalDebit: result.total_debit ?? 0,
    totalCredit: result.total_credit ?? 0,
    netBalance: result.net_balance ?? 0,
  }
}

/**
 * Admin: Get any dealer's transactions
 */
export async function getAdminDealerTransactions(
  dealerId: string,
  filters: TransactionFilters = {}
): Promise<{ transactions: DealerTransaction[]; totalCount: number; error?: string }> {
  const supabase = await createClient()

  const { error: authError } = await verifyAdmin(supabase)
  if (authError) {
    return { transactions: [], totalCount: 0, error: authError }
  }

  const page = filters.page || 1
  const pageSize = filters.pageSize || 20
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('dealer_transactions')
    .select(`
      id,
      amount,
      description,
      reference_number,
      transaction_date,
      due_date,
      notes,
      created_at,
      transaction_type:transaction_types(
        code,
        name,
        balance_effect
      ),
      order:orders(
        id,
        order_number
      )
    `, { count: 'exact' })
    .eq('dealer_id', dealerId)
    .order('transaction_date', { ascending: false })
    .range(offset, offset + pageSize - 1)

  // Apply date filters
  if (filters.startDate) {
    query = query.gte('transaction_date', filters.startDate)
  }
  if (filters.endDate) {
    query = query.lte('transaction_date', filters.endDate)
  }

  // Apply type filter
  if (filters.typeCode) {
    const { data: typeData } = await supabase
      .from('transaction_types')
      .select('id')
      .eq('code', filters.typeCode)
      .single()

    if (typeData) {
      query = query.eq('transaction_type_id', (typeData as { id: string }).id)
    }
  }

  const { data, count, error } = await query

  if (error) {
    console.error('Error fetching admin transactions:', error)
    return { transactions: [], totalCount: 0 }
  }

  const transactions: DealerTransaction[] = (data || []).map((t: any) => ({
    id: t.id,
    amount: t.amount,
    description: t.description,
    referenceNumber: t.reference_number,
    transactionDate: t.transaction_date,
    dueDate: t.due_date,
    notes: t.notes,
    createdAt: t.created_at,
    transactionType: t.transaction_type ? {
      code: t.transaction_type.code,
      name: t.transaction_type.name,
      balanceEffect: t.transaction_type.balance_effect,
    } : { code: 'unknown', name: 'Bilinmeyen', balanceEffect: 'debit' as const },
    order: t.order ? {
      id: t.order.id,
      orderNumber: t.order.order_number,
    } : null,
  }))

  return {
    transactions,
    totalCount: count || 0,
  }
}

/**
 * Admin: Get dealer info for financials page header
 */
export async function getAdminDealerInfo(
  dealerId: string
): Promise<{ id: string; companyName: string; email: string } | null> {
  const supabase = await createClient()

  const { error: authError } = await verifyAdmin(supabase)
  if (authError) return null

  const { data, error } = await supabase
    .from('dealers')
    .select('id, company_name, email')
    .eq('id', dealerId)
    .single()

  if (error || !data) return null

  const dealer = data as { id: string; company_name: string; email: string }

  return {
    id: dealer.id,
    companyName: dealer.company_name,
    email: dealer.email,
  }
}
