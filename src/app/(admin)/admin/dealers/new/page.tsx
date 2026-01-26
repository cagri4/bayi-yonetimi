import { DealerForm } from '@/components/admin/dealer-form'
import { getDealerGroups } from '@/lib/actions/dealers'

export default async function NewDealerPage() {
  const groups = await getDealerGroups()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Yeni Bayi Ekle</h1>
      <DealerForm groups={groups} />
    </div>
  )
}
