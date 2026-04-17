import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------
const mockFrom = vi.fn()
const mockFunctionsInvoke = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: { invoke: (...args: unknown[]) => mockFunctionsInvoke(...args) },
  },
}))

import {
  queueNotification,
  getUserNotificationPreferences,
  processNotificationQueue,
} from './emailNotificationService'

// ---------------------------------------------------------------------------
// Chain builder
// ---------------------------------------------------------------------------
function makeChain(
  listData: unknown[] | null = null,
  error: { message: string } | null = null,
  singleData?: unknown,
) {
  const singleResult = { data: singleData !== undefined ? singleData : null, error }
  const listResult = { data: listData, error }

  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(singleResult)
  chain.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
    Promise.resolve(listResult).then(resolve, reject)
  return chain
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const PENDING_NOTIFICATION = {
  id: 'notif-1',
  project_id: 'proj-1',
  recipient_user_id: 'user-1',
  recipient_email: 'user@example.com',
  trigger: 'rfi_assigned',
  template_data: { rfiNumber: 'RFI-001', rfiTitle: 'Concrete mix question' },
  status: 'pending',
  sent_at: null,
  error: null,
  created_at: '2024-01-01T00:00:00Z',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('emailNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── queueNotification ─────────────────────────────────────────────────────
  describe('queueNotification', () => {
    it('inserts a pending notification into the queue', async () => {
      const chain = makeChain(null)
      mockFrom.mockReturnValue(chain)

      await queueNotification('proj-1', 'rfi_assigned', 'user-1', { rfiNumber: 'RFI-001', rfiTitle: 'Test' })

      expect(mockFrom).toHaveBeenCalledWith('notification_queue')
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ trigger: 'rfi_assigned', status: 'pending' }),
      )
    })

    it('throws when the insert fails', async () => {
      mockFrom.mockReturnValue(makeChain(null, { message: 'insert failed' }))

      await expect(
        queueNotification('proj-1', 'rfi_assigned', 'user-1', {}),
      ).rejects.toThrow('insert failed')
    })
  })

  // ── getUserNotificationPreferences ────────────────────────────────────────
  describe('getUserNotificationPreferences', () => {
    it('returns stored preferences for a user', async () => {
      const stored = {
        user_id: 'user-1',
        rfi_assigned: 'digest',
        rfi_response: 'off',
        rfi_overdue: 'instant',
        submittal_approved: 'instant',
        submittal_revision: 'instant',
        change_order_pending: 'instant',
        daily_log_reminder: 'digest',
        pay_app_review: 'instant',
        punch_item_assigned: 'instant',
        meeting_scheduled: 'off',
      }
      mockFrom.mockReturnValue(makeChain(null, null, stored))

      const prefs = await getUserNotificationPreferences('user-1')

      expect(prefs.rfi_assigned).toBe('digest')
      expect(prefs.rfi_response).toBe('off')
      expect(prefs.daily_log_reminder).toBe('digest')
      expect(prefs.meeting_scheduled).toBe('off')
    })

    it('returns default preferences (all instant) when no record exists', async () => {
      mockFrom.mockReturnValue(makeChain(null, { message: 'no rows' }, null))

      const prefs = await getUserNotificationPreferences('user-no-prefs')

      expect(prefs.rfi_assigned).toBe('instant')
      expect(prefs.pay_app_review).toBe('instant')
      expect(prefs.meeting_scheduled).toBe('instant')
    })

    it('returns defaults when data is null (new user)', async () => {
      mockFrom.mockReturnValue(makeChain(null, null, null))

      const prefs = await getUserNotificationPreferences('new-user')

      expect(prefs.rfi_assigned).toBe('instant')
    })

    it('ignores unknown preference values and keeps defaults', async () => {
      const stored = { user_id: 'user-1', rfi_assigned: 'weekly' } // invalid value
      mockFrom.mockReturnValue(makeChain(null, null, stored))

      const prefs = await getUserNotificationPreferences('user-1')

      // 'weekly' is not a valid value, should fall back to default 'instant'
      expect(prefs.rfi_assigned).toBe('instant')
    })
  })

  // ── processNotificationQueue ──────────────────────────────────────────────
  describe('processNotificationQueue', () => {
    it('does nothing when queue is empty', async () => {
      mockFrom.mockReturnValue(makeChain([]))

      await processNotificationQueue()

      expect(mockFunctionsInvoke).not.toHaveBeenCalled()
    })

    it('sends email for instant-preference notifications', async () => {
      const instantPrefs = {
        rfi_assigned: 'instant', rfi_response: 'instant', rfi_overdue: 'instant',
        submittal_approved: 'instant', submittal_revision: 'instant',
        change_order_pending: 'instant', daily_log_reminder: 'instant',
        pay_app_review: 'instant', punch_item_assigned: 'instant', meeting_scheduled: 'instant',
      }

      mockFunctionsInvoke.mockResolvedValue({ error: null })

      mockFrom
        .mockReturnValueOnce(makeChain([PENDING_NOTIFICATION]))     // pending queue
        .mockReturnValueOnce(makeChain(null, null, instantPrefs))  // preferences (via single())
        .mockReturnValueOnce(makeChain(null))                       // update status to sent

      await processNotificationQueue()

      expect(mockFunctionsInvoke).toHaveBeenCalledWith('send-notification-email', expect.objectContaining({
        body: expect.objectContaining({ recipientEmail: 'user@example.com', trigger: 'rfi_assigned' }),
      }))
    })

    it('skips notification when preference is off', async () => {
      const offPrefs = {
        rfi_assigned: 'off', rfi_response: 'instant', rfi_overdue: 'instant',
        submittal_approved: 'instant', submittal_revision: 'instant',
        change_order_pending: 'instant', daily_log_reminder: 'instant',
        pay_app_review: 'instant', punch_item_assigned: 'instant', meeting_scheduled: 'instant',
      }

      const updateChain = makeChain(null)
      mockFrom
        .mockReturnValueOnce(makeChain([PENDING_NOTIFICATION]))  // pending queue
        .mockReturnValueOnce(makeChain(null, null, offPrefs))    // preferences
        .mockReturnValueOnce(updateChain)                        // update to skipped

      await processNotificationQueue()

      expect(mockFunctionsInvoke).not.toHaveBeenCalled()
      expect(updateChain.update).toHaveBeenCalledWith({ status: 'skipped' })
    })

    it('does not send email for digest preference', async () => {
      const digestPrefs = {
        rfi_assigned: 'digest', rfi_response: 'instant', rfi_overdue: 'instant',
        submittal_approved: 'instant', submittal_revision: 'instant',
        change_order_pending: 'instant', daily_log_reminder: 'instant',
        pay_app_review: 'instant', punch_item_assigned: 'instant', meeting_scheduled: 'instant',
      }

      mockFrom
        .mockReturnValueOnce(makeChain([PENDING_NOTIFICATION]))
        .mockReturnValueOnce(makeChain(null, null, digestPrefs))

      await processNotificationQueue()

      expect(mockFunctionsInvoke).not.toHaveBeenCalled()
    })

    it('marks notification as failed when email function errors', async () => {
      const instantPrefs = {
        rfi_assigned: 'instant', rfi_response: 'instant', rfi_overdue: 'instant',
        submittal_approved: 'instant', submittal_revision: 'instant',
        change_order_pending: 'instant', daily_log_reminder: 'instant',
        pay_app_review: 'instant', punch_item_assigned: 'instant', meeting_scheduled: 'instant',
      }
      const invokeError = { message: 'SMTP failure' }
      mockFunctionsInvoke.mockResolvedValue({ error: invokeError })

      const failChain = makeChain(null)
      mockFrom
        .mockReturnValueOnce(makeChain([PENDING_NOTIFICATION]))
        .mockReturnValueOnce(makeChain(null, null, instantPrefs))
        .mockReturnValueOnce(failChain) // update to failed

      await expect(processNotificationQueue()).rejects.toBeDefined()

      expect(failChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', error: 'SMTP failure' }),
      )
    })

    it('throws when fetching queue fails', async () => {
      mockFrom.mockReturnValue(makeChain(null, { message: 'queue unavailable' }))

      await expect(processNotificationQueue()).rejects.toThrow('queue unavailable')
    })

    it('generates correct subject for rfi_overdue trigger', async () => {
      const overdueNotif = {
        ...PENDING_NOTIFICATION,
        id: 'notif-2',
        trigger: 'rfi_overdue',
        template_data: { rfiNumber: 'RFI-007', daysOverdue: '3' },
      }
      const instantPrefs = Object.fromEntries(
        ['rfi_assigned','rfi_response','rfi_overdue','submittal_approved','submittal_revision',
         'change_order_pending','daily_log_reminder','pay_app_review','punch_item_assigned','meeting_scheduled']
          .map((k) => [k, 'instant'])
      )

      mockFunctionsInvoke.mockResolvedValue({ error: null })
      mockFrom
        .mockReturnValueOnce(makeChain([overdueNotif]))
        .mockReturnValueOnce(makeChain(null, null, instantPrefs))
        .mockReturnValueOnce(makeChain(null))

      await processNotificationQueue()

      const invokeBody = mockFunctionsInvoke.mock.calls[0][1].body
      expect(invokeBody.subject).toContain('OVERDUE')
      expect(invokeBody.subject).toContain('RFI-007')
    })
  })
})
