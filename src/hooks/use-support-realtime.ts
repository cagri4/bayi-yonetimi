'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Hook for admin: subscribe to new support message INSERT events
 * Handles React Strict Mode double-mount with channelRef pattern
 * Shows toast notification and refreshes page on new messages
 */
export function useSupportRealtime() {
  const [newMessageCount, setNewMessageCount] = useState(0)
  const router = useRouter()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabase = createClient()

  useEffect(() => {
    // Prevent double subscription in React Strict Mode
    if (channelRef.current) {
      return
    }

    const channel = supabase
      .channel('admin-support-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
        },
        () => {
          toast.info('Yeni destek mesaji alindi')
          setNewMessageCount((c) => c + 1)
          router.refresh()
        }
      )
      .subscribe()

    channelRef.current = channel

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [supabase, router])

  return { newMessageCount }
}
