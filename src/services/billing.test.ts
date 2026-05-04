import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------
const mockFrom = vi.fn()
const mockRpc = vi.fn()
const mockGetSession = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: { getSession: () => mockGetSession() },
  },
}))

// ---------------------------------------------------------------------------
// fetch mock (for createCheckoutSession / createPortalSession)
// ---------------------------------------------------------------------------
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ---------------------------------------------------------------------------
// Import after mocks are set up
// ---------------------------------------------------------------------------
import {
  getPlans,
  getSubscription,
  createCheckoutSession,
  createPortalSession,
  checkPlanLimit,
  checkFeatureAccess,
  trackUsage,
  getUsageSummary,
} from './billing'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeChain(data: unknown, error: { message: string } | null = null) {
  const chain: Record<string, unknown> = {}
  const resolved = { data, error }
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.gte = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(resolved)
  chain.insert = vi.fn().mockResolvedValue({ data: null, error })
  // Make chain thenable so `await query` resolves to { data, error }
  chain.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
    Promise.resolve(resolved).then(resolve, reject)
  return chain
}

const PLAN = {
  id: 'plan-starter',
  name: 'Starter',
  description: 'Entry plan',
  price_monthly: 9900,
  price_annual: 99000,
  max_projects: 5,
  max_users: 10,
  max_storage_gb: 10,
  ai_copilot: false,
  integrations: false,
  custom_reports: false,
  sso: false,
  api_access: false,
  ai_per_page_rate: 0.10,
  payment_processing_rate: 0.029,
}

const SUB = {
  id: 'sub-1',
  organization_id: 'org-1',
  plan_id: 'plan-starter',
  status: 'active',
  billing_cycle: 'monthly',
  stripe_customer_id: 'cus_abc',
  stripe_subscription_id: 'sub_abc',
  trial_ends_at: null,
  current_period_start: '2026-04-01',
  current_period_end: '2026-05-01',
  canceled_at: null,
}

describe('getPlans', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mapped plan array on success', async () => {
    mockFrom.mockReturnValue(makeChain([PLAN]))

    const plans = await getPlans()

    expect(plans).toHaveLength(1)
    expect(plans[0].id).toBe('plan-starter')
    expect(plans[0].priceMonthly).toBe(9900)
    expect(plans[0].aiCopilot).toBe(false)
  })

  it('throws when supabase returns an error', async () => {
    const chain = makeChain(null, { message: 'DB error' })
    chain.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
      Promise.resolve({ data: null, error: { message: 'DB error' } }).then(resolve, reject)
    mockFrom.mockReturnValue(chain)

    await expect(getPlans()).rejects.toThrow('DB error')
  })
})

describe('getSubscription', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mapped subscription when found', async () => {
    // Use explicit non-thenable chain to avoid Promise resolution edge cases
    const singleFn = vi.fn().mockResolvedValue({ data: SUB, error: null })
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockReturnValue(chain)
    chain.single = singleFn
    mockFrom.mockReturnValue(chain)

    const sub = await getSubscription('org-1')

    expect(sub).not.toBeNull()
    expect(sub?.organizationId).toBe('org-1')
    expect(sub?.status).toBe('active')
    expect(sub?.billingCycle).toBe('monthly')
  })

  it('returns null when subscription not found', async () => {
    const chain = makeChain(null)
    chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found', code: 'PGRST116' } })
    mockFrom.mockReturnValue(chain)

    const sub = await getSubscription('org-missing')
    expect(sub).toBeNull()
  })

  it('returns null on any DB error', async () => {
    const chain = makeChain(null)
    chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'permission denied' } })
    mockFrom.mockReturnValue(chain)

    const sub = await getSubscription('org-bad')
    expect(sub).toBeNull()
  })
})

describe('createCheckoutSession', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls billing/checkout and returns url on success', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok-abc' } } })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://checkout.stripe.com/pay/abc' }),
    })

    const result = await createCheckoutSession('org-1', 'plan-starter', 'monthly')

    expect(result.url).toBe('https://checkout.stripe.com/pay/abc')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/billing/checkout'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('throws when no auth session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    await expect(createCheckoutSession('org-1', 'plan-starter', 'monthly')).rejects.toThrow('Not authenticated')
  })

  it('throws when API returns non-ok response', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok-abc' } } })
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid plan' }),
    })

    await expect(createCheckoutSession('org-1', 'bad-plan', 'monthly')).rejects.toThrow('Invalid plan')
  })
})

describe('createPortalSession', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns portal url on success', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok-xyz' } } })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://billing.stripe.com/session/xyz' }),
    })

    const result = await createPortalSession('org-1')
    expect(result.url).toContain('stripe.com')
  })

  it('throws when no auth session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    await expect(createPortalSession('org-1')).rejects.toThrow('Not authenticated')
  })

  it('throws on non-ok portal response', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok-xyz' } } })
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) })

    await expect(createPortalSession('org-1')).rejects.toThrow('Failed to create portal session')
  })
})

describe('checkPlanLimit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the value from the RPC call', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })

    const withinLimit = await checkPlanLimit('org-1', 'projects')
    expect(withinLimit).toBe(false)
  })

  it('fails open (returns true) when RPC errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'function not found' } })

    const result = await checkPlanLimit('org-1', 'users')
    expect(result).toBe(true)
  })
})

describe('checkFeatureAccess', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true when plan has the feature enabled', async () => {
    const chain = makeChain([{ plan: { ai_copilot: true } }], null)
    chain.single = vi.fn().mockResolvedValue({ data: { plan: { ai_copilot: true } }, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await checkFeatureAccess('org-1', 'ai_copilot')
    expect(result).toBe(true)
  })

  it('returns false when plan does not have the feature', async () => {
    const chain = makeChain(null, null)
    chain.single = vi.fn().mockResolvedValue({ data: { plan: { sso: false } }, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await checkFeatureAccess('org-1', 'sso')
    expect(result).toBe(false)
  })

  it('returns false when no active subscription found', async () => {
    const chain = makeChain(null)
    chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    mockFrom.mockReturnValue(chain)

    const result = await checkFeatureAccess('org-1', 'api_access')
    expect(result).toBe(false)
  })
})

describe('trackUsage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts usage event with ai_per_page_rate for ai_page_processed', async () => {
    const subChain = makeChain(null, null)
    subChain.single = vi.fn().mockResolvedValue({
      data: { plan: { ai_per_page_rate: 0.10, payment_processing_rate: 0.029 } },
      error: null,
    })
    const insertChain = makeChain(null, null)
    insertChain.insert = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(subChain)
      .mockReturnValueOnce(insertChain)

    await expect(trackUsage('org-1', 'ai_page_processed', 5)).resolves.toBeUndefined()
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'ai_page_processed', quantity: 5 }),
    )
  })

  it('inserts with unit_price 0 for non-ai event types', async () => {
    const subChain = makeChain(null, null)
    subChain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'no sub' } })
    const insertChain = makeChain(null, null)
    insertChain.insert = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(subChain)
      .mockReturnValueOnce(insertChain)

    await trackUsage('org-1', 'report_generated')
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ unit_price: 0, quantity: 1 }),
    )
  })
})

describe('getUsageSummary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('aggregates events by event_type', async () => {
    const events = [
      { event_type: 'ai_page_processed', quantity: 3, unit_price: 10 },
      { event_type: 'ai_page_processed', quantity: 2, unit_price: 10 },
      { event_type: 'report_generated', quantity: 1, unit_price: 0 },
    ]
    const chain = makeChain(events)
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: events, error: null }).then(resolve)
    mockFrom.mockReturnValue(chain)

    const summary = await getUsageSummary('org-1')

    const aiEntry = summary.find((s) => s.eventType === 'ai_page_processed')
    expect(aiEntry?.totalQuantity).toBe(5)
    expect(aiEntry?.totalAmount).toBe(50)

    const reportEntry = summary.find((s) => s.eventType === 'report_generated')
    expect(reportEntry?.totalQuantity).toBe(1)
  })

  it('throws when supabase returns an error', async () => {
    const chain = makeChain(null, { message: 'permission denied' })
    chain.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
      Promise.resolve({ data: null, error: { message: 'permission denied' } }).then(resolve, reject)
    mockFrom.mockReturnValue(chain)

    await expect(getUsageSummary('org-1')).rejects.toThrow('permission denied')
  })

  it('returns empty array when no events exist', async () => {
    const chain = makeChain([])
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve)
    mockFrom.mockReturnValue(chain)

    const summary = await getUsageSummary('org-1')
    expect(summary).toEqual([])
  })
})
