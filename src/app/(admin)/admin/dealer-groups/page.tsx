'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { DealerGroupForm } from '@/components/admin/dealer-group-form'
import { getDealerGroups } from '@/lib/actions/dealers'

interface DealerGroup {
  id: string
  name: string
  discount_percent: number
  min_order_amount: number
  is_active: boolean
}

export default function DealerGroupsPage() {
  const [groups, setGroups] = useState<DealerGroup[]>([])
  const [editingGroup, setEditingGroup] = useState<DealerGroup | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const loadGroups = async () => {
    const data = await getDealerGroups()
    setGroups(data)
  }

  useEffect(() => {
    loadGroups()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Bayi Gruplari</h1>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>Yeni Grup Ekle</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Bayi Grubu</DialogTitle>
            </DialogHeader>
            <DealerGroupForm onSuccess={() => {
              setIsCreateOpen(false)
              loadGroups()
            }} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gruplar</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grup Adi</TableHead>
                <TableHead className="text-right">Iskonto %</TableHead>
                <TableHead className="text-right">Min. Siparis</TableHead>
                <TableHead className="text-center">Durum</TableHead>
                <TableHead className="text-right">Islemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell className="text-right">%{group.discount_percent}</TableCell>
                  <TableCell className="text-right">{formatCurrency(group.min_order_amount)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={group.is_active ? 'default' : 'secondary'}>
                      {group.is_active ? 'Aktif' : 'Pasif'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingGroup(group)}
                        >
                          Duzenle
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Grubu Duzenle</DialogTitle>
                        </DialogHeader>
                        <DealerGroupForm
                          group={editingGroup || undefined}
                          onSuccess={() => {
                            setEditingGroup(null)
                            loadGroups()
                          }}
                        />
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
