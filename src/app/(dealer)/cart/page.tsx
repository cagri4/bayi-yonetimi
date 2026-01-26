'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CartItems } from '@/components/cart/cart-items'
import { CartSummary } from '@/components/cart/cart-summary'
import { useCartStore } from '@/store/cart'
import { getDealerInfo } from '@/lib/actions/catalog'

interface DealerInfo {
  id: string
  company_name: string
  dealer_group: {
    id: string
    name: string
    discount_percent: number
    min_order_amount: number
  } | null
}

export default function CartPage() {
  const items = useCartStore((state) => state.items)
  const clearCart = useCartStore((state) => state.clearCart)
  const [dealerInfo, setDealerInfo] = useState<DealerInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDealerInfo = async () => {
      const info = await getDealerInfo()
      setDealerInfo(info)
      setLoading(false)
    }
    loadDealerInfo()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p>Yukleniyor...</p>
      </div>
    )
  }

  const minOrderAmount = dealerInfo?.dealer_group?.min_order_amount || 0
  const discountPercent = dealerInfo?.dealer_group?.discount_percent || 0
  const groupName = dealerInfo?.dealer_group?.name || 'Standart'

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Sepetim</h1>
          <p className="text-gray-500">
            Sepetinizdeki urunleri inceleyebilir ve siparise donusturebilirsiniz.
          </p>
        </div>
        <div className="space-x-2">
          <Link href="/catalog">
            <Button variant="outline">Alisverise Devam Et</Button>
          </Link>
          {items.length > 0 && (
            <Button variant="ghost" onClick={clearCart}>
              Sepeti Temizle
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CartItems items={items} />
        </div>
        <div>
          <CartSummary
            minOrderAmount={minOrderAmount}
            discountPercent={discountPercent}
            groupName={groupName}
          />
        </div>
      </div>
    </div>
  )
}
