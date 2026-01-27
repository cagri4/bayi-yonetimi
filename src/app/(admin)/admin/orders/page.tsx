import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getAdminOrders } from '@/lib/actions/admin-orders'
import { OrderFilters } from '@/components/admin/order-filters'
import { OrderTable } from '@/components/admin/order-table'
import { Skeleton } from '@/components/ui/skeleton'

interface SearchParams {
  page?: string
  status?: string
  dealer?: string
  from?: string
  to?: string
}

interface OrderStatus {
  id: string
  code: string
  name: string
}

interface Dealer {
  id: string
  company_name: string
}

async function getFilterData() {
  const supabase = await createClient()

  // Load order statuses for filter
  const { data: statuses } = await supabase
    .from('order_statuses')
    .select('id, code, name')
    .eq('is_active', true)
    .order('display_order')

  // Load dealers for filter
  const { data: dealers } = await supabase
    .from('dealers')
    .select('id, company_name')
    .eq('is_active', true)
    .order('company_name')

  return {
    statuses: (statuses || []) as OrderStatus[],
    dealers: (dealers || []) as Dealer[],
  }
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const page = parseInt(params.page || '1')

  // Load filter data and orders in parallel
  const [filterData, ordersResult] = await Promise.all([
    getFilterData(),
    getAdminOrders({
      page,
      status: params.status,
      dealerId: params.dealer,
      from: params.from,
      to: params.to,
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Siparis Yonetimi</h1>
        <p className="text-muted-foreground">
          Tum siparisleri goruntuleyip yonetin
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-32 w-full" />}>
        <OrderFilters
          statuses={filterData.statuses}
          dealers={filterData.dealers}
        />
      </Suspense>

      {ordersResult.error ? (
        <div className="text-center py-8 text-red-500">
          {ordersResult.error}
        </div>
      ) : (
        <OrderTable
          orders={ordersResult.orders}
          totalCount={ordersResult.count}
          currentPage={page}
        />
      )}
    </div>
  )
}
