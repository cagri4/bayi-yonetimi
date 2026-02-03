'use client'

import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

interface SalesChartData {
  period: string
  order_count: number
  total_sales: number
}

interface SalesChartProps {
  data: SalesChartData[]
}

const chartConfig = {
  order_count: {
    label: 'Siparis Sayisi',
    color: 'hsl(var(--chart-1))',
  },
  total_sales: {
    label: 'Toplam Satis (TL)',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig

function formatPeriod(period: string): string {
  try {
    // Handle different period formats
    if (period.match(/^\d{4}-\d{2}$/)) {
      // Monthly format: YYYY-MM
      const date = parseISO(`${period}-01`)
      return format(date, 'MMM yyyy', { locale: tr })
    } else if (period.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Daily/Weekly format: YYYY-MM-DD
      const date = parseISO(period)
      return format(date, 'd MMM', { locale: tr })
    }
    return period
  } catch {
    return period
  }
}

export function SalesChart({ data }: SalesChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        Veri bulunamadi
      </div>
    )
  }

  // Transform data for chart (reverse to show chronological order)
  const chartData = [...data].reverse().map((item) => ({
    period: formatPeriod(item.period),
    order_count: item.order_count,
    total_sales: item.total_sales,
  }))

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <BarChart data={chartData} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="period"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <YAxis
          yAxisId="left"
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) =>
            value >= 1000 ? `${(value / 1000).toFixed(0)}K` : `${value}`
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => value}
              formatter={(value, name) => {
                if (name === 'total_sales') {
                  return [
                    `${Number(value).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}`,
                    'Toplam Satis',
                  ]
                }
                return [`${value}`, 'Siparis Sayisi']
              }}
            />
          }
        />
        <Bar
          yAxisId="left"
          dataKey="order_count"
          fill="var(--color-order_count)"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          yAxisId="right"
          dataKey="total_sales"
          fill="var(--color-total_sales)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  )
}
