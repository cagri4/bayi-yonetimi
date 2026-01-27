import Link from 'next/link'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { getDealerOrders } from '@/lib/actions/orders'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Type for order from getDealerOrders
interface OrderStatus {
  code: string
  name: string
}

interface Order {
  id: string
  order_number: string
  created_at: string
  total_amount: number
  status: OrderStatus | null
}

export default async function OrdersPage() {
  const orders = (await getDealerOrders()) as Order[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Siparislerim</h1>
        <Link href="/catalog">
          <Button>Yeni Siparis</Button>
        </Link>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <div className="text-center text-muted-foreground">
              <p className="text-lg">Henuz siparisizin bulunmuyor</p>
              <p className="mt-2">
                <Link href="/catalog" className="text-primary hover:underline">
                  Urunleri inceleyin
                </Link>{' '}
                ve ilk siparisizini verin.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Siparis Gecmisi</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Siparis No</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">Toplam</TableHead>
                  <TableHead className="text-center">Detay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.order_number}
                    </TableCell>
                    <TableCell>
                      {format(new Date(order.created_at), 'dd MMMM yyyy, HH:mm', {
                        locale: tr,
                      })}
                    </TableCell>
                    <TableCell>
                      {order.status ? (
                        <OrderStatusBadge status={order.status} />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {order.total_amount.toLocaleString('tr-TR', {
                        style: 'currency',
                        currency: 'TRY',
                      })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Link href={`/orders/${order.id}`}>
                        <Button variant="outline" size="sm">
                          Goruntule
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
