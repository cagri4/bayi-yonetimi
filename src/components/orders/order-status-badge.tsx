import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface OrderStatusBadgeProps {
  status: {
    code: string
    name: string
  }
}

/**
 * Badge component for displaying order status with color coding
 * Status codes: pending, confirmed, preparing, shipped, delivered, cancelled
 */
export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const getVariantAndClassName = (code: string) => {
    switch (code) {
      case 'pending':
        return { variant: 'outline' as const, className: 'border-gray-300 text-gray-600' }
      case 'confirmed':
        return { variant: 'secondary' as const, className: 'bg-blue-100 text-blue-700' }
      case 'preparing':
        return { variant: 'outline' as const, className: 'border-yellow-400 bg-yellow-50 text-yellow-700' }
      case 'shipped':
        return { variant: 'secondary' as const, className: 'bg-indigo-100 text-indigo-700' }
      case 'delivered':
        return { variant: 'default' as const, className: 'bg-green-600 text-white' }
      case 'cancelled':
        return { variant: 'destructive' as const, className: '' }
      default:
        return { variant: 'outline' as const, className: '' }
    }
  }

  const { variant, className } = getVariantAndClassName(status.code)

  return (
    <Badge variant={variant} className={cn(className)}>
      {status.name}
    </Badge>
  )
}
