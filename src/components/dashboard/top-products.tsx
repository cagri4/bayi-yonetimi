import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart, Package } from 'lucide-react'
import type { TopProduct } from '@/lib/queries/dashboard'

interface TopProductsProps {
  products: TopProduct[]
}

export function TopProductsWidget({ products }: TopProductsProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">En Cok Alinan Urunler</CardTitle>
          <Link href="/catalog" className="text-xs text-primary hover:underline font-medium">
            Katalog
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Package className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Henuz siparis gecmisiniz yok</p>
            <Link href="/catalog" className="mt-2 text-xs text-primary hover:underline">
              Ilk siparisizini verin
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {products.map((product, index) => (
              <div
                key={product.productId}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                {/* Rank badge */}
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                  {index + 1}
                </div>

                {/* Product info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{product.productName}</p>
                  <p className="text-xs text-muted-foreground">{product.productCode}</p>
                </div>

                {/* Stats and add to cart */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant="secondary" className="text-xs whitespace-nowrap">
                    {product.orderCount} kez siparis
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {product.totalQuantity} adet
                  </span>
                </div>
              </div>
            ))}

            <div className="pt-2 border-t">
              <Link
                href="/catalog"
                className="flex items-center justify-center gap-2 w-full py-2 text-sm text-primary hover:bg-primary/5 rounded-lg transition-colors font-medium"
              >
                <ShoppingCart className="h-4 w-4" />
                Yeni Siparis Ver
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
