import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import type { SpendingComparison } from '@/lib/queries/spending-reports'

interface PeriodComparisonProps {
  comparison: SpendingComparison
}

interface PeriodCardProps {
  title: string
  totalDebit: number
  totalCredit: number
  netBalance: number
  /** Compare against this amount to determine trend direction (lower debit = better) */
  compareDebit?: number
}

function PeriodCard({
  title,
  totalDebit,
  totalCredit,
  netBalance,
  compareDebit,
}: PeriodCardProps) {
  let TrendIcon = Minus
  let trendColor = 'text-muted-foreground'

  if (compareDebit !== undefined && compareDebit !== 0) {
    if (totalDebit < compareDebit) {
      // Less debt than reference period — better
      TrendIcon = TrendingDown
      trendColor = 'text-green-600'
    } else if (totalDebit > compareDebit) {
      TrendIcon = TrendingUp
      trendColor = 'text-red-500'
    }
  } else if (compareDebit === 0 && totalDebit > 0) {
    TrendIcon = TrendingUp
    trendColor = 'text-red-500'
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
          {title}
          <TrendIcon className={`h-4 w-4 ${trendColor}`} />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-2xl font-bold tracking-tight">
          {formatCurrency(totalDebit)}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Toplam Borc</p>
        <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-x-4 text-xs">
          <div>
            <p className="text-muted-foreground">Alacak</p>
            <p className="font-medium text-green-700">{formatCurrency(totalCredit)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Net</p>
            <p className={`font-medium ${netBalance <= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(netBalance))}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function PeriodComparison({ comparison }: PeriodComparisonProps) {
  const { thisMonth, lastMonth, thisYear, lastYear } = comparison

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <PeriodCard
        title="Bu Ay"
        totalDebit={thisMonth.totalDebit}
        totalCredit={thisMonth.totalCredit}
        netBalance={thisMonth.netBalance}
        compareDebit={lastMonth.totalDebit}
      />
      <PeriodCard
        title="Gecen Ay"
        totalDebit={lastMonth.totalDebit}
        totalCredit={lastMonth.totalCredit}
        netBalance={lastMonth.netBalance}
      />
      <PeriodCard
        title="Bu Yil"
        totalDebit={thisYear.totalDebit}
        totalCredit={thisYear.totalCredit}
        netBalance={thisYear.netBalance}
        compareDebit={lastYear.totalDebit}
      />
      <PeriodCard
        title="Gecen Yil"
        totalDebit={lastYear.totalDebit}
        totalCredit={lastYear.totalCredit}
        netBalance={lastYear.netBalance}
      />
    </div>
  )
}
