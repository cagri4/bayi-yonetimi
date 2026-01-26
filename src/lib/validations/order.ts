import { z } from 'zod'

export const orderItemSchema = z.object({
  productId: z.string().uuid(),
  productCode: z.string(),
  productName: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
})

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Sepetiniz bos'),
  notes: z.string().optional(),
})

export type OrderItemInput = z.infer<typeof orderItemSchema>
export type CreateOrderInput = z.infer<typeof createOrderSchema>
