import { Building2, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

interface DealerBalanceCardProps {
  dealer: {
    id: string
    companyName: string
    email: string
  }
  balance: {
    totalDebit: number
    totalCredit: number
    netBalance: number
  }
}

export function DealerBalanceCard({ dealer, balance }: DealerBalanceCardProps) {
  const isDebt = balance.netBalance > 0
  const isCredit = balance.netBalance < 0
  const isZero = balance.netBalance === 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <Building2 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-lg">{dealer.companyName}</CardTitle>
            <p className="text-sm text-muted-foreground">{dealer.email}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mt-4">
          {/* Toplam Borc */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-red-500" />
              <span className="text-xs">Toplam Borc</span>
            </div>
            <p className="text-lg font-semibold text-red-600">
              {formatCurrency(balance.totalDebit)}
            </p>
          </div>

          {/* Toplam Alacak */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingDown className="h-4 w-4 text-green-500" />
              <span className="text-xs">Toplam Alacak</span>
            </div>
            <p className="text-lg font-semibold text-green-600">
              {formatCurrency(balance.totalCredit)}
            </p>
          </div>

          {/* Net Bakiye */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Wallet className="h-4 w-4" />
              <span className="text-xs">Net Bakiye</span>
            </div>
            <p
              className={`text-lg font-bold ${
                isDebt
                  ? 'text-red-600'
                  : isCredit
                  ? 'text-green-600'
                  : 'text-gray-600'
              }`}
            >
              {isDebt && '+'}
              {formatCurrency(Math.abs(balance.netBalance))}
            </p>
            <p className="text-xs text-muted-foreground">
              {isDebt && 'Borclu'}
              {isCredit && 'Alacakli'}
              {isZero && 'Dengede'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
