import { Suspense } from 'react'
import { ProductGrid } from '@/components/catalog/product-grid'
import { ProductFilters } from '@/components/catalog/product-filters'
import { ProductSearch } from '@/components/catalog/product-search'
import { getCategories, getBrands } from '@/lib/actions/catalog'
import { Skeleton } from '@/components/ui/skeleton'

interface CatalogPageProps {
  searchParams: Promise<{
    search?: string
    category?: string
    brand?: string
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

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-800">Urun Katalogu</h1>
        <p className="text-gray-500 mt-1">Tum urunlerimizi goruntuleyebilir ve siparis verebilirsiniz.</p>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
        <ProductSearch />
        <ProductFilters categories={categories} brands={brands} />
      </div>

      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductGrid
          search={params.search}
          categoryId={params.category}
          brandId={params.brand}
        />
      </Suspense>
    </div>
  )
}
