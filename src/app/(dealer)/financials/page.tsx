import { Suspense } from 'react'
import { Wallet } from 'lucide-react'
import {
  getDealerBalance,
  getDealerTransactions,
  getTransactionTypes,
} from '@/lib/actions/financials'
import { BalanceSummary } from '@/components/financials/balance-summary'
import { TransactionFilters } from '@/components/financials/transaction-filters'
import { TransactionListWrapper } from '@/components/financials/transaction-list-wrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface PageProps {
  searchParams: Promise<{
    startDate?: string
    endDate?: string
    type?: string
    page?: string
  }>
}

function BalanceSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function TransactionsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  )
}

async function BalanceSection() {
  const balance = await getDealerBalance()
  return (
    <BalanceSummary
      totalDebit={balance.totalDebit}
      totalCredit={balance.totalCredit}
      netBalance={balance.netBalance}
    />
  )
}

async function TransactionsSection({
  startDate,
  endDate,
  typeCode,
  page,
}: {
  startDate?: string
  endDate?: string
  typeCode?: string
  page: number
}) {
  const [{ transactions, totalCount }, transactionTypes] = await Promise.all([
    getDealerTransactions({
      startDate,
      endDate,
      typeCode,
      page,
      pageSize: 20,
    }),
    getTransactionTypes(),
  ])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Islem Gecmisi</CardTitle>
        <div className="mt-4">
          <TransactionFilters
            transactionTypes={transactionTypes.map((t) => ({
              code: t.code,
              name: t.name,
            }))}
          />
        </div>
      </CardHeader>
      <CardContent>
        <TransactionListWrapper transactions={transactions} />
        {totalCount > 20 && (
          <div className="mt-4 text-sm text-muted-foreground text-center">
            Toplam {totalCount} islem ({Math.ceil(totalCount / 20)} sayfa)
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default async function FinancialsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = params.page ? parseInt(params.page) : 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Wallet className="h-8 w-8 text-blue-500" />
              Cari Hesap
            </h1>
            <p className="text-gray-500 mt-1">
              Hesap durumunuzu ve islem gecmisinizi goruntuleyin
            </p>
          </div>
        </div>
      </div>

      {/* Balance Summary */}
      <Suspense fallback={<BalanceSkeleton />}>
        <BalanceSection />
      </Suspense>

      {/* Transactions */}
      <Suspense fallback={<TransactionsSkeleton />}>
        <TransactionsSection
          startDate={params.startDate}
          endDate={params.endDate}
          typeCode={params.type}
          page={page}
        />
      </Suspense>
    </div>
  )
}
