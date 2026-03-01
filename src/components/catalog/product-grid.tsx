import { getCatalogProducts } from '@/lib/actions/catalog'
import { getFavoriteIds, getFavoriteProducts } from '@/lib/actions/favorites'
import { ProductCard } from './product-card'

interface ProductGridProps {
  search?: string
  categoryId?: string
  brandId?: string
  isNew?: boolean
  favoritesOnly?: boolean
}

function isProductNew(createdAt: string): boolean {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  return new Date(createdAt) >= thirtyDaysAgo
}

export async function ProductGrid({
  search,
  categoryId,
  brandId,
  isNew,
  favoritesOnly,
}: ProductGridProps) {
  const [products, favoriteIds] = await Promise.all([
    favoritesOnly
      ? getFavoriteProducts()
      : getCatalogProducts({
          search,
          category_id: categoryId,
          brand_id: brandId,
          is_new: isNew,
        }),
    getFavoriteIds(),
  ])

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">
          {favoritesOnly
            ? 'Henuz favori urun eklemediniz.'
            : search || categoryId || brandId || isNew
              ? 'Aramaniza uygun urun bulunamadi.'
              : 'Henuz urun eklenmemis.'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          isFavorited={favoriteIds.includes(product.id)}
          showNewBadge={product.created_at ? isProductNew(product.created_at) : false}
        />
      ))}
    </div>
  )
}
