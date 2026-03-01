'use client'

import { useState } from 'react'
import { Truck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { updateCargoInfo, type CargoInfo } from '@/lib/actions/order-docs'

interface CargoFormProps {
  orderId: string
  initialCargoInfo: CargoInfo | null
}

export function CargoForm({ orderId, initialCargoInfo }: CargoFormProps) {
  const [vehiclePlate, setVehiclePlate] = useState(initialCargoInfo?.vehiclePlate || '')
  const [driverName, setDriverName] = useState(initialCargoInfo?.driverName || '')
  const [driverPhone, setDriverPhone] = useState(initialCargoInfo?.driverPhone || '')
  const [cargoNotes, setCargoNotes] = useState(initialCargoInfo?.cargoNotes || '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    setSuccess(false)

    const result = await updateCargoInfo(orderId, {
      vehiclePlate: vehiclePlate.trim() || undefined,
      driverName: driverName.trim() || undefined,
      driverPhone: driverPhone.trim() || undefined,
      cargoNotes: cargoNotes.trim() || undefined,
    })

    if (!result.success) {
      setError(result.error || 'Kargo bilgisi guncellenemedi')
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }

    setIsSaving(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Kargo Bilgileri
        </CardTitle>
        <CardDescription>
          Arac plakasi ve sofor bilgilerini girin
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-plate">Arac Plakasi</Label>
              <Input
                id="vehicle-plate"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                placeholder="34 ABC 123"
                className="font-mono uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="driver-phone">Sofor Telefonu</Label>
              <Input
                id="driver-phone"
                type="tel"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                placeholder="0532 000 00 00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="driver-name">Sofor Adi</Label>
            <Input
              id="driver-name"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="Ad Soyad"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cargo-notes">Kargo Notu</Label>
            <Textarea
              id="cargo-notes"
              value={cargoNotes}
              onChange={(e) => setCargoNotes(e.target.value)}
              placeholder="Teslimat notu, adres aciklamasi..."
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-600">Kargo bilgisi guncellendi.</p>
          )}

          <Button type="submit" size="sm" disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Truck className="h-4 w-4" />
            )}
            {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
