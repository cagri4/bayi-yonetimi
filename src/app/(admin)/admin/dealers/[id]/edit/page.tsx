import { notFound } from 'next/navigation'
import { DealerForm } from '@/components/admin/dealer-form'
import { getDealer, getDealerGroups } from '@/lib/actions/dealers'

interface EditDealerPageProps {
  params: Promise<{ id: string }>
}

export default async function EditDealerPage({ params }: EditDealerPageProps) {
  const { id } = await params

  const [dealer, groups] = await Promise.all([
    getDealer(id).catch(() => null),
    getDealerGroups(),
  ])

  if (!dealer) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bayi Duzenle: {dealer.company_name}</h1>
      <DealerForm groups={groups} dealer={dealer} />
    </div>
  )
}
