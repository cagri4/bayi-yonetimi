'use client'

import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { Download, FileText, CreditCard, Receipt, AlertCircle } from 'lucide-react'
import type { DealerTransaction } from '@/lib/actions/financials'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(amount)
}

const formatDate = (dateString: string) => {
  return format(new Date(dateString), 'dd MMM yyyy', { locale: tr })
}

const getTransactionIcon = (code: string) => {
  switch (code) {
    case 'invoice':
      return <FileText className="h-4 w-4" />
    case 'payment':
      return <CreditCard className="h-4 w-4" />
    case 'credit_note':
    case 'debit_note':
      return <Receipt className="h-4 w-4" />
    default:
      return <AlertCircle className="h-4 w-4" />
  }
}

interface TransactionListProps {
  transactions: DealerTransaction[]
  onDownloadInvoice?: (transactionId: string) => void
  isDownloading?: string | null
}

export function TransactionList({
  transactions,
  onDownloadInvoice,
  isDownloading,
}: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Henuz islem kaydi bulunmuyor.</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tarih</TableHead>
          <TableHead>Tip</TableHead>
          <TableHead>Aciklama</TableHead>
          <TableHead>Referans</TableHead>
          <TableHead className="text-right">Tutar</TableHead>
          <TableHead className="text-center">Islem</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((tx) => (
          <TableRow key={tx.id}>
            <TableCell className="font-medium">
              {formatDate(tx.transactionDate)}
              {tx.dueDate && (
                <div className="text-xs text-muted-foreground">
                  Vade: {formatDate(tx.dueDate)}
                </div>
              )}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {getTransactionIcon(tx.transactionType.code)}
                <Badge
                  variant={tx.transactionType.balanceEffect === 'debit' ? 'destructive' : 'default'}
                >
                  {tx.transactionType.name}
                </Badge>
              </div>
            </TableCell>
            <TableCell>
              <div>{tx.description}</div>
              {tx.order && (
                <div className="text-xs text-muted-foreground">
                  Siparis: {tx.order.orderNumber}
                </div>
              )}
            </TableCell>
            <TableCell className="font-mono text-sm">
              {tx.referenceNumber || '-'}
            </TableCell>
            <TableCell className={`text-right font-medium ${
              tx.transactionType.balanceEffect === 'debit'
                ? 'text-red-600'
                : 'text-green-600'
            }`}>
              {tx.transactionType.balanceEffect === 'debit' ? '+' : '-'}
              {formatCurrency(tx.amount)}
            </TableCell>
            <TableCell className="text-center">
              {tx.transactionType.code === 'invoice' && onDownloadInvoice && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDownloadInvoice(tx.id)}
                  disabled={isDownloading === tx.id}
                >
                  <Download className={`h-4 w-4 ${isDownloading === tx.id ? 'animate-pulse' : ''}`} />
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
