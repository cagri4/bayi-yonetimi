import Link from 'next/link'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { formatCurrency } from '@/lib/utils'
import type { RecentOrder } from '@/lib/queries/dashboard'

interface RecentOrdersProps {
  orders: RecentOrder[]
}

export function RecentOrdersWidget({ orders }: RecentOrdersProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Son Siparisler</CardTitle>
          <Link
            href="/orders"
            className="text-xs text-primary hover:underline font-medium"
          >
            Tum Siparisler
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <p className="text-sm">Henuz siparisizin bulunmuyor</p>
            <Link href="/catalog" className="mt-2 text-xs text-primary hover:underline">
              Urunleri inceleyin
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-medium truncate">
                    {order.orderNumber}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(order.createdAt), 'dd MMM yyyy', { locale: tr })}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                  {order.status && (
                    <OrderStatusBadge status={order.status} />
                  )}
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatCurrency(order.totalAmount)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
