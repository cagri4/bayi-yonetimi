'use client'

// NOTE: xlsx is NOT imported here — it belongs only in the route handler.
// Importing xlsx in a client component would add ~500KB to the client bundle.

import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { MonthlySpending } from '@/lib/queries/spending-reports'

const chartConfig = {
  totalDebit: {
    label: 'Borc (TL)',
    color: 'hsl(var(--chart-1))',
  },
  totalCredit: {
    label: 'Alacak (TL)',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig

interface SpendingTrendChartProps {
  data: MonthlySpending[]
}

export function SpendingTrendChart({ data }: SpendingTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] rounded-lg border border-dashed text-center px-6">
        <p className="text-sm text-muted-foreground">
          Harcama verisi bulunamadi. Finansal islemler tamamlandiktan sonra grafik gosterilecektir.
        </p>
      </div>
    )
  }

  const chartData = data.map((d) => {
    let label = d.month
    try {
      label = format(parseISO(`${d.month.slice(0, 7)}-01`), 'MMM yy', { locale: tr })
    } catch {
      // keep raw value on parse failure
    }
    return {
      month: label,
      totalDebit: d.totalDebit,
      totalCredit: d.totalCredit,
    }
  })

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <BarChart data={chartData} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => {
                const label = name === 'totalDebit' ? 'Borc' : 'Alacak'
                return [
                  `${Number(value).toLocaleString('tr-TR', {
                    style: 'currency',
                    currency: 'TRY',
                  })}`,
                  label,
                ]
              }}
            />
          }
        />
        <Bar
          dataKey="totalDebit"
          fill="var(--color-totalDebit)"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="totalCredit"
          fill="var(--color-totalCredit)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  )
}
