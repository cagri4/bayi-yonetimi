import { CampaignList } from '@/components/campaigns/campaign-list'
import { getActiveCampaigns } from '@/lib/actions/campaigns'

export const metadata = {
  title: 'Kampanyalar',
  description: 'Aktif kampanyaları görüntüleyin',
}

export default async function CampaignsPage() {
  const campaigns = await getActiveCampaigns()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Kampanyalar</h1>
          <p className="text-muted-foreground mt-1">
            Aktif kampanyalarımız ve özel fırsatlarımız
          </p>
        </div>
      </div>

      <CampaignList campaigns={campaigns} />
    </div>
  )
}
