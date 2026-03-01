import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

// Module-level singleton — reuse across agent calls in same serverless instance
let _serviceClient: SupabaseClient<Database> | null = null

/**
 * Returns a typed Supabase client using the service role key.
 * This client bypasses RLS and is used ONLY by agent layer code (src/lib/agents/).
 * Never expose this client to user-facing request handlers.
 */
export function createServiceClient(): SupabaseClient<Database> {
  if (_serviceClient) {
    return _serviceClient
  }

  _serviceClient = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )

  return _serviceClient
}
