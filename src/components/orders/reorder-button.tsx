'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/store/cart'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, Loader2 } from 'lucide-react'

interface ReorderButtonProps {
  orderId: string
}

interface OrderItemForReorder {
  product_id: string
  product_code: string
  product_name: string
  quantity: number
}

interface DealerForReorder {
  id: string
}

export function ReorderButton({ orderId }: ReorderButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const addItem = useCartStore((state) => state.addItem)

  const handleReorder = async () => {
    setIsLoading(true)
    const supabase = createClient()

    try {
      // Fetch order items
      const { data: orderItemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('product_id, product_code, product_name, quantity')
        .eq('order_id', orderId)

      if (itemsError || !orderItemsData) {
        toast.error('Siparis yuklenirken hata olustu')
        return
      }

      const orderItems = orderItemsData as unknown as OrderItemForReorder[]

      if (orderItems.length === 0) {
        toast.error('Sipariste urun bulunamadi')
        return
      }

      // Get current user and dealer ID
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Oturum acmaniz gerekli')
        return
      }

      const { data: dealerData } = await supabase
        .from('dealers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!dealerData) {
        toast.error('Bayi kaydi bulunamadi')
        return
      }

      const dealer = dealerData as unknown as DealerForReorder

      // Add each item to cart with CURRENT price
      let addedCount = 0
      for (const item of orderItems) {
        // Get current dealer price via RPC
        const { data: priceData, error: priceError } = await (supabase as any)
          .rpc('get_dealer_price', {
            p_product_id: item.product_id,
            p_dealer_id: dealer.id,
          })

        if (priceError) {
          console.error('Price fetch error:', priceError)
          continue
        }

        const currentPrice = priceData || 0

        addItem({
          productId: item.product_id,
          productCode: item.product_code,
          productName: item.product_name,
          quantity: item.quantity,
          price: currentPrice,
        })
        addedCount++
      }

      if (addedCount > 0) {
        toast.success(`${addedCount} urun sepete eklendi`)
      } else {
        toast.error('Urunler sepete eklenemedi')
      }
    } catch (error) {
      console.error('Reorder error:', error)
      toast.error('Siparis yuklenirken hata olustu')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleReorder}
      variant="outline"
      disabled={isLoading}
      className="gap-2"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      Tekrar Siparis Ver
    </Button>
  )
}
