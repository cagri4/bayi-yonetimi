'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Zap, Package, ClipboardList, ShoppingCart, Heart, Wallet, Megaphone, Bell, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/catalog', label: 'Urunler', icon: Package },
  { href: '/favorites', label: 'Favorilerim', icon: Heart },
  { href: '/campaigns', label: 'Kampanyalar', icon: Megaphone },
  { href: '/announcements', label: 'Duyurular', icon: Bell },
  { href: '/financials', label: 'Cari Hesap', icon: Wallet },
  { href: '/quick-order', label: 'Hizli Siparis', icon: Zap },
  { href: '/orders', label: 'Siparislerim', icon: ClipboardList },
  { href: '/cart', label: 'Sepet', icon: ShoppingCart },
]

export function NavLinks() {
  const pathname = usePathname()

  return (
    <div className="hidden sm:ml-8 sm:flex sm:space-x-1">
      {links.map((link) => {
        const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
        const Icon = link.icon

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 gap-2',
              isActive
                ? 'bg-primary/10 text-primary border-b-2 border-primary'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <Icon className="h-4 w-4" />
            {link.label}
          </Link>
        )
      })}
    </div>
  )
}
