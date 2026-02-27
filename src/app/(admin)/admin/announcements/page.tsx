import { AnnouncementManager } from '@/components/admin/announcement-manager'
import { getAllAnnouncements } from '@/lib/actions/announcements'

export default async function AdminAnnouncementsPage() {
  const announcements = await getAllAnnouncements()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Duyurular</h1>
      </div>

      <AnnouncementManager announcements={announcements} />
    </div>
  )
}
