import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
        <h1 className="text-6xl font-bold text-gray-200 mb-4">404</h1>

        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Sayfa bulunamadi
        </h2>

        <p className="text-sm text-gray-500 mb-6">
          Aradiginiz sayfa mevcut degil veya tasindi.
        </p>

        <Link
          href="/"
          className="inline-block px-5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Ana sayfaya don
        </Link>
      </div>
    </div>
  )
}
