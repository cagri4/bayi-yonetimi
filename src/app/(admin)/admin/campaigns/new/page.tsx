import { CampaignForm } from '@/components/admin/campaign-form'

export default async function NewCampaignPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Yeni Kampanya Ekle</h1>
      <CampaignForm />
    </div>
  )
}
