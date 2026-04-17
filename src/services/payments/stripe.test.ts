import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------
const mockGetSession = vi.fn()
const mockFrom = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

import {
  calculatePlatformFee,
  createPayment,
  confirmPayment,
  holdRetainage,
  releaseRetainage,
  getPaymentHistory,
  createConnectedAccount,
  getAccountStatus,
} from './stripe'

// ---------------------------------------------------------------------------
// Fetch mock
// ---------------------------------------------------------------------------
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeFetchOk(data: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
}

function makeFetchError(errorMsg: string, status = 400) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: errorMsg }),
  })
}

function makeChain(listData: unknown, error: unknown = null) {
  const result = { data: listData, error }
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(result)
  chain.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return chain
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok-abc' } } })
  })

  // ── calculatePlatformFee ─────────────────────────────────────────────────
  describe('calculatePlatformFee', () => {
    it('charges 1.5% for card payments', () => {
      expect(calculatePlatformFee(100000, 'card')).toBe(1500) // $1000 × 1.5% = $15
    })

    it('charges 0.5% for ach_debit under the cap', () => {
      expect(calculatePlatformFee(60000, 'ach_debit')).toBe(300) // $600 × 0.5% = $3
    })

    it('caps ACH debit fee at $5 (500 cents)', () => {
      expect(calculatePlatformFee(500000, 'ach_debit')).toBe(500) // $5000 × 0.5% = $25, capped at $5
    })

    it('caps ACH credit fee at $5 (500 cents)', () => {
      expect(calculatePlatformFee(200000, 'ach_credit')).toBe(500)
    })

    it('charges 0 for wire transfers', () => {
      expect(calculatePlatformFee(1000000, 'wire')).toBe(0)
    })

    it('handles zero amount', () => {
      expect(calculatePlatformFee(0, 'card')).toBe(0)
    })
  })

  // ── createPayment ─────────────────────────────────────────────────────────
  describe('createPayment', () => {
    const params = {
      applicationId: 'app-1',
      projectId: 'proj-1',
      amount: 100000,
      paymentMethod: 'card' as const,
      recipientAccountId: 'acct_123',
      description: 'Pay app #3',
    }

    it('creates a payment and returns success for succeeded status', async () => {
      mockFetch.mockReturnValue(makeFetchOk({ paymentIntentId: 'pi_123', clientSecret: 'sec', status: 'succeeded' }))

      const result = await createPayment(params)

      expect(result.success).toBe(true)
      expect(result.paymentIntentId).toBe('pi_123')
      expect(result.status).toBe('succeeded')
    })

    it('returns success=true for processing status', async () => {
      mockFetch.mockReturnValue(makeFetchOk({ paymentIntentId: 'pi_456', status: 'processing' }))

      const result = await createPayment({ ...params, paymentMethod: 'ach_debit' })

      expect(result.success).toBe(true)
    })

    it('passes correct platform fee in the request body', async () => {
      mockFetch.mockReturnValue(makeFetchOk({ paymentIntentId: 'pi_789', status: 'succeeded' }))

      await createPayment(params)

      const [, requestInit] = mockFetch.mock.calls[0]
      const body = JSON.parse(requestInit.body as string)
      expect(body.platformFee).toBe(1500) // 1.5% of 100000
    })

    it('throws when user is not authenticated', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } })

      await expect(createPayment(params)).rejects.toThrow('Not authenticated')
    })

    it('throws with server error message on non-ok response', async () => {
      mockFetch.mockReturnValue(makeFetchError('Insufficient funds'))

      await expect(createPayment(params)).rejects.toThrow('Insufficient funds')
    })
  })

  // ── confirmPayment ────────────────────────────────────────────────────────
  describe('confirmPayment', () => {
    it('confirms and returns success', async () => {
      mockFetch.mockReturnValue(makeFetchOk({ paymentIntentId: 'pi_123', status: 'succeeded' }))

      const result = await confirmPayment('pi_123')

      expect(result.success).toBe(true)
      expect(result.paymentIntentId).toBe('pi_123')
    })

    it('returns success=false for failed status', async () => {
      mockFetch.mockReturnValue(makeFetchOk({ paymentIntentId: 'pi_123', status: 'failed' }))

      const result = await confirmPayment('pi_123')

      expect(result.success).toBe(false)
    })
  })

  // ── holdRetainage ─────────────────────────────────────────────────────────
  describe('holdRetainage', () => {
    it('creates retainage hold and returns created status', async () => {
      mockFetch.mockReturnValue(makeFetchOk({ holdId: 'hold_abc' }))

      const result = await holdRetainage({
        projectId: 'proj-1',
        contractId: 'contract-1',
        amount: 50000,
        recipientAccountId: 'acct_123',
        description: '10% retainage hold',
      })

      expect(result.success).toBe(true)
      expect(result.paymentIntentId).toBe('hold_abc')
      expect(result.status).toBe('created')
    })
  })

  // ── releaseRetainage ──────────────────────────────────────────────────────
  describe('releaseRetainage', () => {
    it('releases retainage and returns success', async () => {
      mockFetch.mockReturnValue(makeFetchOk({ paymentIntentId: 'pi_rel', status: 'succeeded' }))

      const result = await releaseRetainage({
        holdId: 'hold_abc',
        projectId: 'proj-1',
        amount: 50000,
        recipientAccountId: 'acct_123',
      })

      expect(result.success).toBe(true)
      expect(result.paymentIntentId).toBe('pi_rel')
    })
  })

  // ── getPaymentHistory ─────────────────────────────────────────────────────
  describe('getPaymentHistory', () => {
    it('returns formatted payment history', async () => {
      const rows = [
        {
          id: 'txn-1',
          amount: 100000,
          platform_fee: 1500,
          payment_method: 'card',
          status: 'succeeded',
          recipient_name: 'ACME Electrical',
          application_number: 3,
          created_at: '2024-06-01T00:00:00Z',
        },
      ]
      mockFrom.mockReturnValue(makeChain(rows))

      const history = await getPaymentHistory('proj-1')

      expect(history).toHaveLength(1)
      expect(history[0].amount).toBe(100000)
      expect(history[0].fee).toBe(1500)
      expect(history[0].recipientName).toBe('ACME Electrical')
      expect(history[0].applicationNumber).toBe(3)
    })

    it('returns empty array when no transactions', async () => {
      mockFrom.mockReturnValue(makeChain(null))

      const history = await getPaymentHistory('proj-1')

      expect(history).toEqual([])
    })

    it('throws on database error', async () => {
      mockFrom.mockReturnValue(makeChain(null, new Error('DB error')))

      await expect(getPaymentHistory('proj-1')).rejects.toBeDefined()
    })

    it('defaults missing fee and application_number to 0', async () => {
      const rows = [{
        id: 'txn-2', amount: 5000, platform_fee: null,
        payment_method: 'wire', status: 'succeeded',
        recipient_name: null, application_number: null,
        created_at: '2024-06-02T00:00:00Z',
      }]
      mockFrom.mockReturnValue(makeChain(rows))

      const [item] = await getPaymentHistory('proj-2')

      expect(item.fee).toBe(0)
      expect(item.applicationNumber).toBe(0)
      expect(item.recipientName).toBe('')
    })
  })

  // ── createConnectedAccount ────────────────────────────────────────────────
  describe('createConnectedAccount', () => {
    it('returns accountId and onboardingUrl', async () => {
      mockFetch.mockReturnValue(makeFetchOk({ accountId: 'acct_new', onboardingUrl: 'https://connect.stripe.com/setup/abc' }))

      const result = await createConnectedAccount('ACME Corp', 'acme@example.com', 'proj-1')

      expect(result.accountId).toBe('acct_new')
      expect(result.onboardingUrl).toBe('https://connect.stripe.com/setup/abc')
    })
  })
})
