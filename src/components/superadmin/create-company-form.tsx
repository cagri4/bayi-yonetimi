'use client'

import { useActionState } from 'react'
import { createCompany } from '@/lib/actions/superadmin'

export function CreateCompanyForm() {
  const [state, formAction, isPending] = useActionState(createCompany, null)

  if (state?.success && state?.data) {
    return (
      <div className="bg-white rounded-lg shadow p-6 max-w-xl">
        <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
          <p className="text-green-800 font-semibold">Firma basariyla olusturuldu!</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Firma ID</label>
            <code className="block bg-gray-100 rounded px-3 py-2 text-sm font-mono break-all">
              {state.data.companyId}
            </code>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gecici Sifre</label>
            <code className="block bg-gray-100 rounded px-3 py-2 text-sm font-mono">
              {state.data.tempPassword}
            </code>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telegram Davet Linki</label>
            <div className="flex items-center gap-2">
              <a
                href={state.data.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm break-all"
              >
                {state.data.deepLink}
              </a>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-yellow-800 text-sm">
              Bu bilgileri guvenli bir sekilde saklayiniz. Gecici sifre tekrar gosterilemez.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-xl">
      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <p className="text-red-800 text-sm">{state.error}</p>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Firma Adi
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="sektor" className="block text-sm font-medium text-gray-700 mb-1">
            Sektor
          </label>
          <input
            id="sektor"
            name="sektor"
            type="text"
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="admin_email" className="block text-sm font-medium text-gray-700 mb-1">
            Admin Email
          </label>
          <input
            id="admin_email"
            name="admin_email"
            type="email"
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="plan" className="block text-sm font-medium text-gray-700 mb-1">
            Plan
          </label>
          <select
            id="plan"
            name="plan"
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Plan secin</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-blue-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Olusturuluyor...' : 'Firma Olustur'}
        </button>
      </form>
    </div>
  )
}
