import { describe, it, expect, vi, beforeEach } from 'vitest'
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

// ── Supabase mock ─────────────────────────────────────────

const mockFrom = vi.fn()
const mockGetSession = vi.fn()
const mockRpc = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getSession: (...args: unknown[]) => mockGetSession(...args) },
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

// ── Chain factory ─────────────────────────────────────────

function makeChain(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const chain: Record<string, unknown> = {
    then: (resolve: (v: typeof result) => unknown, reject?: (r: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
    catch: (reject: (r: unknown) => unknown) => Promise.resolve(result).catch(reject),
  }
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(result)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.gte = vi.fn().mockReturnValue(chain)
  chain.lte = vi.fn().mockReturnValue(chain)
  return chain
}

// ── Tests ─────────────────────────────────────────────────

describe('getPlans', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps DB rows into Plan objects', async () => {
    const dbRow = {
      id: 'plan-starter',
      name: 'Starter',
      description: 'Small teams',
      price_monthly: 99,
      price_annual: 990,
      max_projects: 5,
      max_users: 10,
      max_storage_gb: 50,
      ai_copilot: false,
      integrations: false,
      custom_reports: false,
      sso: false,
      api_access: false,
      ai_per_page_rate: 0.1,
      payment_processing_rate: 0.02,
    }
    mockFrom.mockReturnValue(makeChain({ data: [dbRow], error: null }))

    const plans = await getPlans()

    expect(plans).toHaveLength(1)
    expect(plans[0].id).toBe('plan-starter')
    expect(plans[0].priceMonthly).toBe(99)
    expect(plans[0].priceAnnual).toBe(990)
    expect(plans[0].aiCopilot).toBe(false)
    expect(plans[0].customReports).toBe(false)
  })

  it('returns empty array when no active plans exist', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }))
    const plans = await getPlans()
    expect(plans).toEqual([])
  })

  it('throws when Supabase returns an error', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'relation not found' } }))
    await expect(getPlans()).rejects.toMatchObject({ message: 'relation not found' })
  })
})

describe('getSubscription', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a mapped Subscription when found', async () => {
    const dbRow = {
      id: 'sub-1',
      organization_id: 'org-abc',
      plan_id: 'plan-pro',
      status: 'active',
      billing_cycle: 'annual',
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_xyz',
      trial_ends_at: null,
      current_period_start: '2026-04-01',
      current_period_end: '2027-04-01',
      canceled_at: null,
    }
    mockFrom.mockReturnValue(makeChain({ data: dbRow, error: null }))

    const sub = await getSubscription('org-abc')

    expect(sub).not.toBeNull()
    expect(sub!.organizationId).toBe('org-abc')
    expect(sub!.status).toBe('active')
    expect(sub!.billingCycle).toBe('annual')
    expect(sub!.stripeCustomerId).toBe('cus_123')
  })

  it('returns null when no subscription exists', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'No rows' } }))
    const sub = await getSubscription('org-missing')
    expect(sub).toBeNull()
  })
})

describe('createCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('throws when user is not authenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    await expect(createCheckoutSession('org-1', 'plan-pro', 'monthly')).rejects.toThrow('Not authenticated')
  })

  it('returns the checkout URL on success', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok_valid' } } })
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: 'https://checkout.stripe.com/c/pay/cs_test_123' }),
    } as Response)

    const result = await createCheckoutSession('org-1', 'plan-pro', 'monthly')
    expect(result.url).toBe('https://checkout.stripe.com/c/pay/cs_test_123')
  })

  it('throws on HTTP error from billing endpoint', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok_valid' } } })
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Plan not found' }),
    } as Response)

    await expect(createCheckoutSession('org-1', 'bad-plan', 'monthly')).rejects.toThrow('Plan not found')
  })
})

describe('createPortalSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('throws when user is not authenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    await expect(createPortalSession('org-1')).rejects.toThrow('Not authenticated')
  })

  it('returns portal URL on success', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok_abc' } } })
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: 'https://billing.stripe.com/p/session_abc' }),
    } as Response)

    const result = await createPortalSession('org-1')
    expect(result.url).toContain('billing.stripe.com')
  })
})

describe('checkPlanLimit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the RPC result when within limit', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    const result = await checkPlanLimit('org-1', 'projects')

    expect(result).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('check_plan_limit', {
      p_organization_id: 'org-1',
      p_limit_type: 'projects',
    })
  })

  it('fails open (returns true) on RPC error to avoid blocking operations', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'function not found' } })

    const result = await checkPlanLimit('org-1', 'users')

    expect(result).toBe(true)
  })
})

describe('checkFeatureAccess', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true when the feature is enabled on the active plan', async () => {
    mockFrom.mockReturnValue(makeChain({ data: { plan: { ai_copilot: true } }, error: null }))

    const result = await checkFeatureAccess('org-1', 'ai_copilot')
    expect(result).toBe(true)
  })

  it('returns false when the feature is not enabled', async () => {
    mockFrom.mockReturnValue(makeChain({ data: { plan: { sso: false } }, error: null }))

    const result = await checkFeatureAccess('org-1', 'sso')
    expect(result).toBe(false)
  })

  it('returns false when subscription is not found', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'no active subscription' } }))

    const result = await checkFeatureAccess('org-1', 'integrations')
    expect(result).toBe(false)
  })
})

describe('trackUsage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts usage event with correct unit price for ai_page_processed', async () => {
    const subChain = makeChain({ data: { plan: { ai_per_page_rate: 0.15, payment_processing_rate: 0.025 } }, error: null })
    const insertChain = makeChain({ data: null, error: null })
    mockFrom
      .mockReturnValueOnce(subChain)
      .mockReturnValueOnce(insertChain)

    await trackUsage('org-1', 'ai_page_processed', 3)

    expect((insertChain.insert as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'org-1',
        event_type: 'ai_page_processed',
        quantity: 3,
        unit_price: 0.15,
      }),
    )
  })

  it('sets unit_price to 0 for non-priced event types', async () => {
    const subChain = makeChain({ data: { plan: { ai_per_page_rate: 0.1 } }, error: null })
    const insertChain = makeChain({ data: null, error: null })
    mockFrom
      .mockReturnValueOnce(subChain)
      .mockReturnValueOnce(insertChain)

    await trackUsage('org-1', 'report_generated', 1)

    expect((insertChain.insert as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ unit_price: 0 }),
    )
  })
})

describe('getUsageSummary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('aggregates events by type with correct totals', async () => {
    const events = [
      { event_type: 'ai_page_processed', quantity: 5, unit_price: 0.1 },
      { event_type: 'ai_page_processed', quantity: 3, unit_price: 0.1 },
      { event_type: 'report_generated', quantity: 2, unit_price: 0 },
    ]
    mockFrom.mockReturnValue(makeChain({ data: events, error: null }))

    const summary = await getUsageSummary('org-1')

    const aiEntry = summary.find((s) => s.eventType === 'ai_page_processed')
    expect(aiEntry!.totalQuantity).toBe(8)
    expect(aiEntry!.totalAmount).toBeCloseTo(0.8)

    const reportEntry = summary.find((s) => s.eventType === 'report_generated')
    expect(reportEntry!.totalQuantity).toBe(2)
    expect(reportEntry!.totalAmount).toBe(0)
  })

  it('returns empty array when no events exist', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }))
    const summary = await getUsageSummary('org-1')
    expect(summary).toEqual([])
  })

  it('throws on database error', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'Query failed' } }))
    await expect(getUsageSummary('org-1')).rejects.toMatchObject({ message: 'Query failed' })
  })
})
