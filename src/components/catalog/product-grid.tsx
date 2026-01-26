import { getCatalogProducts, type CatalogProduct } from '@/lib/actions/catalog'
import { ProductCard } from './product-card'

interface ProductGridProps {
  search?: string
  categoryId?: string
  brandId?: string
}

export async function ProductGrid({ search, categoryId, brandId }: ProductGridProps) {
  const products = await getCatalogProducts({
    search,
    category_id: categoryId,
    brand_id: brandId,
  })

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">
          {search || categoryId || brandId
            ? 'Aramaniza uygun urun bulunamadi.'
            : 'Henuz urun eklenmemis.'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
