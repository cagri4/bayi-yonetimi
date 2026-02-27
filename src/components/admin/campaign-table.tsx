'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2 } from 'lucide-react'
import { deleteCampaign } from '@/lib/actions/campaigns'
import { useTransition } from 'react'
import type { Campaign } from '@/lib/actions/campaigns'

interface CampaignTableProps {
  campaigns: Campaign[]
}

export function CampaignTable({ campaigns }: CampaignTableProps) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = (campaignId: string, campaignTitle: string) => {
    if (confirm(`"${campaignTitle}" kampanyasını silmek istediğinize emin misiniz?`)) {
      startTransition(async () => {
        try {
          await deleteCampaign(campaignId)
        } catch (error) {
          console.error('Error deleting campaign:', error)
          alert('Kampanya silinirken bir hata oluştu')
        }
      })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const isActive = (campaign: Campaign) => {
    const now = new Date()
    const start = new Date(campaign.start_date)
    const end = new Date(campaign.end_date)
    return campaign.is_active && start <= now && end >= now
  }

  if (campaigns.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border">
        <p className="text-muted-foreground">Henüz kampanya eklenmemiş.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Başlık</TableHead>
            <TableHead>Başlangıç</TableHead>
            <TableHead>Bitiş</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead className="text-right">İşlemler</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => (
            <TableRow key={campaign.id}>
              <TableCell className="font-medium">{campaign.title}</TableCell>
              <TableCell>{formatDate(campaign.start_date)}</TableCell>
              <TableCell>{formatDate(campaign.end_date)}</TableCell>
              <TableCell>
                <Badge variant={isActive(campaign) ? 'default' : 'secondary'}>
                  {isActive(campaign) ? 'Aktif' : campaign.is_active ? 'Beklemede' : 'Pasif'}
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Link href={`/admin/campaigns/${campaign.id}/edit`}>
                  <Button variant="outline" size="sm">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(campaign.id, campaign.title)}
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
