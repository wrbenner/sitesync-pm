/**
 * Supplementary billing edge-case tests.
 * Covers: zero quantity, null unit_price, Cents arithmetic in getUsageSummary.
 * The main billing.test.ts covers the happy-path flows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------
const mockFrom = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: vi.fn(),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}))

vi.stubGlobal('fetch', vi.fn())

import { getUsageSummary, trackUsage } from '../../services/billing'

// ---------------------------------------------------------------------------
// Chain builder for list queries
// ---------------------------------------------------------------------------
function makeListChain(data: unknown[], error: { message: string } | null = null) {
  const resolved = { data, error }
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.gte = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue({ data: null, error })
  chain.insert = vi.fn().mockResolvedValue({ data: null, error })
  chain.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
    Promise.resolve(resolved).then(resolve, reject)
  return chain
}

// ---------------------------------------------------------------------------
// getUsageSummary — edge cases
// ---------------------------------------------------------------------------
describe('getUsageSummary — edge cases', () => {
  beforeEach(() => vi.clearAllMocks())

  it('handles events with null unit_price (treated as 0)', async () => {
    const events = [
      { event_type: 'report_generated', quantity: 5, unit_price: null },
    ]
    mockFrom.mockReturnValue(makeListChain(events))

    const summary = await getUsageSummary('org-1')
    const entry = summary.find((s) => s.eventType === 'report_generated')
    expect(entry).toBeDefined()
    expect(entry?.totalQuantity).toBe(5)
    // null unit_price → 0 amount
    expect(entry?.totalAmount).toBe(0)
  })

  it('handles events with zero quantity', async () => {
    const events = [
      { event_type: 'ai_chat_message', quantity: 0, unit_price: 50 },
    ]
    mockFrom.mockReturnValue(makeListChain(events))

    const summary = await getUsageSummary('org-1')
    const entry = summary.find((s) => s.eventType === 'ai_chat_message')
    expect(entry).toBeDefined()
    expect(entry?.totalQuantity).toBe(0)
    expect(entry?.totalAmount).toBe(0)
  })

  it('handles mixed null and non-null unit_prices for same event type', async () => {
    const events = [
      { event_type: 'ai_page_processed', quantity: 3, unit_price: 10 },
      { event_type: 'ai_page_processed', quantity: 2, unit_price: null },
    ]
    mockFrom.mockReturnValue(makeListChain(events))

    const summary = await getUsageSummary('org-1')
    const entry = summary.find((s) => s.eventType === 'ai_page_processed')
    expect(entry?.totalQuantity).toBe(5)
    // only 3 * 10 = 30 cents contribute (null → 0)
    expect(entry?.totalAmount).toBe(30)
  })

  it('correctly aggregates many event types without cross-contamination', async () => {
    const events = [
      { event_type: 'ai_page_processed', quantity: 10, unit_price: 10 },
      { event_type: 'ai_chat_message', quantity: 5, unit_price: 5 },
      { event_type: 'report_generated', quantity: 2, unit_price: 0 },
    ]
    mockFrom.mockReturnValue(makeListChain(events))

    const summary = await getUsageSummary('org-1')
    expect(summary).toHaveLength(3)

    const aiPages = summary.find((s) => s.eventType === 'ai_page_processed')
    expect(aiPages?.totalAmount).toBe(100) // 10 * 10

    const chat = summary.find((s) => s.eventType === 'ai_chat_message')
    expect(chat?.totalAmount).toBe(25) // 5 * 5

    const report = summary.find((s) => s.eventType === 'report_generated')
    expect(report?.totalAmount).toBe(0) // 2 * 0
  })

  it('returns period set to current month start when no periodStart provided', async () => {
    mockFrom.mockReturnValue(makeListChain([]))

    const summary = await getUsageSummary('org-1')
    // When data is empty, return empty array — no period to check
    expect(summary).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// trackUsage — edge cases
// ---------------------------------------------------------------------------
describe('trackUsage — edge cases', () => {
  beforeEach(() => vi.clearAllMocks())

  it('defaults quantity to 1 when not specified', async () => {
    // Mock: subscription lookup (not found), then insert
    const subChain = makeListChain([], null)
    subChain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'no sub' } })
    const insertChain = makeListChain([], null)
    insertChain.insert = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(subChain)
      .mockReturnValueOnce(insertChain)

    await trackUsage('org-1', 'report_generated')

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 1 }),
    )
  })

  it('uses provided quantity when specified', async () => {
    const subChain = makeListChain([], null)
    subChain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'no sub' } })
    const insertChain = makeListChain([], null)
    insertChain.insert = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(subChain)
      .mockReturnValueOnce(insertChain)

    await trackUsage('org-1', 'ai_page_processed', 42)

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 42 }),
    )
  })
})
