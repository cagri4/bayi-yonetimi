import Link from 'next/link'
import { redirect } from 'next/navigation'
import { logout, getCurrentUser, getUserRole } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { getDealerInfo } from '@/lib/actions/catalog'
import { CartIndicator } from '@/components/cart/cart-indicator'
import { NavLinks } from '@/components/layout/nav-links'
import { Store, LogOut } from 'lucide-react'

export default async function DealerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const dealer = await getDealerInfo()

  if (!dealer) {
    // User exists but no dealer record - might be admin
    const role = await getUserRole()

    if (role === 'admin') {
      redirect('/admin')
    }

    // No dealer record found - show error
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Bayi kaydınız bulunamadı. Lütfen yönetici ile iletişime geçin.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/catalog" className="flex items-center gap-2 group">
                <div className="p-2 bg-primary rounded-lg group-hover:bg-primary/90 transition-colors">
                  <Store className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-800">Bayi Portal</span>
              </Link>

              <NavLinks />
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-sm text-right hidden sm:block">
                <p className="font-semibold text-gray-800">{dealer.company_name}</p>
                {dealer.dealer_group && (
                  <p className="text-primary font-medium">
                    {dealer.dealer_group.name} - %{dealer.dealer_group.discount_percent} iskonto
                  </p>
                )}
              </div>

              <CartIndicator />

              <form action={logout}>
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-red-600 hover:bg-red-50">
                  <LogOut className="h-4 w-4 mr-2" />
                  Cikis
                </Button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
