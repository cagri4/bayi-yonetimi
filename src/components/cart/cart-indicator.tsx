'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/store/cart'
import { useEffect, useState } from 'react'
import { ShoppingBag } from 'lucide-react'

export function CartIndicator() {
  // Subscribe to items array directly so component re-renders on changes
  const items = useCartStore((state) => state.items)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const itemCount = mounted ? items.reduce((sum, item) => sum + item.quantity, 0) : 0

  return (
    <Link href="/cart">
      <Button variant="outline" className="relative gap-2 border-primary/20 hover:border-primary hover:bg-primary/5">
        <ShoppingBag className="h-4 w-4" />
        Sepet
        {itemCount > 0 && (
          <span className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center rounded-full bg-primary text-white text-xs font-bold animate-pulse">
            {itemCount}
          </span>
        )}
      </Button>
    </Link>
  )
}
