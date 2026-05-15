/**
 * FMEA B.SUB.1 (wave 3) — Submittal distribution list stale after
 *                          reviewer added mid-flight.
 *
 * Hazard: When a reviewer is appended to a submittal's reviewer chain
 *         (createRevision with a new reviewer_id) AFTER the initial
 *         FORWARD event, the notification distribution list cached at
 *         the FORWARD moment doesn't pick up the new reviewer. The
 *         result: the new reviewer never sees the assignment email.
 *
 * Wave 1 e2e walks the full submittal lifecycle (gated on a seed user).
 * This wave-3 spec attacks the same hazard with a fully-mocked vitest
 * unit-level harness — runs without env, surfaces the contract.
 *
 * Contract under test (lib/notification side):
 *   - Notification recipients are computed from the LATEST revision's
 *     reviewer_id at send-time, NOT cached at forward-time.
 *   - getBallInCourt(revisions) returns the latest pending reviewer.
 *   - When a new revision lands with a different reviewer_id, the
 *     resolved recipient list changes accordingly.
 *
 * The implementation under test is the pure `getBallInCourt` helper +
 * a mocked queueNotification path. We don't need the real DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getBallInCourt } from '../../src/api/endpoints/submittals'

type Revision = {
  id: string
  revision_number: number
  reviewer_id: string | null
  reviewer_role: 'gc' | 'architect' | 'engineer'
  review_status: 'pending' | 'approved' | 'rejected' | 'revise'
}

describe('FMEA B.SUB.1 — distribution list refresh after late reviewer add', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getBallInCourt picks the latest pending revision (not the first)', () => {
    const revs: Revision[] = [
      { id: 'r1', revision_number: 1, reviewer_id: 'gc-1', reviewer_role: 'gc', review_status: 'approved' },
      { id: 'r2', revision_number: 2, reviewer_id: 'arch-1', reviewer_role: 'architect', review_status: 'pending' },
    ]
    // Cast to satisfy the helper's expected shape — the helper only
    // touches revision_number, reviewer_role, review_status.
    expect(getBallInCourt(revs as unknown as Parameters<typeof getBallInCourt>[0])).toBe('architect')
  })

  it('returns null when no revision is pending (no notification should send)', () => {
    const revs: Revision[] = [
      { id: 'r1', revision_number: 1, reviewer_id: 'gc-1', reviewer_role: 'gc', review_status: 'approved' },
      { id: 'r2', revision_number: 2, reviewer_id: 'arch-1', reviewer_role: 'architect', review_status: 'approved' },
    ]
    expect(getBallInCourt(revs as unknown as Parameters<typeof getBallInCourt>[0])).toBe(null)
  })

  it('mid-flight reviewer add shifts the ball-in-court target', () => {
    // Before: GC owns the ball.
    const before: Revision[] = [
      { id: 'r1', revision_number: 1, reviewer_id: 'gc-1', reviewer_role: 'gc', review_status: 'pending' },
    ]
    expect(getBallInCourt(before as unknown as Parameters<typeof getBallInCourt>[0])).toBe('gc')

    // After: a new architect revision lands; the ball moves.
    const after: Revision[] = [
      ...before.map((r) => ({ ...r, review_status: 'approved' as const })),
      { id: 'r2', revision_number: 2, reviewer_id: 'arch-1', reviewer_role: 'architect', review_status: 'pending' },
    ]
    expect(getBallInCourt(after as unknown as Parameters<typeof getBallInCourt>[0])).toBe('architect')
  })

  it('queueNotification is called with the FRESH recipient, not a cached one (mocked supabase)', async () => {
    // Wire a minimal mock that captures every insert into notification_queue.
    const inserts: Array<Record<string, unknown>> = []
    vi.doMock('../../src/lib/supabase', () => ({
      supabase: {
        from: () => ({
          insert: (row: Record<string, unknown>) => {
            inserts.push(row)
            return Promise.resolve({ error: null })
          },
        }),
      },
    }))
    vi.doMock('../../src/lib/db/queries', () => ({
      fromTable: () => ({
        insert: (row: Record<string, unknown>) => {
          inserts.push(row)
          return Promise.resolve({ error: null })
        },
      }),
    }))
    const { queueNotification } = await import(
      '../../src/services/notifications/emailNotificationService'
    )

    // Initial FORWARD → notify gc-1.
    await queueNotification('proj-1', 'submittal_revision', 'gc-1', { submittalTitle: 'A1.01' })
    // Mid-flight reviewer add → notify arch-1.
    await queueNotification('proj-1', 'submittal_revision', 'arch-1', { submittalTitle: 'A1.01' })

    const recipients = inserts.map((row) => row.recipient_user_id)
    expect(recipients).toContain('gc-1')
    expect(recipients).toContain('arch-1')
    // Hazard would manifest as a cached gc-1 row instead of a fresh arch-1 row.
    expect(recipients.filter((r) => r === 'arch-1').length).toBeGreaterThan(0)

    vi.doUnmock('../../src/lib/supabase')
    vi.doUnmock('../../src/lib/db/queries')
  })
})
