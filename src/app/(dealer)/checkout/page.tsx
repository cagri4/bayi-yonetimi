'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCartStore } from '@/store/cart'
import { createOrder, type OrderActionState } from '@/lib/actions/orders'
import { getDealerInfo } from '@/lib/actions/catalog'

interface DealerInfo {
  id: string
  company_name: string
  dealer_group: {
    id: string
    name: string
    discount_percent: number
    min_order_amount: number
  } | null
}

export default function CheckoutPage() {
  const router = useRouter()
  const items = useCartStore((state) => state.items)
  const getTotalAmount = useCartStore((state) => state.getTotalAmount)
  const clearCart = useCartStore((state) => state.clearCart)

  const [dealerInfo, setDealerInfo] = useState<DealerInfo | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<OrderActionState | null>(null)

  useEffect(() => {
    const loadDealerInfo = async () => {
      const info = await getDealerInfo()
      setDealerInfo(info)
    }
    loadDealerInfo()
  }, [])

  const totalAmount = getTotalAmount()
  const minOrderAmount = dealerInfo?.dealer_group?.min_order_amount || 0
  const meetsMinimum = totalAmount >= minOrderAmount

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(amount)
  }

  const handleSubmitOrder = async () => {
    if (!meetsMinimum || items.length === 0) return

    setSubmitting(true)
    setResult(null)

    const orderResult = await createOrder(
      items.map((item) => ({
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
      })),
      notes || undefined
    )

    setResult(orderResult)
    setSubmitting(false)

    if (orderResult.success) {
      clearCart()
      // Redirect after short delay to show success message
      setTimeout(() => {
        router.push('/catalog')
      }, 2000)
    }
  }

  if (items.length === 0 && !result?.success) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Sepetiniz Bos</h1>
        <p className="text-gray-500 mb-6">
          Siparis vermek icin once urun eklemeniz gerekmektedir.
        </p>
        <Button onClick={() => router.push('/catalog')}>
          Urun Katalogu
        </Button>
      </div>
    )
  }

  if (result?.success) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <Alert>
          <AlertTitle className="text-xl">Siparis Olusturuldu!</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="font-medium">Siparis No: {result.orderNumber}</p>
            <p className="text-gray-500 mt-2">
              Siparisizin durumunu takip edebilirsiniz.
            </p>
          </AlertDescription>
        </Alert>
        <p className="text-sm text-gray-500 mt-4">
          Urun katalogu'na yonlendiriliyorsunuz...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Siparis Onayi</h1>
        <p className="text-gray-500">
          Siparisinizi gozden gecirin ve onaylayin.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Siparis Kalemleri</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Urun</TableHead>
                    <TableHead className="text-right">Birim Fiyat</TableHead>
                    <TableHead className="text-center">Adet</TableHead>
                    <TableHead className="text-right">Toplam</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-sm text-gray-500">{item.productCode}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.price)}
                      </TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.price * item.quantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Siparis Notu</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="notes" className="sr-only">
                Siparis Notu
              </Label>
              <Textarea
                id="notes"
                placeholder="Siparisizle ilgili not ekleyebilirsiniz (opsiyonel)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Siparis Toplami</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {dealerInfo && (
                <div className="text-sm text-gray-500">
                  <p>
                    Firma: <span className="font-medium">{dealerInfo.company_name}</span>
                  </p>
                  <p>
                    Grup: <span className="font-medium">{dealerInfo.dealer_group?.name || 'Standart'}</span>
                  </p>
                </div>
              )}

              <div className="border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span>Urun Sayisi</span>
                  <span>{items.reduce((sum, i) => sum + i.quantity, 0)} adet</span>
                </div>
                <div className="flex justify-between font-bold text-xl mt-2">
                  <span>Toplam</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              {result?.message && !result.success && (
                <Alert variant="destructive">
                  <AlertDescription>{result.message}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmitOrder}
                disabled={submitting || !meetsMinimum}
              >
                {submitting ? 'Siparis Olusturuluyor...' : 'Siparisi Onayla'}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push('/cart')}
                disabled={submitting}
              >
                Sepete Don
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
