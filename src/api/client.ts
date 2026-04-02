// Supabase API client wrapper with typed error handling.
//
// WARNING: Do NOT pass the raw `supabase` client to project-scoped query
// callbacks. Always use projectScopedQuery, which automatically enforces
// project_id isolation via createScopedClient. Bypassing this allows
// cross-project data leakage.

import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { transformSupabaseError } from './errors'
import { assertProjectAccess } from './middleware/projectScope'
import { dedup, queryKey } from '../lib/requestDedup'

type TableName = keyof Database['public']['Tables']
type DbClient = typeof supabase
type SupabaseProxyTarget = typeof supabase
type QueryResult<T> = PromiseLike<{ data: T | null; error: { message: string; code?: string; details?: string | null } | null }>

// Tables that do not have a project_id column and must NOT receive the auto-scoped .eq filter.
const UNSCOPED_TABLES = new Set(['organizations', 'organization_members', 'auth', 'storage'])

const SCOPED_CLIENT_CACHE_MAX = 5
const scopedClientCache = new Map<string, DbClient>()

/** Clears the scoped client cache. Call on logout or project switching. */
export function clearScopedClientCache(): void {
  scopedClientCache.clear()
}

/**
 * Wraps the Supabase client so that every terminal operation (select, insert,
 * update, delete, upsert) automatically appends .eq('project_id', projectId).
 * The .eq() is injected after the terminal call so that callers receive a
 * full PostgrestQueryBuilder from .from() and can chain freely before the
 * filter is applied. Tables in UNSCOPED_TABLES are excluded from scoping.
 *
 * Results are cached by projectId (LRU, max 5 entries) to avoid allocating a
 * new Proxy pair on every call with the same projectId.
 */
export function createScopedClient(client: DbClient, projectId: string): DbClient {
  const cached = scopedClientCache.get(projectId)
  if (cached !== undefined) {
    // Refresh LRU position
    scopedClientCache.delete(projectId)
    scopedClientCache.set(projectId, cached)
    return cached
  }

  const TERMINAL_OPS = new Set(['select', 'insert', 'update', 'delete', 'upsert'])
  // Type for a terminal method after invocation — all return something with .eq()
  type ScopedResult = { eq(col: string, val: unknown): unknown }
  type TerminalMethod = (...args: unknown[]) => ScopedResult

  const proxy = new Proxy(client, {
    get(target: SupabaseProxyTarget, prop: string | symbol, receiver: unknown) {
      if (prop === 'from') {
        return (table: string): ReturnType<typeof supabase.from> => {
          const qb = target.from(table as TableName)
          const skipScoping = UNSCOPED_TABLES.has(table)
          return new Proxy(qb, {
            get(qbTarget, qbProp, qbReceiver) {
              if (!skipScoping && typeof qbProp === 'string' && TERMINAL_OPS.has(qbProp)) {
                return (...args: unknown[]) => {
                  const result = (qbTarget[qbProp as keyof typeof qbTarget] as TerminalMethod).call(qbTarget, ...args).eq('project_id', projectId)
                  if (qbProp === 'select') {
                    return (result as any).is('deleted_at', null)
                  }
                  return result
                }
              }
              return Reflect.get(qbTarget, qbProp, qbReceiver)
            },
          }) as ReturnType<typeof supabase.from>
        }
      }
      return Reflect.get(target, prop, receiver)
    },
  })

  // Evict LRU entry if at capacity
  if (scopedClientCache.size >= SCOPED_CLIENT_CACHE_MAX) {
    const lruKey = scopedClientCache.keys().next().value
    if (lruKey !== undefined) scopedClientCache.delete(lruKey)
  }
  scopedClientCache.set(projectId, proxy)
  return proxy
}

/**
 * Use for simple reads that do not need per-project access enforcement or
 * deduplication. The callback receives the typed Supabase client.
 */
export async function supabaseQuery<T>(
  query: (client: DbClient) => QueryResult<T>
): Promise<T> {
  const { data, error } = await query(supabase)
  if (error) throw transformSupabaseError(error)
  return data as T
}

/**
 * Use for INSERT, UPDATE, and DELETE operations. Mutations are never
 * deduplicated, so they always execute immediately.
 */
export async function supabaseMutation<T>(
  mutation: (client: DbClient) => QueryResult<T>
): Promise<T> {
  const { data, error } = await mutation(supabase)
  if (error) throw transformSupabaseError(error)
  return data as T
}

/**
 * Use for project-scoped reads. Asserts the caller has access to projectId,
 * then deduplicates concurrent calls with the same table + projectId so that
 * rapid re-renders never fan out into redundant network requests.
 */
export async function projectScopedQuery<T>(
  table: TableName,
  projectId: string,
  query: (client: DbClient) => QueryResult<T>
): Promise<T> {
  await assertProjectAccess(projectId)
  const key = queryKey(table, { project_id: projectId })
  const scopedClient = createScopedClient(supabase, projectId)
  return dedup(key, async () => {
    const { data, error } = await query(scopedClient)
    if (error) throw transformSupabaseError(error)
    return data as T
  })
}

// Deduplicated query helper — coalesces concurrent identical requests into a single network call
export async function dedupQuery<T>(
  table: TableName,
  filters: Record<string, unknown>,
  query: (client: DbClient) => QueryResult<T>
): Promise<T> {
  const key = queryKey(table, filters)
  return dedup(key, async () => {
    const { data, error } = await query(supabase)
    if (error) throw transformSupabaseError(error)
    return data as T
  })
}

/**
 * Runs a paginated Supabase query. The queryFn receives (from, to) range indices
 * and must use `.select('*', { count: 'exact' })` and `.range(from, to)`.
 * Returns a PaginatedResult with the mapped rows and total count.
 */
export async function buildPaginatedQuery<TRaw, TResult = TRaw>(
  queryFn: (from: number, to: number) => PromiseLike<{
    data: TRaw[] | null
    error: { message: string; code?: string; details?: string | null } | null
    count: number | null
  }>,
  pagination: import('../types/api').PaginationParams = {},
  transform?: (item: TRaw) => TResult
): Promise<import('../types/api').PaginatedResult<TResult>> {
  const { page = 1, pageSize = 50 } = pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, error, count } = await queryFn(from, to)
  if (error) throw transformSupabaseError(error)
  const rows = (data ?? []) as TRaw[]
  const mappedData = transform ? rows.map(transform) : (rows as unknown as TResult[])
  const total = count ?? 0
  return {
    data: mappedData,
    total,
    page,
    pageSize,
    hasMore: (from + pageSize) < total,
    isEmpty: mappedData.length === 0 && total === 0,
  }
}

/**
 * Creates a typed Supabase Realtime subscription for a given table filtered by
 * project_id. Returns an object with an unsubscribe function for cleanup (e.g. in useEffect).
 */
export function subscribeToTable(
  table: string,
  projectId: string,
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE',
  onPayload: (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void
): { unsubscribe: () => void } {
  const channel = supabase
    .channel(`realtime:${table}:${projectId}`)
    .on('postgres_changes', { event, schema: 'public', table, filter: `project_id=eq.${projectId}` }, onPayload)
    .subscribe()
  return { unsubscribe: () => { supabase.removeChannel(channel) } }
}

/**
 * Creates a Supabase Realtime subscription for the notifications table filtered
 * by user_id instead of project_id. Returns an object with an unsubscribe function.
 */
export function subscribeToUserNotifications(
  userId: string,
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE',
  onPayload: (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void
): { unsubscribe: () => void } {
  const channel = supabase
    .channel(`realtime:notifications:${userId}`)
    .on('postgres_changes', { event, schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, onPayload)
    .subscribe()
  return { unsubscribe: () => { supabase.removeChannel(channel) } }
}

// Re-export for convenience
export { supabase }
export { ApiError, AuthError, PermissionError, ValidationError, NotFoundError, transformSupabaseError } from './errors'
