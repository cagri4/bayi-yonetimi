'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/use-debounce'

export function ProductSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialSearch = searchParams.get('search') || ''
  const [search, setSearch] = useState(initialSearch)
  const isFirstRender = useRef(true)

  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    // Skip first render to avoid unnecessary navigation
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    const params = new URLSearchParams(searchParams.toString())

    if (debouncedSearch) {
      params.set('search', debouncedSearch)
    } else {
      params.delete('search')
    }

    router.push(`/catalog?${params.toString()}`)
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Input
      placeholder="Urun adi veya kodu ara..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="max-w-sm"
    />
  )
}
