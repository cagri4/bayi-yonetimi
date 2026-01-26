'use server'

import { createClient } from '@/lib/supabase/server'
import { dealerSchema, dealerGroupSchema, dealerPriceSchema } from '@/lib/validations/dealer'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type ActionState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

// ============ DEALER GROUPS ============

export async function getDealerGroups() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('dealer_groups')
    .select('*')
    .order('name')

  if (error) throw error
  return data
}

export async function getDealerGroup(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('dealer_groups')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createDealerGroup(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const validatedFields = dealerGroupSchema.safeParse({
    name: formData.get('name'),
    discount_percent: formData.get('discount_percent'),
    min_order_amount: formData.get('min_order_amount'),
    is_active: formData.get('is_active') === 'true',
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Gecersiz form verileri',
    }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('dealer_groups')
    .insert(validatedFields.data)

  if (error) {
    if (error.code === '23505') {
      return { errors: { name: ['Bu grup adi zaten kullaniliyor'] } }
    }
    return { message: 'Grup eklenirken hata olustu: ' + error.message }
  }

  revalidatePath('/admin/dealer-groups')
  return { success: true, message: 'Grup olusturuldu' }
}

export async function updateDealerGroup(
  id: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const validatedFields = dealerGroupSchema.safeParse({
    name: formData.get('name'),
    discount_percent: formData.get('discount_percent'),
    min_order_amount: formData.get('min_order_amount'),
    is_active: formData.get('is_active') === 'true',
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Gecersiz form verileri',
    }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('dealer_groups')
    .update(validatedFields.data)
    .eq('id', id)

  if (error) {
    return { message: 'Grup guncellenirken hata olustu: ' + error.message }
  }

  revalidatePath('/admin/dealer-groups')
  return { success: true, message: 'Grup guncellendi' }
}

// ============ DEALERS ============

export async function getDealers() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('dealers')
    .select(`
      *,
      dealer_group:dealer_groups(id, name, discount_percent)
    `)
    .order('company_name')

  if (error) throw error
  return data
}

export async function getDealer(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('dealers')
    .select(`
      *,
      dealer_group:dealer_groups(id, name, discount_percent)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createDealer(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const validatedFields = dealerSchema.safeParse({
    company_name: formData.get('company_name'),
    email: formData.get('email'),
    phone: formData.get('phone') || null,
    address: formData.get('address') || null,
    dealer_group_id: formData.get('dealer_group_id') || null,
    is_active: formData.get('is_active') === 'true',
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Gecersiz form verileri',
    }
  }

  const supabase = await createClient()

  // Check for duplicate email
  const { data: existing } = await supabase
    .from('dealers')
    .select('id')
    .eq('email', validatedFields.data.email)
    .single()

  if (existing) {
    return {
      errors: { email: ['Bu email adresi zaten kullaniliyor'] },
    }
  }

  const { error } = await supabase
    .from('dealers')
    .insert(validatedFields.data)

  if (error) {
    return { message: 'Bayi eklenirken hata olustu: ' + error.message }
  }

  revalidatePath('/admin/dealers')
  redirect('/admin/dealers')
}

export async function updateDealer(
  id: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const validatedFields = dealerSchema.safeParse({
    company_name: formData.get('company_name'),
    email: formData.get('email'),
    phone: formData.get('phone') || null,
    address: formData.get('address') || null,
    dealer_group_id: formData.get('dealer_group_id') || null,
    is_active: formData.get('is_active') === 'true',
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Gecersiz form verileri',
    }
  }

  const supabase = await createClient()

  // Check for duplicate email (excluding current dealer)
  const { data: existing } = await supabase
    .from('dealers')
    .select('id')
    .eq('email', validatedFields.data.email)
    .neq('id', id)
    .single()

  if (existing) {
    return {
      errors: { email: ['Bu email adresi zaten kullaniliyor'] },
    }
  }

  const { error } = await supabase
    .from('dealers')
    .update(validatedFields.data)
    .eq('id', id)

  if (error) {
    return { message: 'Bayi guncellenirken hata olustu: ' + error.message }
  }

  revalidatePath('/admin/dealers')
  redirect('/admin/dealers')
}

export async function toggleDealerActive(
  id: string,
  isActive: boolean
): Promise<ActionState> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('dealers')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) {
    return { message: 'Bayi durumu degistirilemedi' }
  }

  revalidatePath('/admin/dealers')
  return { success: true, message: isActive ? 'Bayi aktif edildi' : 'Bayi pasif edildi' }
}

// ============ DEALER PRICES ============

export async function getDealerPrices(dealerId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('dealer_prices')
    .select(`
      *,
      product:products(id, code, name, base_price)
    `)
    .eq('dealer_id', dealerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function setDealerPrice(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const validatedFields = dealerPriceSchema.safeParse({
    dealer_id: formData.get('dealer_id'),
    product_id: formData.get('product_id'),
    custom_price: formData.get('custom_price'),
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Gecersiz form verileri',
    }
  }

  const supabase = await createClient()

  // Upsert - update if exists, insert if not
  const { error } = await supabase
    .from('dealer_prices')
    .upsert(validatedFields.data, {
      onConflict: 'dealer_id,product_id',
    })

  if (error) {
    return { message: 'Fiyat kaydedilemedi: ' + error.message }
  }

  revalidatePath(`/admin/dealers/${validatedFields.data.dealer_id}/prices`)
  return { success: true, message: 'Ozel fiyat kaydedildi' }
}

export async function deleteDealerPrice(
  dealerId: string,
  productId: string
): Promise<ActionState> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('dealer_prices')
    .delete()
    .eq('dealer_id', dealerId)
    .eq('product_id', productId)

  if (error) {
    return { message: 'Fiyat silinemedi' }
  }

  revalidatePath(`/admin/dealers/${dealerId}/prices`)
  return { success: true, message: 'Ozel fiyat silindi' }
}
