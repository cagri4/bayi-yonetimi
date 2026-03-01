import { Suspense } from 'react'
import { ProductGrid } from '@/components/catalog/product-grid'
import { ProductFilters } from '@/components/catalog/product-filters'
import { ProductSearch } from '@/components/catalog/product-search'
import { CatalogFilterTabs } from '@/components/catalog/catalog-filter-tabs'
import { getCategories, getBrands } from '@/lib/actions/catalog'
import { Skeleton } from '@/components/ui/skeleton'

interface CatalogPageProps {
  searchParams: Promise<{
    search?: string
    category?: string
    brand?: string
    filter?: string
  }>
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-white border rounded-xl p-4 space-y-4 shadow-sm">
          <Skeleton className="w-full h-48 rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams
  const [categories, brands] = await Promise.all([
    getCategories(),
    getBrands(),
  ])

  const activeFilter = params.filter || 'all'
  const isNewFilter = activeFilter === 'new'
  const isFavoritesFilter = activeFilter === 'favorites'

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-800">Urun Katalogu</h1>
        <p className="text-gray-500 mt-1">Tum urunlerimizi goruntuleyebilir ve siparis verebilirsiniz.</p>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
        <CatalogFilterTabs activeFilter={activeFilter} />
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center border-t pt-4">
          <ProductSearch />
          {!isFavoritesFilter && (
            <ProductFilters categories={categories} brands={brands} />
          )}
        </div>
      </div>

      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductGrid
          search={params.search}
          categoryId={isFavoritesFilter ? undefined : params.category}
          brandId={isFavoritesFilter ? undefined : params.brand}
          isNew={isNewFilter}
          favoritesOnly={isFavoritesFilter}
        />
      </Suspense>
    </div>
  )
}
