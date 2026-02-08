import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface FavoritesStore {
  favoriteIds: Set<string>
  addFavorite: (productId: string) => void
  removeFavorite: (productId: string) => void
  toggleFavorite: (productId: string) => void
  isFavorite: (productId: string) => boolean
  hydrate: (productIds: string[]) => void
  clear: () => void
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favoriteIds: new Set<string>(),

      addFavorite: (productId) =>
        set((state) => {
          const newSet = new Set(state.favoriteIds)
          newSet.add(productId)
          return { favoriteIds: newSet }
        }),

      removeFavorite: (productId) =>
        set((state) => {
          const newSet = new Set(state.favoriteIds)
          newSet.delete(productId)
          return { favoriteIds: newSet }
        }),

      toggleFavorite: (productId) => {
        const state = get()
        if (state.favoriteIds.has(productId)) {
          state.removeFavorite(productId)
        } else {
          state.addFavorite(productId)
        }
      },

      isFavorite: (productId) => {
        return get().favoriteIds.has(productId)
      },

      hydrate: (productIds) => {
        set({ favoriteIds: new Set(productIds) })
      },

      clear: () => set({ favoriteIds: new Set<string>() }),
    }),
    {
      name: 'dealer-favorites-storage',
      partialize: (state) => ({
        favoriteIds: Array.from(state.favoriteIds),
      }),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.favoriteIds)) {
          state.favoriteIds = new Set(state.favoriteIds as unknown as string[])
        }
      },
    }
  )
)
