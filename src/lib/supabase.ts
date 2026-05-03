import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import type { Database, Profile } from '../types/database'
import { UserRole } from '../types/enums'

// Supabase config: env vars are injected at build time by Vite.
// Required in production — if either is missing in a real build the client creation
// will throw, which is what we want: a silently-running build pointed at the wrong
// project is worse than a hard failure.
// Exception: when VITE_DEV_BYPASS=true is set (dev-only, no Supabase vars), we create
// a placeholder client so pages can render under auth bypass (e2e / local dev without
// a Supabase project). isDevBypassActive() in lib/devBypass.ts explicitly requires that
// no Supabase vars are present, so we must not throw in that case.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
const isDevBypass = import.meta.env.DEV === true && import.meta.env.VITE_DEV_BYPASS === 'true'

if (!isDevBypass && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error(
    '[SiteSync] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set. ' +
    'Configure them in your deployment environment (Vercel project settings, .env.local, etc.).',
  )
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      // Disable gotrue-js's navigator-lock serialization. It's designed to coordinate auth
      // refresh across multiple tabs, but in practice it causes 5s timeouts + "Lock stolen"
      // errors when a page fires many concurrent data fetches (each one wants to read the
      // session, each acquires the same lock). Pass-through is safe for single-tab usage.
      lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<unknown>) => fn(),
    },
  },
)

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey

/**
 * Typed table accessor that accepts tables added by migration but not yet in generated types.
 * Use this instead of direct unsafe table name casts for safe, typed table access.
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
