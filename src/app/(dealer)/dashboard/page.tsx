import { Suspense } from 'react'
import { LayoutDashboard } from 'lucide-react'
import { getDashboardData } from '@/lib/queries/dashboard'
import { SpendingSummaryWidget } from '@/components/dashboard/spending-summary'
import { RecentOrdersWidget } from '@/components/dashboard/recent-orders'
import { PendingCountWidget } from '@/components/dashboard/pending-count'
import { QuickActionsWidget } from '@/components/dashboard/quick-actions'
import { TopProductsWidget } from '@/components/dashboard/top-products'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// ============================================
// SKELETON COMPONENTS
// ============================================

function SpendingSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-20 mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function WidgetSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card className="h-full">
      <CardContent className="pt-6 space-y-3">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}

// ============================================
// DATA SECTIONS (async server components)
// ============================================

async function DashboardContent() {
  const data = await getDashboardData()

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Veri yuklenemedi. Lutfen sayfayi yenileyin.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Spending Summary - full width */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Cari Durum</h2>
        <SpendingSummaryWidget
          currentMonth={data.spending.currentMonth}
          previousMonth={data.spending.previousMonth}
          ytd={data.spending.yearToDate}
        />
      </section>

      {/* Row 2: Pending Count + Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <PendingCountWidget count={data.pendingCount} />
        <QuickActionsWidget />
      </div>

      {/* Row 3: Recent Orders + Top Products */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentOrdersWidget orders={data.recentOrders} />
        </div>
        <div>
          <TopProductsWidget products={data.topProducts} />
        </div>
      </div>
    </div>
  )
}

// ============================================
// PAGE
// ============================================

export default async function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-8 w-8 text-blue-500" />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
            <p className="text-gray-500 mt-1">
              Hesabinizin genel durumunu ve son faaliyetleri goruntuleyin
            </p>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <Suspense
        fallback={
          <div className="space-y-6">
            <SpendingSkeleton />
            <div className="grid gap-4 md:grid-cols-2">
              <WidgetSkeleton rows={1} />
              <WidgetSkeleton rows={4} />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <WidgetSkeleton rows={5} />
              </div>
              <WidgetSkeleton rows={5} />
            </div>
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </div>
  )
}
