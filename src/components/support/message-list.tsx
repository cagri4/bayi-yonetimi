'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { MessageStatusBadge } from './message-status-badge'
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'
import type { SupportMessage } from '@/lib/actions/support'

const CATEGORY_LABELS: Record<string, string> = {
  siparis: 'Siparis',
  urun: 'Urun',
  odeme: 'Odeme',
  teknik: 'Teknik',
  diger: 'Diger',
}

interface MessageListProps {
  messages: SupportMessage[]
}

function MessageRow({ message }: { message: SupportMessage }) {
  const [expanded, setExpanded] = useState(false)
  const dateStr = new Date(message.created_at).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full text-left"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{message.subject}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {CATEGORY_LABELS[message.category] ?? message.category}
                  </span>
                  <span className="text-xs text-muted-foreground">{dateStr}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <MessageStatusBadge status={message.status} />
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardContent>
      </button>

      {expanded && (
        <div className="border-t bg-gray-50">
          <div className="p-4 space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Mesajiniz
              </p>
              <p className="text-sm whitespace-pre-wrap">{message.body}</p>
            </div>

            {message.status === 'answered' && message.reply_body && (
              <div className="border-l-4 border-blue-400 pl-3 bg-blue-50 rounded-r p-3">
                <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-1">
                  Yanit
                </p>
                <p className="text-sm whitespace-pre-wrap text-blue-900">{message.reply_body}</p>
                {message.replied_at && (
                  <p className="text-xs text-blue-600 mt-1">
                    {new Date(message.replied_at).toLocaleDateString('tr-TR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Henuz mesajiniz bulunmuyor</h3>
        <p className="text-sm text-muted-foreground">
          Yukaridaki formu kullanarak mesaj gonderebilirsiniz.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <MessageRow key={message.id} message={message} />
      ))}
    </div>
  )
}
