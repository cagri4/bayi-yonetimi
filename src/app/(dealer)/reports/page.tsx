import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { BarChart2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getDealerIdFromUser, getDealerMonthlySpending, getSpendingComparison } from '@/lib/queries/spending-reports'
import { SpendingTrendChart } from '@/components/reports/spending-trend-chart'
import { PeriodComparison } from '@/components/reports/period-comparison'
import { SpendingExportButton } from '@/components/reports/spending-export-button'

// ============================================
// SKELETONS
// ============================================

function ChartSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  )
}

function ComparisonSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardContent className="pt-6 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================
// CONTENT (async server component)
// ============================================

async function ReportsContent({ dealerId }: { dealerId: string }) {
  // Parallel data fetch — no waterfall
  const [monthlyData, comparison] = await Promise.all([
    getDealerMonthlySpending(dealerId, 12),
    getSpendingComparison(dealerId),
  ])

  return (
    <div className="space-y-8">
      {/* Period Comparison Cards */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Donem Karsilastirmasi</h2>
        <PeriodComparison comparison={comparison} />
      </section>

      {/* Monthly Trend Chart */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Aylik Trend (Son 12 Ay)</h2>
        <Card>
          <CardContent className="pt-6">
            <SpendingTrendChart data={monthlyData} />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

// ============================================
// PAGE
// ============================================

export default async function ReportsPage() {
  const dealerId = await getDealerIdFromUser()

  if (!dealerId) {
    redirect('/login')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BarChart2 className="h-8 w-8 text-blue-500" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Harcama Analizi</h1>
              <p className="text-gray-500 mt-1">
                Finansal hareketlerinizi aylik trend ve donem karsilastirmasi ile inceleyin
              </p>
            </div>
          </div>
          <SpendingExportButton />
        </div>
      </div>

      {/* Reports Content */}
      <Suspense
        fallback={
          <div className="space-y-8">
            <section>
              <Skeleton className="h-6 w-48 mb-4" />
              <ComparisonSkeleton />
            </section>
            <section>
              <Skeleton className="h-6 w-40 mb-4" />
              <ChartSkeleton />
            </section>
          </div>
        }
      >
        <ReportsContent dealerId={dealerId} />
      </Suspense>
    </div>
  )
}
