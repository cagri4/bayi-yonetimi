import { z } from 'zod'

export const productSchema = z.object({
  code: z.string().min(1, 'Urun kodu gerekli'),
  name: z.string().min(1, 'Urun adi gerekli'),
  description: z.string().optional(),
  base_price: z.coerce.number().positive('Fiyat pozitif olmali'),
  stock_quantity: z.coerce.number().int().min(0, 'Stok negatif olamaz'),
  low_stock_threshold: z.coerce.number().int().min(0).optional(),
  category_id: z.string().uuid('Kategori secin').optional().nullable(),
  brand_id: z.string().uuid('Marka secin').optional().nullable(),
  is_active: z.boolean().default(true),
})

export const stockUpdateSchema = z.object({
  product_id: z.string().uuid(),
  stock_quantity: z.coerce.number().int().min(0, 'Stok negatif olamaz'),
})

export type ProductInput = z.infer<typeof productSchema>
export type StockUpdateInput = z.infer<typeof stockUpdateSchema>
