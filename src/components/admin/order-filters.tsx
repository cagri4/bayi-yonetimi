'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface OrderStatus {
  id: string
  code: string
  name: string
}

interface Dealer {
  id: string
  company_name: string
}

interface OrderFiltersProps {
  statuses: OrderStatus[]
  dealers: Dealer[]
}

export function OrderFilters({ statuses, dealers }: OrderFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initialize state from URL params
  const [status, setStatus] = useState(searchParams.get('status') || 'all')
  const [dealerId, setDealerId] = useState(searchParams.get('dealer') || 'all')
  const [from, setFrom] = useState(searchParams.get('from') || '')
  const [to, setTo] = useState(searchParams.get('to') || '')

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams()

    if (status && status !== 'all') {
      params.set('status', status)
    }
    if (dealerId && dealerId !== 'all') {
      params.set('dealer', dealerId)
    }
    if (from) {
      params.set('from', from)
    }
    if (to) {
      params.set('to', to)
    }

    // Reset to page 1 when filters change
    params.delete('page')

    const queryString = params.toString()
    router.push(`/admin/orders${queryString ? `?${queryString}` : ''}`)
  }, [status, dealerId, from, to, router])

  const clearFilters = useCallback(() => {
    setStatus('all')
    setDealerId('all')
    setFrom('')
    setTo('')
    router.push('/admin/orders')
  }, [router])

  const hasFilters = status !== 'all' || dealerId !== 'all' || from || to

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        {/* Status filter */}
        <div className="w-[180px]">
          <Label htmlFor="status-filter" className="text-sm font-medium mb-1 block">
            Durum
          </Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="status-filter">
              <SelectValue placeholder="Durum secin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tum Durumlar</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dealer filter */}
        <div className="w-[200px]">
          <Label htmlFor="dealer-filter" className="text-sm font-medium mb-1 block">
            Bayi
          </Label>
          <Select value={dealerId} onValueChange={setDealerId}>
            <SelectTrigger id="dealer-filter">
              <SelectValue placeholder="Bayi secin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tum Bayiler</SelectItem>
              {dealers.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date from filter */}
        <div className="w-[160px]">
          <Label htmlFor="from-filter" className="text-sm font-medium mb-1 block">
            Tarihten
          </Label>
          <Input
            id="from-filter"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>

        {/* Date to filter */}
        <div className="w-[160px]">
          <Label htmlFor="to-filter" className="text-sm font-medium mb-1 block">
            Tarihe
          </Label>
          <Input
            id="to-filter"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      {/* Filter action buttons */}
      <div className="flex gap-2">
        <Button onClick={applyFilters}>
          Filtrele
        </Button>
        {hasFilters && (
          <Button variant="outline" onClick={clearFilters}>
            Temizle
          </Button>
        )}
      </div>
    </div>
  )
}
