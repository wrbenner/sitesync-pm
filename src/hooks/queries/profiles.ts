import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface ProfileSummary {
  user_id: string
  full_name: string | null
  avatar_url: string | null
}

export type ProfileMap = Map<string, ProfileSummary>

/**
 * Batch-resolve profile names for a set of user IDs.
 * Dedupes and sorts so the query key is stable regardless of input order.
 */
export function useProfileNames(userIds: (string | null | undefined)[]) {
  const unique = Array.from(new Set(userIds.filter((id): id is string => !!id))).sort()

  return useQuery<ProfileMap>({
    queryKey: ['profile-names', unique],
    enabled: unique.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', unique)
      if (error) throw error
      const map: ProfileMap = new Map()
      for (const row of (data as ProfileSummary[] | null) ?? []) {
        map.set(row.user_id, row)
      }
      return map
    },
  })
}

/** Resolve a user ID to a display name, never returning a raw UUID. */
export function displayName(
  map: ProfileMap | undefined,
  userId: string | null | undefined,
  fallback = 'Unknown',
): string {
  if (!userId) return fallback
  return map?.get(userId)?.full_name || fallback
}
