import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hypxrmcppjfbtlwuoafc.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cHhybWNwcGpmYnRsd3VvYWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTM1MjQsImV4cCI6MjA5MDI4OTUyNH0.gI_zodUcFN1z5a9k4GC5At4fsPYgWi-99C0ZNcVgmYA'

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey

/**
 * Force a token refresh. Call this proactively before long-running operations
 * or when a 401 is received from any API endpoint.
 */
export async function refreshSession(): Promise<void> {
  const { error } = await supabase.auth.refreshSession()
  if (error) throw error
}

/**
 * Subscribe to auth state changes. Returns the unsubscribe function.
 * Use this in the app root to keep tenant context in sync with the session.
 */
export function onAuthStateChange(
  callback: (event: string, session: ReturnType<typeof supabase.auth.getSession> | null) => void,
) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => callback(event, session as any),
  )
  return () => subscription.unsubscribe()
}
