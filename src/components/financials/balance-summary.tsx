'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react'

interface BalanceSummaryProps {
  totalDebit: number
  totalCredit: number
  netBalance: number
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(amount)
}

export function BalanceSummary({
  totalDebit,
  totalCredit,
  netBalance,
}: BalanceSummaryProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Toplam Borc</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(totalDebit)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Faturalar ve borc dekontlari
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Toplam Alacak</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(totalCredit)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Odemeler ve alacak dekontlari
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Net Bakiye</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${
            netBalance > 0 ? 'text-red-600' : netBalance < 0 ? 'text-green-600' : ''
          }`}>
            {formatCurrency(Math.abs(netBalance))}
            {netBalance > 0 && <span className="text-sm ml-2">(Borc)</span>}
            {netBalance < 0 && <span className="text-sm ml-2">(Alacak)</span>}
            {netBalance === 0 && <span className="text-sm ml-2">(Denk)</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Guncel cari hesap durumu
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
