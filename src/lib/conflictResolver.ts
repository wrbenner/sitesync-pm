import type { ConflictRecord } from '../types/sync'

/**
 * Three-way merge: compare local and server changes against the base version.
 *
 * Rules per field:
 *   - Only local changed  -> take local (non-conflicting)
 *   - Only server changed -> take server (non-conflicting)
 *   - Both unchanged      -> take server (same value)
 *   - Both changed to same value -> take that value (non-conflicting)
 *   - Both changed to different values -> real conflict, needs manual resolution
 */
export function detectConflicts(
  base: Record<string, unknown>,
  local: Record<string, unknown>,
  server: Record<string, unknown>
): { canAutoMerge: boolean; conflictingFields: string[]; merged: Record<string, unknown> } {
  const allKeys = new Set([...Object.keys(local), ...Object.keys(server)])
  const conflictingFields: string[] = []
  const merged: Record<string, unknown> = { ...server } // start with server as the base

  for (const key of allKeys) {
    if (key === 'updated_at' || key === 'id') continue

    const baseVal = JSON.stringify(base[key])
    const localVal = JSON.stringify(local[key])
    const serverVal = JSON.stringify(server[key])

    if (localVal === serverVal) continue // both sides agree, no conflict

    if (localVal !== baseVal && serverVal === baseVal) {
      // Only local changed: take local
      merged[key] = local[key]
    } else if (serverVal !== baseVal && localVal === baseVal) {
      // Only server changed: take server (already in merged)
    } else {
      // Both changed to different values: real conflict
      conflictingFields.push(key)
    }
  }

  return {
    canAutoMerge: conflictingFields.length === 0,
    conflictingFields,
    merged,
  }
}

/**
 * Produce a final resolved record from a conflict.
 *
 * - 'local': use the entire local version
 * - 'server': use the entire server version
 * - Per-field fieldResolutions map: pick each field from local or server individually
 */
export function resolveConflict(
  conflict: ConflictRecord,
  resolution: 'local' | 'server',
  fieldResolutions?: Record<string, 'local' | 'server'>
): Record<string, unknown> {
  if (resolution === 'local') return conflict.local_version
  if (resolution === 'server') return conflict.server_version

  // Per-field merge: start from server, then override with chosen sides
  const merged: Record<string, unknown> = { ...conflict.server_version }
  if (fieldResolutions) {
    for (const [field, choice] of Object.entries(fieldResolutions)) {
      merged[field] =
        choice === 'local' ? conflict.local_version[field] : conflict.server_version[field]
    }
  }
  return merged
}

/**
 * Detect whether a live (non-offline) submission is stale.
 *
 * Call this before saving an edited record to check whether the server version
 * has changed since the user opened the form. If it has, and the changes
 * conflict, surface the LiveEditConflictModal.
 *
 * Returns:
 *   isStale        - true when the server has diverged from before_state
 *   canAutoMerge   - true when all divergences are non-overlapping (safe to merge silently)
 *   conflictingFields - field names that both the user and server changed differently
 *   merged         - the auto-merged record (only valid when canAutoMerge is true)
 */
export function checkStaleSubmission(
  beforeState: Record<string, unknown>,
  serverState: Record<string, unknown>,
  localEdits: Record<string, unknown>,
): {
  isStale: boolean
  canAutoMerge: boolean
  conflictingFields: string[]
  merged: Record<string, unknown>
} {
  // Fast path: server hasn't changed at all
  const serverChanged = Object.keys(serverState).some(
    (k) => k !== 'updated_at' && k !== 'id' &&
      JSON.stringify(serverState[k]) !== JSON.stringify(beforeState[k]),
  )
  if (!serverChanged) {
    return { isStale: false, canAutoMerge: true, conflictingFields: [], merged: { ...localEdits } }
  }

  const { canAutoMerge, conflictingFields, merged } = detectConflicts(beforeState, localEdits, serverState)
  return { isStale: true, canAutoMerge, conflictingFields, merged }
}

/**
 * Build a merged record from a conflict using per-field resolutions stored on a PendingMutation.
 * Starts from the auto-merged base (server + non-conflicting local changes), then applies
 * the user's manual choices for the truly conflicting fields.
 */
export function buildMergedRecord(
  base: Record<string, unknown>,
  local: Record<string, unknown>,
  server: Record<string, unknown>,
  fieldResolutions: Record<string, 'local' | 'server'>
): Record<string, unknown> {
  const { merged: autoMerged } = detectConflicts(base, local, server)

  // Apply manual resolutions on top of the auto-merged result
  const final: Record<string, unknown> = { ...autoMerged }
  for (const [field, choice] of Object.entries(fieldResolutions)) {
    final[field] = choice === 'local' ? local[field] : server[field]
  }
  return final
}
