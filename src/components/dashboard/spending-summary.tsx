'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { SpendingSummary } from '@/lib/queries/dashboard'

interface SpendingSummaryProps {
  currentMonth: SpendingSummary['currentMonth']
  previousMonth: SpendingSummary['previousMonth']
  ytd: SpendingSummary['yearToDate']
}

export function SpendingSummaryWidget({ currentMonth, previousMonth, ytd }: SpendingSummaryProps) {
  const currentBalance = currentMonth.netBalance
  const prevBalance = previousMonth.netBalance

  const isCurrentDebt = currentBalance > 0
  const isPrevDebt = prevBalance > 0

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {/* Bu Ay */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Bu Ay</CardTitle>
          {isCurrentDebt ? (
            <TrendingDown className="h-4 w-4 text-red-500" />
          ) : (
            <TrendingUp className="h-4 w-4 text-green-500" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${isCurrentDebt ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(Math.abs(currentBalance))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isCurrentDebt ? 'Borc' : currentBalance < 0 ? 'Alacak' : 'Denk'}
          </p>
          <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
            <div>Borc: {formatCurrency(currentMonth.totalDebit)}</div>
            <div>Alacak: {formatCurrency(currentMonth.totalCredit)}</div>
          </div>
        </CardContent>
      </Card>

      {/* Gecen Ay */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Gecen Ay</CardTitle>
          {isPrevDebt ? (
            <TrendingDown className="h-4 w-4 text-red-500" />
          ) : (
            <TrendingUp className="h-4 w-4 text-green-500" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${isPrevDebt ? 'text-red-600' : prevBalance < 0 ? 'text-green-600' : 'text-gray-600'}`}>
            {formatCurrency(Math.abs(prevBalance))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isPrevDebt ? 'Borc' : prevBalance < 0 ? 'Alacak' : 'Denk'}
          </p>
          <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
            <div>Borc: {formatCurrency(previousMonth.totalDebit)}</div>
            <div>Alacak: {formatCurrency(previousMonth.totalCredit)}</div>
          </div>
        </CardContent>
      </Card>

      {/* Bu Yil */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Bu Yil (YTD)</CardTitle>
          <Calendar className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${ytd.netBalance > 0 ? 'text-red-600' : ytd.netBalance < 0 ? 'text-green-600' : 'text-gray-600'}`}>
            {formatCurrency(Math.abs(ytd.netBalance))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {ytd.netBalance > 0 ? 'Net Borc' : ytd.netBalance < 0 ? 'Net Alacak' : 'Denk'}
          </p>
          <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
            <div>Toplam Borc: {formatCurrency(ytd.totalDebit)}</div>
            <div>Toplam Alacak: {formatCurrency(ytd.totalCredit)}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
