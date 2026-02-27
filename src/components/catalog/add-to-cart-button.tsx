'use client'

import { Button } from '@/components/ui/button'
import { useCartStore } from '@/store/cart'
import { useToast } from '@/hooks/use-toast'
import { ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AddToCartButtonProps {
  productId: string
  productName: string
  productCode?: string
  price: number
  quantity?: number
  stockQuantity?: number
  disabled?: boolean
  className?: string
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  showIcon?: boolean
}

export function AddToCartButton({
  productId,
  productName,
  productCode = '',
  price,
  quantity = 1,
  stockQuantity = 1,
  disabled = false,
  className,
  variant = 'default',
  size = 'default',
  showIcon = true,
}: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem)
  const { toast } = useToast()

  const isOutOfStock = stockQuantity === 0
  const isDisabled = disabled || isOutOfStock

  const handleAddToCart = () => {
    if (isDisabled) return

    addItem({
      productId,
      productName,
      productCode,
      price,
      quantity,
    })

    toast({
      title: 'Sepete eklendi',
      description: `${productName} sepete eklendi.`,
    })
  }

  return (
    <Button
      onClick={handleAddToCart}
      disabled={isDisabled}
      variant={variant}
      size={size}
      className={cn(className)}
    >
      {showIcon && <ShoppingCart className="h-4 w-4 mr-2" />}
      {isOutOfStock ? 'Stok Yok' : 'Sepete Ekle'}
    </Button>
  )
}
