import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getProducts } from '@/lib/actions/products'
import { getDealers } from '@/lib/actions/dealers'

export default async function AdminDashboard() {
  const [products, dealers] = await Promise.all([
    getProducts().catch(() => []),
    getDealers().catch(() => []),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Toplam Urun
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Toplam Bayi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dealers.length}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
