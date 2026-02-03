import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { SalesReportRow } from '@/lib/queries/reports'

interface SalesReportTableProps {
  data: SalesReportRow[]
}

export function SalesReportTable({ data }: SalesReportTableProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Bu tarih araliginda satis verisi bulunamadi.
      </div>
    )
  }

  // Calculate totals
  const totals = data.reduce(
    (acc, row) => ({
      order_count: acc.order_count + row.order_count,
      total_sales: acc.total_sales + row.total_sales,
    }),
    { order_count: 0, total_sales: 0 }
  )

  const avgOrderValue = totals.order_count > 0
    ? totals.total_sales / totals.order_count
    : 0

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Donem</TableHead>
          <TableHead className="text-right">Siparis Sayisi</TableHead>
          <TableHead className="text-right">Toplam Satis</TableHead>
          <TableHead className="text-right">Ortalama Siparis</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.period}>
            <TableCell className="font-medium">{row.period}</TableCell>
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
          </TableRow>
        ))}
        <TableRow className="bg-muted/50 font-bold">
          <TableCell>Toplam</TableCell>
          <TableCell className="text-right">{totals.order_count}</TableCell>
          <TableCell className="text-right">
            {totals.total_sales.toLocaleString('tr-TR', {
              style: 'currency',
              currency: 'TRY',
            })}
          </TableCell>
          <TableCell className="text-right">
            {avgOrderValue.toLocaleString('tr-TR', {
              style: 'currency',
              currency: 'TRY',
            })}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}
