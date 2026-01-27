import { redirect } from 'next/navigation'
import { getDealerInfo } from '@/lib/actions/catalog'
import { getFrequentProducts } from '@/lib/queries/orders'
import { FrequentProducts } from '@/components/quick-order/frequent-products'
import { QuickOrderForm } from '@/components/quick-order/quick-order-form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Zap, History } from 'lucide-react'

export default async function QuickOrderPage() {
  const dealer = await getDealerInfo()

  if (!dealer) {
    redirect('/login')
  }

  // Load frequent products for this dealer (last 90 days, top 10)
  const frequentProducts = await getFrequentProducts(dealer.id, 10)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="h-6 w-6" />
          Hizli Siparis
        </h1>
        <p className="text-muted-foreground mt-1">
          Urun kodlarini girerek hizli siparis verin veya sik siparis ettiginiz urunlerden secin.
        </p>
      </div>

      {/* Main content - responsive layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Frequent Products - Right Column on Desktop, Top on Mobile */}
        <div className="lg:col-span-1 lg:order-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Sik Siparis Edilen Urunler
              </CardTitle>
              <CardDescription>
                Son 90 gunde en cok siparis ettiginiz urunler
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FrequentProducts products={frequentProducts} />
            </CardContent>
          </Card>
        </div>

        {/* Quick Order Form - Left Column on Desktop (2/3 width), Bottom on Mobile */}
        <div className="lg:col-span-2 lg:order-1">
          <Card>
            <CardHeader>
              <CardTitle>Hizli Siparis Formu</CardTitle>
              <CardDescription>
                Urun kodlarini girin, sistem otomatik olarak urun bilgilerini ve fiyatlarini getirecektir.
                Her satira bir urun kodu girin ve Enter veya alan disina tiklayin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuickOrderForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
