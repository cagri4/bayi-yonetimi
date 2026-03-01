'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCartStore } from '@/store/cart'
import { useToast } from '@/hooks/use-toast'
import { FavoriteToggle } from '@/components/favorites/favorite-toggle'
import type { CatalogProduct } from '@/lib/actions/catalog'

interface ProductCardProps {
  product: CatalogProduct
  isFavorited?: boolean
  showNewBadge?: boolean
}

export function ProductCard({ product, isFavorited, showNewBadge }: ProductCardProps) {
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
      return { label: 'Stok Yok', className: 'bg-red-500 text-white hover:bg-red-600', canOrder: false }
    }
    if (product.stock_quantity <= product.low_stock_threshold) {
      return { label: 'Az Stok', className: 'bg-amber-500 text-white hover:bg-amber-600', canOrder: true }
    }
    return { label: 'Stokta', className: 'bg-emerald-500 text-white hover:bg-emerald-600', canOrder: true }
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
    <Card className="flex flex-col h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer group">
      <div className="relative h-48 bg-gray-50 overflow-hidden rounded-t-lg">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
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
        <div className="absolute top-2 left-2 z-10">
          <FavoriteToggle
            productId={product.id}
            productName={product.name}
            initialFavorited={isFavorited ?? false}
          />
        </div>
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {showNewBadge && (
            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded font-semibold shadow-sm">
              Yeni
            </span>
          )}
          {hasDiscount && (
            <Badge className="bg-rose-500 text-white font-semibold shadow-md">
              %{discountPercent} indirim
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="flex-grow pt-4 space-y-3">
        <p className="text-xs text-gray-400 font-mono tracking-wide">{product.code}</p>
        <h3 className="font-semibold text-gray-800 line-clamp-2 leading-tight">{product.name}</h3>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={stockStatus.className}>{stockStatus.label}</Badge>
          {product.category && (
            <Badge variant="outline" className="text-xs">{product.category.name}</Badge>
          )}
        </div>

        <div className="pt-2 space-y-1">
          {hasDiscount && (
            <p className="text-sm text-gray-400 line-through">
              {formatCurrency(product.base_price)}
            </p>
          )}
          <p className="text-xl font-bold text-primary">
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
