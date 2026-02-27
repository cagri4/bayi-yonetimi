import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Wallet, Tag } from 'lucide-react'
import { DealerForm } from '@/components/admin/dealer-form'
import { getDealer, getDealerGroups } from '@/lib/actions/dealers'
import { Button } from '@/components/ui/button'

interface EditDealerPageProps {
  params: Promise<{ id: string }>
}

export default async function EditDealerPage({ params }: EditDealerPageProps) {
  const { id } = await params

  const [dealerResult, groups] = await Promise.all([
    getDealer(id).catch(() => null),
    getDealerGroups(),
  ])

  if (!dealerResult) {
    notFound()
  }

  const dealer = dealerResult

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bayi Duzenle: {dealer.company_name}</h1>
        <div className="flex gap-2">
          <Link href={`/admin/dealers/${id}/prices`}>
            <Button variant="outline">
              <Tag className="h-4 w-4 mr-2" />
              Ozel Fiyatlar
            </Button>
          </Link>
          <Link href={`/admin/dealers/${id}/financials`}>
            <Button variant="outline">
              <Wallet className="h-4 w-4 mr-2" />
              Finansal Islemler
            </Button>
          </Link>
        </div>
      </div>
      <DealerForm groups={groups} dealer={dealer} />
    </div>
  )
}
