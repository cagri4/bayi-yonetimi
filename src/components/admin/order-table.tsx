'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'

interface OrderWithRelations {
  id: string
  order_number: string
  dealer_id: string
  status_id: string
  subtotal: number
  discount_amount: number
  total_amount: number
  notes: string | null
  created_at: string
  updated_at: string
  dealer: {
    id: string
    company_name: string
    email: string
  } | null
  status: {
    id: string
    code: string
    name: string
  } | null
}

interface OrderTableProps {
  orders: OrderWithRelations[]
  totalCount: number
  currentPage: number
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(amount)
}

const formatDate = (dateString: string) => {
  return format(new Date(dateString), 'dd MMM yyyy, HH:mm', { locale: tr })
}

export function OrderTable({ orders, totalCount, currentPage }: OrderTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pageSize = 50
  const totalPages = Math.ceil(totalCount / pageSize)

  const navigateToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (page > 1) {
      params.set('page', page.toString())
    } else {
      params.delete('page')
    }
    const queryString = params.toString()
    router.push(`/admin/orders${queryString ? `?${queryString}` : ''}`)
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Siparis No</TableHead>
              <TableHead>Bayi</TableHead>
              <TableHead className="w-[180px]">Tarih</TableHead>
              <TableHead className="w-[140px]">Durum</TableHead>
              <TableHead className="text-right w-[120px]">Toplam</TableHead>
              <TableHead className="text-right w-[100px]">Islemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  Siparis bulunamadi
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-sm font-medium">
                    {order.order_number}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{order.dealer?.company_name || '-'}</div>
                      <div className="text-sm text-muted-foreground">
                        {order.dealer?.email || '-'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(order.created_at)}
                  </TableCell>
                  <TableCell>
                    {order.status ? (
                      <OrderStatusBadge status={order.status} />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(order.total_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/orders/${order.id}`}>
                      <Button variant="outline" size="sm">
                        Detay
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Toplam {totalCount} siparis
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateToPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              Onceki
            </Button>
            <span className="text-sm">
              Sayfa {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              Sonraki
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
