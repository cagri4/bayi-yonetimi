'use client'

import { useTransition, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { MessageStatusBadge } from '@/components/support/message-status-badge'
import { replyToMessage } from '@/lib/actions/support'
import { Send, MessageSquare, User } from 'lucide-react'
import type { SupportMessageWithDealer } from '@/types/database.types'

const CATEGORY_LABELS: Record<string, string> = {
  siparis: 'Siparis',
  urun: 'Urun',
  odeme: 'Odeme',
  teknik: 'Teknik',
  diger: 'Diger',
}

interface ReplyFormProps {
  messageId: string
}

function ReplyForm({ messageId }: ReplyFormProps) {
  const [isPending, startTransition] = useTransition()
  const [replyBody, setReplyBody] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!replyBody.trim()) return

    startTransition(async () => {
      const result = await replyToMessage(messageId, replyBody)

      if (result.success) {
        toast.success('Yanit gonderildi')
        setReplyBody('')
      } else {
        toast.error(result.error || 'Yanit gonderilemedi')
      }
    })
  }

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <h3 className="text-sm font-semibold mb-3">Yanit Yaz</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="reply-body" className="sr-only">
            Yanit
          </Label>
          <Textarea
            id="reply-body"
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Yanitinizi buraya yazin..."
            rows={5}
            maxLength={5000}
            disabled={isPending}
            required
          />
          <p className="text-xs text-muted-foreground text-right">{replyBody.length}/5000</p>
        </div>

        <Button
          type="submit"
          disabled={isPending || !replyBody.trim()}
        >
          <Send className="h-4 w-4 mr-2" />
          {isPending ? 'Gonderiliyor...' : 'Yanit Gonder'}
        </Button>
      </form>
    </div>
  )
}

interface MessageThreadProps {
  message: SupportMessageWithDealer
}

export function MessageThread({ message }: MessageThreadProps) {
  const dateStr = new Date(message.created_at).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="space-y-4">
      {/* Message header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">{message.subject}</CardTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{message.dealers?.company_name ?? 'Bilinmeyen Bayi'}</span>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {CATEGORY_LABELS[message.category] ?? message.category}
                </span>
                <span className="text-xs text-muted-foreground">{dateStr}</span>
              </div>
            </div>
            <MessageStatusBadge status={message.status} />
          </div>
        </CardHeader>

        <CardContent>
          {/* Original message */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Mesaj
              </span>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm whitespace-pre-wrap">{message.body}</p>
            </div>
          </div>

          {/* Reply (if answered) */}
          {message.status === 'answered' && message.reply_body && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Send className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-medium text-blue-700 uppercase tracking-wide">
                  Yanit
                </span>
                {message.replied_at && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(message.replied_at).toLocaleDateString('tr-TR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
              <div className="border-l-4 border-blue-400 pl-4 bg-blue-50 rounded-r-lg p-4">
                <p className="text-sm whitespace-pre-wrap text-blue-900">{message.reply_body}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reply form (only for pending messages) */}
      {message.status === 'pending' && <ReplyForm messageId={message.id} />}
    </div>
  )
}
