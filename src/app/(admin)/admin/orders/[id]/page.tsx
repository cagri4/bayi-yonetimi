import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getValidNextStatuses } from '@/lib/actions/admin-orders'
import { getOrderDocuments, getCargoInfo } from '@/lib/actions/order-docs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { OrderStatusTimeline } from '@/components/orders/order-status-timeline'
import { OrderStatusSelect, CancelOrderButton } from '@/components/admin/order-status-select'
import { DocumentUpload } from '@/components/admin/orders/document-upload'
import { CargoForm } from '@/components/admin/orders/cargo-form'

interface OrderItem {
  id: string
  product_id: string
  product_code: string
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
}

interface OrderStatusHistory {
  id: string
  status: {
    code: string
    name: string
  }
  created_at: string
  notes: string | null
}

interface OrderDetails {
  id: string
  order_number: string
  subtotal: number
  discount_amount: number
  total_amount: number
  notes: string | null
  created_at: string
  updated_at: string
  status_id: string
  dealer: {
    id: string
    company_name: string
    email: string
    phone: string | null
    address: string | null
  } | null
  status: {
    id: string
    code: string
    name: string
  } | null
  items: OrderItem[]
  status_history: OrderStatusHistory[]
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(amount)
}

const formatDate = (dateString: string) => {
  return format(new Date(dateString), 'dd MMMM yyyy, HH:mm', { locale: tr })
}

async function getOrderDetails(orderId: string): Promise<OrderDetails | null> {
  const supabase = await createClient()

  // Get order with dealer info and status
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      subtotal,
      discount_amount,
      total_amount,
      notes,
      created_at,
      updated_at,
      status_id,
      dealer:dealers(id, company_name, email, phone, address),
      status:order_statuses(id, code, name)
    `)
    .eq('id', orderId)
    .single()

  if (error || !order) {
    return null
  }

  // Get order items
  const { data: items } = await supabase
    .from('order_items')
    .select('id, product_id, product_code, product_name, quantity, unit_price, total_price')
    .eq('order_id', orderId)
    .order('created_at')

  // Get status history
  const { data: statusHistory } = await supabase
    .from('order_status_history')
    .select(`
      id,
      created_at,
      notes,
      status:order_statuses(code, name)
    `)
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  // Type for raw status history
  type RawStatusHistory = {
    id: string
    created_at: string
    notes: string | null
    status: { code: string; name: string } | null
  }
  const typedStatusHistory = (statusHistory || []) as RawStatusHistory[]

  // Type assertion for the order object
  const orderData = order as {
    id: string
    order_number: string
    subtotal: number
    discount_amount: number
    total_amount: number
    notes: string | null
    created_at: string
    updated_at: string
    status_id: string
    dealer: OrderDetails['dealer']
    status: OrderDetails['status']
  }

  return {
    id: orderData.id,
    order_number: orderData.order_number,
    subtotal: orderData.subtotal,
    discount_amount: orderData.discount_amount,
    total_amount: orderData.total_amount,
    notes: orderData.notes,
    created_at: orderData.created_at,
    updated_at: orderData.updated_at,
    status_id: orderData.status_id,
    dealer: orderData.dealer,
    status: orderData.status,
    items: (items || []) as OrderItem[],
    status_history: typedStatusHistory
      .filter(h => h.status !== null)
      .map(h => ({
        id: h.id,
        created_at: h.created_at,
        notes: h.notes,
        status: h.status!,
      })),
  }
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [order, validStatuses, documents, cargoInfo] = await Promise.all([
    getOrderDetails(id),
    getValidNextStatuses(id),
    getOrderDocuments(id),
    getCargoInfo(id),
  ])

  if (!order) {
    notFound()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/orders">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Geri
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Siparis Detayi</h1>
            <p className="text-muted-foreground">
              {order.order_number}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {order.status && (
            <OrderStatusBadge status={order.status} />
          )}
          <CancelOrderButton
            orderId={order.id}
            currentStatusCode={order.status?.code || ''}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Siparis Kalemleri</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Kod</TableHead>
                    <TableHead>Urun Adi</TableHead>
                    <TableHead className="text-right">Birim Fiyat</TableHead>
                    <TableHead className="text-center">Adet</TableHead>
                    <TableHead className="text-right">Toplam</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">
                        {item.product_code}
                      </TableCell>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.unit_price)}
                      </TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.total_price)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Order totals */}
              <div className="mt-4 flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Ara Toplam:</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                  {order.discount_amount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Indirim:</span>
                      <span>-{formatCurrency(order.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>Toplam:</span>
                    <span>{formatCurrency(order.total_amount)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Update */}
          <Card>
            <CardHeader>
              <CardTitle>Durum Guncelle</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderStatusSelect
                orderId={order.id}
                currentStatusId={order.status_id}
                currentStatusCode={order.status?.code || ''}
                validStatuses={validStatuses}
              />
            </CardContent>
          </Card>

          {/* Document Upload */}
          <DocumentUpload orderId={order.id} initialDocuments={documents} />

          {/* Cargo Form */}
          <CargoForm orderId={order.id} initialCargoInfo={cargoInfo} />

          {/* Order Notes */}
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Siparis Notu</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {order.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - 1 column */}
        <div className="space-y-6">
          {/* Dealer Info */}
          <Card>
            <CardHeader>
              <CardTitle>Bayi Bilgisi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Firma Adi</div>
                <div className="font-medium">{order.dealer?.company_name || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">E-posta</div>
                <div className="font-medium">{order.dealer?.email || '-'}</div>
              </div>
              {order.dealer?.phone && (
                <div>
                  <div className="text-sm text-muted-foreground">Telefon</div>
                  <div className="font-medium">{order.dealer.phone}</div>
                </div>
              )}
              {order.dealer?.address && (
                <div>
                  <div className="text-sm text-muted-foreground">Adres</div>
                  <div className="font-medium">{order.dealer.address}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Info */}
          <Card>
            <CardHeader>
              <CardTitle>Siparis Bilgisi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Siparis No</div>
                <div className="font-mono font-medium">{order.order_number}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Olusturma Tarihi</div>
                <div className="font-medium">{formatDate(order.created_at)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Son Guncelleme</div>
                <div className="font-medium">{formatDate(order.updated_at)}</div>
              </div>
            </CardContent>
          </Card>

          {/* Status History */}
          <Card>
            <CardHeader>
              <CardTitle>Durum Gecmisi</CardTitle>
            </CardHeader>
            <CardContent>
              {order.status_history.length > 0 ? (
                <OrderStatusTimeline
                  history={order.status_history}
                  currentStatusCode={order.status?.code || 'pending'}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Durum gecmisi bulunmuyor.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
