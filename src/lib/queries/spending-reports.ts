import { createClient } from '@/lib/supabase/server'
import { startOfMonth, subMonths, startOfYear, subYears, format } from 'date-fns'

// ============================================
// TYPES
// ============================================

export interface MonthlySpending {
  month: string       // 'YYYY-MM-DD' (first of month, from materialized view)
  totalDebit: number  // sum of debit transactions
  totalCredit: number // sum of credit transactions
  netBalance: number  // totalCredit - totalDebit
}

export interface SpendingComparison {
  thisMonth: { totalDebit: number; totalCredit: number; netBalance: number }
  lastMonth: { totalDebit: number; totalCredit: number; netBalance: number }
  thisYear: { totalDebit: number; totalCredit: number; netBalance: number }
  lastYear: { totalDebit: number; totalCredit: number; netBalance: number }
}

// ============================================
// HELPER
// ============================================

/**
 * Get dealer ID from authenticated user.
 * Pattern identical to queries/dashboard.ts and actions/financials.ts
 */
export async function getDealerIdFromUser(): Promise<string | null> {
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

// ============================================
// QUERIES
// ============================================

/**
 * Get last N months of spending data from dealer_spending_summary materialized view.
 * Returns empty array on error — page renders gracefully even if view is stale/empty.
 */
export async function getDealerMonthlySpending(
  dealerId: string,
  months = 12
): Promise<MonthlySpending[]> {
  const supabase = await createClient()

  const cutoff = format(subMonths(new Date(), months), 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('dealer_spending_summary')
    .select('month, total_debit, total_credit, net_balance')
    .eq('dealer_id', dealerId)
    .gte('month', cutoff)
    .order('month', { ascending: true })

  if (error) {
    console.error('Error fetching monthly spending:', error)
    return []
  }

  if (!data || data.length === 0) {
    return []
  }

  return (data as Array<{
    month: string
    total_debit: number
    total_credit: number
    net_balance: number
  }>).map((row) => ({
    month: row.month,
    totalDebit: row.total_debit ?? 0,
    totalCredit: row.total_credit ?? 0,
    netBalance: row.net_balance ?? 0,
  }))
}

/**
 * Get period comparison: this month vs last month, this year vs last year.
 *
 * Primary source: dealer_spending_summary materialized view (last 24 months).
 * Fallback: dealer_transactions table queried directly per period.
 *
 * Returns SpendingComparison with zero-defaults for any period with no data.
 */
export async function getSpendingComparison(
  dealerId: string
): Promise<SpendingComparison> {
  const supabase = await createClient()

  const now = new Date()

  // Date boundaries
  const thisMonthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const lastMonthStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd')
  const thisYearStart = format(startOfYear(now), 'yyyy-MM-dd')
  const lastYearStart = format(startOfYear(subYears(now, 1)), 'yyyy-MM-dd')
  const lastYearEnd = format(startOfYear(now), 'yyyy-MM-dd') // exclusive upper bound

  // Try materialized view: fetch last 24 months and aggregate in JS
  const cutoff = format(subMonths(now, 24), 'yyyy-MM-dd')

  const { data: viewData, error: viewError } = await supabase
    .from('dealer_spending_summary')
    .select('month, total_debit, total_credit, net_balance')
    .eq('dealer_id', dealerId)
    .gte('month', cutoff)
    .order('month', { ascending: true })

  if (!viewError && viewData && viewData.length > 0) {
    const rows = viewData as Array<{
      month: string
      total_debit: number
      total_credit: number
      net_balance: number
    }>

    const aggregate = (predicate: (m: string) => boolean) => {
      const matched = rows.filter((r) => predicate(r.month))
      return matched.reduce(
        (acc, r) => ({
          totalDebit: acc.totalDebit + (r.total_debit ?? 0),
          totalCredit: acc.totalCredit + (r.total_credit ?? 0),
          netBalance: acc.netBalance + (r.net_balance ?? 0),
        }),
        { totalDebit: 0, totalCredit: 0, netBalance: 0 }
      )
    }

    return {
      thisMonth: aggregate((m) => m >= thisMonthStart),
      lastMonth: aggregate((m) => m >= lastMonthStart && m < thisMonthStart),
      thisYear: aggregate((m) => m >= thisYearStart),
      lastYear: aggregate((m) => m >= lastYearStart && m < lastYearEnd),
    }
  }

  // Fallback: query dealer_transactions directly for each period
  // transaction_type.balance_effect: 'debit' | 'credit'
  const queryPeriod = async (
    from: string,
    to: string | null
  ): Promise<{ totalDebit: number; totalCredit: number; netBalance: number }> => {
    let query = (supabase as any)
      .from('dealer_transactions')
      .select('amount, transaction_type:transaction_types(balance_effect)')
      .eq('dealer_id', dealerId)
      .gte('transaction_date', from)

    if (to) {
      query = query.lt('transaction_date', to)
    }

    const { data, error } = await query

    if (error || !data) {
      console.error('Fallback transaction query error:', error)
      return { totalDebit: 0, totalCredit: 0, netBalance: 0 }
    }

    return (data as Array<{ amount: number; transaction_type: { balance_effect: string } | null }>)
      .reduce(
        (acc, t) => {
          const effect = t.transaction_type?.balance_effect
          const amt = t.amount ?? 0
          if (effect === 'debit') {
            return { ...acc, totalDebit: acc.totalDebit + amt }
          } else if (effect === 'credit') {
            return { ...acc, totalCredit: acc.totalCredit + amt }
          }
          return acc
        },
        { totalDebit: 0, totalCredit: 0, netBalance: 0 }
      )
      // compute net after accumulation
  }

  const [thisMonth, lastMonth, thisYear, lastYear] = await Promise.all([
    queryPeriod(thisMonthStart, null),
    queryPeriod(lastMonthStart, thisMonthStart),
    queryPeriod(thisYearStart, null),
    queryPeriod(lastYearStart, lastYearEnd),
  ])

  const withNet = (p: { totalDebit: number; totalCredit: number; netBalance: number }) => ({
    ...p,
    netBalance: p.totalCredit - p.totalDebit,
  })

  return {
    thisMonth: withNet(thisMonth),
    lastMonth: withNet(lastMonth),
    thisYear: withNet(thisYear),
    lastYear: withNet(lastYear),
  }

}
