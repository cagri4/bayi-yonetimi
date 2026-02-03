import { Suspense } from 'react'
import { getSalesReport } from '@/lib/queries/reports'
import { exportSalesReportCSV } from '@/lib/actions/export-reports'
import { SalesReportTable } from '@/components/reports/sales-report-table'
import { SalesChart } from '@/components/reports/sales-chart'
import { DateRangeFilter } from '@/components/reports/date-range-filter'
import { PeriodSelector } from '@/components/reports/period-selector'
import { ExportButton } from '@/components/reports/export-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ShoppingCart, TrendingUp, Calculator } from 'lucide-react'

interface SearchParams {
  startDate?: string
  endDate?: string
  period?: string
}

function getDefaultDates() {
  const today = new Date()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(today.getDate() - 30)

  return {
    startDate: thirtyDaysAgo.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
  }
}

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const defaults = getDefaultDates()
  const startDate = params.startDate || defaults.startDate
  const endDate = params.endDate || defaults.endDate
  const period = (params.period || 'daily') as 'daily' | 'weekly' | 'monthly'

  const data = await getSalesReport(startDate, endDate, period)

  // Calculate summary totals
  const totals = data.reduce(
    (acc, row) => ({
      order_count: acc.order_count + row.order_count,
      total_sales: acc.total_sales + row.total_sales,
    }),
    { order_count: 0, total_sales: 0 }
  )
  const avgOrderValue = totals.order_count > 0
    ? totals.total_sales / totals.order_count
    : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Satis Raporu</h1>
          <p className="text-muted-foreground">
            Donemlere gore satis istatistikleri
          </p>
        </div>
        <ExportButton
          exportFn={async () => exportSalesReportCSV(period, startDate, endDate)}
          filename={`satis-raporu-${period}-${startDate}-${endDate}.csv`}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Siparis</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.order_count}</div>
            <p className="text-xs text-muted-foreground">
              Secili donem icinde
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Ciro</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totals.total_sales.toLocaleString('tr-TR', {
                style: 'currency',
                currency: 'TRY',
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Secili donem icinde
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ortalama Siparis</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgOrderValue.toLocaleString('tr-TR', {
                style: 'currency',
                currency: 'TRY',
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Siparis basina ortalama
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtreler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <Suspense fallback={<Skeleton className="h-10 w-full" />}>
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                basePath="/admin/reports/sales"
              />
            </Suspense>
            <div className="space-y-2">
              <span className="text-sm font-medium">Periyot</span>
              <Suspense fallback={<Skeleton className="h-10 w-[180px]" />}>
                <PeriodSelector
                  currentPeriod={period}
                  basePath="/admin/reports/sales"
                />
              </Suspense>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Satis Grafigi</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesChart data={data} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Satis Verileri</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesReportTable data={data} />
        </CardContent>
      </Card>
    </div>
  )
}
