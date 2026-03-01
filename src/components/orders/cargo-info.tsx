import { Truck } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { CargoInfo as CargoInfoType } from '@/lib/actions/order-docs'

interface CargoInfoProps {
  cargoInfo: CargoInfoType | null
}

export function CargoInfo({ cargoInfo }: CargoInfoProps) {
  if (!cargoInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Kargo Bilgileri
          </CardTitle>
          <CardDescription>Teslimat ve sofor bilgileri</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Kargo bilgisi henuz girilmemis.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Kargo Bilgileri
        </CardTitle>
        <CardDescription>Teslimat ve sofor bilgileri</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {cargoInfo.vehiclePlate && (
          <div>
            <div className="text-xs text-muted-foreground">Arac Plakasi</div>
            <div className="font-mono font-semibold tracking-wider text-sm mt-0.5">
              {cargoInfo.vehiclePlate}
            </div>
          </div>
        )}

        {cargoInfo.driverName && (
          <div>
            <div className="text-xs text-muted-foreground">Sofor Adi</div>
            <div className="text-sm font-medium mt-0.5">{cargoInfo.driverName}</div>
          </div>
        )}

        {cargoInfo.driverPhone && (
          <div>
            <div className="text-xs text-muted-foreground">Sofor Telefonu</div>
            <a
              href={`tel:${cargoInfo.driverPhone}`}
              className="text-sm font-medium text-primary hover:underline mt-0.5 block"
            >
              {cargoInfo.driverPhone}
            </a>
          </div>
        )}

        {cargoInfo.cargoNotes && (
          <div>
            <div className="text-xs text-muted-foreground">Notlar</div>
            <div className="text-sm mt-0.5 whitespace-pre-wrap text-muted-foreground">
              {cargoInfo.cargoNotes}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
