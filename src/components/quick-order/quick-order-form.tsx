'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCartStore } from '@/store/cart'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, Trash2, ShoppingCart, RotateCcw, Loader2 } from 'lucide-react'

interface QuickOrderRow {
  id: string
  sku: string
  productName: string
  productId: string | null
  quantity: number
  price: number | null
  error: string | null
  isSearching: boolean
}

interface ProductSearchResult {
  id: string
  code: string
  name: string
}

interface DealerResult {
  id: string
}

function createEmptyRow(): QuickOrderRow {
  return {
    id: crypto.randomUUID(),
    sku: '',
    productName: '',
    productId: null,
    quantity: 1,
    price: null,
    error: null,
    isSearching: false,
  }
}

export function QuickOrderForm() {
  const [rows, setRows] = useState<QuickOrderRow[]>(() =>
    Array.from({ length: 5 }, createEmptyRow)
  )
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const addItem = useCartStore((state) => state.addItem)
  const supabase = createClient()

  const searchProduct = async (sku: string, rowId: string) => {
    if (!sku.trim()) {
      // Clear row if SKU is empty
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? { ...r, productId: null, productName: '', price: null, error: null }
            : r
        )
      )
      return
    }

    // Set searching state
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, isSearching: true, error: null } : r))
    )

    try {
      // Get dealer ID
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === rowId
              ? { ...r, isSearching: false, error: 'Oturum acmaniz gerekli' }
              : r
          )
        )
        return
      }

      const { data: dealerData } = await supabase
        .from('dealers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!dealerData) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === rowId
              ? { ...r, isSearching: false, error: 'Bayi kaydi bulunamadi' }
              : r
          )
        )
        return
      }

      const dealer = dealerData as unknown as DealerResult

      // Search product by code (case-insensitive)
      const { data: productData } = await supabase
        .from('products')
        .select('id, code, name')
        .ilike('code', sku.trim())
        .single()

      if (!productData) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === rowId
              ? { ...r, isSearching: false, error: 'Urun bulunamadi' }
              : r
          )
        )
        return
      }

      const product = productData as unknown as ProductSearchResult

      // Get dealer price
      const { data: price } = await (supabase as any).rpc('get_dealer_price', {
        p_product_id: product.id,
        p_dealer_id: dealer.id,
      })

      // Update row with product info
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                productId: product.id,
                productName: product.name,
                price: price || 0,
                isSearching: false,
                error: null,
              }
            : r
        )
      )
    } catch (error) {
      console.error('Product search error:', error)
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? { ...r, isSearching: false, error: 'Arama sirasinda hata olustu' }
            : r
        )
      )
    }
  }

  const updateRowSku = (rowId: string, sku: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, sku, error: null } : r))
    )
  }

  const updateRowQuantity = (rowId: string, quantity: number) => {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, quantity: Math.max(1, quantity) } : r))
    )
  }

  const addRow = () => {
    setRows((prev) => [...prev, createEmptyRow()])
  }

  const removeRow = (rowId: string) => {
    if (rows.length <= 1) return
    setRows((prev) => prev.filter((r) => r.id !== rowId))
  }

  const clearForm = () => {
    setRows(Array.from({ length: 5 }, createEmptyRow))
  }

  const addToCart = async () => {
    const validRows = rows.filter((r) => r.productId && r.quantity > 0)

    if (validRows.length === 0) {
      toast.error('Sepete eklenecek gecerli urun yok')
      return
    }

    setIsAddingToCart(true)

    try {
      validRows.forEach((row) => {
        addItem({
          productId: row.productId!,
          productCode: row.sku,
          productName: row.productName,
          quantity: row.quantity,
          price: row.price || 0,
        })
      })

      toast.success(`${validRows.length} urun sepete eklendi`)

      // Reset form
      setRows(Array.from({ length: 5 }, createEmptyRow))
    } finally {
      setIsAddingToCart(false)
    }
  }

  const validRowCount = rows.filter((r) => r.productId && r.quantity > 0).length

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Urun Kodu</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Urun Adi</th>
              <th className="px-4 py-3 text-center text-sm font-medium w-24">Adet</th>
              <th className="px-4 py-3 text-right text-sm font-medium w-32">Fiyat</th>
              <th className="px-4 py-3 text-right text-sm font-medium w-32">Tutar</th>
              <th className="px-4 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-2">
                  <div className="space-y-1">
                    <div className="relative">
                      <Input
                        value={row.sku}
                        onChange={(e) => updateRowSku(row.id, e.target.value)}
                        onBlur={() => searchProduct(row.sku, row.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            searchProduct(row.sku, row.id)
                          }
                        }}
                        placeholder="Urun kodu girin"
                        className={`pr-8 ${row.error ? 'border-destructive' : ''}`}
                      />
                      {row.isSearching && (
                        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {row.error && (
                      <p className="text-xs text-destructive">{row.error}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <span className={row.productName ? '' : 'text-muted-foreground'}>
                    {row.productName || '-'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    min={1}
                    value={row.quantity}
                    onChange={(e) =>
                      updateRowQuantity(row.id, parseInt(e.target.value) || 1)
                    }
                    className="text-center"
                    disabled={!row.productId}
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  {row.price !== null
                    ? row.price.toLocaleString('tr-TR', {
                        style: 'currency',
                        currency: 'TRY',
                      })
                    : '-'}
                </td>
                <td className="px-4 py-2 text-right font-medium">
                  {row.price !== null && row.productId
                    ? (row.price * row.quantity).toLocaleString('tr-TR', {
                        style: 'currency',
                        currency: 'TRY',
                      })
                    : '-'}
                </td>
                <td className="px-4 py-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length <= 1}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={addRow} className="gap-2">
            <Plus className="h-4 w-4" />
            Satir Ekle
          </Button>
          <Button variant="outline" onClick={clearForm} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Temizle
          </Button>
        </div>

        <Button
          onClick={addToCart}
          disabled={validRowCount === 0 || isAddingToCart}
          className="gap-2"
        >
          {isAddingToCart ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShoppingCart className="h-4 w-4" />
          )}
          Sepete Ekle ({validRowCount} urun)
        </Button>
      </div>
    </div>
  )
}
