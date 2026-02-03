'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface DateRangeFilterProps {
  startDate: string
  endDate: string
  basePath: string
}

export function DateRangeFilter({ startDate, endDate, basePath }: DateRangeFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [localStart, setLocalStart] = useState(startDate)
  const [localEnd, setLocalEnd] = useState(endDate)

  function handleApply() {
    startTransition(() => {
      const params = new URLSearchParams(searchParams)
      params.set('startDate', localStart)
      params.set('endDate', localEnd)
      router.push(`${basePath}?${params.toString()}`)
    })
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-2">
        <Label htmlFor="startDate">Baslangic Tarihi</Label>
        <Input
          id="startDate"
          type="date"
          value={localStart}
          onChange={(e) => setLocalStart(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="endDate">Bitis Tarihi</Label>
        <Input
          id="endDate"
          type="date"
          value={localEnd}
          onChange={(e) => setLocalEnd(e.target.value)}
        />
      </div>
      <Button onClick={handleApply} disabled={isPending}>
        {isPending ? 'Yukleniyor...' : 'Uygula'}
      </Button>
    </div>
  )
}
