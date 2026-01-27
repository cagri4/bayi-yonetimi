'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface UseOrderRealtimeOptions {
  orderId: string
}

/**
 * Hook for subscribing to real-time order status changes
 * Handles React Strict Mode double-mount with channel ref
 * Shows toast notification and refreshes page on updates
 */
export function useOrderRealtime({ orderId }: UseOrderRealtimeOptions) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const router = useRouter()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabase = createClient()

  useEffect(() => {
    // Prevent double subscription in React Strict Mode
    if (channelRef.current) {
      return
    }

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        async (payload) => {
          // Fetch the new status name for the toast
          const { data: status } = await supabase
            .from('order_statuses')
            .select('name')
            .eq('id', (payload.new as { status_id: string }).status_id)
            .single()

          if (status && 'name' in status) {
            toast.success(`Siparis durumu guncellendi: ${(status as { name: string }).name}`)
          } else {
            toast.success('Siparis durumu guncellendi')
          }

          // Refresh page data from server
          router.refresh()
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsSubscribed(true)
        }
      })

    channelRef.current = channel

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
        setIsSubscribed(false)
      }
    }
  }, [orderId, supabase, router])

  return { isSubscribed }
}
