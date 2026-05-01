import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface ProfileSummary {
  user_id: string
  full_name: string | null
  avatar_url: string | null
}

export type ProfileMap = Map<string, ProfileSummary>

// ── Synthetic-seed name overlay ─────────────────────────────────────────────
// Demo + dev seed data uses deterministic UUIDs (e.g.
// a0000001-0000-0000-0000-00000000000N). Those IDs do not exist in the
// `profiles` table because the seeder can't write to `auth.users` from
// the client. Without an overlay, the cockpit shows "a00000" instead of
// names — which looks broken to investors.
//
// This overlay maps the well-known last-segment to a realistic
// construction-native name. If the project loads real `profiles` rows
// for an ID, those win; the overlay is consulted only when the live map
// has no entry.

// Keys are the 3-char hex tail captured from the synthetic-UUID regex.
// '001' through '00f' covers 15 personas; the cycler below handles
// anything outside that range deterministically (UUID -> stable name).
const DEMO_NAME_OVERLAY: Record<string, string> = {
  '001': 'Mike Foreman',
  '002': 'Sarah Garcia',
  '003': 'Robert Torres',
  '004': 'Lisa Chen',
  '005': 'David Park',
  '006': 'Karen Walsh',
  '007': 'James Reilly',
  '008': 'Jennifer Cole',
  '009': 'Tom Brown',
  '00a': 'Erin Patel',
  '00b': 'Mark Hayes',
  '00c': 'Anna Diaz',
  '00d': 'Carlos Romero',
  '00e': 'Priya Anand',
  '00f': 'Alex Nguyen',
  '010': 'Beth Klein',
}

// Synthetic seed UUIDs follow the convention: any 8-hex prefix, then
// three zero-segments, then 9 zeros + a 3-hex tail (e.g.
// `a0000001-0000-0000-0000-000000000007`). Real auth.users UUIDs almost
// never have 9 leading zeros in the last segment, so this is a safe
// signature for the synthetic-seed namespace without false positives.
const SYNTHETIC_UUID_RE =
  /^[0-9a-f]{8}-0{4}-0{4}-0{4}-0{9}([0-9a-f]{3})$/i

/** Returns a friendly name for a synthetic seed UUID, or null otherwise. */
function syntheticName(userId: string): string | null {
  const m = userId.match(SYNTHETIC_UUID_RE)
  if (!m) return null
  const tail = m[1].toLowerCase()
  // Exact mappings take priority — covers our 16 canonical demo personas.
  if (DEMO_NAME_OVERLAY[tail]) return DEMO_NAME_OVERLAY[tail]
  // Beyond the explicit table, fall back to a stable cycle so any
  // out-of-range synthetic UUID still resolves to a real name.
  const idx = parseInt(tail, 16)
  if (Number.isFinite(idx)) {
    const names = Object.values(DEMO_NAME_OVERLAY)
    return names[idx % names.length]
  }
  return null
}

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
      // Fill gaps with synthetic-seed names so demo UUIDs don't render
      // as "a00000" in the cockpit. Never overwrites a real profile.
      for (const id of unique) {
        if (map.has(id)) continue
        const overlayed = syntheticName(id)
        if (overlayed) {
          map.set(id, { user_id: id, full_name: overlayed, avatar_url: null })
        }
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
  const live = map?.get(userId)?.full_name
  if (live) return live
  const synth = syntheticName(userId)
  if (synth) return synth
  return fallback
}
