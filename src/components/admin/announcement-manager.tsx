'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { createAnnouncement, updateAnnouncement, deleteAnnouncement } from '@/lib/actions/announcements'
import type { Announcement } from '@/lib/actions/announcements'

interface AnnouncementManagerProps {
  announcements: Announcement[]
}

export function AnnouncementManager({ announcements }: AnnouncementManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      try {
        if (editingAnnouncement) {
          await updateAnnouncement(editingAnnouncement.id, formData)
        } else {
          await createAnnouncement(formData)
        }
        setIsDialogOpen(false)
        setEditingAnnouncement(null)
      } catch (error) {
        console.error('Error saving announcement:', error)
        alert('Duyuru kaydedilirken bir hata oluştu')
      }
    })
  }

  const handleDelete = (announcementId: string, title: string) => {
    if (confirm(`"${title}" duyurusunu silmek istediğinize emin misiniz?`)) {
      startTransition(async () => {
        try {
          await deleteAnnouncement(announcementId)
        } catch (error) {
          console.error('Error deleting announcement:', error)
          alert('Duyuru silinirken bir hata oluştu')
        }
      })
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const openCreateDialog = () => {
    setEditingAnnouncement(null)
    setIsDialogOpen(true)
  }

  const openEditDialog = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setIsDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Duyuru Yönetimi</CardTitle>
              <CardDescription>
                Bayilere gösterilecek duyuruları yönetin
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Duyuru
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingAnnouncement ? 'Duyuruyu Düzenle' : 'Yeni Duyuru Oluştur'}
                  </DialogTitle>
                  <DialogDescription>
                    Duyuru detaylarını girin
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Başlık *</Label>
                    <Input
                      id="title"
                      name="title"
                      defaultValue={editingAnnouncement?.title}
                      required
                      placeholder="Duyuru başlığı"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content">İçerik *</Label>
                    <Textarea
                      id="content"
                      name="content"
                      defaultValue={editingAnnouncement?.content}
                      required
                      rows={6}
                      placeholder="Duyuru içeriği..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="priority">Öncelik</Label>
                      <Input
                        id="priority"
                        name="priority"
                        type="number"
                        min="0"
                        max="5"
                        defaultValue={editingAnnouncement?.priority ?? 1}
                        placeholder="0-5"
                      />
                      <p className="text-xs text-muted-foreground">
                        3+ Acil, 2 Önemli, 1 Normal
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="is_active">Durum</Label>
                      <select
                        id="is_active"
                        name="is_active"
                        defaultValue={editingAnnouncement?.is_active ? 'true' : 'false'}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                      >
                        <option value="true">Aktif</option>
                        <option value="false">Pasif</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="published_at">Yayın Tarihi</Label>
                      <Input
                        id="published_at"
                        name="published_at"
                        type="datetime-local"
                        defaultValue={
                          editingAnnouncement?.published_at
                            ? new Date(editingAnnouncement.published_at).toISOString().slice(0, 16)
                            : new Date().toISOString().slice(0, 16)
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expires_at">Son Geçerlilik</Label>
                      <Input
                        id="expires_at"
                        name="expires_at"
                        type="datetime-local"
                        defaultValue={
                          editingAnnouncement?.expires_at
                            ? new Date(editingAnnouncement.expires_at).toISOString().slice(0, 16)
                            : ''
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Boş bırakılırsa süresiz
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      disabled={isPending}
                    >
                      İptal
                    </Button>
                    <Button type="submit" disabled={isPending}>
                      {isPending ? 'Kaydediliyor...' : editingAnnouncement ? 'Güncelle' : 'Oluştur'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Henüz duyuru eklenmemiş.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Başlık</TableHead>
                  <TableHead>Öncelik</TableHead>
                  <TableHead>Yayın Tarihi</TableHead>
                  <TableHead>Bitiş</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {announcements.map((announcement) => (
                  <TableRow key={announcement.id}>
                    <TableCell className="font-medium max-w-xs truncate">
                      {announcement.title}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          announcement.priority >= 3
                            ? 'destructive'
                            : announcement.priority >= 2
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {announcement.priority >= 3
                          ? 'Acil'
                          : announcement.priority >= 2
                          ? 'Önemli'
                          : 'Normal'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(announcement.published_at)}</TableCell>
                    <TableCell>{formatDate(announcement.expires_at)}</TableCell>
                    <TableCell>
                      <Badge variant={announcement.is_active ? 'default' : 'secondary'}>
                        {announcement.is_active ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(announcement)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(announcement.id, announcement.title)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
