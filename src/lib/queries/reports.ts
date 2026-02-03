import { createClient } from '@/lib/supabase/server'

// ============================================
// TYPES
// ============================================

export interface TopProductRow {
  product_id: string
  product_name: string
  sku: string
  order_count: number
  total_quantity: number
  total_revenue: number
}

export interface DealerPerformanceRow {
  dealer_id: string
  company_name: string
  order_count: number
  total_sales: number
  avg_order_value: number
  sales_rank: number
  sales_percentage: number
}

export interface SalesReportRow {
  period: string
  order_count: number
  total_sales: number
  avg_order_value: number
}

// ============================================
// QUERY FUNCTIONS
// ============================================

/**
 * Get top selling products by quantity
 * Returns products sorted by total quantity sold
 */
export async function getTopProducts(
  startDate: string,
  endDate: string,
  limit?: number
): Promise<TopProductRow[]> {
  const supabase = await createClient()

  const { data, error } = await (supabase as any).rpc('get_top_products', {
    start_date: startDate,
    end_date: endDate,
    limit_count: limit || 10,
  })

  if (error) {
    console.error('Error fetching top products:', error)
    return []
  }

  return (data || []) as TopProductRow[]
}

/**
 * Get dealer performance with ranking
 * Returns dealers sorted by total sales with rank and percentage
 */
export async function getDealerPerformance(
  startDate: string,
  endDate: string
): Promise<DealerPerformanceRow[]> {
  const supabase = await createClient()

  const { data, error } = await (supabase as any).rpc('get_dealer_performance', {
    start_date: startDate,
    end_date: endDate,
  })

  if (error) {
    console.error('Error fetching dealer performance:', error)
    return []
  }

  return (data || []) as DealerPerformanceRow[]
}

/**
 * Get sales report by period
 * Returns aggregated sales data grouped by daily/weekly/monthly
 */
export async function getSalesReport(
  startDate: string,
  endDate: string,
  periodType: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<SalesReportRow[]> {
  const supabase = await createClient()

  const { data, error } = await (supabase as any).rpc('get_sales_report', {
    start_date: startDate,
    end_date: endDate,
    period_type: periodType,
  })

  if (error) {
    console.error('Error fetching sales report:', error)
    return []
  }

  return (data || []) as SalesReportRow[]
}
