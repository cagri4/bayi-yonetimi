import Link from 'next/link'
import { HelpCircle, ArrowLeft, MessageSquare, PackagePlus } from 'lucide-react'
import { getFaqWithCategories } from '@/lib/actions/support'
import { FaqCategoryList } from '@/components/support/faq-category-list'

export default async function FaqPage() {
  const categories = await getFaqWithCategories()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/support"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Destek
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <HelpCircle className="h-8 w-8 text-blue-500" />
          Sik Sorulan Sorular
        </h1>
        <p className="text-gray-500 mt-1">
          En sik sorulan sorularin cevaplarini burada bulabilirsiniz
        </p>

        {/* Navigation tabs */}
        <div className="flex gap-3 mt-4">
          <Link
            href="/support"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            <MessageSquare className="h-4 w-4" />
            Mesajlarim
          </Link>
          <Link
            href="/support/faq"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary border-b-2 border-primary"
          >
            <HelpCircle className="h-4 w-4" />
            SSS
          </Link>
          <Link
            href="/support/product-requests"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            <PackagePlus className="h-4 w-4" />
            Urun Talebi
          </Link>
        </div>
      </div>

      <FaqCategoryList categories={categories} />
    </div>
  )
}
