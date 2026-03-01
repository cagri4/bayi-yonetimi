import Link from 'next/link'
import { MessageSquare, Settings } from 'lucide-react'
import { getAllSupportMessages } from '@/lib/actions/support'
import { MessageInbox } from '@/components/admin/support/message-inbox'
import { Button } from '@/components/ui/button'

export default async function AdminSupportPage() {
  const messages = await getAllSupportMessages()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-blue-500" />
              Destek Mesajlari
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Bayi destek taleplerini goruntulen ve yanitlayin
            </p>
          </div>
          <Link href="/admin/support/faq">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              SSS Yonetimi
            </Button>
          </Link>
        </div>
      </div>

      {/* Inbox with realtime */}
      <MessageInbox initialMessages={messages} />
    </div>
  )
}
