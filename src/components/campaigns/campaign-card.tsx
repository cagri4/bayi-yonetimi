import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Campaign } from '@/lib/actions/campaigns'

interface CampaignCardProps {
  campaign: Campaign
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const startDate = new Date(campaign.start_date)
  const endDate = new Date(campaign.end_date)
  const now = new Date()

  const isActive = campaign.is_active && startDate <= now && endDate >= now
  const hasExpired = endDate < now

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <Link href={`/campaigns/${campaign.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
        {campaign.image_url ? (
          <div className="relative h-48 w-full">
            <Image
              src={campaign.image_url}
              alt={campaign.title}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="h-48 w-full bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center">
            <span className="text-4xl">📢</span>
          </div>
        )}

        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg line-clamp-2">{campaign.title}</CardTitle>
            <Badge variant={isActive ? 'default' : hasExpired ? 'secondary' : 'outline'}>
              {isActive ? 'Aktif' : hasExpired ? 'Sona Erdi' : 'Yakında'}
            </Badge>
          </div>
          <CardDescription className="text-sm">
            {formatDate(startDate)} - {formatDate(endDate)}
          </CardDescription>
        </CardHeader>

        {campaign.description && (
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {campaign.description}
            </p>
          </CardContent>
        )}
      </Card>
    </Link>
  )
}
