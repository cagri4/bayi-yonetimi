'use client'

import { useOptimistic, useTransition } from 'react'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toggleFavorite } from '@/lib/actions/favorites'
import { useFavoritesStore } from '@/store/favorites'

interface FavoriteToggleProps {
  productId: string
  productName: string
  initialFavorited: boolean
}

export function FavoriteToggle({
  productId,
  productName,
  initialFavorited,
}: FavoriteToggleProps) {
  const [isPending, startTransition] = useTransition()
  const [optimisticFavorited, setOptimisticFavorited] = useOptimistic(
    initialFavorited,
    (state, newState: boolean) => newState
  )
  const toggleStoreState = useFavoritesStore((state) => state.toggleFavorite)

  const handleToggle = () => {
    const newState = !optimisticFavorited

    startTransition(async () => {
      // Set optimistic state immediately for instant feedback
      setOptimisticFavorited(newState)

      // Update Zustand store for cross-component sync
      toggleStoreState(productId)

      try {
        // Call Server Action to persist to database
        await toggleFavorite(productId)
      } catch (error) {
        // useOptimistic will auto-revert on error
        console.error('Failed to toggle favorite:', error)
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      disabled={isPending}
      aria-pressed={optimisticFavorited}
      aria-label={
        optimisticFavorited
          ? `${productName} favorilerden cikar`
          : `${productName} favorilere ekle`
      }
      className="min-w-[44px] min-h-[44px] bg-white/90 hover:bg-white shadow-md"
    >
      <Heart
        className={`h-5 w-5 transition-all ${
          optimisticFavorited
            ? 'fill-red-500 text-red-500'
            : 'text-gray-400 hover:text-red-400'
        }`}
      />
    </Button>
  )
}
