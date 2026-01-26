'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createProduct, updateProduct, type ActionState } from '@/lib/actions/products'
import { ImageUpload } from './image-upload'
import Link from 'next/link'

interface Category {
  id: string
  name: string
}

interface Brand {
  id: string
  name: string
}

interface Product {
  id: string
  code: string
  name: string
  description: string | null
  base_price: number
  stock_quantity: number
  low_stock_threshold: number
  image_url: string | null
  category_id: string | null
  brand_id: string | null
  is_active: boolean
}

interface ProductFormProps {
  categories: Category[]
  brands: Brand[]
  product?: Product
}

const initialState: ActionState = {}

export function ProductForm({ categories, brands, product }: ProductFormProps) {
  const isEdit = !!product

  const boundAction = isEdit
    ? updateProduct.bind(null, product.id)
    : createProduct

  const [state, formAction, pending] = useActionState(boundAction, initialState)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <form action={formAction}>
          <Card>
            <CardHeader>
              <CardTitle>{isEdit ? 'Urun Duzenle' : 'Yeni Urun'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {state.message && !state.success && (
                <Alert variant="destructive">
                  <AlertDescription>{state.message}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">Urun Kodu *</Label>
                  <Input
                    id="code"
                    name="code"
                    defaultValue={product?.code}
                    required
                  />
                  {state.errors?.code && (
                    <p className="text-sm text-red-500 mt-1">{state.errors.code[0]}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="name">Urun Adi *</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={product?.name}
                    required
                  />
                  {state.errors?.name && (
                    <p className="text-sm text-red-500 mt-1">{state.errors.name[0]}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="description">Aciklama</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={product?.description || ''}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category_id">Kategori</Label>
                  <Select name="category_id" defaultValue={product?.category_id || ''}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kategori secin" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="brand_id">Marka</Label>
                  <Select name="brand_id" defaultValue={product?.brand_id || ''}>
                    <SelectTrigger>
                      <SelectValue placeholder="Marka secin" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="base_price">Baz Fiyat (TL) *</Label>
                  <Input
                    id="base_price"
                    name="base_price"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={product?.base_price}
                    required
                  />
                  {state.errors?.base_price && (
                    <p className="text-sm text-red-500 mt-1">{state.errors.base_price[0]}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="stock_quantity">Stok Miktari *</Label>
                  <Input
                    id="stock_quantity"
                    name="stock_quantity"
                    type="number"
                    min="0"
                    defaultValue={product?.stock_quantity || 0}
                    required
                  />
                  {state.errors?.stock_quantity && (
                    <p className="text-sm text-red-500 mt-1">{state.errors.stock_quantity[0]}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="low_stock_threshold">Dusuk Stok Esigi</Label>
                  <Input
                    id="low_stock_threshold"
                    name="low_stock_threshold"
                    type="number"
                    min="0"
                    defaultValue={product?.low_stock_threshold || 10}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  name="is_active"
                  defaultChecked={product?.is_active ?? true}
                  value="true"
                />
                <Label htmlFor="is_active">Aktif</Label>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={pending}>
                  {pending ? 'Kaydediliyor...' : isEdit ? 'Guncelle' : 'Olustur'}
                </Button>
                <Link href="/admin/products">
                  <Button type="button" variant="outline">
                    Iptal
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>

      {isEdit && (
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Urun Resmi</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageUpload
                productId={product.id}
                currentImageUrl={product.image_url}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
