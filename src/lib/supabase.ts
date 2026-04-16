import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import type { Database, Profile } from '../types/database'
import { UserRole } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (import.meta.env.PROD && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error(
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required in production. ' +
      'Configure them via your deployment environment.',
  )
}

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey

export const supabase = createClient<Database>(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'dev-anon-key-not-valid',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  },
)

/**
 * Typed table accessor that accepts tables added by migration but not yet in generated types.
 * Use this instead of `supabase.from('table' as any)` to avoid `as any` casts.
 */
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
export const fromTable = (table: AnyTableName) => supabase.from(table as keyof Database['public']['Tables'])

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
  callback: (event: string, session: Session | null) => void,
) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => callback(event, session),
  )
  return () => subscription.unsubscribe()
}

/**
 * Get the currently authenticated user's profile
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

/**
 * Get the current user's profile record from the profiles table
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  return data
}

/**
 * Get the current user's role in a specific project
 */
export async function getProjectRole(projectId: string): Promise<UserRole | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  return data?.role as UserRole || null
}

/**
 * Check if current user has admin role in organization
 */
export async function isOrgAdmin(organizationId: string): Promise<boolean> {
  const profile = await getCurrentProfile()
  if (!profile) return false

  return profile.organization_id === organizationId && profile.role === UserRole.Admin
}
