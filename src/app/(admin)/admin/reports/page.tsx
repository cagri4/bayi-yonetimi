import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, Package, Users } from 'lucide-react'

const reports = [
  {
    href: '/admin/reports/sales',
    title: 'Satis Raporu',
    description: 'Gunluk, haftalik ve aylik satis istatistikleri',
    icon: BarChart3,
  },
  {
    href: '/admin/reports/products',
    title: 'En Cok Satan Urunler',
    description: 'Satis adetine gore siralanan urunler',
    icon: Package,
  },
  {
    href: '/admin/reports/dealers',
    title: 'Bayi Performansi',
    description: 'Satis hacmine gore bayi siralamalari',
    icon: Users,
  },
]

export default function ReportsIndexPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Raporlar</h1>
        <p className="text-muted-foreground">
          Satis ve performans raporlarini goruntuleyip CSV olarak indirin
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Link key={report.href} href={report.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <report.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{report.title}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{report.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
