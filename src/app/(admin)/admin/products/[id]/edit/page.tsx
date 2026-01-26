import { notFound } from 'next/navigation'
import { ProductForm } from '@/components/admin/product-form'
import { getProduct, getCategories, getBrands } from '@/lib/actions/products'

interface EditProductPageProps {
  params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params

  const [product, categories, brands] = await Promise.all([
    getProduct(id).catch(() => null),
    getCategories(),
    getBrands(),
  ])

  if (!product) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Urun Duzenle: {product.name}</h1>
      <ProductForm
        categories={categories}
        brands={brands}
        product={product}
      />
    </div>
  )
}
