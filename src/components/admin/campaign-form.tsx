'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createCampaign, updateCampaign } from '@/lib/actions/campaigns'
import type { Campaign } from '@/lib/actions/campaigns'

interface CampaignFormProps {
  campaign?: Campaign
  productIds?: string[]
  productDiscounts?: Map<string, number>
}

export function CampaignForm({ campaign, productIds = [], productDiscounts = new Map() }: CampaignFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const formData = new FormData(e.currentTarget)

      if (campaign) {
        await updateCampaign(campaign.id, formData)
      } else {
        await createCampaign(formData)
      }
    } catch (error) {
      console.error('Error submitting campaign:', error)
      alert('Kampanya kaydedilirken bir hata oluştu')
      setIsSubmitting(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Kampanya Bilgileri</CardTitle>
          <CardDescription>
            Kampanya detaylarını girin
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Başlık *</Label>
            <Input
              id="title"
              name="title"
              defaultValue={campaign?.title}
              required
              placeholder="Örn: Yaz İndirimi 2024"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Açıklama</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={campaign?.description || ''}
              rows={4}
              placeholder="Kampanya açıklaması..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image_url">Görsel URL</Label>
            <Input
              id="image_url"
              name="image_url"
              type="url"
              defaultValue={campaign?.image_url || ''}
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Başlangıç Tarihi *</Label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                defaultValue={campaign?.start_date.split('T')[0] || today}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">Bitiş Tarihi *</Label>
              <Input
                id="end_date"
                name="end_date"
                type="date"
                defaultValue={campaign?.end_date.split('T')[0]}
                required
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_active"
              name="is_active"
              value="true"
              defaultChecked={campaign?.is_active ?? true}
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              Aktif
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ürün Bağlantıları</CardTitle>
          <CardDescription>
            Bu kampanyaya dahil edilecek ürünleri seçin (İsteğe bağlı)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ürün seçimi şu anda form dışında yapılmaktadır. Kampanyayı kaydettikten sonra düzenleyerek ürün ekleyebilirsiniz.
          </p>
          <input type="hidden" name="product_ids" value={JSON.stringify(productIds)} />
          <input type="hidden" name="product_discounts" value={JSON.stringify(Object.fromEntries(productDiscounts))} />
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Kaydediliyor...' : campaign ? 'Güncelle' : 'Oluştur'}
        </Button>
        <Button type="button" variant="outline" onClick={() => window.history.back()}>
          İptal
        </Button>
      </div>
    </form>
  )
}
