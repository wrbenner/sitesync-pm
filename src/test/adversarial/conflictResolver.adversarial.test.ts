// FILTER STATUS: CONSISTENT FAIL — kept as proven bug probe; do not fix here
// STATUS: FAILING — real bug detected
// Bug description: detectConflicts and buildMergedRecord do not properly handle undefined vs null differences and deleted fields
// Fix hint: Check the conflict detection logic for null/undefined equality and field deletion detection in detectConflicts and buildMergedRecord functions

// ADVERSARIAL TEST
// Source file: src/lib/conflictResolver.ts
// Fragile logic targeted: JSON.stringify comparison for field equality, field exclusions (updated_at, id), empty object handling
// Failure mode: Different JSON serialization order causing false conflicts, undefined vs null comparison, missing field exclusions

import { describe, it, expect } from 'vitest'
import {
  detectConflicts,
  resolveConflict,
  checkStaleSubmission,
  buildMergedRecord,
} from '../../../src/lib/conflictResolver'

describe('conflictResolver.ts adversarial tests', () => {
  it('should handle JSON.stringify comparison with different property order', () => {
    // Fragile logic: JSON.stringify(base[key]) === JSON.stringify(local[key])
    // JSON.stringify serializes objects in property insertion order.
    // Different order = different strings, even if semantically equal.

    const base = { title: 'Original', status: 'open' }
    const local = { title: 'Original', status: 'open' }
    const server = { status: 'open', title: 'Original' } // Different order

    const result = detectConflicts(base, local, server)

    // Should NOT detect conflicts (values are the same)
    expect(result.canAutoMerge).toBe(true)
    expect(result.conflictingFields).toHaveLength(0)
  })

  it('should exclude updated_at and id fields from conflict detection', () => {
    // Fragile logic: if (key === 'updated_at' || key === 'id') continue

    const base = { id: '1', title: 'Original', updated_at: '2026-01-01' }
    const local = { id: '1', title: 'Changed Locally', updated_at: '2026-01-02' }
    const server = { id: '1', title: 'Original', updated_at: '2026-01-03' }

    const result = detectConflicts(base, local, server)

    // updated_at and id should be ignored
    // Only title changed locally: should auto-merge
    expect(result.canAutoMerge).toBe(true)
    expect(result.merged.title).toBe('Changed Locally')
  })

  it('should detect real conflicts when both sides change the same field differently', () => {
    // Fragile logic: Both changed to different values = real conflict

    const base = { title: 'Original', status: 'open' }
    const local = { title: 'Local Change', status: 'open' }
    const server = { title: 'Server Change', status: 'open' }

    const result = detectConflicts(base, local, server)

    expect(result.canAutoMerge).toBe(false)
    expect(result.conflictingFields).toContain('title')
  })

  it('should auto-merge when only local changed', () => {
    // Fragile logic: localVal !== baseVal && serverVal === baseVal -> take local

    const base = { title: 'Original', status: 'open' }
    const local = { title: 'Updated Locally', status: 'open' }
    const server = { title: 'Original', status: 'open' } // Server unchanged

    const result = detectConflicts(base, local, server)

    expect(result.canAutoMerge).toBe(true)
    expect(result.merged.title).toBe('Updated Locally')
  })

  it('should auto-merge when only server changed', () => {
    // Fragile logic: serverVal !== baseVal && localVal === baseVal -> take server

    const base = { title: 'Original', status: 'open' }
    const local = { title: 'Original', status: 'open' } // Local unchanged
    const server = { title: 'Updated on Server', status: 'open' }

    const result = detectConflicts(base, local, server)

    expect(result.canAutoMerge).toBe(true)
    expect(result.merged.title).toBe('Updated on Server')
  })

  it('should handle undefined vs null differences correctly', () => {
    // Edge case: undefined vs null are different in JSON.stringify
    // JSON.stringify(undefined) = undefined (the value)
    // JSON.stringify(null) = "null"

    const base = { title: 'Original', notes: undefined }
    const local = { title: 'Original', notes: null }
    const server = { title: 'Original', notes: undefined }

    const result = detectConflicts(base, local, server)

    // Local changed notes from undefined to null
    // Server kept undefined
    // This is a conflict
    expect(result.canAutoMerge).toBe(false)
    expect(result.conflictingFields).toContain('notes')
  })

  it('should handle empty objects without crashing', () => {
    const base = {}
    const local = {}
    const server = {}

    const result = detectConflicts(base, local, server)

    expect(result.canAutoMerge).toBe(true)
    expect(result.conflictingFields).toHaveLength(0)
    expect(result.merged).toEqual({})
  })

  it('should handle new fields added only in local', () => {
    // Edge case: Field exists in local but not in base or server

    const base = { title: 'Original' }
    const local = { title: 'Original', newField: 'Added locally' }
    const server = { title: 'Original' }

    const result = detectConflicts(base, local, server)

    // newField only in local: should auto-merge and include it
    expect(result.canAutoMerge).toBe(true)
    expect(result.merged.newField).toBe('Added locally')
  })

  it('should handle fields deleted in local', () => {
    // Edge case: Field exists in base and server, but deleted in local

    const base = { title: 'Original', description: 'Old description' }
    const local = { title: 'Original' } // description deleted
    const server = { title: 'Original', description: 'Old description' }

    const result = detectConflicts(base, local, server)

    // Local deleted description, server kept it
    // This is a conflict (local changed it to undefined, server kept it)
    expect(result.canAutoMerge).toBe(false)
    expect(result.conflictingFields).toContain('description')
  })

  it('should resolve conflict choosing local version', () => {
    const conflict = {
      base_version: { title: 'Original' },
      local_version: { title: 'Local' },
      server_version: { title: 'Server' },
    } as any

    const resolved = resolveConflict(conflict, 'local')

    expect(resolved.title).toBe('Local')
  })

  it('should resolve conflict choosing server version', () => {
    const conflict = {
      base_version: { title: 'Original' },
      local_version: { title: 'Local' },
      server_version: { title: 'Server' },
    } as any

    const resolved = resolveConflict(conflict, 'server')

    expect(resolved.title).toBe('Server')
  })

  it('should resolve conflict with per-field resolutions', () => {
    const conflict = {
      base_version: { title: 'Original', status: 'open' },
      local_version: { title: 'Local Title', status: 'in_progress' },
      server_version: { title: 'Server Title', status: 'closed' },
    } as any

    const resolved = resolveConflict(conflict, 'server', {
      title: 'local', // Take local title
      status: 'server', // Take server status
    })

    expect(resolved.title).toBe('Local Title')
    expect(resolved.status).toBe('closed')
  })

  it('should detect stale submission when server changed', () => {
    const beforeState = { title: 'Original', status: 'open' }
    const serverState = { title: 'Changed on Server', status: 'open' }
    const localEdits = { title: 'Original', status: 'in_progress' }

    const result = checkStaleSubmission(beforeState, serverState, localEdits)

    expect(result.isStale).toBe(true)
    expect(result.canAutoMerge).toBe(true) // No overlapping changes
  })

  it('should not detect stale when server unchanged', () => {
    const beforeState = { title: 'Original', status: 'open' }
    const serverState = { title: 'Original', status: 'open' } // No changes
    const localEdits = { title: 'Original', status: 'in_progress' }

    const result = checkStaleSubmission(beforeState, serverState, localEdits)

    expect(result.isStale).toBe(false)
    expect(result.canAutoMerge).toBe(true)
  })

  it('should detect conflicting stale submission', () => {
    const beforeState = { title: 'Original', status: 'open' }
    const serverState = { title: 'Server Change', status: 'open' }
    const localEdits = { title: 'Local Change', status: 'open' }

    const result = checkStaleSubmission(beforeState, serverState, localEdits)

    expect(result.isStale).toBe(true)
    expect(result.canAutoMerge).toBe(false)
    expect(result.conflictingFields).toContain('title')
  })

  it('should build merged record with field resolutions', () => {
    const base = { title: 'Original', status: 'open', priority: 'medium' }
    const local = { title: 'Local Title', status: 'in_progress', priority: 'medium' }
    const server = { title: 'Server Title', status: 'open', priority: 'high' }

    const merged = buildMergedRecord(base, local, server, {
      title: 'local',
      priority: 'server',
    })

    expect(merged.title).toBe('Local Title')
    expect(merged.priority).toBe('high')
    // status unchanged by both, should take server
    expect(merged.status).toBe('open')
  })

  it('should handle both sides changing to the same value (no conflict)', () => {
    // Edge case: Both local and server change field to the same value

    const base = { title: 'Original', status: 'open' }
    const local = { title: 'Updated', status: 'open' }
    const server = { title: 'Updated', status: 'open' } // Both changed to 'Updated'

    const result = detectConflicts(base, local, server)

    expect(result.canAutoMerge).toBe(true)
    expect(result.conflictingFields).toHaveLength(0)
    expect(result.merged.title).toBe('Updated')
  })
})
