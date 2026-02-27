import { AnnouncementList } from '@/components/announcements/announcement-list'
import { getAnnouncements, getUnreadAnnouncementCount } from '@/lib/actions/announcements'
import { Badge } from '@/components/ui/badge'
import { Bell } from 'lucide-react'

export const metadata = {
  title: 'Duyurular',
  description: 'Önemli duyuruları görüntüleyin',
}

export default async function AnnouncementsPage() {
  const [announcements, unreadCount] = await Promise.all([
    getAnnouncements(),
    getUnreadAnnouncementCount(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Bell className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Duyurular</h1>
            <p className="text-muted-foreground mt-1">
              Önemli duyurular ve güncellemeler
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="text-base px-3 py-1">
            {unreadCount} Okunmamış
          </Badge>
        )}
      </div>

      <AnnouncementList announcements={announcements} />
    </div>
  )
}
