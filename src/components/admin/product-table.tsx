'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toggleProductActive, updateStock } from '@/lib/actions/products'
import { useToast } from '@/hooks/use-toast'

interface Product {
  id: string
  code: string
  name: string
  base_price: number
  stock_quantity: number
  low_stock_threshold: number
  is_active: boolean
  image_url: string | null
  category: { id: string; name: string } | null
  brand: { id: string; name: string } | null
}

interface Category {
  id: string
  name: string
}

interface Brand {
  id: string
  name: string
}

interface ProductTableProps {
  products: Product[]
  categories: Category[]
  brands: Brand[]
}

export function ProductTable({ products, categories, brands }: ProductTableProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [brandFilter, setBrandFilter] = useState<string>('all')
  const { toast } = useToast()

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.code.toLowerCase().includes(search.toLowerCase())
    const matchesCategory =
      categoryFilter === 'all' || product.category?.id === categoryFilter
    const matchesBrand =
      brandFilter === 'all' || product.brand?.id === brandFilter

    return matchesSearch && matchesCategory && matchesBrand
  })

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const result = await toggleProductActive(id, !currentActive)
    if (result.success) {
      toast({ title: result.message })
    } else {
      toast({ title: result.message, variant: 'destructive' })
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(price)
  }

  const getStockBadge = (quantity: number, threshold: number) => {
    if (quantity === 0) {
      return <Badge variant="destructive">Stok Yok</Badge>
    }
    if (quantity <= threshold) {
      return <Badge variant="secondary">Az Stok ({quantity})</Badge>
    }
    return <Badge variant="default">{quantity}</Badge>
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Input
          placeholder="Urun adi veya kodu ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tum Kategoriler</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Marka" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tum Markalar</SelectItem>
            {brands.map((brand) => (
              <SelectItem key={brand.id} value={brand.id}>
                {brand.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Kod</TableHead>
              <TableHead>Urun Adi</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Marka</TableHead>
              <TableHead className="text-right">Fiyat</TableHead>
              <TableHead className="text-center">Stok</TableHead>
              <TableHead className="text-center">Durum</TableHead>
              <TableHead className="text-right">Islemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  Urun bulunamadi
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-mono text-sm">
                    {product.code}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.category?.name || '-'}</TableCell>
                  <TableCell>{product.brand?.name || '-'}</TableCell>
                  <TableCell className="text-right">
                    {formatPrice(product.base_price)}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStockBadge(product.stock_quantity, product.low_stock_threshold)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant={product.is_active ? 'default' : 'secondary'}
                      size="sm"
                      onClick={() => handleToggleActive(product.id, product.is_active)}
                    >
                      {product.is_active ? 'Aktif' : 'Pasif'}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/products/${product.id}/edit`}>
                      <Button variant="outline" size="sm">
                        Duzenle
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
