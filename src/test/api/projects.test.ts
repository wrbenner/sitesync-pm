import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeProjectHealthScore, computeAiConfidenceLevel } from '../../lib/healthScoring'
import { assertProjectAccess } from '../../api/middleware/projectScope'
import { clearTtlCache } from '../../lib/requestDedup'
import type { ProjectMetrics } from '../../types/api'

// ---------------------------------------------------------------------------
// Supabase + org store mocks for assertProjectAccess tests
// ---------------------------------------------------------------------------
const { mockGetUser, mockMaybySingle, mockOrgGetState } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockMaybySingle: vi.fn(),
  mockOrgGetState: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: vi.fn().mockImplementation(() => {
      const chain: unknown = {}
      chain.select = vi.fn().mockReturnValue(chain)
      chain.eq = vi.fn().mockReturnValue(chain)
      chain.maybeSingle = mockMaybySingle
      return chain
    }),
  },
}))

vi.mock('../../stores/organizationStore', () => ({
  useOrganizationStore: { getState: mockOrgGetState },
}))

function makeMetrics(overrides: Partial<ProjectMetrics> = {}): ProjectMetrics {
  return {
    project_id: 'proj-1',
    project_name: 'Test Project',
    contract_value: 1_000_000,
    overall_progress: 50,
    milestones_completed: 3,
    milestones_total: 10,
    schedule_variance_days: 0,
    rfis_open: 2,
    rfis_overdue: 0,
    rfis_total: 5,
    avg_rfi_response_days: 3,
    punch_open: 0,
    punch_total: 10,
    budget_total: 900_000,
    budget_spent: 450_000,
    budget_committed: 50_000,
    crews_active: 3,
    workers_onsite: 12,
    safety_incidents_this_month: 0,
    submittals_pending: 1,
    submittals_approved: 8,
    submittals_total: 10,
    ...overrides,
  }
}

describe('computeProjectHealthScore', () => {
  it('returns 100 when all metrics are perfect', () => {
    // All negative indicators = 0, punch list clean (punch_open=0)
    const metrics = makeMetrics({ schedule_variance_days: 0, rfis_overdue: 0, punch_open: 0 })
    expect(computeProjectHealthScore(metrics)).toBe(100)
  })

  it('reduces score when RFIs are overdue', () => {
    const baseline = makeMetrics({ rfis_overdue: 0 })
    const overdue = makeMetrics({ rfis_overdue: 5 })
    expect(computeProjectHealthScore(overdue)).toBeLessThan(computeProjectHealthScore(baseline)!)
  })

  it('8 overdue RFIs reduce health score below 85', () => {
    // rfiHealth = 100*(1-8/10) = 20, weighted 0.20 => 4
    // perfect schedule (100*0.25=25), budget (100*0.30=30), punch (100*0.15=15), safety (100*0.10=10): total = 84
    const metrics = makeMetrics({ rfis_overdue: 8, schedule_variance_days: 0 })
    expect(computeProjectHealthScore(metrics)).toBeLessThan(85)
  })

  it('reduces score when budget is overspent', () => {
    // budget_spent 10% over budget_total => budgetHealth = 0
    // schedule (100*0.25) + budget (0*0.30) + rfi (100*0.20) + punch (100*0.15) + safety (100*0.10) = 25+0+20+15+10 = 70
    const metrics = makeMetrics({ budget_spent: 990_000, budget_total: 900_000 })
    expect(computeProjectHealthScore(metrics)).toBe(70)
  })

  it('schedule variance of 10 days reduces schedule component', () => {
    // scheduleHealth = 100*(1-10/20) = 50 => 50*0.25=12.5
    // budget on track (100*0.30=30), rfi clean (100*0.20=20), punch clean (100*0.15=15), safety (100*0.10=10) => 87.5 => 88
    const metrics = makeMetrics({ schedule_variance_days: 10, rfis_overdue: 0 })
    expect(computeProjectHealthScore(metrics)).toBe(88)
  })

  it('clamps to 0 when all components are at or beyond their thresholds', () => {
    // schedule >= 20 days, budget >= 10% overrun, rfis_overdue >= 10, punch all open, incidents >= 3
    const metrics = makeMetrics({
      schedule_variance_days: 20,
      rfis_overdue: 10,
      budget_spent: 990_000,
      budget_total: 900_000,
      safety_incidents_this_month: 3,
      punch_open: 10,
      punch_total: 10,
    })
    expect(computeProjectHealthScore(metrics)).toBe(0)
  })
})

describe('computeAiConfidenceLevel', () => {
  it('returns 100 when all five data sources are populated', () => {
    const metrics = makeMetrics()
    expect(computeAiConfidenceLevel(metrics)).toBe(100)
  })

  it('returns 80 when one of the five sources is absent', () => {
    // schedule_variance_days=null removes the schedule source
    const metrics = makeMetrics({ schedule_variance_days: null })
    expect(computeAiConfidenceLevel(metrics)).toBe(80)
  })

  it('returns null when fewer than 3 data sources are populated', () => {
    // Only 2 sources: budget_total + rfis_total; others absent/zero
    const sparse = {
      project_id: 'proj-sparse',
      project_name: 'Sparse Project',
      schedule_variance_days: null,
      budget_total: 500_000,
      budget_spent: 0,
      budget_committed: 0,
      rfis_total: 3,
      rfis_open: 0,
      rfis_overdue: null,
      avg_rfi_response_days: 0,
      punch_total: 0,
      punch_open: null,
      overall_progress: 0,
      milestones_completed: 0,
      milestones_total: 0,
      crews_active: 0,
      workers_onsite: 0,
      submittals_pending: 0,
      submittals_approved: 0,
      submittals_total: 0,
    } as ProjectMetrics
    expect(computeAiConfidenceLevel(sparse)).toBeNull()
  })

  it('returns 60 when exactly 3 of 5 sources have data', () => {
    // schedule + budget + rfis populated; punch and safety absent
    const partial = {
      project_id: 'proj-partial',
      project_name: 'Partial Project',
      schedule_variance_days: 5,
      budget_total: 500_000,
      budget_spent: 0,
      budget_committed: 0,
      rfis_total: 3,
      rfis_open: 0,
      rfis_overdue: null,
      avg_rfi_response_days: 0,
      punch_total: 0,
      punch_open: null,
      overall_progress: 0,
      milestones_completed: 0,
      milestones_total: 0,
      crews_active: 0,
      workers_onsite: 0,
      submittals_pending: 0,
      submittals_approved: 0,
      submittals_total: 0,
    } as ProjectMetrics
    expect(computeAiConfidenceLevel(partial)).toBe(60)
  })

  it('returns null when all completeness fields are absent (newly created row with no data)', () => {
    const empty = { project_id: 'proj-empty', project_name: 'Empty Project' } as ProjectMetrics
    expect(computeAiConfidenceLevel(empty)).toBeNull()
  })
})

describe('computeProjectHealthScore null cases', () => {
  it('returns null when schedule_variance_days and rfis_overdue are null and budget_total is 0', () => {
    // All three primary health indicators absent — must be null, not a fake perfect score.
    const empty = makeMetrics({
      schedule_variance_days: null,
      rfis_overdue: null,
      budget_total: 0,
      budget_spent: 0,
    })
    expect(computeProjectHealthScore(empty)).toBeNull()
  })

  it('returns a number (not null) when at least budget data is present', () => {
    const metrics = makeMetrics({ schedule_variance_days: null, rfis_overdue: null })
    expect(computeProjectHealthScore(metrics)).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// assertProjectAccess cross-org guard
// ---------------------------------------------------------------------------
const PROJ_ID  = '00000000-0000-4000-8000-000000000001'
const ORG_A_ID = '00000000-0000-4000-9000-000000000001'
const ORG_B_ID = '00000000-0000-4000-9000-000000000002'

describe('assertProjectAccess', () => {
  beforeEach(() => {
    mockMaybySingle.mockReset()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockOrgGetState.mockReturnValue({ currentOrg: { id: ORG_A_ID } })
    clearTtlCache()
  })

  it('throws 403 when project.organization_id does not match caller active org', async () => {
    mockMaybySingle
      .mockResolvedValueOnce({ data: { id: 'member-1' }, error: null })
      .mockResolvedValueOnce({ data: { organization_id: ORG_B_ID }, error: null })
    await expect(assertProjectAccess(PROJ_ID)).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('resolves when project.organization_id matches caller active org', async () => {
    mockMaybySingle
      .mockResolvedValueOnce({ data: { id: 'member-1' }, error: null })
      .mockResolvedValueOnce({ data: { organization_id: ORG_A_ID }, error: null })
    await expect(assertProjectAccess(PROJ_ID)).resolves.toBeUndefined()
  })

  it('throws 403 when no active organization context', async () => {
    mockOrgGetState.mockReturnValue({ currentOrg: null })
    mockMaybySingle.mockResolvedValueOnce({ data: { id: 'member-1' }, error: null })
    await expect(assertProjectAccess(PROJ_ID)).rejects.toMatchObject({ status: 403 })
  })

  it('throws 403 when user is not a project member', async () => {
    mockMaybySingle.mockResolvedValueOnce({ data: null, error: null })
    await expect(assertProjectAccess(PROJ_ID)).rejects.toMatchObject({ status: 403 })
  })

  it('throws 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'jwt expired' } })
    await expect(assertProjectAccess(PROJ_ID)).rejects.toMatchObject({ status: 401 })
  })

  it('deduplicates concurrent membership queries — 10 calls result in 1 DB round-trip', async () => {
    mockMaybySingle
      .mockResolvedValueOnce({ data: { id: 'member-1' }, error: null })
      .mockResolvedValue({ data: { organization_id: ORG_A_ID }, error: null })

    const { supabase: sb } = await import('../../lib/supabase') as unknown
    ;(sb.from as ReturnType<typeof vi.fn>).mockClear()

    await Promise.all(Array.from({ length: 10 }, () => assertProjectAccess(PROJ_ID)))

    const memberCalls = (sb.from as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([t]: [string]) => t === 'project_members',
    )
    expect(memberCalls).toHaveLength(1)
  })
})
