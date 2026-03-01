import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShoppingCart, ClipboardList, Receipt, Heart } from 'lucide-react'

const actions = [
  {
    href: '/catalog',
    label: 'Yeni Siparis',
    icon: ShoppingCart,
    description: 'Katalogdan siparis ver',
    color: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
  },
  {
    href: '/orders',
    label: 'Siparislerim',
    icon: ClipboardList,
    description: 'Siparis gecmisi',
    color: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
  },
  {
    href: '/financials',
    label: 'Faturalar',
    icon: Receipt,
    description: 'Cari hesap',
    color: 'bg-green-50 text-green-600 hover:bg-green-100',
  },
  {
    href: '/favorites',
    label: 'Favorilerim',
    icon: Heart,
    description: 'Favori urunler',
    color: 'bg-pink-50 text-pink-600 hover:bg-pink-100',
  },
] as const

export function QuickActionsWidget() {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Hizli Erisim</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.href}
                href={action.href}
                className={`flex flex-col items-center justify-center p-4 rounded-xl transition-colors text-center gap-2 ${action.color}`}
              >
                <Icon className="h-6 w-6" />
                <div>
                  <div className="text-sm font-semibold leading-tight">{action.label}</div>
                  <div className="text-xs opacity-75 mt-0.5">{action.description}</div>
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
