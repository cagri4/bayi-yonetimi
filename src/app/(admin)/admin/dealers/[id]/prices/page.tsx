import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getDealer, getDealerPrices, deleteDealerPrice } from '@/lib/actions/dealers'
import { getProducts } from '@/lib/actions/products'
import { DealerPriceForm } from '@/components/admin/dealer-price-form'
import { revalidatePath } from 'next/cache'

interface DealerPricesPageProps {
  params: Promise<{ id: string }>
}

export default async function DealerPricesPage({ params }: DealerPricesPageProps) {
  const { id } = await params

  const [dealer, prices, products] = await Promise.all([
    getDealer(id).catch(() => null),
    getDealerPrices(id),
    getProducts(),
  ])

  if (!dealer) {
    notFound()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(amount)
  }

  const existingProductIds = prices.map((p) => p.product_id)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{dealer.company_name}</h1>
          <p className="text-gray-500">Bayiye Ozel Fiyatlar</p>
          {dealer.dealer_group && (
            <p className="text-sm text-gray-500">
              Grup: {dealer.dealer_group.name} (%{dealer.dealer_group.discount_percent} iskonto)
            </p>
          )}
        </div>
        <Link href="/admin/dealers">
          <Button variant="outline">Bayilere Don</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Mevcut Ozel Fiyatlar</CardTitle>
            </CardHeader>
            <CardContent>
              {prices.length === 0 ? (
                <p className="text-gray-500 py-4">
                  Bu bayi icin henuz ozel fiyat tanimlanmamis.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Urun Kodu</TableHead>
                      <TableHead>Urun Adi</TableHead>
                      <TableHead className="text-right">Baz Fiyat</TableHead>
                      <TableHead className="text-right">Ozel Fiyat</TableHead>
                      <TableHead className="text-right">Islem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prices.map((price) => (
                      <TableRow key={price.id}>
                        <TableCell className="font-mono">{price.product?.code}</TableCell>
                        <TableCell>{price.product?.name}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(price.product?.base_price || 0)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(price.custom_price)}
                        </TableCell>
                        <TableCell className="text-right">
                          <form
                            action={async () => {
                              'use server'
                              await deleteDealerPrice(id, price.product_id)
                              revalidatePath(`/admin/dealers/${id}/prices`)
                            }}
                          >
                            <Button variant="destructive" size="sm" type="submit">
                              Sil
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Yeni Ozel Fiyat Ekle</CardTitle>
            </CardHeader>
            <CardContent>
              <DealerPriceForm
                dealerId={id}
                products={products}
                existingProductIds={existingProductIds}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
