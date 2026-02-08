'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface FavoriteProduct {
  id: string
  code: string
  name: string
  description: string | null
  base_price: number
  dealer_price: number
  stock_quantity: number
  low_stock_threshold: number
  image_url: string | null
  category: { id: string; name: string; slug: string } | null
  brand: { id: string; name: string; slug: string } | null
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
  category: { id: string; name: string; slug: string } | null
  brand: { id: string; name: string; slug: string } | null
}

interface DealerPriceRow {
  product_id: string
  custom_price: number
}

/**
 * Toggle favorite status for a product
 * @param productId - UUID of the product
 * @returns true if added to favorites, false if removed
 */
export async function toggleFavorite(productId: string): Promise<boolean> {
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get dealer ID
  const { data: dealerData, error: dealerError } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (dealerError || !dealerData) {
    throw new Error('Dealer not found')
  }

  const dealerId = (dealerData as { id: string }).id

  // Check if favorite exists
  const { data: existingFavorite } = await supabase
    .from('dealer_favorites')
    .select('id')
    .eq('dealer_id', dealerId)
    .eq('product_id', productId)
    .single()

  if (existingFavorite) {
    // Remove favorite
      const { error: deleteError } = await supabase
      .from('dealer_favorites')
      .delete()
      .eq('dealer_id', dealerId)
      .eq('product_id', productId)

    if (deleteError) {
      throw new Error('Failed to remove favorite')
    }

    // Revalidate pages
    revalidatePath('/favorites')
    revalidatePath('/catalog')

    return false // Removed
  } else {
    // Add favorite
      const { error: insertError } = await (supabase as any)
      .from('dealer_favorites')
      .insert({
        dealer_id: dealerId,
        product_id: productId,
      })

    if (insertError) {
      throw new Error('Failed to add favorite')
    }

    // Revalidate pages
    revalidatePath('/favorites')
    revalidatePath('/catalog')

    return true // Added
  }
}

/**
 * Get all favorite products for the current dealer with fresh pricing
 * @returns Array of favorite products with dealer-specific pricing
 */
export async function getFavoriteProducts(): Promise<FavoriteProduct[]> {
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Get dealer info with group discount
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

  // Query favorites with product join
  const { data: favoritesData, error } = await supabase
    .from('dealer_favorites')
    .select(`
      product:products(
        id,
        code,
        name,
        description,
        base_price,
        stock_quantity,
        low_stock_threshold,
        image_url,
        category:categories(id, name, slug),
        brand:brands(id, name, slug)
      )
    `)
    .eq('dealer_id', dealer.id)
    .order('created_at', { ascending: false })

  if (error || !favoritesData) return []

  // Extract products from nested structure
  const products = favoritesData
    .map((fav: any) => fav.product)
    .filter((product: any) => product !== null) as ProductFromDB[]

  // Get dealer-specific price overrides
  const pricesResult = await supabase
    .from('dealer_prices')
    .select('product_id, custom_price')
    .eq('dealer_id', dealer.id)

  const dealerPrices = (pricesResult.data as DealerPriceRow[] | null) || []

  const priceMap = new Map(
    dealerPrices.map((dp) => [dp.product_id, dp.custom_price])
  )

  // Calculate dealer prices (same logic as getCatalogProducts)
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
    }
  })
}

/**
 * Get favorite product IDs for the current dealer
 * Used for hydrating catalog view (marking which products are favorited)
 * @returns Array of product IDs that are favorited
 */
export async function getFavoriteIds(): Promise<string[]> {
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Get dealer ID
  const { data: dealerData } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!dealerData) return []

  const dealerId = (dealerData as { id: string }).id

  // Get favorite product IDs
  const { data: favoritesData } = await supabase
    .from('dealer_favorites')
    .select('product_id')
    .eq('dealer_id', dealerId)

  if (!favoritesData) return []

  return favoritesData.map((fav: any) => fav.product_id)
}
