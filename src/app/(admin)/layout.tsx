import Link from 'next/link'
import { redirect } from 'next/navigation'
import { logout, getCurrentUser, getUserRole } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { BarChart3, Megaphone, Bell, ClipboardList, Headphones } from 'lucide-react'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const role = await getUserRole()

  if (role !== 'admin') {
    redirect('/catalog')
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-xl font-bold">Admin Panel</span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/admin"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Dashboard
                </Link>
                <Link
                  href="/admin/products"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Urunler
                </Link>
                <Link
                  href="/admin/dealers"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Bayiler
                </Link>
                <Link
                  href="/admin/orders"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium gap-1"
                >
                  <ClipboardList className="h-4 w-4" />
                  Siparisler
                </Link>
                <Link
                  href="/admin/campaigns"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium gap-1"
                >
                  <Megaphone className="h-4 w-4" />
                  Kampanyalar
                </Link>
                <Link
                  href="/admin/announcements"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium gap-1"
                >
                  <Bell className="h-4 w-4" />
                  Duyurular
                </Link>
                <Link
                  href="/admin/support"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium gap-1"
                >
                  <Headphones className="h-4 w-4" />
                  Destek
                </Link>
                <Link
                  href="/admin/reports"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium gap-1"
                >
                  <BarChart3 className="h-4 w-4" />
                  Raporlar
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <form action={logout}>
                <Button variant="ghost" type="submit">
                  Cikis
                </Button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
