import { createClient } from '@/lib/supabase/server'

// ============================================
// TYPES
// ============================================

export interface SpendingSummary {
  currentMonth: {
    totalDebit: number
    totalCredit: number
    netBalance: number
  }
  previousMonth: {
    totalDebit: number
    totalCredit: number
    netBalance: number
  }
  yearToDate: {
    totalDebit: number
    totalCredit: number
    netBalance: number
  }
}

export interface RecentOrder {
  id: string
  orderNumber: string
  status: {
    code: string
    name: string
  } | null
  totalAmount: number
  createdAt: string
}

export interface TopProduct {
  productId: string
  productName: string
  productCode: string
  totalQuantity: number
  orderCount: number
}

export interface DashboardData {
  spending: SpendingSummary
  recentOrders: RecentOrder[]
  pendingCount: number
  topProducts: TopProduct[]
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get dealer ID from authenticated user
 * Reuses pattern from financials.ts
 */
async function getDealerFromUser(): Promise<string | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: dealer } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!dealer) return null

  return (dealer as { id: string }).id
}

/**
 * Get spending summary from materialized view
 * Falls back to get_dealer_balance_breakdown RPC if view not populated
 */
async function getSpendingSummary(dealerId: string): Promise<SpendingSummary> {
  const supabase = await createClient()

  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const yearStart = new Date(now.getFullYear(), 0, 1)

  // Try materialized view first
  const { data: viewData } = await supabase
    .from('dealer_spending_summary')
    .select('*')
    .eq('dealer_id', dealerId)
    .gte('month', yearStart.toISOString().split('T')[0])
    .order('month', { ascending: false })

  if (viewData && viewData.length > 0) {
    const rawData = viewData as Array<{
      month: string
      total_debit: number
      total_credit: number
      net_balance: number
    }>

    // Calculate current month (first entry should be current/most recent)
    const currentMonth = rawData.find(
      (d) => d.month === currentMonthStart.toISOString().split('T')[0]
    ) || { total_debit: 0, total_credit: 0, net_balance: 0 }

    // Calculate previous month
    const previousMonth = rawData.find(
      (d) => d.month === previousMonthStart.toISOString().split('T')[0]
    ) || { total_debit: 0, total_credit: 0, net_balance: 0 }

    // Calculate YTD (sum all months from year start)
    const ytd = rawData.reduce(
      (acc, d) => ({
        total_debit: acc.total_debit + (d.total_debit || 0),
        total_credit: acc.total_credit + (d.total_credit || 0),
        net_balance: acc.net_balance + (d.net_balance || 0),
      }),
      { total_debit: 0, total_credit: 0, net_balance: 0 }
    )

    return {
      currentMonth: {
        totalDebit: currentMonth.total_debit ?? 0,
        totalCredit: currentMonth.total_credit ?? 0,
        netBalance: currentMonth.net_balance ?? 0,
      },
      previousMonth: {
        totalDebit: previousMonth.total_debit ?? 0,
        totalCredit: previousMonth.total_credit ?? 0,
        netBalance: previousMonth.net_balance ?? 0,
      },
      yearToDate: {
        totalDebit: ytd.total_debit,
        totalCredit: ytd.total_credit,
        netBalance: ytd.net_balance,
      },
    }
  }

  // Fallback to RPC if view not populated
  const { data: rpcData } = await (supabase as any)
    .rpc('get_dealer_balance_breakdown', { p_dealer_id: dealerId })
    .single()

  if (rpcData) {
    const balance = rpcData as {
      total_debit: number
      total_credit: number
      net_balance: number
    }

    return {
      currentMonth: {
        totalDebit: balance.total_debit ?? 0,
        totalCredit: balance.total_credit ?? 0,
        netBalance: balance.net_balance ?? 0,
      },
      previousMonth: {
        totalDebit: 0,
        totalCredit: 0,
        netBalance: 0,
      },
      yearToDate: {
        totalDebit: balance.total_debit ?? 0,
        totalCredit: balance.total_credit ?? 0,
        netBalance: balance.net_balance ?? 0,
      },
    }
  }

  // No data available
  return {
    currentMonth: { totalDebit: 0, totalCredit: 0, netBalance: 0 },
    previousMonth: { totalDebit: 0, totalCredit: 0, netBalance: 0 },
    yearToDate: { totalDebit: 0, totalCredit: 0, netBalance: 0 },
  }
}

/**
 * Get recent orders for dealer (last 5)
 */
async function getRecentOrders(dealerId: string): Promise<RecentOrder[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      total_amount,
      created_at,
      status:order_statuses(
        code,
        name
      )
    `)
    .eq('dealer_id', dealerId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error || !data) {
    console.error('Error fetching recent orders:', error)
    return []
  }

  return data.map((o: any) => ({
    id: o.id,
    orderNumber: o.order_number,
    status: o.status ? {
      code: o.status.code,
      name: o.status.name,
    } : null,
    totalAmount: o.total_amount,
    createdAt: o.created_at,
  }))
}

/**
 * Get count of pending orders (pending, confirmed, preparing statuses)
 */
async function getPendingOrdersCount(dealerId: string): Promise<number> {
  const supabase = await createClient()

  // Get status IDs for pending states
  const { data: statuses } = await supabase
    .from('order_statuses')
    .select('id')
    .in('code', ['pending', 'confirmed', 'preparing'])

  if (!statuses || statuses.length === 0) return 0

  const statusIds = statuses.map((s: any) => s.id)

  const { count, error } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('dealer_id', dealerId)
    .in('status_id', statusIds)

  if (error) {
    console.error('Error counting pending orders:', error)
    return 0
  }

  return count ?? 0
}

/**
 * Get top products for dealer (most ordered)
 */
async function getTopProducts(dealerId: string): Promise<TopProduct[]> {
  const supabase = await createClient()

  const { data, error } = await (supabase as any).rpc(
    'get_top_products_for_dealer',
    { p_dealer_id: dealerId, p_limit: 5 }
  )

  if (error || !data) {
    console.error('Error fetching top products:', error)
    return []
  }

  return data.map((p: any) => ({
    productId: p.product_id,
    productName: p.product_name,
    productCode: p.product_code,
    totalQuantity: p.total_quantity,
    orderCount: p.order_count,
  }))
}

// ============================================
// MAIN DASHBOARD QUERY
// ============================================

/**
 * Get all dashboard data with parallel fetching
 * Uses Promise.all to fetch all widget data simultaneously
 */
export async function getDashboardData(): Promise<DashboardData | null> {
  const dealerId = await getDealerFromUser()
  if (!dealerId) return null

  // Parallel data fetching - NO waterfall
  const [spending, recentOrders, pendingCount, topProducts] = await Promise.all([
    getSpendingSummary(dealerId),
    getRecentOrders(dealerId),
    getPendingOrdersCount(dealerId),
    getTopProducts(dealerId),
  ])

  return {
    spending,
    recentOrders,
    pendingCount,
    topProducts,
  }
}
