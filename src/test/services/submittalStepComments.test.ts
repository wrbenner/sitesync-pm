// Phase 7c-1 — submittalStepComments service tests.
//
// Pure-function tests for collapseEditHistory + getEditHistory. The RPC
// wrapper paths are validated by the migration smoke test (env-gated)
// in src/test/integration/submittal-multi-approval-migration.test.ts.

import { describe, it, expect } from 'vitest'
import {
  collapseEditHistory,
  getEditHistory,
  type StepComment,
} from '../../services/submittalStepComments'

const mk = (over: Partial<StepComment> = {}): StepComment => ({
  id: String(over.id ?? Math.random()),
  reviewer_step_id: 'step-1',
  author_id: 'user-1',
  body_md: 'body',
  attachments: [],
  mentions: [],
  parent_comment_id: null,
  is_deleted: false,
  reason_code: null,
  created_at: '2026-05-01T00:00:00Z',
  ...over,
})

describe('collapseEditHistory', () => {
  it('returns empty for empty input', () => {
    expect(collapseEditHistory([])).toEqual([])
  })

  it('keeps non-edited comments unchanged + sorted by creation', () => {
    const c1 = mk({ id: 'c1', body_md: 'first', created_at: '2026-05-01T10:00:00Z' })
    const c2 = mk({ id: 'c2', body_md: 'second', created_at: '2026-05-01T11:00:00Z' })
    const r = collapseEditHistory([c2, c1])
    expect(r.map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('collapses an edit chain to the latest leaf', () => {
    const root = mk({ id: 'root', body_md: 'v1', created_at: '2026-05-01T10:00:00Z' })
    const v2 = mk({ id: 'v2', body_md: 'v2', parent_comment_id: 'root', created_at: '2026-05-01T11:00:00Z' })
    const v3 = mk({ id: 'v3', body_md: 'v3', parent_comment_id: 'v2', created_at: '2026-05-01T12:00:00Z' })
    const r = collapseEditHistory([root, v2, v3])
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('v3')
    expect(r[0].body_md).toBe('v3')
  })

  it('preserves order by chain root creation, not by latest edit', () => {
    const a = mk({ id: 'a', body_md: 'a-v1', created_at: '2026-05-01T10:00:00Z' })
    const aV2 = mk({ id: 'a2', body_md: 'a-v2', parent_comment_id: 'a', created_at: '2026-05-01T13:00:00Z' })
    const b = mk({ id: 'b', body_md: 'b', created_at: '2026-05-01T11:00:00Z' })
    const r = collapseEditHistory([a, aV2, b])
    // Order = chain-root creation: a (10:00) < b (11:00). a-v2 wins inside a's chain.
    expect(r.map((c) => c.id)).toEqual(['a2', 'b'])
  })

  it('surfaces a deleted leaf so the UI can render a tombstone', () => {
    const root = mk({ id: 'root', created_at: '2026-05-01T10:00:00Z' })
    const del = mk({ id: 'del', parent_comment_id: 'root', is_deleted: true, created_at: '2026-05-01T11:00:00Z' })
    const r = collapseEditHistory([root, del])
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('del')
    expect(r[0].is_deleted).toBe(true)
  })

  it('handles a cycle defensively (returns the cycle entry as the root)', () => {
    // Pathological: a → b → a. Should not infinite-loop.
    const a = mk({ id: 'a', parent_comment_id: 'b', created_at: '2026-05-01T10:00:00Z' })
    const b = mk({ id: 'b', parent_comment_id: 'a', created_at: '2026-05-01T11:00:00Z' })
    const r = collapseEditHistory([a, b])
    expect(r.length).toBeGreaterThan(0) // doesn't crash
  })
})

describe('getEditHistory', () => {
  it('returns the full chain (oldest → newest) for a chain root', () => {
    const root = mk({ id: 'root', body_md: 'v1', created_at: '2026-05-01T10:00:00Z' })
    const v2 = mk({ id: 'v2', body_md: 'v2', parent_comment_id: 'root', created_at: '2026-05-01T11:00:00Z' })
    const v3 = mk({ id: 'v3', body_md: 'v3', parent_comment_id: 'v2', created_at: '2026-05-01T12:00:00Z' })
    const chain = getEditHistory([root, v2, v3], 'root')
    expect(chain.map((c) => c.id)).toEqual(['root', 'v2', 'v3'])
  })

  it('returns just the root when there are no edits', () => {
    const c = mk({ id: 'c1', created_at: '2026-05-01T10:00:00Z' })
    expect(getEditHistory([c], 'c1')).toEqual([c])
  })

  it('returns empty when the root is unknown', () => {
    expect(getEditHistory([], 'unknown')).toEqual([])
  })
})
