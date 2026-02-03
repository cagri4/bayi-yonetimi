import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { TopProductRow } from '@/lib/queries/reports'

interface TopProductsTableProps {
  data: TopProductRow[]
}

export function TopProductsTable({ data }: TopProductsTableProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Bu tarih araliginda satis verisi bulunamadi.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[60px]">Sira</TableHead>
          <TableHead>Urun Adi</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead className="text-right">Siparis Sayisi</TableHead>
          <TableHead className="text-right">Satis Adedi</TableHead>
          <TableHead className="text-right">Toplam Ciro</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, index) => (
          <TableRow key={row.product_id}>
            <TableCell className="font-medium">{index + 1}</TableCell>
            <TableCell className="font-medium">{row.product_name}</TableCell>
            <TableCell className="text-muted-foreground">{row.sku}</TableCell>
            <TableCell className="text-right">{row.order_count}</TableCell>
            <TableCell className="text-right">{row.total_quantity}</TableCell>
            <TableCell className="text-right">
              {row.total_revenue.toLocaleString('tr-TR', {
                style: 'currency',
                currency: 'TRY',
              })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
