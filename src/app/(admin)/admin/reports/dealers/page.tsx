import { Suspense } from 'react'
import { getDealerPerformance } from '@/lib/queries/reports'
import { exportDealerPerformanceCSV } from '@/lib/actions/export-reports'
import { DealerPerformanceTable } from '@/components/reports/dealer-performance-table'
import { DateRangeFilter } from '@/components/reports/date-range-filter'
import { ExportButton } from '@/components/reports/export-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface SearchParams {
  startDate?: string
  endDate?: string
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

export default async function DealerPerformancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const defaults = getDefaultDates()
  const startDate = params.startDate || defaults.startDate
  const endDate = params.endDate || defaults.endDate

  const data = await getDealerPerformance(startDate, endDate)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bayi Performansi</h1>
          <p className="text-muted-foreground">
            Satis hacmine gore bayi siralamalari
          </p>
        </div>
        <ExportButton
          exportFn={async () => exportDealerPerformanceCSV(startDate, endDate)}
          filename={`bayi-performans-${startDate}-${endDate}.csv`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tarih Araligi</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-10 w-full" />}>
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              basePath="/admin/reports/dealers"
            />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bayi Satis Siralamalari</CardTitle>
        </CardHeader>
        <CardContent>
          <DealerPerformanceTable data={data} />
        </CardContent>
      </Card>
    </div>
  )
}
