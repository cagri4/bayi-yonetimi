import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Wallet, Plus, FileText } from 'lucide-react'
import {
  getAdminDealerInfo,
  getAdminDealerBalance,
  getAdminDealerTransactions,
  getTransactionTypes,
} from '@/lib/actions/financials'
import { DealerBalanceCard } from '@/components/admin/financial/dealer-balance-card'
import { TransactionForm } from '@/components/admin/financial/transaction-form'
import { InvoiceUpload } from '@/components/admin/financial/invoice-upload'
import { TransactionList } from '@/components/financials/transaction-list'
import { TransactionFilters } from '@/components/financials/transaction-filters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    startDate?: string
    endDate?: string
    type?: string
    page?: string
  }>
}

function BalanceCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
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

async function DealerHeader({ dealerId }: { dealerId: string }) {
  const [dealer, balance] = await Promise.all([
    getAdminDealerInfo(dealerId),
    getAdminDealerBalance(dealerId),
  ])

  if (!dealer) {
    notFound()
  }

  return (
    <DealerBalanceCard
      dealer={dealer}
      balance={balance}
    />
  )
}

async function TransactionsSection({
  dealerId,
  startDate,
  endDate,
  typeCode,
  page,
}: {
  dealerId: string
  startDate?: string
  endDate?: string
  typeCode?: string
  page: number
}) {
  const [{ transactions, totalCount }, transactionTypes] = await Promise.all([
    getAdminDealerTransactions(dealerId, {
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
        <TransactionList transactions={transactions} />
        {totalCount > 20 && (
          <div className="mt-4 text-sm text-muted-foreground text-center">
            Toplam {totalCount} islem ({Math.ceil(totalCount / 20)} sayfa)
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default async function AdminDealerFinancialsPage({
  params,
  searchParams,
}: PageProps) {
  const { id: dealerId } = await params
  const search = await searchParams
  const page = search.page ? parseInt(search.page) : 1

  // Verify dealer exists
  const dealer = await getAdminDealerInfo(dealerId)
  if (!dealer) {
    notFound()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/dealers">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Wallet className="h-7 w-7 text-blue-500" />
                Finansal Islemler
              </h1>
              <p className="text-gray-500 mt-1">
                {dealer.companyName} - Cari hesap yonetimi
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Balance Card */}
      <Suspense fallback={<BalanceCardSkeleton />}>
        <DealerHeader dealerId={dealerId} />
      </Suspense>

      {/* Action Forms */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Yeni Islem Ekle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="transaction">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="transaction">Islem</TabsTrigger>
                <TabsTrigger value="invoice">Fatura</TabsTrigger>
              </TabsList>
              <TabsContent value="transaction" className="mt-4">
                <TransactionForm dealerId={dealerId} />
              </TabsContent>
              <TabsContent value="invoice" className="mt-4">
                <InvoiceUpload dealerId={dealerId} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Quick Stats - placeholder for future */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Ozet Bilgiler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                Bu sayfadan bayinin cari hesabini yonetebilirsiniz:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>Odeme kaydi girebilirsiniz (alacak)</li>
                <li>Borc/alacak dekontu duzenleyebilirsiniz</li>
                <li>Fatura PDF'i yukleyebilirsiniz</li>
                <li>Acilis bakiyesi tanimlayabilirsiniz</li>
              </ul>
              <p className="text-xs pt-2 border-t">
                Tum islemler sistem tarafindan kaydedilir ve izlenebilir.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions History */}
      <Suspense fallback={<TransactionsSkeleton />}>
        <TransactionsSection
          dealerId={dealerId}
          startDate={search.startDate}
          endDate={search.endDate}
          typeCode={search.type}
          page={page}
        />
      </Suspense>
    </div>
  )
}
