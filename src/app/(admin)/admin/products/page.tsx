import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ProductTable } from '@/components/admin/product-table'
import { getProducts, getCategories, getBrands } from '@/lib/actions/products'

export default async function ProductsPage() {
  const [products, categories, brands] = await Promise.all([
    getProducts(),
    getCategories(),
    getBrands(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Urunler</h1>
        <Link href="/admin/products/new">
          <Button>Yeni Urun Ekle</Button>
        </Link>
      </div>

      <ProductTable
        products={products}
        categories={categories}
        brands={brands}
      />
    </div>
  )
}
