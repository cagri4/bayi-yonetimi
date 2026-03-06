'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Asserts that the current request is made by a superadmin user.
 *
 * Returns the actor's user ID for use in audit log entries.
 * Throws 'FORBIDDEN' if the user is not authenticated or does not have the superadmin role.
 *
 * Every superadmin Server Action must call this as its first line,
 * wrapped in try/catch that returns { error: 'Forbidden', status: 403 }.
 */
export async function assertSuperadmin(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('FORBIDDEN')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'superadmin') throw new Error('FORBIDDEN')

  return user.id // Returns actor_id for audit log
}
