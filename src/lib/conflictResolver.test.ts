import { describe, it, expect } from 'vitest'
import {
  detectConflicts,
  resolveConflict,
  checkStaleSubmission,
  buildMergedRecord,
} from './conflictResolver'
import type { ConflictRecord } from '../types/sync'

// conflictResolver implements three-way merge for offline-first edits.
// Every code path here directly affects whether a user's offline changes
// silently overwrite a teammate's edit, so the tests pin every branch
// of the field-by-field decision matrix.

describe('conflictResolver — detectConflicts', () => {
  it('canAutoMerge = true when neither side changed', () => {
    const base = { a: 1, b: 'x' }
    const r = detectConflicts(base, base, base)
    expect(r.canAutoMerge).toBe(true)
    expect(r.conflictingFields).toEqual([])
    expect(r.merged).toEqual(base)
  })

  it('takes local change when only local diverged from base', () => {
    const r = detectConflicts(
      { a: 1, b: 'x' },        // base
      { a: 1, b: 'LOCAL' },     // local changed b
      { a: 1, b: 'x' },         // server unchanged
    )
    expect(r.canAutoMerge).toBe(true)
    expect(r.merged.b).toBe('LOCAL')
  })

  it('takes server change when only server diverged from base', () => {
    const r = detectConflicts(
      { a: 1, b: 'x' },
      { a: 1, b: 'x' },         // local unchanged
      { a: 1, b: 'SERVER' },    // server changed b
    )
    expect(r.canAutoMerge).toBe(true)
    expect(r.merged.b).toBe('SERVER')
  })

  it('non-conflicting when both sides changed to the same value', () => {
    const r = detectConflicts(
      { status: 'open' },
      { status: 'closed' },
      { status: 'closed' },
    )
    expect(r.canAutoMerge).toBe(true)
    expect(r.conflictingFields).toEqual([])
  })

  it('reports the diverging field as a real conflict', () => {
    const r = detectConflicts(
      { title: 'Original', priority: 'low' },
      { title: 'My edit', priority: 'low' },
      { title: 'Their edit', priority: 'low' },
    )
    expect(r.canAutoMerge).toBe(false)
    expect(r.conflictingFields).toEqual(['title'])
  })

  it('ignores `updated_at` and `id` columns even when they differ', () => {
    const r = detectConflicts(
      { id: 'r1', updated_at: '2026-01-01', body: 'A' },
      { id: 'r1', updated_at: '2026-02-01', body: 'A' }, // updated_at moved
      { id: 'r1', updated_at: '2026-03-01', body: 'A' },
    )
    expect(r.canAutoMerge).toBe(true)
    expect(r.conflictingFields).toEqual([])
  })

  it('handles deep-equal nested objects (arrays + objects) correctly', () => {
    const r = detectConflicts(
      { tags: ['a', 'b'], meta: { color: 'red' } },
      { tags: ['a', 'b'], meta: { color: 'red' } },
      { tags: ['a', 'b'], meta: { color: 'red' } },
    )
    expect(r.conflictingFields).toEqual([])
  })

  it('detects array conflicts when both sides edit the array differently', () => {
    const r = detectConflicts(
      { tags: ['a'] },
      { tags: ['a', 'b'] },
      { tags: ['a', 'c'] },
    )
    expect(r.conflictingFields).toEqual(['tags'])
  })

  it('treats null !== undefined the same as JS does', () => {
    const r = detectConflicts(
      { x: null },
      { x: 'set' },
      { x: null },
    )
    expect(r.conflictingFields).toEqual([])
    expect(r.merged.x).toBe('set')
  })

  it('handles a key that appears only on the local side as a local-only change', () => {
    const r = detectConflicts(
      { a: 1 },                   // base — no `b`
      { a: 1, b: 'added' },        // local added `b`
      { a: 1 },                    // server — no `b`
    )
    expect(r.canAutoMerge).toBe(true)
    expect(r.merged.b).toBe('added')
  })
})

describe('conflictResolver — resolveConflict', () => {
  function conflict(): ConflictRecord {
    return {
      id: 'c1', table: 'rfis', record_id: 'r1',
      local_version: { title: 'My edit', priority: 'high' },
      server_version: { title: 'Their edit', priority: 'low' },
      base_version: { title: 'Original', priority: 'medium' },
      conflicting_fields: ['title', 'priority'],
      resolved: false, resolution: null,
    }
  }

  it('"local" returns the entire local version', () => {
    expect(resolveConflict(conflict(), 'local')).toEqual({ title: 'My edit', priority: 'high' })
  })

  it('"server" returns the entire server version', () => {
    expect(resolveConflict(conflict(), 'server')).toEqual({ title: 'Their edit', priority: 'low' })
  })

  it('without fieldResolutions falls back to server version', () => {
    expect(resolveConflict(conflict(), 'server')).toEqual({ title: 'Their edit', priority: 'low' })
  })

  it('fieldResolutions are IGNORED when resolution is "local" or "server" (early-return path)', () => {
    // The function early-returns the entire local/server side before the
    // per-field merge code runs. buildMergedRecord is the right tool when
    // per-field overrides are needed; this test pins the current behaviour.
    const r = resolveConflict(conflict(), 'server', {
      title: 'local',
      priority: 'local',
    })
    expect(r).toEqual({ title: 'Their edit', priority: 'low' })
  })
})

describe('conflictResolver — checkStaleSubmission', () => {
  it('isStale = false (and auto-merge) when server is unchanged from before_state', () => {
    const before = { title: 'A', priority: 'low' }
    const r = checkStaleSubmission(
      before,
      { ...before, updated_at: '2026-01-02' },   // updated_at moves but no real change
      { title: 'My edit', priority: 'low' },
    )
    expect(r.isStale).toBe(false)
    expect(r.canAutoMerge).toBe(true)
    expect(r.merged.title).toBe('My edit')
  })

  it('isStale = true when server actually moved AND there are conflicts', () => {
    const r = checkStaleSubmission(
      { title: 'A', priority: 'low' },
      { title: 'Their edit', priority: 'low' },
      { title: 'My edit',    priority: 'low' },
    )
    expect(r.isStale).toBe(true)
    expect(r.canAutoMerge).toBe(false)
    expect(r.conflictingFields).toEqual(['title'])
  })

  it('isStale = true with canAutoMerge when server changed in non-overlapping fields', () => {
    const r = checkStaleSubmission(
      { title: 'A', priority: 'low' },
      { title: 'A', priority: 'high' },           // server changed priority
      { title: 'My edit', priority: 'low' },     // local changed title
    )
    expect(r.isStale).toBe(true)
    expect(r.canAutoMerge).toBe(true)
    expect(r.merged.title).toBe('My edit')
    expect(r.merged.priority).toBe('high')
  })
})

describe('conflictResolver — buildMergedRecord', () => {
  it('returns the auto-merged base when fieldResolutions is empty', () => {
    const r = buildMergedRecord(
      { a: 1, b: 'x' },
      { a: 1, b: 'LOCAL' },
      { a: 1, b: 'x' },
      {},
    )
    expect(r.b).toBe('LOCAL')
  })

  it('applies per-field user choices on top of the auto-merge result', () => {
    const r = buildMergedRecord(
      { title: 'O', priority: 'low' },
      { title: 'L', priority: 'high' },
      { title: 'S', priority: 'low' },
      { title: 'server', priority: 'local' },
    )
    expect(r).toEqual({ title: 'S', priority: 'high' })
  })

  it('manual resolutions override even non-conflicting auto-merged fields', () => {
    // Only local changed body (auto-merge would take 'L'), but user explicitly chose server.
    const r = buildMergedRecord(
      { body: 'O' },
      { body: 'L' },
      { body: 'O' },
      { body: 'server' },
    )
    expect(r.body).toBe('O')
  })
})
