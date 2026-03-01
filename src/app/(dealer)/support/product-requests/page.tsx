import Link from 'next/link'
import { PackagePlus, MessageSquare, HelpCircle, Package } from 'lucide-react'
import { getDealerProductRequests } from '@/lib/actions/support'
import { ProductRequestForm } from '@/components/support/product-request-form'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  open: { label: 'Acik', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
  in_review: { label: 'Inceleniyor', className: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
  fulfilled: { label: 'Karsilandi', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  rejected: { label: 'Reddedildi', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
}

export default async function ProductRequestsPage() {
  const requests = await getDealerProductRequests()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/support"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            Destek
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <PackagePlus className="h-8 w-8 text-blue-500" />
          Urun Talepleri
        </h1>
        <p className="text-gray-500 mt-1">
          Katalogda bulamadığınız urunleri talep edin
        </p>

        {/* Navigation tabs */}
        <div className="flex gap-3 mt-4">
          <Link
            href="/support"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            <MessageSquare className="h-4 w-4" />
            Mesajlarim
          </Link>
          <Link
            href="/support/faq"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            <HelpCircle className="h-4 w-4" />
            SSS
          </Link>
          <Link
            href="/support/product-requests"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary border-b-2 border-primary"
          >
            <PackagePlus className="h-4 w-4" />
            Urun Talebi
          </Link>
        </div>
      </div>

      {/* Request Form */}
      <ProductRequestForm />

      {/* Existing Requests */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Taleplerim</h2>

          {requests.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Henuz urun talebiniz yok</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => {
                const statusInfo = STATUS_LABELS[req.status] ?? { label: req.status, className: '' }
                const dateStr = new Date(req.created_at).toLocaleDateString('tr-TR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })

                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-sm">{req.product_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {req.product_code && (
                          <span className="text-xs text-muted-foreground">
                            Kod: {req.product_code}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Miktar: {req.requested_quantity}
                        </span>
                        <span className="text-xs text-muted-foreground">{dateStr}</span>
                      </div>
                    </div>
                    <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
