'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { updateOrderStatus, cancelOrder } from '@/lib/actions/admin-orders'

interface ValidStatus {
  id: string
  code: string
  name: string
}

interface OrderStatusSelectProps {
  orderId: string
  currentStatusId: string
  currentStatusCode: string
  validStatuses: ValidStatus[]
}

export function OrderStatusSelect({
  orderId,
  currentStatusId,
  currentStatusCode,
  validStatuses,
}: OrderStatusSelectProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedStatusId, setSelectedStatusId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)

  const isTerminal = currentStatusCode === 'cancelled' || currentStatusCode === 'delivered'

  const handleStatusChange = (newStatusId: string) => {
    setSelectedStatusId(newStatusId)
    setShowNotes(true)
  }

  const handleSubmit = () => {
    if (!selectedStatusId) return

    startTransition(async () => {
      const result = await updateOrderStatus(orderId, selectedStatusId, notes || undefined)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Siparis durumu guncellendi')
        setSelectedStatusId('')
        setNotes('')
        setShowNotes(false)
        router.refresh()
      }
    })
  }

  if (isTerminal) {
    return (
      <div className="text-sm text-muted-foreground">
        Siparis tamamlanmis veya iptal edilmis. Durum guncellenemez.
      </div>
    )
  }

  if (validStatuses.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Gecerli durum degisikligi bulunmuyor.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="status-select" className="text-sm font-medium mb-1 block">
          Yeni Durum
        </Label>
        <Select value={selectedStatusId} onValueChange={handleStatusChange}>
          <SelectTrigger id="status-select" className="w-[200px]">
            <SelectValue placeholder="Durum secin" />
          </SelectTrigger>
          <SelectContent>
            {validStatuses.map((status) => (
              <SelectItem key={status.id} value={status.id}>
                {status.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showNotes && (
        <div>
          <Label htmlFor="status-notes" className="text-sm font-medium mb-1 block">
            Not (opsiyonel)
          </Label>
          <Textarea
            id="status-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Durum degisikligi ile ilgili not ekleyin..."
            className="max-w-md"
          />
        </div>
      )}

      {selectedStatusId && (
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? 'Guncelleniyor...' : 'Durumu Guncelle'}
        </Button>
      )}
    </div>
  )
}

interface CancelOrderButtonProps {
  orderId: string
  currentStatusCode: string
}

export function CancelOrderButton({ orderId, currentStatusCode }: CancelOrderButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState('')
  const [open, setOpen] = useState(false)

  // Only show cancel button for pending or confirmed orders
  const canCancel = ['pending', 'confirmed'].includes(currentStatusCode)

  if (!canCancel) {
    return null
  }

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelOrder(orderId, reason || undefined)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Siparis iptal edildi')
        setOpen(false)
        setReason('')
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          Siparisi Iptal Et
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Siparisi Iptal Et</DialogTitle>
          <DialogDescription>
            Bu siparisi iptal etmek istediginizden emin misiniz? Bu islem geri alinamaz.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Label htmlFor="cancel-reason" className="text-sm font-medium mb-1 block">
            Iptal Sebebi (opsiyonel)
          </Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Iptal sebebini belirtin..."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Vazgec
          </Button>
          <Button variant="destructive" onClick={handleCancel} disabled={isPending}>
            {isPending ? 'Iptal ediliyor...' : 'Siparisi Iptal Et'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
