'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { setDealerPrice, type ActionState } from '@/lib/actions/dealers'

interface Product {
  id: string
  code: string
  name: string
  base_price: number
}

interface DealerPriceFormProps {
  dealerId: string
  products: Product[]
  existingProductIds: string[]
  onSuccess?: () => void
}

const initialState: ActionState = {}

export function DealerPriceForm({
  dealerId,
  products,
  existingProductIds,
  onSuccess,
}: DealerPriceFormProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const availableProducts = products.filter(
    (p) => !existingProductIds.includes(p.id)
  )

  const [state, formAction, pending] = useActionState(async (prevState: ActionState, formData: FormData) => {
    const result = await setDealerPrice(prevState, formData)
    if (result.success && onSuccess) {
      onSuccess()
      setSelectedProduct(null)
    }
    return result
  }, initialState)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(amount)
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="dealer_id" value={dealerId} />

      <div>
        <Label htmlFor="product_id">Urun *</Label>
        <Select
          name="product_id"
          value={selectedProduct?.id || ''}
          onValueChange={(value) => {
            const product = products.find((p) => p.id === value)
            setSelectedProduct(product || null)
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Urun secin" />
          </SelectTrigger>
          <SelectContent>
            {availableProducts.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.code} - {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.product_id && (
          <p className="text-sm text-red-500 mt-1">{state.errors.product_id[0]}</p>
        )}
      </div>

      {selectedProduct && (
        <p className="text-sm text-gray-500">
          Baz fiyat: {formatCurrency(selectedProduct.base_price)}
        </p>
      )}

      <div>
        <Label htmlFor="custom_price">Ozel Fiyat (TL) *</Label>
        <Input
          id="custom_price"
          name="custom_price"
          type="number"
          step="0.01"
          min="0"
          required
        />
        {state.errors?.custom_price && (
          <p className="text-sm text-red-500 mt-1">{state.errors.custom_price[0]}</p>
        )}
      </div>

      {state.message && !state.success && (
        <p className="text-sm text-red-500">{state.message}</p>
      )}

      <Button type="submit" disabled={pending || !selectedProduct}>
        {pending ? 'Kaydediliyor...' : 'Ozel Fiyat Ekle'}
      </Button>
    </form>
  )
}
