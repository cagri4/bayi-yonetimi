import { redirect } from 'next/navigation'
import { getCurrentUser, getUserRole } from '@/lib/actions/auth'
import { LoginForm } from './login-form'

export default async function LoginPage() {
  const user = await getCurrentUser()

  if (user) {
    // Get user role and redirect appropriately
    const role = await getUserRole()

    if (role === 'admin') {
      redirect('/admin')
    } else {
      redirect('/catalog')
    }
  }

  return (
    <>
      <div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Bayi Giris
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          B2B Siparis Sistemi
        </p>
      </div>
      <LoginForm />

      {/* Demo Giriş Bilgileri */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs text-gray-500 font-medium mb-2">Demo Giris Bilgileri:</p>
        <div className="space-y-1 text-xs text-gray-600">
          <p><span className="font-medium">Bayi:</span> bayi@test.com / bayi1234</p>
          <p><span className="font-medium">Admin:</span> admin@test.com / admin123</p>
        </div>
      </div>
    </>
  )
}
