import { Suspense } from 'react'
import { getSalesReport } from '@/lib/queries/reports'
import { exportSalesReportCSV } from '@/lib/actions/export-reports'
import { SalesReportTable } from '@/components/reports/sales-report-table'
import { DateRangeFilter } from '@/components/reports/date-range-filter'
import { PeriodSelector } from '@/components/reports/period-selector'
import { ExportButton } from '@/components/reports/export-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

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
