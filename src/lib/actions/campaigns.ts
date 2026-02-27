'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export interface Campaign {
  id: string
  title: string
  description: string | null
  image_url: string | null
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CampaignDetail extends Campaign {
  products: CampaignProduct[]
}

export interface CampaignProduct {
  product_id: string
  product_code: string
  product_name: string
  product_image_url: string | null
  base_price: number
  dealer_price: number
  discount_percent: number | null
  stock_quantity: number
}

/**
 * Get all active campaigns within date range
 * Dealer query - no 'use server' needed
 */
export async function getActiveCampaigns(): Promise<Campaign[]> {
  const supabase = await createClient()

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('is_active', true)
    .lte('start_date', now)
    .gte('end_date', now)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching campaigns:', error)
    return []
  }

  return data as Campaign[]
}

/**
 * Get campaign detail with linked products and dealer-specific pricing
 */
export async function getCampaignDetail(campaignId: string): Promise<CampaignDetail | null> {
  const supabase = await createClient()

  // Get campaign
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (campaignError || !campaign) {
    console.error('Error fetching campaign:', campaignError)
    return null
  }

  // Get authenticated user and dealer info
  const { data: { user } } = await supabase.auth.getUser()
  let dealerId: string | null = null
  let discountPercent = 0

  if (user) {
    const { data: dealerData } = await supabase
      .from('dealers')
      .select(`
        id,
        dealer_group:dealer_groups(
          discount_percent
        )
      `)
      .eq('user_id', user.id)
      .single()

    if (dealerData) {
      dealerId = (dealerData as any).id
      discountPercent = (dealerData as any).dealer_group?.discount_percent || 0
    }
  }

  // Get campaign products with product details
  const { data: campaignProducts, error: productsError } = await supabase
    .from('campaign_products')
    .select(`
      discount_percent,
      product:products(
        id,
        code,
        name,
        base_price,
        image_url,
        stock_quantity
      )
    `)
    .eq('campaign_id', campaignId)

  if (productsError || !campaignProducts) {
    console.error('Error fetching campaign products:', productsError)
    return { ...campaign, products: [] } as CampaignDetail
  }

  // Get dealer-specific price overrides if dealer is logged in
  let priceMap = new Map<string, number>()
  if (dealerId) {
    const { data: dealerPrices } = await supabase
      .from('dealer_prices')
      .select('product_id, custom_price')
      .eq('dealer_id', dealerId)

    if (dealerPrices) {
      priceMap = new Map(
        dealerPrices.map((dp: any) => [dp.product_id, dp.custom_price])
      )
    }
  }

  // Map products with dealer pricing
  const products: CampaignProduct[] = campaignProducts
    .map((cp: any) => {
      const product = cp.product
      if (!product) return null

      // Check for dealer-specific override first
      const customPrice = priceMap.get(product.id)

      // Calculate final dealer price
      const dealerPrice = customPrice !== undefined
        ? customPrice
        : product.base_price * (1 - discountPercent / 100)

      return {
        product_id: product.id,
        product_code: product.code,
        product_name: product.name,
        product_image_url: product.image_url,
        base_price: product.base_price,
        dealer_price: Math.round(dealerPrice * 100) / 100,
        discount_percent: cp.discount_percent,
        stock_quantity: product.stock_quantity,
      }
    })
    .filter((p): p is CampaignProduct => p !== null)

  return {
    ...campaign,
    products,
  } as CampaignDetail
}

/**
 * Get all campaigns (active and inactive) - Admin only
 */
export async function getAllCampaigns(): Promise<Campaign[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching all campaigns:', error)
    return []
  }

  return data as Campaign[]
}

/**
 * Get campaign with products for editing - Admin only
 */
export async function getCampaignForEdit(campaignId: string): Promise<{
  campaign: Campaign
  productIds: string[]
  productDiscounts: Map<string, number>
} | null> {
  const supabase = await createClient()

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (campaignError || !campaign) return null

  const { data: campaignProducts } = await supabase
    .from('campaign_products')
    .select('product_id, discount_percent')
    .eq('campaign_id', campaignId)

  const productIds = campaignProducts?.map((cp: any) => cp.product_id) || []
  const productDiscounts = new Map(
    campaignProducts?.map((cp: any) => [cp.product_id, cp.discount_percent || 0]) || []
  )

  return {
    campaign: campaign as Campaign,
    productIds,
    productDiscounts,
  }
}

/**
 * Create a new campaign - Admin only
 */
export async function createCampaign(formData: FormData) {
  const supabase = await createClient()

  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const image_url = formData.get('image_url') as string
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string
  const is_active = formData.get('is_active') === 'true'
  const productIds = formData.get('product_ids') as string // JSON array string
  const productDiscounts = formData.get('product_discounts') as string // JSON object string

  // Insert campaign
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      title,
      description: description || null,
      image_url: image_url || null,
      start_date,
      end_date,
      is_active,
    })
    .select()
    .single()

  if (campaignError) {
    console.error('Error creating campaign:', campaignError)
    throw new Error('Failed to create campaign')
  }

  // Link products if provided
  if (productIds) {
    const ids = JSON.parse(productIds) as string[]
    const discounts = productDiscounts ? JSON.parse(productDiscounts) : {}

    const campaignProductsData = ids.map(productId => ({
      campaign_id: campaign.id,
      product_id: productId,
      discount_percent: discounts[productId] || null,
    }))

    const { error: productsError } = await supabase
      .from('campaign_products')
      .insert(campaignProductsData)

    if (productsError) {
      console.error('Error linking products:', productsError)
      // Campaign created but products failed - could rollback or continue
    }
  }

  revalidatePath('/admin/campaigns')
  revalidatePath('/campaigns')
  redirect('/admin/campaigns')
}

/**
 * Update an existing campaign - Admin only
 */
export async function updateCampaign(campaignId: string, formData: FormData) {
  const supabase = await createClient()

  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const image_url = formData.get('image_url') as string
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string
  const is_active = formData.get('is_active') === 'true'
  const productIds = formData.get('product_ids') as string
  const productDiscounts = formData.get('product_discounts') as string

  // Update campaign
  const { error: campaignError } = await supabase
    .from('campaigns')
    .update({
      title,
      description: description || null,
      image_url: image_url || null,
      start_date,
      end_date,
      is_active,
    })
    .eq('id', campaignId)

  if (campaignError) {
    console.error('Error updating campaign:', campaignError)
    throw new Error('Failed to update campaign')
  }

  // Update linked products
  // First delete existing links
  await supabase
    .from('campaign_products')
    .delete()
    .eq('campaign_id', campaignId)

  // Then insert new links
  if (productIds) {
    const ids = JSON.parse(productIds) as string[]
    const discounts = productDiscounts ? JSON.parse(productDiscounts) : {}

    const campaignProductsData = ids.map(productId => ({
      campaign_id: campaignId,
      product_id: productId,
      discount_percent: discounts[productId] || null,
    }))

    const { error: productsError } = await supabase
      .from('campaign_products')
      .insert(campaignProductsData)

    if (productsError) {
      console.error('Error linking products:', productsError)
    }
  }

  revalidatePath('/admin/campaigns')
  revalidatePath(`/admin/campaigns/${campaignId}/edit`)
  revalidatePath('/campaigns')
  redirect('/admin/campaigns')
}

/**
 * Delete a campaign - Admin only
 * Soft delete by setting is_active = false
 */
export async function deleteCampaign(campaignId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('campaigns')
    .update({ is_active: false })
    .eq('id', campaignId)

  if (error) {
    console.error('Error deleting campaign:', error)
    throw new Error('Failed to delete campaign')
  }

  revalidatePath('/admin/campaigns')
  revalidatePath('/campaigns')
}
