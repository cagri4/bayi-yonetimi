'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCartStore } from '@/store/cart'
import { useToast } from '@/hooks/use-toast'
import type { CatalogProduct } from '@/lib/actions/catalog'

interface ProductCardProps {
  product: CatalogProduct
}

export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem)
  const { toast } = useToast()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(amount)
  }

  const getStockStatus = () => {
    if (product.stock_quantity === 0) {
      return { label: 'Stok Yok', variant: 'destructive' as const, canOrder: false }
    }
    if (product.stock_quantity <= product.low_stock_threshold) {
      return { label: 'Az Stok', variant: 'secondary' as const, canOrder: true }
    }
    return { label: 'Stokta', variant: 'default' as const, canOrder: true }
  }

  const stockStatus = getStockStatus()
  const hasDiscount = product.dealer_price < product.base_price
  const discountPercent = hasDiscount
    ? Math.round((1 - product.dealer_price / product.base_price) * 100)
    : 0

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      price: product.dealer_price,
      quantity: 1,
    })
    toast({
      title: 'Sepete eklendi',
      description: `${product.name} sepete eklendi.`,
    })
  }

  return (
    <Card className="flex flex-col h-full">
      <div className="relative aspect-square bg-gray-100">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-contain p-4"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <svg
              className="w-16 h-16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
        {hasDiscount && (
          <Badge className="absolute top-2 right-2 bg-red-500">
            %{discountPercent} indirim
          </Badge>
        )}
      </div>

      <CardContent className="flex-grow pt-4 space-y-2">
        <p className="text-xs text-gray-500 font-mono">{product.code}</p>
        <h3 className="font-medium line-clamp-2">{product.name}</h3>

        <div className="flex items-center gap-2">
          <Badge variant={stockStatus.variant}>{stockStatus.label}</Badge>
          {product.category && (
            <Badge variant="outline">{product.category.name}</Badge>
          )}
        </div>

        <div className="pt-2">
          {hasDiscount && (
            <p className="text-sm text-gray-400 line-through">
              {formatCurrency(product.base_price)}
            </p>
          )}
          <p className="text-lg font-bold text-primary">
            {formatCurrency(product.dealer_price)}
          </p>
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <Button
          className="w-full"
          onClick={handleAddToCart}
          disabled={!stockStatus.canOrder}
        >
          {stockStatus.canOrder ? 'Sepete Ekle' : 'Stok Yok'}
        </Button>
      </CardFooter>
    </Card>
  )
}
