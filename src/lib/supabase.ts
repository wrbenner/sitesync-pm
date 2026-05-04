import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import type { Database, Profile } from '../types/database'
import { UserRole } from '../types/enums'

// Supabase config: env vars are injected at build time by Vite.
// Required — no source-level fallbacks. If either is missing the client
// creation below will throw, which is what we want: a silently-running
// build pointed at the wrong project is worse than a hard failure.

// In acceptance-test builds (VITE_ACCEPTANCE_MODE=true) the gate runs against
// vite preview with no real Supabase backend; queries are expected to fail
// gracefully and components render their empty/loading states. Use placeholder
// values so createClient() doesn't throw at module load.
const isAcceptanceBuild = import.meta.env.VITE_ACCEPTANCE_MODE === 'true'
const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''
const supabaseUrl = rawUrl || (isAcceptanceBuild ? 'http://acceptance.invalid' : '')
const supabaseAnonKey = rawKey || (isAcceptanceBuild ? 'acceptance-stub-key' : '')
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[SiteSync] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set. ' +
    'Configure them in your deployment environment (Vercel project settings, .env.local, etc.).',
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Disable gotrue-js's navigator-lock serialization. It's designed to coordinate auth
    // refresh across multiple tabs, but in practice it causes 5s timeouts + "Lock stolen"
    // errors when a page fires many concurrent data fetches (each one wants to read the
    // session, each acquires the same lock). Pass-through is safe for single-tab usage.
    lock: (async (_name: string, _acquireTimeout: number, fn: () => Promise<unknown>) => fn()) as never,
  },
})

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey

/**
 * Typed table accessor — preserves the literal table name so `.eq()`, `.in()`,
 * `.select()` calls narrow correctly to that table's row shape under
 * @supabase/supabase-js v2 strict generics. Use this everywhere instead of
 * `supabase.from(...)`. Callers needing the dynamic-string escape hatch can
 * cast: `fromTable(name as never)`.
 */
type TableName = keyof Database['public']['Tables']
export function fromTable<T extends TableName>(table: T) {
  return supabase.from(table)
}

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

  const { data, error } = await fromTable('profiles')
    .select('*')
    .eq('user_id' as never, user.id)
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

  const { data, error } = await fromTable('project_members')
    .select('role')
    .eq('project_id' as never, projectId)
    .eq('user_id' as never, user.id)
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
