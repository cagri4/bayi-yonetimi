'use server'

import { createClient } from '@/lib/supabase/server'

export interface CatalogProduct {
  id: string
  code: string
  name: string
  description: string | null
  base_price: number
  dealer_price: number
  stock_quantity: number
  low_stock_threshold: number
  image_url: string | null
  created_at?: string
  category: { id: string; name: string; slug: string } | null
  brand: { id: string; name: string; slug: string } | null
}

export interface DealerInfo {
  id: string
  company_name: string
  dealer_group: {
    id: string
    name: string
    discount_percent: number
    min_order_amount: number
  } | null
}

export interface CatalogFilters {
  search?: string
  category_id?: string
  brand_id?: string
  is_new?: boolean
}

export async function getDealerInfo(): Promise<DealerInfo | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const result = await supabase
    .from('dealers')
    .select(`
      id,
      company_name,
      dealer_group:dealer_groups(
        id,
        name,
        discount_percent,
        min_order_amount
      )
    `)
    .eq('user_id', user.id)
    .single()

  return result.data as DealerInfo | null
}

interface DealerForPricing {
  id: string
  dealer_group: { discount_percent: number } | null
}

interface ProductFromDB {
  id: string
  code: string
  name: string
  description: string | null
  base_price: number
  stock_quantity: number
  low_stock_threshold: number
  image_url: string | null
  created_at: string
  category: { id: string; name: string; slug: string } | null
  brand: { id: string; name: string; slug: string } | null
}

interface DealerPriceRow {
  product_id: string
  custom_price: number
}

export async function getCatalogProducts(
  filters?: CatalogFilters
): Promise<CatalogProduct[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Get dealer info for pricing
  const dealerResult = await supabase
    .from('dealers')
    .select(`
      id,
      dealer_group:dealer_groups(
        discount_percent
      )
    `)
    .eq('user_id', user.id)
    .single()

  const dealer = dealerResult.data as DealerForPricing | null
  if (!dealer) return []

  // Get products with categories and brands
  let query = supabase
    .from('products')
    .select(`
      id,
      code,
      name,
      description,
      base_price,
      stock_quantity,
      low_stock_threshold,
      image_url,
      created_at,
      category:categories(id, name, slug),
      brand:brands(id, name, slug)
    `)
    .eq('is_active', true)
    .order('name')

  // Apply filters
  if (filters?.category_id) {
    query = query.eq('category_id', filters.category_id)
  }

  if (filters?.brand_id) {
    query = query.eq('brand_id', filters.brand_id)
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`)
  }

  if (filters?.is_new) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    query = query.gte('created_at', thirtyDaysAgo.toISOString())
  }

  const { data: productsData, error } = await query

  if (error || !productsData) return []

  const products = productsData as ProductFromDB[]

  // Get dealer-specific prices
  const pricesResult = await supabase
    .from('dealer_prices')
    .select('product_id, custom_price')
    .eq('dealer_id', dealer.id)

  const dealerPrices = (pricesResult.data as DealerPriceRow[] | null) || []

  const priceMap = new Map(
    dealerPrices.map((dp) => [dp.product_id, dp.custom_price])
  )

  // Calculate dealer prices
  const discountPercent = dealer.dealer_group?.discount_percent || 0

  return products.map((product) => {
    // Check for dealer-specific override first
    const customPrice = priceMap.get(product.id)

    // Calculate final dealer price
    const dealerPrice = customPrice !== undefined
      ? customPrice
      : product.base_price * (1 - discountPercent / 100)

    return {
      ...product,
      dealer_price: Math.round(dealerPrice * 100) / 100, // Round to 2 decimals
      created_at: product.created_at,
    }
  })
}

interface CategoryBrandItem {
  id: string
  name: string
  slug: string
}

export async function getCategories(): Promise<CategoryBrandItem[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('categories')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('name')

  return (data as CategoryBrandItem[] | null) || []
}

export async function getBrands(): Promise<CategoryBrandItem[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('brands')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('name')

  return (data as CategoryBrandItem[] | null) || []
}
