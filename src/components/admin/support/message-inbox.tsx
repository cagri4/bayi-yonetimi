'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSupportRealtime } from '@/hooks/use-support-realtime'
import { MessageStatusBadge } from '@/components/support/message-status-badge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, Inbox } from 'lucide-react'
import type { SupportMessageWithDealer } from '@/types/database.types'

const CATEGORY_LABELS: Record<string, string> = {
  siparis: 'Siparis',
  urun: 'Urun',
  odeme: 'Odeme',
  teknik: 'Teknik',
  diger: 'Diger',
}

type FilterType = 'all' | 'pending' | 'answered'

interface MessageInboxProps {
  initialMessages: SupportMessageWithDealer[]
}

export function MessageInbox({ initialMessages }: MessageInboxProps) {
  const [filter, setFilter] = useState<FilterType>('all')
  const { newMessageCount } = useSupportRealtime()

  const pendingCount = initialMessages.filter((m) => m.status === 'pending').length + newMessageCount

  const filteredMessages = initialMessages.filter((m) => {
    if (filter === 'pending') return m.status === 'pending'
    if (filter === 'answered') return m.status === 'answered'
    return true
  })

  const filterTabs: { key: FilterType; label: string; count?: number }[] = [
    { key: 'all', label: 'Tumu', count: initialMessages.length },
    { key: 'pending', label: 'Bekliyor', count: pendingCount },
    { key: 'answered', label: 'Cevaplandi' },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Mesajlar
            {pendingCount > 0 && (
              <Badge className="bg-red-100 text-red-800 hover:bg-red-100 ml-1">
                {pendingCount}
              </Badge>
            )}
          </CardTitle>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mt-3">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-gray-100'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1.5 text-xs">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {filteredMessages.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Mesaj bulunmuyor</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredMessages.map((message) => {
              const dateStr = new Date(message.created_at).toLocaleDateString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
              const isPending = message.status === 'pending'

              return (
                <Link
                  key={message.id}
                  href={`/admin/support/${message.id}`}
                  className={`flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors ${
                    isPending ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${isPending ? 'font-bold' : 'font-medium'}`}>
                      {message.subject}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground font-medium">
                        {message.dealers?.company_name ?? 'Bilinmeyen Bayi'}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {CATEGORY_LABELS[message.category] ?? message.category}
                      </span>
                      <span className="text-xs text-muted-foreground">{dateStr}</span>
                    </div>
                  </div>
                  <div className="ml-3 shrink-0">
                    <MessageStatusBadge status={message.status} />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
