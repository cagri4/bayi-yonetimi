import { ProductForm } from '@/components/admin/product-form'
import { getCategories, getBrands } from '@/lib/actions/products'

export default async function NewProductPage() {
  const [categories, brands] = await Promise.all([
    getCategories(),
    getBrands(),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Yeni Urun Ekle</h1>
      <ProductForm categories={categories} brands={brands} />
    </div>
  )
}
