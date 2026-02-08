import Link from 'next/link'
import { Heart } from 'lucide-react'
import { getFavoriteProducts } from '@/lib/actions/favorites'
import { ProductCard } from '@/components/catalog/product-card'
import { Button } from '@/components/ui/button'

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 p-6 bg-gray-100 rounded-full">
        <Heart className="h-16 w-16 text-gray-400" />
      </div>
      <h2 className="text-2xl font-semibold text-gray-800 mb-2">
        Henuz favori urun eklemediniz
      </h2>
      <p className="text-gray-500 mb-6 max-w-md">
        Katalogda begendiginiz urunleri favorilere ekleyerek hizlica erisebilirsiniz
      </p>
      <Button asChild>
        <Link href="/catalog">Kataloga Git</Link>
      </Button>
    </div>
  )
}

export default async function FavoritesPage() {
  const products = await getFavoriteProducts()

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Heart className="h-8 w-8 text-red-500" />
              Favorilerim
            </h1>
            <p className="text-gray-500 mt-1">
              {products.length} urun favorilerinizde
            </p>
          </div>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm">
          <EmptyState />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isFavorited={true}
            />
          ))}
        </div>
      )}
    </div>
  )
}
