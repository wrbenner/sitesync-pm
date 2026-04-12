import { describe, it, expect } from 'vitest'
import {
  detectConflicts,
  resolveConflict,
  checkStaleSubmission,
  buildMergedRecord,
} from '../../lib/conflictResolver'
import type { ConflictRecord } from '../../types/sync'

// ── Helpers ────────────────────────────────────────────────────────────────

function makeConflict(overrides: Partial<ConflictRecord> = {}): ConflictRecord {
  return {
    id: 'conflict-1',
    table: 'rfis',
    record_id: 'rfi-1',
    local_version: { title: 'Local Title', status: 'open', priority: 'high' },
    server_version: { title: 'Server Title', status: 'open', priority: 'medium' },
    base_version: { title: 'Original Title', status: 'open', priority: 'medium' },
    conflicting_fields: ['title'],
    resolved: false,
    resolution: null,
    ...overrides,
  }
}

// ── detectConflicts ────────────────────────────────────────────────────────

describe('detectConflicts', () => {
  it('should return canAutoMerge when no real conflicts exist', () => {
    const base = { title: 'Base', status: 'open', priority: 'medium' }
    const local = { title: 'Base', status: 'open', priority: 'medium' }
    const server = { title: 'Base', status: 'open', priority: 'medium' }

    const result = detectConflicts(base, local, server)
    expect(result.canAutoMerge).toBe(true)
    expect(result.conflictingFields).toEqual([])
  })

  it('should take local value when only local changed', () => {
    const base = { title: 'Base', status: 'open' }
    const local = { title: 'Local Update', status: 'open' }
    const server = { title: 'Base', status: 'open' }

    const result = detectConflicts(base, local, server)
    expect(result.canAutoMerge).toBe(true)
    expect(result.merged.title).toBe('Local Update')
  })

  it('should take server value when only server changed', () => {
    const base = { title: 'Base', status: 'open' }
    const local = { title: 'Base', status: 'open' }
    const server = { title: 'Base', status: 'answered' }

    const result = detectConflicts(base, local, server)
    expect(result.canAutoMerge).toBe(true)
    expect(result.merged.status).toBe('answered')
  })

  it('should detect real conflict when both sides changed to different values', () => {
    const base = { title: 'Base', status: 'open' }
    const local = { title: 'Local Title', status: 'open' }
    const server = { title: 'Server Title', status: 'open' }

    const result = detectConflicts(base, local, server)
    expect(result.canAutoMerge).toBe(false)
    expect(result.conflictingFields).toContain('title')
  })

  it('should not conflict when both sides changed to the same value', () => {
    const base = { title: 'Base', status: 'open' }
    const local = { title: 'Same New Title', status: 'open' }
    const server = { title: 'Same New Title', status: 'open' }

    const result = detectConflicts(base, local, server)
    expect(result.canAutoMerge).toBe(true)
    expect(result.conflictingFields).toEqual([])
  })

  it('should ignore updated_at and id fields', () => {
    const base = { id: '1', updated_at: '2024-01-01', title: 'Base' }
    const local = { id: '1', updated_at: '2024-01-02', title: 'Base' }
    const server = { id: '1', updated_at: '2024-01-03', title: 'Base' }

    const result = detectConflicts(base, local, server)
    expect(result.canAutoMerge).toBe(true)
    expect(result.conflictingFields).toEqual([])
  })

  it('should handle multiple conflicting fields', () => {
    const base = { title: 'Base', priority: 'low', status: 'open' }
    const local = { title: 'Local Title', priority: 'high', status: 'open' }
    const server = { title: 'Server Title', priority: 'medium', status: 'open' }

    const result = detectConflicts(base, local, server)
    expect(result.canAutoMerge).toBe(false)
    expect(result.conflictingFields).toContain('title')
    expect(result.conflictingFields).toContain('priority')
  })

  it('should handle empty objects without throwing', () => {
    const result = detectConflicts({}, {}, {})
    expect(result.canAutoMerge).toBe(true)
    expect(result.conflictingFields).toEqual([])
    expect(result.merged).toEqual({})
  })

  it('should handle new keys added locally', () => {
    const base = { title: 'Base' }
    const local = { title: 'Base', newField: 'local value' }
    const server = { title: 'Base' }

    const result = detectConflicts(base, local, server)
    // local added newField, server has no newField (undefined)
    // localVal !== serverVal, localVal !== baseVal (both undefined initially vs 'local value')
    // This is a conflict because local changed from undefined to 'local value'
    // and server is still undefined (same as base)
    // Wait: localVal = JSON.stringify('local value'), baseVal = JSON.stringify(undefined) = 'undefined'
    // serverVal = JSON.stringify(undefined) = 'undefined'
    // localVal !== serverVal => localVal !== baseVal (true) AND serverVal === baseVal (true) => take local
    expect(result.merged.newField).toBe('local value')
  })
})

// ── resolveConflict ────────────────────────────────────────────────────────

describe('resolveConflict', () => {
  it('should use local version when resolution is local', () => {
    const conflict = makeConflict()
    const result = resolveConflict(conflict, 'local')
    expect(result).toEqual(conflict.local_version)
  })

  it('should use server version when resolution is server', () => {
    const conflict = makeConflict()
    const result = resolveConflict(conflict, 'server')
    expect(result).toEqual(conflict.server_version)
  })

  it('should return full server version when resolution is server, ignoring fieldResolutions', () => {
    // BUG DOCUMENTED: fieldResolutions are silently ignored when resolution is 'local' or 'server'
    // because the function returns early before processing them.
    // The per-field merge code (lines after the early returns) is currently unreachable with the
    // existing 'local' | 'server' type constraint. The expected correct behavior would be:
    //   result.title === 'Local Title'  (from local per fieldResolutions)
    //   result.status === 'answered'    (from server default)
    //   result.priority === 'medium'    (from server per fieldResolutions)
    // See QUESTIONS.md for the bug report.
    const conflict = makeConflict({
      local_version: { title: 'Local Title', status: 'open', priority: 'high' },
      server_version: { title: 'Server Title', status: 'answered', priority: 'medium' },
    })

    const result = resolveConflict(conflict, 'server', {
      title: 'local',
      priority: 'server',
    })

    // Current (broken) behavior: returns the full server version unchanged
    expect(result).toEqual(conflict.server_version)
  })

  it('should start from server version for per-field merge', () => {
    const conflict = makeConflict({
      local_version: { a: 'local-a', b: 'local-b' },
      server_version: { a: 'server-a', b: 'server-b', c: 'server-c' },
    })

    const result = resolveConflict(conflict, 'server', {})
    // No field resolutions, should be identical to server
    expect(result).toEqual({ a: 'server-a', b: 'server-b', c: 'server-c' })
  })
})

// ── checkStaleSubmission ───────────────────────────────────────────────────

describe('checkStaleSubmission', () => {
  it('should return isStale=false when server has not changed', () => {
    const beforeState = { title: 'Original', status: 'open' }
    const serverState = { title: 'Original', status: 'open' }
    const localEdits = { title: 'My Edit', status: 'open' }

    const result = checkStaleSubmission(beforeState, serverState, localEdits)
    expect(result.isStale).toBe(false)
    expect(result.canAutoMerge).toBe(true)
    expect(result.merged).toEqual(localEdits)
  })

  it('should return isStale=true when server has changed', () => {
    const beforeState = { title: 'Original', status: 'open' }
    const serverState = { title: 'Original', status: 'answered' }
    const localEdits = { title: 'My Edit', status: 'open' }

    const result = checkStaleSubmission(beforeState, serverState, localEdits)
    expect(result.isStale).toBe(true)
  })

  it('should auto-merge when server and local changed different fields', () => {
    const beforeState = { title: 'Original', status: 'open', priority: 'low' }
    const serverState = { title: 'Original', status: 'answered', priority: 'low' }
    const localEdits = { title: 'My Title', status: 'open', priority: 'low' }

    const result = checkStaleSubmission(beforeState, serverState, localEdits)
    expect(result.isStale).toBe(true)
    expect(result.canAutoMerge).toBe(true)
    expect(result.conflictingFields).toEqual([])
  })

  it('should report conflict when both changed the same field differently', () => {
    const beforeState = { title: 'Original', status: 'open' }
    const serverState = { title: 'Server Title', status: 'open' }
    const localEdits = { title: 'Local Title', status: 'open' }

    const result = checkStaleSubmission(beforeState, serverState, localEdits)
    expect(result.isStale).toBe(true)
    expect(result.canAutoMerge).toBe(false)
    expect(result.conflictingFields).toContain('title')
  })

  it('should ignore updated_at and id when checking staleness', () => {
    const beforeState = { id: '1', updated_at: '2024-01-01', title: 'Same' }
    const serverState = { id: '1', updated_at: '2024-02-01', title: 'Same' }
    const localEdits = { id: '1', updated_at: '2024-01-01', title: 'Same' }

    const result = checkStaleSubmission(beforeState, serverState, localEdits)
    expect(result.isStale).toBe(false)
  })
})

// ── buildMergedRecord ──────────────────────────────────────────────────────

describe('buildMergedRecord', () => {
  it('should apply manual field resolutions on top of auto-merge', () => {
    const base = { title: 'Base', status: 'open', priority: 'low' }
    const local = { title: 'Local Title', status: 'open', priority: 'high' }
    const server = { title: 'Server Title', status: 'answered', priority: 'low' }

    // title conflicts: local='Local Title', server='Server Title'
    // status: only server changed (open -> answered) -> auto-merged to 'answered'
    // priority: only local changed (low -> high) -> auto-merged to 'high'
    const result = buildMergedRecord(base, local, server, { title: 'local' })

    expect(result.title).toBe('Local Title')   // manually chosen local
    expect(result.status).toBe('answered')     // auto-merged from server
    expect(result.priority).toBe('high')       // auto-merged from local
  })

  it('should prefer server for conflicting field when resolution is server', () => {
    const base = { note: 'original', amount: 100 }
    const local = { note: 'local note', amount: 200 }
    const server = { note: 'server note', amount: 100 }

    // note conflicts, amount only changed locally
    const result = buildMergedRecord(base, local, server, { note: 'server' })
    expect(result.note).toBe('server note')
    expect(result.amount).toBe(200) // auto-merged from local
  })

  it('should handle empty field resolutions gracefully', () => {
    const base = { title: 'Base' }
    const local = { title: 'Local' }
    const server = { title: 'Server' }

    // No resolutions means auto-merge result is returned unchanged
    const result = buildMergedRecord(base, local, server, {})
    // title conflicts: both changed from 'Base'
    // auto-merge keeps server as default for conflicts
    expect(result.title).toBe('Server')
  })
})
