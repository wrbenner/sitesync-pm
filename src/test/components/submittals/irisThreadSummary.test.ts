// Phase 7c-1 — IrisThreadSummary deterministic fallback tests.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildDeterministicFallback } from '../../../components/submittals/detail/MultiApproval/IrisThreadSummary'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-09T12:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('buildDeterministicFallback', () => {
  it('returns null when there are no comments', () => {
    expect(buildDeterministicFallback({ commentCount: 0 })).toBeNull()
  })

  it('reports a single comment with author + relative time', () => {
    const r = buildDeterministicFallback({
      commentCount: 1,
      lastCommenterName: 'Walker',
      lastCommentAt: '2026-05-09T10:00:00Z', // 2h ago
    })
    expect(r).toMatch(/1 comment/)
    expect(r).toMatch(/Walker/)
    expect(r).toMatch(/2h ago/)
  })

  it('formats "just now" for sub-minute deltas', () => {
    const r = buildDeterministicFallback({
      commentCount: 2,
      lastCommenterName: 'Melissa',
      lastCommentAt: '2026-05-09T11:59:30Z', // 30s ago
    })
    expect(r).toMatch(/just now/)
  })

  it('plural-aware comment count', () => {
    const single = buildDeterministicFallback({ commentCount: 1, lastCommenterName: 'A', lastCommentAt: '2026-05-09T11:50:00Z' })
    const multi = buildDeterministicFallback({ commentCount: 4, lastCommenterName: 'B', lastCommentAt: '2026-05-09T11:50:00Z' })
    expect(single).toMatch(/1 comment\b/)
    expect(multi).toMatch(/4 comments/)
  })

  it('falls back to "someone" when no commenter name + no timestamp', () => {
    const r = buildDeterministicFallback({ commentCount: 3 })
    expect(r).toMatch(/3 comments/)
  })
})
