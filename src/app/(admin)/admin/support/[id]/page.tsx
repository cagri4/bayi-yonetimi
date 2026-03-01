import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getSupportMessageById } from '@/lib/actions/support'
import { MessageThread } from '@/components/admin/support/message-thread'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminSupportMessagePage({ params }: PageProps) {
  const { id } = await params
  const message = await getSupportMessageById(id)

  if (!message) {
    redirect('/admin/support')
  }

  return (
    <div className="space-y-4">
      {/* Back link + page title */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <Link
          href="/admin/support"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Destek Mesajlari
        </Link>
        <h1 className="text-xl font-bold text-gray-800 truncate">{message.subject}</h1>
      </div>

      {/* Message thread with reply form */}
      <MessageThread message={message} />
    </div>
  )
}
