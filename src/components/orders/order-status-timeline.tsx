import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import { CheckCircle2, Circle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OrderStatusHistory {
  id: string
  status: {
    code: string
    name: string
  }
  created_at: string
  notes?: string | null
}

interface OrderStatusTimelineProps {
  history: OrderStatusHistory[]
  currentStatusCode: string
}

// Standard order status progression
const STATUS_ORDER = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered']

/**
 * Timeline component displaying order status progression
 * Shows completed, current, and pending steps with timestamps
 */
export function OrderStatusTimeline({ history, currentStatusCode }: OrderStatusTimelineProps) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatusCode)
  // cancelled status is special - show as final step
  const isCancelled = currentStatusCode === 'cancelled'

  // Sort history by created_at ascending
  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  return (
    <div className="space-y-0">
      {sortedHistory.map((item, index) => {
        const statusIndex = STATUS_ORDER.indexOf(item.status.code)
        const isCompleted = !isCancelled && statusIndex < currentIndex
        const isCurrent = item.status.code === currentStatusCode
        const isLast = index === sortedHistory.length - 1

        return (
          <div key={item.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              {/* Status icon */}
              {isCancelled && isCurrent ? (
                <Circle className="h-6 w-6 text-red-500 fill-red-100" />
              ) : isCompleted ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : isCurrent ? (
                <Clock className="h-6 w-6 text-blue-600" />
              ) : (
                <Circle className="h-6 w-6 text-gray-300" />
              )}

              {/* Connecting line */}
              {!isLast && (
                <div
                  className={cn(
                    'w-0.5 h-12',
                    isCompleted ? 'bg-green-600' : 'bg-gray-200'
                  )}
                />
              )}
            </div>

            <div className="flex-1 pb-8">
              <div
                className={cn(
                  'font-semibold',
                  isCancelled && isCurrent && 'text-red-600',
                  isCurrent && !isCancelled && 'text-blue-600'
                )}
              >
                {item.status.name}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(item.created_at), {
                  addSuffix: true,
                  locale: tr,
                })}
              </div>
              {item.notes && (
                <div className="text-sm text-muted-foreground mt-1 italic">
                  {item.notes}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
