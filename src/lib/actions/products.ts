'use server'

import { createClient } from '@/lib/supabase/server'
import { productSchema, stockUpdateSchema } from '@/lib/validations/product'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type ActionState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
}

export interface Product {
  id: string
  code: string
  name: string
  description: string | null
  base_price: number
  stock_quantity: number
  low_stock_threshold: number
  image_url: string | null
  category_id: string | null
  brand_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  category: { id: string; name: string } | null
  brand: { id: string; name: string } | null
}

export async function getProducts(): Promise<Product[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(id, name),
      brand:brands(id, name)
    `)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Product[]
}

export async function getProduct(id: string): Promise<Product> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(id, name),
      brand:brands(id, name)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Product
}

export async function getCategories() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return data
}

export async function getBrands() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('brands')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return data
}

export async function createProduct(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const validatedFields = productSchema.safeParse({
    code: formData.get('code'),
    name: formData.get('name'),
    description: formData.get('description'),
    base_price: formData.get('base_price'),
    stock_quantity: formData.get('stock_quantity'),
    low_stock_threshold: formData.get('low_stock_threshold') || 10,
    category_id: formData.get('category_id') || null,
    brand_id: formData.get('brand_id') || null,
    is_active: formData.get('is_active') === 'true',
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Gecersiz form verileri',
    }
  }

  const supabase = await createClient()

  // Check for duplicate code
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('code', validatedFields.data.code)
    .single()

  if (existing) {
    return {
      errors: { code: ['Bu urun kodu zaten kullaniliyor'] },
      message: 'Urun kodu benzersiz olmali',
    }
  }

  const { error } = await (supabase as any)
    .from('products')
    .insert(validatedFields.data)

  if (error) {
    return { message: 'Urun eklenirken hata olustu: ' + error.message }
  }

  revalidatePath('/admin/products')
  redirect('/admin/products')
}

export async function updateProduct(
  id: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const validatedFields = productSchema.safeParse({
    code: formData.get('code'),
    name: formData.get('name'),
    description: formData.get('description'),
    base_price: formData.get('base_price'),
    stock_quantity: formData.get('stock_quantity'),
    low_stock_threshold: formData.get('low_stock_threshold') || 10,
    category_id: formData.get('category_id') || null,
    brand_id: formData.get('brand_id') || null,
    is_active: formData.get('is_active') === 'true',
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Gecersiz form verileri',
    }
  }

  const supabase = await createClient()

  // Check for duplicate code (excluding current product)
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('code', validatedFields.data.code)
    .neq('id', id)
    .single()

  if (existing) {
    return {
      errors: { code: ['Bu urun kodu zaten kullaniliyor'] },
      message: 'Urun kodu benzersiz olmali',
    }
  }

  const { error } = await (supabase as any)
    .from('products')
    .update(validatedFields.data)
    .eq('id', id)

  if (error) {
    return { message: 'Urun guncellenirken hata olustu: ' + error.message }
  }

  revalidatePath('/admin/products')
  redirect('/admin/products')
}

export async function toggleProductActive(
  id: string,
  isActive: boolean
): Promise<ActionState> {
  const supabase = await createClient()

  const { error } = await (supabase as any)
    .from('products')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) {
    return { message: 'Urun durumu degistirilemedi' }
  }

  revalidatePath('/admin/products')
  return { success: true, message: isActive ? 'Urun aktif edildi' : 'Urun pasif edildi' }
}

export async function updateStock(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const validatedFields = stockUpdateSchema.safeParse({
    product_id: formData.get('product_id'),
    stock_quantity: formData.get('stock_quantity'),
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Gecersiz stok miktari',
    }
  }

  const supabase = await createClient()

  const { error } = await (supabase as any)
    .from('products')
    .update({ stock_quantity: validatedFields.data.stock_quantity })
    .eq('id', validatedFields.data.product_id)

  if (error) {
    return { message: 'Stok guncellenemedi' }
  }

  revalidatePath('/admin/products')
  return { success: true, message: 'Stok guncellendi' }
}

export async function uploadProductImage(
  productId: string,
  formData: FormData
): Promise<ActionState> {
  const file = formData.get('image') as File

  if (!file || file.size === 0) {
    return { message: 'Resim secilmedi' }
  }

  if (!file.type.startsWith('image/')) {
    return { message: 'Sadece resim dosyalari yuklenebilir' }
  }

  if (file.size > 5 * 1024 * 1024) {
    return { message: 'Resim boyutu 5MB\'dan kucuk olmali' }
  }

  const supabase = await createClient()

  const fileExt = file.name.split('.').pop()
  const fileName = `${productId}-${Date.now()}.${fileExt}`
  const filePath = `products/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    return { message: 'Resim yuklenirken hata olustu: ' + uploadError.message }
  }

  const { data: { publicUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(filePath)

  const { error: updateError } = await (supabase as any)
    .from('products')
    .update({ image_url: publicUrl })
    .eq('id', productId)

  if (updateError) {
    return { message: 'Urun resmi guncellenemedi' }
  }

  revalidatePath('/admin/products')
  return { success: true, message: 'Resim yuklendi', imageUrl: publicUrl } as ActionState & { imageUrl?: string }
}

export async function deleteProduct(id: string): Promise<ActionState> {
  const supabase = await createClient()

  const { error } = await (supabase as any)
    .from('products')
    .delete()
    .eq('id', id)

  if (error) {
    return { message: 'Urun silinemedi: ' + error.message }
  }

  revalidatePath('/admin/products')
  return { success: true, message: 'Urun silindi' }
}
