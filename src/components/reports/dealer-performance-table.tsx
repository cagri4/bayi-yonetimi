import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { DealerPerformanceRow } from '@/lib/queries/reports'

interface DealerPerformanceTableProps {
  data: DealerPerformanceRow[]
}

function getRankDisplay(rank: number): string {
  if (rank === 1) return '1'
  if (rank === 2) return '2'
  if (rank === 3) return '3'
  return String(rank)
}

function getRankStyle(rank: number): string {
  if (rank === 1) return 'text-yellow-600 font-bold'
  if (rank === 2) return 'text-gray-500 font-bold'
  if (rank === 3) return 'text-amber-700 font-bold'
  return ''
}

export function DealerPerformanceTable({ data }: DealerPerformanceTableProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Bu tarih araliginda bayi verisi bulunamadi.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[60px]">Sira</TableHead>
          <TableHead>Bayi Adi</TableHead>
          <TableHead className="text-right">Siparis Sayisi</TableHead>
          <TableHead className="text-right">Toplam Satis</TableHead>
          <TableHead className="text-right">Ort. Siparis</TableHead>
          <TableHead className="text-right">Pay (%)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.dealer_id}>
            <TableCell className={getRankStyle(row.sales_rank)}>
              {getRankDisplay(row.sales_rank)}
            </TableCell>
            <TableCell className="font-medium">{row.company_name}</TableCell>
            <TableCell className="text-right">{row.order_count}</TableCell>
            <TableCell className="text-right">
              {row.total_sales.toLocaleString('tr-TR', {
                style: 'currency',
                currency: 'TRY',
              })}
            </TableCell>
            <TableCell className="text-right">
              {row.avg_order_value.toLocaleString('tr-TR', {
                style: 'currency',
                currency: 'TRY',
              })}
            </TableCell>
            <TableCell className="text-right">
              %{row.sales_percentage.toFixed(1)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
