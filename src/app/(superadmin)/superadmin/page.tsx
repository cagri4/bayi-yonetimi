import Link from 'next/link'

export default function SuperadminPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Superadmin Panel</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-2">Firma Yonetimi</h2>
        <p className="text-gray-600 mb-4">Yeni firma olusturun ve davet linkleri yonetin.</p>
        <Link
          href="/superadmin/companies/new"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Yeni Firma Olustur
        </Link>
      </div>
    </div>
  )
}
