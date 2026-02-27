'use client'

import Image from 'next/image'
import { Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCartStore } from '@/store/cart'
import { useToast } from '@/hooks/use-toast'
import type { CampaignProduct } from '@/lib/actions/campaigns'

interface CampaignProductCardProps {
  product: CampaignProduct
}

export function CampaignProductCard({ product }: CampaignProductCardProps) {
  const addItem = useCartStore((state) => state.addItem)
  const { toast } = useToast()

  const finalPrice = product.discount_percent && product.discount_percent > 0
    ? product.dealer_price * (1 - product.discount_percent / 100)
    : product.dealer_price

  const handleAddToCart = () => {
    addItem({
      productId: product.product_id,
      productName: product.product_name,
      productCode: product.product_code,
      price: finalPrice,
      quantity: 1,
    })
    toast({
      title: 'Sepete eklendi',
      description: `${product.product_name} sepete eklendi.`,
    })
  }

  return (
    <Card className="overflow-hidden">
      {product.product_image_url ? (
        <div className="relative h-48 w-full">
          <Image
            src={product.product_image_url}
            alt={product.product_name}
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div className="h-48 w-full bg-muted flex items-center justify-center">
          <Package className="h-12 w-12 text-muted-foreground" />
        </div>
      )}

      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base line-clamp-2">
              {product.product_name}
            </CardTitle>
            <CardDescription>{product.product_code}</CardDescription>
          </div>
          {product.discount_percent && product.discount_percent > 0 && (
            <Badge variant="destructive" className="shrink-0">
              %{product.discount_percent} İndirim
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          {product.discount_percent && product.discount_percent > 0 ? (
            <>
              <span className="text-sm line-through text-muted-foreground">
                ₺{product.dealer_price.toFixed(2)}
              </span>
              <span className="text-2xl font-bold text-primary">
                ₺{finalPrice.toFixed(2)}
              </span>
            </>
          ) : (
            <span className="text-2xl font-bold">
              ₺{product.dealer_price.toFixed(2)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Stok:</span>
          <span className={product.stock_quantity > 0 ? 'text-green-600' : 'text-red-600'}>
            {product.stock_quantity > 0 ? `${product.stock_quantity} adet` : 'Stokta Yok'}
          </span>
        </div>

        <Button
          onClick={handleAddToCart}
          disabled={product.stock_quantity === 0}
          className="w-full"
        >
          {product.stock_quantity > 0 ? 'Sepete Ekle' : 'Stokta Yok'}
        </Button>
      </CardContent>
    </Card>
  )
}
