'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useCartStore } from '@/store/cart'

interface CartSummaryProps {
  minOrderAmount: number
  discountPercent: number
  groupName: string
}

export function CartSummary({
  minOrderAmount,
  discountPercent,
  groupName,
}: CartSummaryProps) {
  const items = useCartStore((state) => state.items)
  const getTotalAmount = useCartStore((state) => state.getTotalAmount)
  const getTotalItems = useCartStore((state) => state.getTotalItems)

  const totalAmount = getTotalAmount()
  const totalItems = getTotalItems()
  const meetsMinimum = totalAmount >= minOrderAmount
  const amountNeeded = minOrderAmount - totalAmount

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(amount)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Siparis Ozeti</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-500">
          <p>
            Bayi Grubu: <span className="font-medium">{groupName}</span>
          </p>
          <p>
            Iskonto: <span className="font-medium">%{discountPercent}</span>
          </p>
          <p>
            Min. Siparis:{' '}
            <span className="font-medium">{formatCurrency(minOrderAmount)}</span>
          </p>
        </div>

        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Urun Sayisi</span>
            <span>{totalItems} adet</span>
          </div>
          <div className="flex justify-between font-bold text-lg">
            <span>Toplam</span>
            <span>{formatCurrency(totalAmount)}</span>
          </div>
        </div>

        {!meetsMinimum && items.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>Minimum Siparis Tutari</AlertTitle>
            <AlertDescription>
              Siparis verebilmek icin {formatCurrency(amountNeeded)} daha
              urun eklemeniz gerekmektedir.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Link href="/checkout" className="w-full">
          <Button
            className="w-full"
            size="lg"
            disabled={!meetsMinimum || items.length === 0}
          >
            {items.length === 0
              ? 'Sepet Bos'
              : !meetsMinimum
              ? `Min. ${formatCurrency(minOrderAmount)} gerekli`
              : 'Siparisi Onayla'}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}
