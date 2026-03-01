import Link from 'next/link'
import { ArrowLeft, HelpCircle } from 'lucide-react'
import { getFaqWithCategories } from '@/lib/actions/support'
import { FaqManager } from '@/components/admin/support/faq-manager'

export default async function AdminFaqPage() {
  const categories = await getFaqWithCategories()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <Link
          href="/admin/support"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Destek Mesajlari
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <HelpCircle className="h-6 w-6 text-blue-500" />
          SSS Yonetimi
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Kategorileri ve sikca sorulan sorulari yonetin
        </p>
      </div>

      {/* FAQ Manager */}
      <FaqManager categories={categories} />
    </div>
  )
}
