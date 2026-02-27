import { CampaignCard } from './campaign-card'
import type { Campaign } from '@/lib/actions/campaigns'

interface CampaignListProps {
  campaigns: Campaign[]
}

export function CampaignList({ campaigns }: CampaignListProps) {
  if (campaigns.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📢</div>
        <h3 className="text-lg font-semibold mb-2">Aktif kampanya bulunmuyor</h3>
        <p className="text-sm text-muted-foreground">
          Yeni kampanyalar eklendiğinde burada görünecektir.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {campaigns.map((campaign) => (
        <CampaignCard key={campaign.id} campaign={campaign} />
      ))}
    </div>
  )
}
