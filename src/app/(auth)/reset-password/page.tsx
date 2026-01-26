import { ResetPasswordForm } from './reset-password-form'

export default function ResetPasswordPage() {
  return (
    <>
      <div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Yeni Sifre Belirle
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Yeni sifrenizi girin
        </p>
      </div>
      <ResetPasswordForm />
    </>
  )
}
