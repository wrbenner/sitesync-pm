// Supabase API client wrapper with typed error handling.

import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { transformSupabaseError } from './errors'
import { validateProjectId } from './middleware/projectScope'
import { dedup, queryKey } from '../lib/requestDedup'

type TableName = keyof Database['public']['Tables']
type DbClient = typeof supabase
type QueryResult<T> = PromiseLike<{ data: T | null; error: { message: string; code?: string; details?: string | null } | null }>

// Typed query helper — callback receives the fully-typed Supabase client
export async function supabaseQuery<T>(
  _table: TableName,
  query: (client: DbClient) => QueryResult<T>
): Promise<T> {
  const { data, error } = await query(supabase)
  if (error) throw transformSupabaseError(error)
  return data as T
}

// Typed mutation helper — callback receives the fully-typed Supabase client
export async function supabaseMutation<T>(
  _table: TableName,
  mutation: (client: DbClient) => QueryResult<T>
): Promise<T> {
  const { data, error } = await mutation(supabase)
  if (error) throw transformSupabaseError(error)
  return data as T
}

// Project-scoped query helper: validates projectId then runs query pre-filtered by project
export async function projectScopedQuery<T>(
  _table: TableName,
  projectId: string,
  query: (client: DbClient) => QueryResult<T>
): Promise<T> {
  validateProjectId(projectId)
  const { data, error } = await query(supabase)
  if (error) throw transformSupabaseError(error)
  return data as T
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

// Re-export for convenience
export { supabase }
export { ApiError, transformSupabaseError } from './errors'
