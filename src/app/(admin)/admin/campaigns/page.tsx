import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CampaignTable } from '@/components/admin/campaign-table'
import { getAllCampaigns } from '@/lib/actions/campaigns'

export default async function AdminCampaignsPage() {
  const campaigns = await getAllCampaigns()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Kampanyalar</h1>
        <Link href="/admin/campaigns/new">
          <Button>Yeni Kampanya Ekle</Button>
        </Link>
      </div>

      <CampaignTable campaigns={campaigns} />
    </div>
  )
}
