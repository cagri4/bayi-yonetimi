'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { DealerTransaction } from '@/lib/actions/financials'
import { getInvoiceDownloadUrl } from '@/lib/actions/financials'
import { TransactionList } from './transaction-list'

interface TransactionListWrapperProps {
  transactions: DealerTransaction[]
}

export function TransactionListWrapper({ transactions }: TransactionListWrapperProps) {
  const [isDownloading, setIsDownloading] = useState<string | null>(null)

  const handleDownloadInvoice = async (transactionId: string) => {
    setIsDownloading(transactionId)

    try {
      const result = await getInvoiceDownloadUrl(transactionId)

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      // Open the signed URL in a new tab
      window.open(result.url, '_blank')
      toast.success('Fatura indiriliyor...')
    } catch (error) {
      toast.error('Fatura indirilemedi')
    } finally {
      setIsDownloading(null)
    }
  }

  return (
    <TransactionList
      transactions={transactions}
      onDownloadInvoice={handleDownloadInvoice}
      isDownloading={isDownloading}
    />
  )
}
