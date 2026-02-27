import { notFound } from 'next/navigation'
import { CampaignForm } from '@/components/admin/campaign-form'
import { getCampaignForEdit } from '@/lib/actions/campaigns'

interface EditCampaignPageProps {
  params: Promise<{ id: string }>
}

export default async function EditCampaignPage({ params }: EditCampaignPageProps) {
  const { id } = await params
  const data = await getCampaignForEdit(id)

  if (!data) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Kampanyayı Düzenle</h1>
      <CampaignForm
        campaign={data.campaign}
        productIds={data.productIds}
        productDiscounts={data.productDiscounts}
      />
    </div>
  )
}
