'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toggleDealerActive } from '@/lib/actions/dealers'
import { useToast } from '@/hooks/use-toast'

interface Dealer {
  id: string
  company_name: string
  email: string
  phone: string | null
  is_active: boolean
  dealer_group: { id: string; name: string; discount_percent: number } | null
}

interface DealerGroup {
  id: string
  name: string
}

interface DealerTableProps {
  dealers: Dealer[]
  groups: DealerGroup[]
}

export function DealerTable({ dealers, groups }: DealerTableProps) {
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const { toast } = useToast()

  const filteredDealers = dealers.filter((dealer) => {
    const matchesSearch =
      dealer.company_name.toLowerCase().includes(search.toLowerCase()) ||
      dealer.email.toLowerCase().includes(search.toLowerCase())
    const matchesGroup =
      groupFilter === 'all' || dealer.dealer_group?.id === groupFilter

    return matchesSearch && matchesGroup
  })

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const result = await toggleDealerActive(id, !currentActive)
    if (result.success) {
      toast({ title: result.message })
    } else {
      toast({ title: result.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Input
          placeholder="Firma adi veya email ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Grup" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tum Gruplar</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Firma Adi</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Grup</TableHead>
              <TableHead className="text-center">Iskonto</TableHead>
              <TableHead className="text-center">Durum</TableHead>
              <TableHead className="text-right">Islemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDealers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  Bayi bulunamadi
                </TableCell>
              </TableRow>
            ) : (
              filteredDealers.map((dealer) => (
                <TableRow key={dealer.id}>
                  <TableCell className="font-medium">{dealer.company_name}</TableCell>
                  <TableCell>{dealer.email}</TableCell>
                  <TableCell>{dealer.phone || '-'}</TableCell>
                  <TableCell>
                    {dealer.dealer_group?.name || (
                      <span className="text-gray-400">Atanmamis</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {dealer.dealer_group ? (
                      <Badge variant="outline">%{dealer.dealer_group.discount_percent}</Badge>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant={dealer.is_active ? 'default' : 'secondary'}
                      size="sm"
                      onClick={() => handleToggleActive(dealer.id, dealer.is_active)}
                    >
                      {dealer.is_active ? 'Aktif' : 'Pasif'}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Link href={`/admin/dealers/${dealer.id}/prices`}>
                      <Button variant="outline" size="sm">
                        Fiyatlar
                      </Button>
                    </Link>
                    <Link href={`/admin/dealers/${dealer.id}/edit`}>
                      <Button variant="outline" size="sm">
                        Duzenle
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
