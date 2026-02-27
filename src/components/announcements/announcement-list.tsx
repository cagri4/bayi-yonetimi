'use client'

import { useTransition } from 'react'
import { AnnouncementCard } from './announcement-card'
import { Button } from '@/components/ui/button'
import { CheckCheck } from 'lucide-react'
import { markAllAnnouncementsAsRead } from '@/lib/actions/announcements'
import type { AnnouncementWithReadStatus } from '@/lib/actions/announcements'

interface AnnouncementListProps {
  announcements: AnnouncementWithReadStatus[]
}

export function AnnouncementList({ announcements }: AnnouncementListProps) {
  const [isPending, startTransition] = useTransition()
  const unreadCount = announcements.filter(a => !a.is_read).length

  const handleMarkAllAsRead = () => {
    startTransition(async () => {
      try {
        await markAllAnnouncementsAsRead()
      } catch (error) {
        console.error('Error marking all as read:', error)
      }
    })
  }

  if (announcements.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🔔</div>
        <h3 className="text-lg font-semibold mb-2">Duyuru bulunmuyor</h3>
        <p className="text-sm text-muted-foreground">
          Yeni duyurular eklendiğinde burada görünecektir.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={isPending}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Tümünü Okundu İşaretle ({unreadCount})
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {announcements.map((announcement) => (
          <AnnouncementCard key={announcement.id} announcement={announcement} />
        ))}
      </div>
    </div>
  )
}
