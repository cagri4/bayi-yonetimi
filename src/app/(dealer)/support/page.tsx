import { Suspense } from 'react'
import Link from 'next/link'
import { Headphones, MessageSquare, HelpCircle, PackagePlus } from 'lucide-react'
import { getSupportMessages } from '@/lib/actions/support'
import { MessageComposeForm } from '@/components/support/message-compose-form'
import { MessageList } from '@/components/support/message-list'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

function MessagesSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  )
}

async function MessagesSection() {
  const messages = await getSupportMessages()
  return <MessageList messages={messages} />
}

export default async function SupportPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Headphones className="h-8 w-8 text-blue-500" />
              Destek
            </h1>
            <p className="text-gray-500 mt-1">
              Sorulariniz icin mesaj gonderin, SSS&apos;yi inceleyin veya urun talebi olusturun
            </p>
          </div>
        </div>

        {/* Navigation tabs */}
        <div className="flex gap-3 mt-4">
          <Link
            href="/support"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary border-b-2 border-primary"
          >
            <MessageSquare className="h-4 w-4" />
            Mesajlarim
          </Link>
          <Link
            href="/support/faq"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
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

      {/* Compose Form */}
      <MessageComposeForm />

      {/* Message History */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Mesaj Gecmisi</h2>
          <Suspense fallback={<MessagesSkeleton />}>
            <MessagesSection />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
