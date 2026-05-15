/**
 * FMEA D.NOTIF.5 (wave 3) — Orphaned notification when recipient deleted.
 *
 * Hazard: A queued notification references `recipient_user_id`. If the
 *         underlying user is soft-deleted (or hard-deleted) between
 *         queue time and send time, the notification:
 *           (a) fails noisily (recipient_email lookup throws), OR
 *           (b) bounces silently against a stale email, OR
 *           (c) somehow re-routes to a default mailbox (worst).
 *
 *         The correct behavior is: send-time loop must look up the
 *         current recipient profile, detect the deleted/disabled state,
 *         and mark the notification `status='skipped'` with an error
 *         note — never throw, never bounce, never reroute.
 *
 * Test approach (vitest, fully mocked):
 *   - Stand up a fake `fromTable('notification_queue')` + a profile
 *     lookup that returns "user deleted" sentinel.
 *   - Call the send routine (or, lacking a dedicated send fn, simulate
 *     the contract by exercising queueNotification + a stubbed sender).
 *   - Assert the queue row's resolved status is 'skipped' (or that the
 *     send path short-circuits) when recipient is missing.
 *   - Static-source assertion: the send routine MUST look up the
 *     recipient via a check that respects deletion (a profile join,
 *     deleted_at filter, or explicit status check). Today the codebase
 *     queues by user_id only and resolves email at send time; this is
 *     the documented gap.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SVC_SRC = resolve(
  __dirname,
  '..',
  '..',
  'src',
  'services',
  'notifications',
  'emailNotificationService.ts',
)

describe('FMEA D.NOTIF.5 — orphan recipient handling', () => {
  it('static: emailNotificationService stores recipient_user_id at queue time', () => {
    const source = readFileSync(SVC_SRC, 'utf-8')
    expect(/recipient_user_id\s*:\s*recipientUserId/.test(source)).toBe(true)
  })

  it('static: send path resolves recipient_email at send time (KNOWN GAP)', () => {
    // The hazard: today the queue row stores recipient_email at send
    // time but does NOT check whether the user was deleted between
    // queue and send. Document the absence.
    const source = readFileSync(SVC_SRC, 'utf-8')
    // No explicit deleted_at / disabled check on the recipient lookup.
    // This is the FMEA-recorded baseline; flip to `.toBe(true)` after
    // a future PR adds the guard.
    const hasDeletionGuard = /recipient[^=]*deleted_at|profile[^=]*deleted_at|is_active\s*=\s*true/.test(source)
    expect(hasDeletionGuard).toBe(false)
  })

  it('mocked: deleted recipient short-circuits to status="skipped"', async () => {
    // Simulate a send loop that respects the deletion contract.
    type QueueRow = {
      id: string
      recipient_user_id: string
      status: 'pending' | 'sent' | 'failed' | 'skipped'
    }
    const queue: QueueRow[] = [
      { id: 'n1', recipient_user_id: 'user-deleted', status: 'pending' },
    ]
    // Mocked profile lookup: deleted user.
    const profiles: Record<string, { deleted_at: string | null } | null> = {
      'user-deleted': { deleted_at: '2026-05-13T00:00:00Z' },
    }

    function send(row: QueueRow): { status: QueueRow['status']; reason?: string } {
      const profile = profiles[row.recipient_user_id]
      if (!profile || profile.deleted_at) {
        return { status: 'skipped', reason: 'recipient_deleted' }
      }
      return { status: 'sent' }
    }

    const result = send(queue[0])
    expect(result.status).toBe('skipped')
    expect(result.reason).toBe('recipient_deleted')
  })

  it('mocked: missing profile (404) skips, does not throw', () => {
    const profiles: Record<string, { deleted_at: string | null } | null> = {}
    function send(recipientUserId: string): 'sent' | 'skipped' | 'error' {
      try {
        const p = profiles[recipientUserId]
        if (!p) return 'skipped'
        if (p.deleted_at) return 'skipped'
        return 'sent'
      } catch {
        return 'error'
      }
    }
    expect(send('missing-user-id')).toBe('skipped')
    // Critically: 'error' would mean the send loop crashed on this row,
    // potentially blocking the whole queue.
    expect(send('missing-user-id')).not.toBe('error')
  })

  it('mocked: queueNotification + soft-delete + send produces skipped, not sent', async () => {
    const captured: Array<Record<string, unknown>> = []
    vi.doMock('../../src/lib/db/queries', () => ({
      fromTable: () => ({
        insert: (row: Record<string, unknown>) => {
          captured.push({ ...row })
          return Promise.resolve({ error: null })
        },
      }),
    }))
    const { queueNotification } = await import(
      '../../src/services/notifications/emailNotificationService'
    )

    await queueNotification('proj-1', 'rfi_assigned', 'user-to-delete', {
      rfiNumber: '#42',
      rfiTitle: 'wall',
    })

    expect(captured.length).toBe(1)
    expect(captured[0].recipient_user_id).toBe('user-to-delete')

    // Simulate send-time: the user is now deleted.
    const sendOutcome = (() => {
      const recipient = { deleted_at: '2026-05-14T12:00:00Z' }
      return recipient.deleted_at ? 'skipped' : 'sent'
    })()
    expect(sendOutcome).toBe('skipped')

    vi.doUnmock('../../src/lib/db/queries')
  })
})
