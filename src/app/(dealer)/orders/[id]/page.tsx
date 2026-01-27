import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/server'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { OrderStatusTimeline } from '@/components/orders/order-status-timeline'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft } from 'lucide-react'
import { OrderRealtimeWrapper } from './order-realtime-wrapper'

// Types for order data
interface OrderStatus {
  code: string
  name: string
}

interface OrderItem {
  id: string
  product_name: string
  product_code: string
  quantity: number
  unit_price: number
  total_price: number
}

interface StatusHistoryEntry {
  id: string
  status: OrderStatus
  created_at: string
  notes: string | null
}

interface OrderDetail {
  id: string
  order_number: string
  created_at: string
  subtotal: number
  discount_amount: number
  total_amount: number
  notes: string | null
  status: OrderStatus | null
  items: OrderItem[]
  history: StatusHistoryEntry[]
}

interface PageProps {
  params: Promise<{ id: string }>
}

async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const supabase = await createClient()

  // Get current user's dealer ID for RLS
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: dealer } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!dealer) return null

  // Fetch order with relations
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      created_at,
      subtotal,
      discount_amount,
      total_amount,
      notes,
      status:order_statuses(code, name),
      items:order_items(id, product_name, product_code, quantity, unit_price, total_price),
      history:order_status_history(id, created_at, notes, status:order_statuses(code, name))
    `)
    .eq('id', orderId)
    .eq('dealer_id', (dealer as { id: string }).id)
    .single()

  if (error || !order) return null

  return order as unknown as OrderDetail
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params
  const order = await getOrderDetail(id)

  if (!order) {
    notFound()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/orders">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Siparis #{order.order_number}</h1>
            <p className="text-muted-foreground">
              {format(new Date(order.created_at), 'dd MMMM yyyy, HH:mm', {
                locale: tr,
              })}
            </p>
          </div>
        </div>
        {order.status && <OrderStatusBadge status={order.status} />}
      </div>

      {/* Realtime subscription wrapper */}
      <OrderRealtimeWrapper orderId={order.id} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Order Items - Left Column (2/3) */}
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
                    <TableHead>Kod</TableHead>
                    <TableHead className="text-center">Adet</TableHead>
                    <TableHead className="text-right">Birim Fiyat</TableHead>
                    <TableHead className="text-right">Tutar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.product_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.product_code}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.unit_price.toLocaleString('tr-TR', {
                          style: 'currency',
                          currency: 'TRY',
                        })}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.total_price.toLocaleString('tr-TR', {
                          style: 'currency',
                          currency: 'TRY',
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Order Totals */}
              <div className="mt-6 border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ara Toplam</span>
                  <span>
                    {order.subtotal.toLocaleString('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                    })}
                  </span>
                </div>
                {order.discount_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Indirim</span>
                    <span className="text-green-600">
                      -{order.discount_amount.toLocaleString('tr-TR', {
                        style: 'currency',
                        currency: 'TRY',
                      })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-medium text-lg border-t pt-2">
                  <span>Genel Toplam</span>
                  <span>
                    {order.total_amount.toLocaleString('tr-TR', {
                      style: 'currency',
                      currency: 'TRY',
                    })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Notes */}
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Siparis Notlari</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Status Timeline - Right Column (1/3) */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Siparis Gecmisi</CardTitle>
              <CardDescription>
                Siparisinizin durum degisiklikleri
              </CardDescription>
            </CardHeader>
            <CardContent>
              {order.history.length > 0 ? (
                <OrderStatusTimeline
                  history={order.history}
                  currentStatusCode={order.status?.code || 'pending'}
                />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Henuz durum gecmisi bulunmuyor.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
