import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DealerTable } from '@/components/admin/dealer-table'
import { getDealers, getDealerGroups } from '@/lib/actions/dealers'

export default async function DealersPage() {
  const [dealers, groups] = await Promise.all([
    getDealers(),
    getDealerGroups(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Bayiler</h1>
        <div className="space-x-2">
          <Link href="/admin/dealer-groups">
            <Button variant="outline">Bayi Gruplari</Button>
          </Link>
          <Link href="/admin/dealers/new">
            <Button>Yeni Bayi Ekle</Button>
          </Link>
        </div>
      </div>

      <DealerTable dealers={dealers} groups={groups} />
    </div>
  )
}
