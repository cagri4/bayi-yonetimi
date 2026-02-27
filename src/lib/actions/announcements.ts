'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export interface Announcement {
  id: string
  title: string
  content: string
  priority: number
  is_active: boolean
  published_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface AnnouncementWithReadStatus extends Announcement {
  is_read: boolean
}

/**
 * Get all active announcements with read status for current dealer
 */
export async function getAnnouncements(): Promise<AnnouncementWithReadStatus[]> {
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Get dealer ID
  const { data: dealerData } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!dealerData) return []

  const dealerId = (dealerData as { id: string }).id
  const now = new Date().toISOString()

  // Get announcements with read status
  const { data: announcements, error } = await supabase
    .from('announcements')
    .select(`
      *,
      announcement_reads!left(
        id,
        read_at
      )
    `)
    .eq('is_active', true)
    .lte('published_at', now)
    .or(`expires_at.is.null,expires_at.gte.${now}`)
    .order('priority', { ascending: false })
    .order('published_at', { ascending: false })

  if (error) {
    console.error('Error fetching announcements:', error)
    return []
  }

  // Map to include is_read status
  return announcements.map((announcement: any) => {
    const reads = Array.isArray(announcement.announcement_reads)
      ? announcement.announcement_reads
      : []

    const isRead = reads.some((read: any) => read.id !== null)

    const { announcement_reads, ...announcementData } = announcement

    return {
      ...announcementData,
      is_read: isRead,
    } as AnnouncementWithReadStatus
  })
}

/**
 * Get count of unread announcements for current dealer
 */
export async function getUnreadAnnouncementCount(): Promise<number> {
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  // Get dealer ID
  const { data: dealerData } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!dealerData) return 0

  const dealerId = (dealerData as { id: string }).id
  const now = new Date().toISOString()

  // Get all active announcements
  const { data: announcements } = await supabase
    .from('announcements')
    .select('id')
    .eq('is_active', true)
    .lte('published_at', now)
    .or(`expires_at.is.null,expires_at.gte.${now}`)

  if (!announcements) return 0

  // Get read announcements
  const { data: reads } = await supabase
    .from('announcement_reads')
    .select('announcement_id')
    .eq('dealer_id', dealerId)
    .in('announcement_id', announcements.map(a => a.id))

  const readIds = new Set(reads?.map(r => r.announcement_id) || [])
  return announcements.filter(a => !readIds.has(a.id)).length
}

/**
 * Mark an announcement as read for current dealer
 */
export async function markAnnouncementAsRead(announcementId: string) {
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get dealer ID
  const { data: dealerData, error: dealerError } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (dealerError || !dealerData) {
    throw new Error('Dealer not found')
  }

  const dealerId = (dealerData as { id: string }).id

  // Insert read receipt (ON CONFLICT DO NOTHING handled by unique constraint)
  const { error: insertError } = await supabase
    .from('announcement_reads')
    .insert({
      announcement_id: announcementId,
      dealer_id: dealerId,
    })

  if (insertError && !insertError.message.includes('duplicate')) {
    console.error('Error marking announcement as read:', insertError)
    throw new Error('Failed to mark announcement as read')
  }

  revalidatePath('/announcements')
}

/**
 * Mark all announcements as read for current dealer
 */
export async function markAllAnnouncementsAsRead() {
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get dealer ID
  const { data: dealerData, error: dealerError } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (dealerError || !dealerData) {
    throw new Error('Dealer not found')
  }

  const dealerId = (dealerData as { id: string }).id
  const now = new Date().toISOString()

  // Get all active announcement IDs
  const { data: announcements } = await supabase
    .from('announcements')
    .select('id')
    .eq('is_active', true)
    .lte('published_at', now)
    .or(`expires_at.is.null,expires_at.gte.${now}`)

  if (!announcements || announcements.length === 0) return

  // Get already read announcement IDs
  const { data: existingReads } = await supabase
    .from('announcement_reads')
    .select('announcement_id')
    .eq('dealer_id', dealerId)
    .in('announcement_id', announcements.map(a => a.id))

  const readIds = new Set(existingReads?.map(r => r.announcement_id) || [])

  // Insert read receipts for unread announcements
  const unreadAnnouncements = announcements
    .filter(a => !readIds.has(a.id))
    .map(a => ({
      announcement_id: a.id,
      dealer_id: dealerId,
    }))

  if (unreadAnnouncements.length > 0) {
    const { error: insertError } = await supabase
      .from('announcement_reads')
      .insert(unreadAnnouncements)

    if (insertError) {
      console.error('Error marking all announcements as read:', insertError)
      throw new Error('Failed to mark all announcements as read')
    }
  }

  revalidatePath('/announcements')
}

/**
 * Get all announcements (active and inactive) - Admin only
 */
export async function getAllAnnouncements(): Promise<Announcement[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching all announcements:', error)
    return []
  }

  return data as Announcement[]
}

/**
 * Create a new announcement - Admin only
 */
export async function createAnnouncement(formData: FormData) {
  const supabase = await createClient()

  const title = formData.get('title') as string
  const content = formData.get('content') as string
  const priority = parseInt(formData.get('priority') as string) || 0
  const is_active = formData.get('is_active') === 'true'
  const published_at = formData.get('published_at') as string
  const expires_at = formData.get('expires_at') as string

  const { error } = await supabase
    .from('announcements')
    .insert({
      title,
      content,
      priority,
      is_active,
      published_at: published_at || new Date().toISOString(),
      expires_at: expires_at || null,
    })

  if (error) {
    console.error('Error creating announcement:', error)
    throw new Error('Failed to create announcement')
  }

  revalidatePath('/admin/announcements')
  revalidatePath('/announcements')
}

/**
 * Update an existing announcement - Admin only
 */
export async function updateAnnouncement(announcementId: string, formData: FormData) {
  const supabase = await createClient()

  const title = formData.get('title') as string
  const content = formData.get('content') as string
  const priority = parseInt(formData.get('priority') as string) || 0
  const is_active = formData.get('is_active') === 'true'
  const published_at = formData.get('published_at') as string
  const expires_at = formData.get('expires_at') as string

  const { error } = await supabase
    .from('announcements')
    .update({
      title,
      content,
      priority,
      is_active,
      published_at: published_at || new Date().toISOString(),
      expires_at: expires_at || null,
    })
    .eq('id', announcementId)

  if (error) {
    console.error('Error updating announcement:', error)
    throw new Error('Failed to update announcement')
  }

  revalidatePath('/admin/announcements')
  revalidatePath('/announcements')
}

/**
 * Delete an announcement - Admin only
 * Soft delete by setting is_active = false
 */
export async function deleteAnnouncement(announcementId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('announcements')
    .update({ is_active: false })
    .eq('id', announcementId)

  if (error) {
    console.error('Error deleting announcement:', error)
    throw new Error('Failed to delete announcement')
  }

  revalidatePath('/admin/announcements')
  revalidatePath('/announcements')
}
