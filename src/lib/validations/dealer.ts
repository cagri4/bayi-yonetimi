import { z } from 'zod'

export const dealerSchema = z.object({
  company_name: z.string().min(1, 'Firma adi gerekli'),
  email: z.string().email('Gecerli bir email adresi girin'),
  phone: z.string().optional(),
  address: z.string().optional(),
  dealer_group_id: z.string().uuid('Bayi grubu secin').optional().nullable(),
  is_active: z.boolean().default(true),
})

export const dealerGroupSchema = z.object({
  name: z.string().min(1, 'Grup adi gerekli'),
  discount_percent: z.coerce.number().min(0).max(100, 'Iskonto 0-100 arasinda olmali'),
  min_order_amount: z.coerce.number().min(0, 'Minimum tutar negatif olamaz'),
  is_active: z.boolean().default(true),
})

export const dealerPriceSchema = z.object({
  dealer_id: z.string().uuid(),
  product_id: z.string().uuid('Urun secin'),
  custom_price: z.coerce.number().positive('Fiyat pozitif olmali'),
})

export type DealerInput = z.infer<typeof dealerSchema>
export type DealerGroupInput = z.infer<typeof dealerGroupSchema>
export type DealerPriceInput = z.infer<typeof dealerPriceSchema>
