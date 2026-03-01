'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

interface CatalogFilterTabsProps {
  activeFilter: string
}

const tabs = [
  { key: 'all', label: 'Tumu' },
  { key: 'new', label: 'Yeni Urunler' },
  { key: 'favorites', label: 'Favorilerim' },
]

export function CatalogFilterTabs({ activeFilter }: CatalogFilterTabsProps) {
  const searchParams = useSearchParams()

  const buildHref = (filterKey: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (filterKey === 'all') {
      params.delete('filter')
    } else {
      params.set('filter', filterKey)
    }
    // Clear category/brand when switching to favorites
    if (filterKey === 'favorites') {
      params.delete('category')
      params.delete('brand')
    }
    const qs = params.toString()
    return `/catalog${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="flex gap-2">
      {tabs.map((tab) => {
        const isActive = activeFilter === tab.key
        return (
          <Link
            key={tab.key}
            href={buildHref(tab.key)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-primary text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
