'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface TransactionType {
  code: string
  name: string
}

interface TransactionFiltersProps {
  transactionTypes: TransactionType[]
}

export function TransactionFilters({ transactionTypes }: TransactionFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentStartDate = searchParams.get('startDate') || ''
  const currentEndDate = searchParams.get('endDate') || ''
  const currentType = searchParams.get('type') || 'all'

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (value === '' || value === 'all') {
      params.delete(key)
    } else {
      params.set(key, value)
    }

    // Reset to page 1 when filters change
    params.delete('page')

    router.push(`/financials?${params.toString()}`)
  }

  const clearFilters = () => {
    router.push('/financials')
  }

  const hasFilters = currentStartDate || currentEndDate || currentType !== 'all'

  return (
    <div className="flex flex-wrap gap-4 items-end">
      <div className="space-y-1">
        <Label htmlFor="startDate" className="text-xs text-muted-foreground">
          Baslangic Tarihi
        </Label>
        <Input
          id="startDate"
          type="date"
          value={currentStartDate}
          onChange={(e) => updateFilter('startDate', e.target.value)}
          className="w-[160px]"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="endDate" className="text-xs text-muted-foreground">
          Bitis Tarihi
        </Label>
        <Input
          id="endDate"
          type="date"
          value={currentEndDate}
          onChange={(e) => updateFilter('endDate', e.target.value)}
          className="w-[160px]"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          Islem Tipi
        </Label>
        <Select
          value={currentType}
          onValueChange={(value) => updateFilter('type', value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Islem Tipi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tum Islemler</SelectItem>
            {transactionTypes.map((type) => (
              <SelectItem key={type.code} value={type.code}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="text-muted-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Temizle
        </Button>
      )}
    </div>
  )
}
