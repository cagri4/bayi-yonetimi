import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ArrowLeft, Calendar, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getCampaignDetail } from '@/lib/actions/campaigns'
import { CampaignProductCard } from '@/components/campaigns/campaign-product-card'

interface CampaignDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { id } = await params
  const campaign = await getCampaignDetail(id)

  if (!campaign) {
    notFound()
  }

  const startDate = new Date(campaign.start_date)
  const endDate = new Date(campaign.end_date)
  const now = new Date()

  const isActive = campaign.is_active && startDate <= now && endDate >= now

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/campaigns">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kampanyalara Dön
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {campaign.image_url ? (
            <div className="relative h-96 w-full rounded-lg overflow-hidden">
              <Image
                src={campaign.image_url}
                alt={campaign.title}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="h-96 w-full rounded-lg bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center">
              <span className="text-8xl">📢</span>
            </div>
          )}

          <div>
            <div className="flex items-start justify-between gap-4 mb-4">
              <h1 className="text-3xl font-bold">{campaign.title}</h1>
              <Badge variant={isActive ? 'default' : 'secondary'} className="text-sm">
                {isActive ? 'Aktif' : 'Sona Erdi'}
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground mb-6">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">
                {formatDate(startDate)} - {formatDate(endDate)}
              </span>
            </div>

            {campaign.description && (
              <div className="prose prose-sm max-w-none">
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {campaign.description}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Kampanya Ürünleri
              </CardTitle>
              <CardDescription>
                {campaign.products.length} ürün bu kampanyaya dahil
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      {campaign.products.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Kampanyaya Dahil Ürünler</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaign.products.map((product) => (
              <CampaignProductCard key={product.product_id} product={product} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
