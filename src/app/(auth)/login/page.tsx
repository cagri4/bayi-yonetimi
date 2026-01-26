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
    </>
  )
}
