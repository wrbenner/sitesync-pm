// Supabase API client wrapper with typed error handling.

import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { transformSupabaseError } from './errors'

type TableName = keyof Database['public']['Tables']

// Typed query helper
export async function supabaseQuery<T>(
  table: TableName,
  query: (q: ReturnType<typeof supabase.from>) => any
): Promise<T> {
  const { data, error } = await query(supabase.from(table as any) as any)
  if (error) throw transformSupabaseError(error)
  return data as T
}

// Typed mutation helper
export async function supabaseMutation<T>(
  table: TableName,
  mutation: (q: ReturnType<typeof supabase.from>) => any
): Promise<T> {
  const { data, error } = await mutation(supabase.from(table as any) as any)
  if (error) throw transformSupabaseError(error)
  return data as T
}

// Re-export for convenience
export { supabase }
export { ApiError, transformSupabaseError } from './errors'
