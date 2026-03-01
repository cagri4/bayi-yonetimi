'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { submitProductRequest } from '@/lib/actions/support'
import { PackagePlus } from 'lucide-react'

export function ProductRequestForm() {
  const [isPending, startTransition] = useTransition()
  const [productName, setProductName] = useState('')
  const [productCode, setProductCode] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const qty = parseInt(quantity, 10)
    if (isNaN(qty) || qty < 1) {
      toast.error('Gecerli bir miktar girin')
      return
    }

    startTransition(async () => {
      const result = await submitProductRequest({
        product_name: productName,
        product_code: productCode || undefined,
        requested_quantity: qty,
        notes: notes || undefined,
      })

      if (result.success) {
        toast.success('Talebiniz alindi')
        setProductName('')
        setProductCode('')
        setQuantity('1')
        setNotes('')
      } else {
        toast.error(result.error || 'Talep gonderilemedi')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Urun Talebi Olustur</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="productName">Urun Adi *</Label>
              <Input
                id="productName"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Talep ettiginiz urun adi"
                required
                maxLength={200}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="productCode">Urun Kodu (opsiyonel)</Label>
              <Input
                id="productCode"
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                placeholder="Biliyorsaniz urun kodu"
                maxLength={100}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Istenen Miktar *</Label>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min={1}
              max={9999}
              required
              disabled={isPending}
              className="w-32"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notlar (opsiyonel)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ek bilgi veya aciklama"
              rows={3}
              maxLength={1000}
              disabled={isPending}
            />
          </div>

          <Button type="submit" disabled={isPending || !productName}>
            <PackagePlus className="h-4 w-4 mr-2" />
            {isPending ? 'Gonderiliyor...' : 'Talep Gonder'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
