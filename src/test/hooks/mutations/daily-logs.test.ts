import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderMutation } from './_helpers'

const h = vi.hoisted(() => {
  const pending = { current: { data: { id: 'mock-id' }, error: null as { message: string } | null } }
  const methods = ['insert','update','delete','upsert','select','eq','neq','in','is','gt','gte','lt','lte','order','limit','range'] as const
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of methods) chain[m] = vi.fn(() => chain)
  chain.single = vi.fn(() => Promise.resolve(pending.current))
  chain.maybeSingle = vi.fn(() => Promise.resolve(pending.current))
  ;(chain as unknown as { then: (r: (v: unknown) => unknown) => Promise<unknown> }).then = (r) => Promise.resolve(pending.current).then(r)
  const supabase = {
    from: vi.fn(() => chain),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user' } } } }), getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
    removeChannel: vi.fn(),
  }

  return {
    supabase, chain,
    setResult: (r: typeof pending.current) => { pending.current = r },
    setError: (msg: string) => { pending.current = { data: null as unknown as { id: string }, error: { message: msg } } },
        hasPermission: vi.fn(() => true),
      logAuditEntry: vi.fn().mockResolvedValue(undefined),
      invalidateEntity: vi.fn(),
      posthogCapture: vi.fn(),
      sentryCapture: vi.fn(),
      toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
      projectId: 'test-project',
  }
})

vi.mock('../../../lib/supabase', () => ({ supabase: h.supabase, fromTable: h.supabase.from }))
vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: h.hasPermission, role: 'project_manager' }),
  PermissionError: class extends Error { constructor(m: string) { super(m); this.name = 'PermissionError' } },
}))
vi.mock('../../../hooks/useProjectId', () => ({ useProjectId: () => h.projectId }))
vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('../../../lib/analytics', () => ({ default: { capture: h.posthogCapture } }))
vi.mock('../../../lib/sentry', () => ({ default: { captureException: h.sentryCapture } }))
vi.mock('../../../api/invalidation', () => ({ invalidateEntity: h.invalidateEntity, INVALIDATION_MAP: {} }))
vi.mock('../../../lib/auditLogger', () => ({ logAuditEntry: h.logAuditEntry }))

import { useCreateDailyLog, useUpdateDailyLog, useDeleteDailyLog } from '../../../hooks/mutations/daily-logs'

const validLog = {
  project_id: 'p1',
  log_date: '2026-04-18',
  weather: 'clear',
  temperature_high: 72,
  temperature_low: 55,
  workers_onsite: 18,
  total_hours: 144,
  incidents: 0,
  work_summary: 'Pour concrete on level 3',
  safety_notes: '',
  delays: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  h.hasPermission.mockReturnValue(true)
  h.setResult({ data: { id: 'dl1', log_date: validLog.log_date }, error: null })
})

describe('useCreateDailyLog', () => {
  it('rejects without daily_log.create permission', async () => {
    h.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useCreateDailyLog())
    await expect(result.current.mutateAsync({ data: validLog, projectId: 'p1' })).rejects.toThrow(/permission/i)
  })
  it('rejects empty log_date via Zod', async () => {
    const { result } = renderMutation(() => useCreateDailyLog())
    await expect(
      result.current.mutateAsync({ data: { ...validLog, log_date: '' }, projectId: 'p1' }),
    ).rejects.toThrow(/validation/i)
  })
  it('inserts and invalidates', async () => {
    const { result } = renderMutation(() => useCreateDailyLog())
    await result.current.mutateAsync({ data: validLog, projectId: 'p1' })
    expect(h.supabase.from).toHaveBeenCalledWith('daily_logs')
    expect(h.chain.insert).toHaveBeenCalledWith(validLog)
    await waitFor(() => expect(h.invalidateEntity).toHaveBeenCalledWith('daily_log', 'test-project'))
  })
})

describe('useUpdateDailyLog', () => {
  it('updates row', async () => {
    const { result } = renderMutation(() => useUpdateDailyLog())
    await result.current.mutateAsync({ id: 'dl1', updates: { activities: 'new activity' }, projectId: 'p1' })
    expect(h.chain.update).toHaveBeenCalled()
  })
})

describe('useDeleteDailyLog', () => {
  it('deletes row', async () => {
    const { result } = renderMutation(() => useDeleteDailyLog())
    await result.current.mutateAsync({ id: 'dl1', projectId: 'p1' })
    expect(h.chain.delete).toHaveBeenCalled()
  })
})
