import Link from 'next/link'
import { redirect } from 'next/navigation'
import { logout, getCurrentUser, getUserRole } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { getDealerInfo } from '@/lib/actions/catalog'
import { CartIndicator } from '@/components/cart/cart-indicator'

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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-xl font-bold">Bayi Portal</span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/catalog"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Urunler
                </Link>
                <Link
                  href="/cart"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Sepet
                </Link>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-sm text-right">
                <p className="font-medium">{dealer.company_name}</p>
                {dealer.dealer_group && (
                  <p className="text-gray-500">
                    {dealer.dealer_group.name} - %{dealer.dealer_group.discount_percent} iskonto
                  </p>
                )}
              </div>

              <CartIndicator />

              <form action={logout}>
                <Button variant="ghost" type="submit">
                  Cikis
                </Button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
