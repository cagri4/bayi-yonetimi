'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function RootError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-red-100 rounded-full">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Bir hata olustu
        </h1>

        {error.message && (
          <p className="text-sm text-gray-500 mb-6 break-words">
            {error.message.slice(0, 200)}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Tekrar Dene
          </button>
          <Link
            href="/"
            className="px-5 py-2 bg-white border border-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Ana Sayfa
          </Link>
        </div>
      </div>
    </div>
  )
}
