'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PeriodSelectorProps {
  currentPeriod: string
  basePath: string
}

export function PeriodSelector({ currentPeriod, basePath }: PeriodSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function handleChange(value: string) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams)
      params.set('period', value)
      router.push(`${basePath}?${params.toString()}`)
    })
  }

  return (
    <Select value={currentPeriod} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Donem Sec" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="daily">Gunluk</SelectItem>
        <SelectItem value="weekly">Haftalik</SelectItem>
        <SelectItem value="monthly">Aylik</SelectItem>
      </SelectContent>
    </Select>
  )
}
