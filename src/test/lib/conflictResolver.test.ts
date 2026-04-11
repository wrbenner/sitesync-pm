import { describe, it, expect } from 'vitest'
import {
  detectConflicts,
  resolveConflict,
  checkStaleSubmission,
  buildMergedRecord,
} from '../../lib/conflictResolver'
import type { ConflictRecord } from '../../types/sync'

// ── detectConflicts ───────────────────────────────────────────

describe('detectConflicts', () => {
  it('should return canAutoMerge true when no changes on either side', () => {
    const base = { title: 'RFI-001', status: 'open' }
    const result = detectConflicts(base, base, base)
    expect(result.canAutoMerge).toBe(true)
    expect(result.conflictingFields).toHaveLength(0)
  })

  it('should take local change when only local changed', () => {
    const base = { title: 'Old Title', status: 'open' }
    const local = { title: 'New Local Title', status: 'open' }
    const server = { title: 'Old Title', status: 'open' }
    const result = detectConflicts(base, local, server)
    expect(result.merged.title).toBe('New Local Title')
    expect(result.canAutoMerge).toBe(true)
  })

  it('should take server change when only server changed', () => {
    const base = { title: 'Old Title', status: 'open' }
    const local = { title: 'Old Title', status: 'open' }
    const server = { title: 'Old Title', status: 'answered' }
    const result = detectConflicts(base, local, server)
    expect(result.merged.status).toBe('answered')
    expect(result.canAutoMerge).toBe(true)
  })

  it('should detect real conflict when both sides changed different values', () => {
    const base = { title: 'Original', status: 'open' }
    const local = { title: 'Local Edit', status: 'open' }
    const server = { title: 'Server Edit', status: 'open' }
    const result = detectConflicts(base, local, server)
    expect(result.canAutoMerge).toBe(false)
    expect(result.conflictingFields).toContain('title')
  })

  it('should auto-merge when both sides changed to same value', () => {
    const base = { title: 'Old', status: 'open' }
    const local = { title: 'Same', status: 'open' }
    const server = { title: 'Same', status: 'open' }
    const result = detectConflicts(base, local, server)
    expect(result.canAutoMerge).toBe(true)
    expect(result.merged.title).toBe('Same')
  })

  it('should skip "id" and "updated_at" fields', () => {
    const base = { id: 'old-id', updated_at: '2025-01-01', title: 'Same' }
    const local = { id: 'local-id', updated_at: '2026-01-01', title: 'Same' }
    const server = { id: 'server-id', updated_at: '2026-06-01', title: 'Same' }
    const result = detectConflicts(base, local, server)
    expect(result.canAutoMerge).toBe(true)
    expect(result.conflictingFields).not.toContain('id')
    expect(result.conflictingFields).not.toContain('updated_at')
  })

  it('should handle multiple fields with mixed conflict states', () => {
    const base = { title: 'A', status: 'open', priority: 'low' }
    const local = { title: 'B', status: 'open', priority: 'high' } // title and priority changed
    const server = { title: 'C', status: 'closed', priority: 'low' } // title and status changed
    const result = detectConflicts(base, local, server)
    // title: both changed differently => conflict
    // status: only server changed => server wins
    // priority: only local changed => local wins
    expect(result.conflictingFields).toContain('title')
    expect(result.conflictingFields).not.toContain('status')
    expect(result.conflictingFields).not.toContain('priority')
    expect(result.merged.status).toBe('closed')
    expect(result.merged.priority).toBe('high')
  })

  it('should handle nested objects via JSON stringify comparison', () => {
    const base = { metadata: { tags: ['a', 'b'] } }
    const local = { metadata: { tags: ['a', 'b', 'c'] } }
    const server = { metadata: { tags: ['a', 'b'] } }
    const result = detectConflicts(base, local, server)
    expect(result.merged.metadata).toEqual({ tags: ['a', 'b', 'c'] })
    expect(result.canAutoMerge).toBe(true)
  })

  it('should start merged from server state', () => {
    const base = { a: 1, b: 2 }
    const local = { a: 1, b: 2 }
    const server = { a: 10, b: 20 }
    const result = detectConflicts(base, local, server)
    expect(result.merged.a).toBe(10)
    expect(result.merged.b).toBe(20)
  })
})

// ── resolveConflict ───────────────────────────────────────────

function makeConflict(overrides: Partial<ConflictRecord> = {}): ConflictRecord {
  return {
    id: 'conflict-1',
    table: 'rfis',
    record_id: 'rfi-001',
    local_version: { title: 'Local Title', status: 'open', priority: 'high' },
    server_version: { title: 'Server Title', status: 'answered', priority: 'low' },
    base_version: { title: 'Base Title', status: 'open', priority: 'low' },
    conflicting_fields: ['title', 'priority'],
    resolved: false,
    resolution: null,
    ...overrides,
  }
}

describe('resolveConflict', () => {
  it('should return local version when resolution is "local"', () => {
    const conflict = makeConflict()
    const result = resolveConflict(conflict, 'local')
    expect(result.title).toBe('Local Title')
    expect(result.status).toBe('open')
    expect(result.priority).toBe('high')
  })

  it('should return server version when resolution is "server"', () => {
    const conflict = makeConflict()
    const result = resolveConflict(conflict, 'server')
    expect(result.title).toBe('Server Title')
    expect(result.status).toBe('answered')
    expect(result.priority).toBe('low')
  })

  it('should return entire local_version object for local resolution', () => {
    const conflict = makeConflict({
      local_version: { id: 'rfi-1', title: 'Local', notes: 'extra field' },
    })
    const result = resolveConflict(conflict, 'local')
    expect(result).toEqual({ id: 'rfi-1', title: 'Local', notes: 'extra field' })
  })

  it('should return entire server_version object for server resolution', () => {
    const conflict = makeConflict({
      server_version: { id: 'rfi-1', title: 'Server', status: 'closed' },
    })
    const result = resolveConflict(conflict, 'server')
    expect(result).toEqual({ id: 'rfi-1', title: 'Server', status: 'closed' })
  })

  it('should ignore fieldResolutions when resolution is "server" (early return)', () => {
    // NOTE: The per-field merge code path is unreachable with the current 'local'|'server' type
    // because both branches return early. fieldResolutions are silently ignored.
    const conflict = makeConflict()
    const result = resolveConflict(conflict, 'server', { title: 'local' })
    // Returns entire server_version, not the per-field merged result
    expect(result.title).toBe('Server Title') // server, not local
  })
})

// ── checkStaleSubmission ──────────────────────────────────────

describe('checkStaleSubmission', () => {
  it('should return isStale false when server unchanged', () => {
    const beforeState = { title: 'Original', status: 'open' }
    const serverState = { title: 'Original', status: 'open' }
    const localEdits = { title: 'My Edit', status: 'open' }
    const result = checkStaleSubmission(beforeState, serverState, localEdits)
    expect(result.isStale).toBe(false)
    expect(result.canAutoMerge).toBe(true)
  })

  it('should return localEdits as merged when not stale', () => {
    const before = { title: 'A' }
    const server = { title: 'A' }
    const local = { title: 'B' }
    const result = checkStaleSubmission(before, server, local)
    expect(result.merged.title).toBe('B')
  })

  it('should return isStale true when server has changed', () => {
    const beforeState = { title: 'Original', status: 'open' }
    const serverState = { title: 'Server Changed', status: 'open' }
    const localEdits = { title: 'Local Edit', status: 'open' }
    const result = checkStaleSubmission(beforeState, serverState, localEdits)
    expect(result.isStale).toBe(true)
  })

  it('should return canAutoMerge true when non-overlapping changes', () => {
    const before = { title: 'A', status: 'open', priority: 'low' }
    const server = { title: 'A', status: 'closed', priority: 'low' } // server changed status
    const local = { title: 'A', status: 'open', priority: 'high' }   // local changed priority
    const result = checkStaleSubmission(before, server, local)
    expect(result.isStale).toBe(true)
    expect(result.canAutoMerge).toBe(true)
  })

  it('should return canAutoMerge false when overlapping changes', () => {
    const before = { title: 'A', status: 'open' }
    const server = { title: 'Server Edit', status: 'open' }
    const local = { title: 'Local Edit', status: 'open' }
    const result = checkStaleSubmission(before, server, local)
    expect(result.isStale).toBe(true)
    expect(result.canAutoMerge).toBe(false)
    expect(result.conflictingFields).toContain('title')
  })

  it('should ignore updated_at and id in staleness check', () => {
    const before = { id: 'x', updated_at: '2025-01-01', title: 'A' }
    const server = { id: 'x', updated_at: '2026-01-01', title: 'A' }
    const local = { id: 'x', updated_at: '2025-01-01', title: 'A' }
    const result = checkStaleSubmission(before, server, local)
    expect(result.isStale).toBe(false)
  })
})

// ── buildMergedRecord ─────────────────────────────────────────

describe('buildMergedRecord', () => {
  it('should apply auto-merge then override with field resolutions', () => {
    const base = { title: 'Base', status: 'open', priority: 'low' }
    const local = { title: 'Local', status: 'open', priority: 'high' } // local changed title + priority
    const server = { title: 'Base', status: 'closed', priority: 'low' } // server changed status
    const fieldResolutions = { priority: 'local' as const }

    const result = buildMergedRecord(base, local, server, fieldResolutions)
    // Auto-merge: title stays local (only local changed), status takes server (only server changed)
    // Field resolution: priority uses local
    expect(result.status).toBe('closed')  // server
    expect(result.title).toBe('Local')   // local (auto-merged)
    expect(result.priority).toBe('high') // local (manual resolution)
  })

  it('should apply server resolution from fieldResolutions', () => {
    const base = { value: 'A' }
    const local = { value: 'B' }
    const server = { value: 'C' }
    const result = buildMergedRecord(base, local, server, { value: 'server' })
    expect(result.value).toBe('C')
  })

  it('should apply local resolution from fieldResolutions', () => {
    const base = { value: 'A' }
    const local = { value: 'B' }
    const server = { value: 'C' }
    const result = buildMergedRecord(base, local, server, { value: 'local' })
    expect(result.value).toBe('B')
  })

  it('should return server as base when no field resolutions', () => {
    const base = { a: 1, b: 2 }
    const local = { a: 1, b: 2 }
    const server = { a: 10, b: 20 }
    const result = buildMergedRecord(base, local, server, {})
    expect(result.a).toBe(10)
    expect(result.b).toBe(20)
  })
})
