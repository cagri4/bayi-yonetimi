'use client'

import { useState, useOptimistic } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Circle } from 'lucide-react'
import { markAnnouncementAsRead } from '@/lib/actions/announcements'
import type { AnnouncementWithReadStatus } from '@/lib/actions/announcements'

interface AnnouncementCardProps {
  announcement: AnnouncementWithReadStatus
}

export function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [optimisticRead, setOptimisticRead] = useOptimistic(
    announcement.is_read,
    (state, newState: boolean) => newState
  )

  const handleClick = async () => {
    setIsExpanded(!isExpanded)

    if (!optimisticRead) {
      // Optimistically mark as read
      setOptimisticRead(true)

      try {
        await markAnnouncementAsRead(announcement.id)
      } catch (error) {
        console.error('Error marking announcement as read:', error)
        // Revert optimistic update on error
        setOptimisticRead(false)
      }
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getPriorityColor = (priority: number) => {
    if (priority >= 3) return 'destructive'
    if (priority >= 2) return 'default'
    return 'secondary'
  }

  const getPriorityLabel = (priority: number) => {
    if (priority >= 3) return 'Acil'
    if (priority >= 2) return 'Önemli'
    return 'Normal'
  }

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        optimisticRead ? 'bg-background' : 'bg-primary/5 border-primary/20'
      }`}
      onClick={handleClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {!optimisticRead && (
              <Circle className="h-2 w-2 fill-primary text-primary mt-2 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <CardTitle className={`text-lg ${optimisticRead ? 'font-semibold' : 'font-bold'}`}>
                {announcement.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {formatDate(announcement.published_at)}
              </p>
            </div>
          </div>
          <Badge variant={getPriorityColor(announcement.priority)} className="shrink-0">
            {getPriorityLabel(announcement.priority)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <p
          className={`text-sm text-muted-foreground whitespace-pre-wrap ${
            isExpanded ? '' : 'line-clamp-3'
          }`}
        >
          {announcement.content}
        </p>
        {announcement.content.length > 150 && (
          <button
            className="text-sm text-primary hover:underline mt-2"
            onClick={(e) => {
              e.stopPropagation()
              handleClick()
            }}
          >
            {isExpanded ? 'Daha az göster' : 'Devamını oku'}
          </button>
        )}
      </CardContent>
    </Card>
  )
}
