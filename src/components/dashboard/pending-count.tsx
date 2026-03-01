import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package } from 'lucide-react'

interface PendingCountProps {
  count: number
}

export function PendingCountWidget({ count }: PendingCountProps) {
  const label = count === 1 ? 'Bekleyen Siparis' : 'Bekleyen Siparis'

  return (
    <Link href="/orders?status=pending" className="block h-full">
      <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
          <div className="p-2 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
            <Package className="h-4 w-4 text-orange-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2">
            <div
              className={`text-4xl font-bold tabular-nums ${
                count > 0 ? 'text-orange-600' : 'text-gray-400'
              }`}
            >
              {count}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {count > 0
              ? 'Isleme alinmayan siparisler mevcut'
              : 'Tum siparisler isleme alindi'}
          </p>
          <p className="text-xs text-primary mt-1 group-hover:underline">
            Goruntule &rarr;
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
