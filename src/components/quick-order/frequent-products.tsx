'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useCartStore } from '@/store/cart'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import type { FrequentProduct } from '@/lib/queries/orders'

interface FrequentProductsProps {
  products: FrequentProduct[]
}

export function FrequentProducts({ products }: FrequentProductsProps) {
  const addItem = useCartStore((state) => state.addItem)

  const handleQuickAdd = (product: FrequentProduct) => {
    addItem({
      productId: product.product_id,
      productCode: product.product_code,
      productName: product.product_name,
      quantity: 1,
      price: product.current_price,
    })
    toast.success(`${product.product_name} sepete eklendi`)
  }

  if (products.length === 0) {
    return (
      <div className="text-muted-foreground text-sm py-4">
        Henuz siparis gecmisiniz bulunmuyor. Siparis verdikce sik siparis ettiginiz urunler burada gorunecek.
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <Card key={product.product_id} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="space-y-2">
              <div>
                <h3 className="font-medium line-clamp-2">{product.product_name}</h3>
                <p className="text-sm text-muted-foreground">{product.product_code}</p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">
                    {product.current_price.toLocaleString('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {product.order_count} kez siparis verildi
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickAdd(product)}
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Ekle
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
