'use client'

import { useOrderRealtime } from '@/hooks/use-order-realtime'

interface OrderRealtimeWrapperProps {
  orderId: string
}

/**
 * Client component wrapper for Realtime subscription
 * Subscribes to order status changes and triggers page refresh
 * Shows subtle indicator when subscribed to live updates
 */
export function OrderRealtimeWrapper({ orderId }: OrderRealtimeWrapperProps) {
  const { isSubscribed } = useOrderRealtime({ orderId })

  // Render nothing visible - just subscribes to updates
  // Could optionally show a "live updates" indicator
  if (isSubscribed) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
        Canli guncellemeler aktif
      </div>
    )
  }

  return null
}
