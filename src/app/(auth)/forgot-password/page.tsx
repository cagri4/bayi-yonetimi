import { ForgotPasswordForm } from './forgot-password-form'

export default function ForgotPasswordPage() {
  return (
    <>
      <div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sifre Sifirlama
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Email adresinize sifre sifirlama linki gonderecegiz
        </p>
      </div>
      <ForgotPasswordForm />
    </>
  )
}
