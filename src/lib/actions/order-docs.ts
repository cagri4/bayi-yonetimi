'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ============================================
// TYPES
// ============================================

export interface OrderDocument {
  id: string
  orderId: string
  documentType: 'invoice' | 'irsaliye'
  fileName: string
  filePath: string
  fileSize: number
  uploadedAt: string
}

export interface CargoInfo {
  vehiclePlate: string | null
  driverName: string | null
  driverPhone: string | null
  cargoNotes: string | null
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

const uploadDocumentSchema = z.object({
  orderId: z.string().uuid('Gecersiz siparis ID'),
  documentType: z.enum(['invoice', 'irsaliye'], {
    error: () => 'Belge tipi Fatura veya Irsaliye olmalidir',
  }),
})

const cargoInfoSchema = z.object({
  vehiclePlate: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  cargoNotes: z.string().optional(),
})

// ============================================
// HELPER: VERIFY ADMIN
// ============================================

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

// ============================================
// ADMIN MUTATIONS
// ============================================

/**
 * Admin: Upload order document (invoice or irsaliye PDF)
 */
export async function uploadOrderDocument(
  formData: FormData
): Promise<{ success: boolean; error?: string; documentId?: string }> {
  const supabase = await createClient()

  const { error: authError, user } = await verifyAdmin(supabase)
  if (authError || !user) {
    return { success: false, error: authError || 'Yetkilendirme hatasi' }
  }

  // Parse form data
  const file = formData.get('file') as File | null
  const rawData = {
    orderId: formData.get('orderId') as string,
    documentType: formData.get('documentType') as string,
  }

  // Validate metadata
  const parsed = uploadDocumentSchema.safeParse(rawData)
  if (!parsed.success) {
    return { success: false, error: 'Gecersiz veri: ' + parsed.error.issues[0]?.message }
  }

  // Validate file
  if (!file || file.type !== 'application/pdf') {
    return { success: false, error: 'Lutfen PDF dosyasi yukleyin' }
  }

  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: 'Dosya boyutu 5MB\'dan buyuk olamaz' }
  }

  const data = parsed.data

  // Verify order exists
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number')
    .eq('id', data.orderId)
    .single()

  if (orderError || !order) {
    return { success: false, error: 'Siparis bulunamadi' }
  }

  // Generate unique file path: order-docs/{orderId}/{timestamp}-{documentType}.pdf
  const timestamp = Date.now()
  const fileName = `${timestamp}-${data.documentType}.pdf`
  const filePath = `order-docs/${data.orderId}/${fileName}`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('order-documents')
    .upload(filePath, file, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadError) {
    console.error('Error uploading file:', uploadError)
    return { success: false, error: 'Dosya yuklenemedi: ' + uploadError.message }
  }

  // Insert metadata into order_documents table
  const { data: document, error: insertError } = await (supabase as any)
    .from('order_documents')
    .insert({
      order_id: data.orderId,
      document_type: data.documentType,
      file_name: fileName,
      file_path: filePath,
      file_size: file.size,
      mime_type: 'application/pdf',
      uploaded_by: user.id,
    })
    .select('id')
    .single()

  if (insertError || !document) {
    console.error('Error inserting document metadata:', insertError)
    // Rollback: delete uploaded file
    await supabase.storage.from('order-documents').remove([filePath])
    return { success: false, error: 'Belge kaydi olusturulamadi' }
  }

  const docData = document as { id: string }

  // Revalidate order pages
  revalidatePath(`/admin/orders/${data.orderId}`)
  revalidatePath(`/orders/${data.orderId}`)
  revalidatePath('/admin/orders')

  return { success: true, documentId: docData.id }
}

/**
 * Admin: Delete order document
 */
export async function deleteOrderDocument(
  documentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error: authError } = await verifyAdmin(supabase)
  if (authError) {
    return { success: false, error: authError }
  }

  // Get document record for file_path
  const { data: document, error: fetchError } = await supabase
    .from('order_documents')
    .select('file_path, order_id')
    .eq('id', documentId)
    .single()

  if (fetchError || !document) {
    return { success: false, error: 'Belge bulunamadi' }
  }

  const docData = document as { file_path: string; order_id: string }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('order-documents')
    .remove([docData.file_path])

  if (storageError) {
    console.error('Error deleting file from storage:', storageError)
    // Continue with DB deletion even if storage fails
  }

  // Delete from order_documents table
  const { error: deleteError } = await supabase
    .from('order_documents')
    .delete()
    .eq('id', documentId)

  if (deleteError) {
    console.error('Error deleting document record:', deleteError)
    return { success: false, error: 'Belge silinemedi' }
  }

  // Revalidate pages
  revalidatePath(`/admin/orders/${docData.order_id}`)
  revalidatePath(`/orders/${docData.order_id}`)

  return { success: true }
}

/**
 * Admin: Update cargo tracking information for order
 */
export async function updateCargoInfo(
  orderId: string,
  data: {
    vehiclePlate?: string
    driverName?: string
    driverPhone?: string
    cargoNotes?: string
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error: authError } = await verifyAdmin(supabase)
  if (authError) {
    return { success: false, error: authError }
  }

  // Validate orderId is UUID
  if (!z.string().uuid().safeParse(orderId).success) {
    return { success: false, error: 'Gecersiz siparis ID' }
  }

  // Validate cargo data
  const parsed = cargoInfoSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Gecersiz veri: ' + parsed.error.issues[0]?.message }
  }

  const cargoData = parsed.data

  // Verify order exists
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    return { success: false, error: 'Siparis bulunamadi' }
  }

  // Update orders table with cargo info
  const { error: updateError } = await supabase
    .from('orders')
    .update({
      vehicle_plate: cargoData.vehiclePlate || null,
      driver_name: cargoData.driverName || null,
      driver_phone: cargoData.driverPhone || null,
      cargo_notes: cargoData.cargoNotes || null,
    })
    .eq('id', orderId)

  if (updateError) {
    console.error('Error updating cargo info:', updateError)
    return { success: false, error: 'Kargo bilgisi guncellenemedi' }
  }

  // Revalidate pages
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/orders/${orderId}`)

  return { success: true }
}

// ============================================
// DEALER/SHARED QUERIES
// ============================================

/**
 * Get documents for an order
 * RLS automatically filters to authorized orders
 */
export async function getOrderDocuments(orderId: string): Promise<OrderDocument[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('order_documents')
    .select('id, order_id, document_type, file_name, file_path, file_size, uploaded_at')
    .eq('order_id', orderId)
    .order('uploaded_at', { ascending: false })

  if (error || !data) {
    console.error('Error fetching order documents:', error)
    return []
  }

  return data.map((doc: any) => ({
    id: doc.id,
    orderId: doc.order_id,
    documentType: doc.document_type as 'invoice' | 'irsaliye',
    fileName: doc.file_name,
    filePath: doc.file_path,
    fileSize: doc.file_size,
    uploadedAt: doc.uploaded_at,
  }))
}

/**
 * Get signed URL for document download
 * Verifies dealer ownership via RLS
 */
export async function getDocumentDownloadUrl(
  documentId: string
): Promise<{ url: string; expiresAt: number } | { error: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum acmaniz gerekiyor' }

  // Get document (RLS will filter by ownership)
  const { data: document, error } = await supabase
    .from('order_documents')
    .select('file_path, file_name')
    .eq('id', documentId)
    .single()

  if (error || !document) {
    console.error('Error fetching document:', error)
    return { error: 'Belge bulunamadi veya erisim yetkiniz yok' }
  }

  const docData = document as { file_path: string; file_name: string }

  // Generate signed URL (60 minutes expiry)
  const expirySeconds = 3600
  const { data: signedUrl, error: urlError } = await supabase.storage
    .from('order-documents')
    .createSignedUrl(docData.file_path, expirySeconds)

  if (urlError || !signedUrl) {
    console.error('Error generating signed URL:', urlError)
    return { error: 'Indirme linki olusturulamadi' }
  }

  return {
    url: signedUrl.signedUrl,
    expiresAt: Date.now() + expirySeconds * 1000,
  }
}

/**
 * Get cargo tracking information for an order
 * RLS handles authorization via orders table
 */
export async function getCargoInfo(orderId: string): Promise<CargoInfo | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('orders')
    .select('vehicle_plate, driver_name, driver_phone, cargo_notes')
    .eq('id', orderId)
    .single()

  if (error || !data) {
    console.error('Error fetching cargo info:', error)
    return null
  }

  const cargoData = data as {
    vehicle_plate: string | null
    driver_name: string | null
    driver_phone: string | null
    cargo_notes: string | null
  }

  // Return null if no cargo info is set
  if (
    !cargoData.vehicle_plate &&
    !cargoData.driver_name &&
    !cargoData.driver_phone &&
    !cargoData.cargo_notes
  ) {
    return null
  }

  return {
    vehiclePlate: cargoData.vehicle_plate,
    driverName: cargoData.driver_name,
    driverPhone: cargoData.driver_phone,
    cargoNotes: cargoData.cargo_notes,
  }
}
