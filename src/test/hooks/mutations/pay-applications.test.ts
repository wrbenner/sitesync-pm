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
      createPayApplication: vi.fn().mockResolvedValue({ id: 'pa1', status: 'draft' }),
      upsertPayApplication: vi.fn().mockResolvedValue({ id: 'pa1', status: 'draft' }),
      submitPayApplication: vi.fn().mockResolvedValue({ id: 'pa1', status: 'submitted' }),
      approvePayApplication: vi.fn().mockResolvedValue({ payApp: { id: 'pa1', status: 'approved' }, waivers: [] }),
  }
})

vi.mock('../../../lib/supabase', () => ({ supabase: h.supabase, fromTable: h.supabase.from }))
vi.mock('../../../api/endpoints/payApplications', () => ({
  getPayApplications: vi.fn().mockResolvedValue([]),
  createPayApplication: h.createPayApplication,
  upsertPayApplication: h.upsertPayApplication,
  submitPayApplication: h.submitPayApplication,
  approvePayApplication: h.approvePayApplication,
}))
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

import {
  useCreatePayApplication,
  useUpdatePayApplication,
  useSubmitPayApplication,
  useApprovePayApplication,
  useDeletePayApplication,
} from '../../../hooks/queries/financials'

const validPayload = {
  contract_id: '11111111-1111-1111-1111-111111111111',
  period_to: '2026-04-30',
}

beforeEach(() => {
  vi.clearAllMocks()
  h.hasPermission.mockReturnValue(true)
  h.setResult({ data: { id: 'pa1' }, error: null })
})

describe('useCreatePayApplication', () => {
  it('rejects without financials.edit permission', async () => {
    h.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useCreatePayApplication())
    await expect(
      result.current.mutateAsync({ projectId: 'p1', payload: validPayload }),
    ).rejects.toThrow(/permission/i)
  })
  it('rejects missing contract_id via Zod', async () => {
    const { result } = renderMutation(() => useCreatePayApplication())
    await expect(
      result.current.mutateAsync({ projectId: 'p1', payload: { ...validPayload, contract_id: '' } }),
    ).rejects.toThrow(/validation/i)
  })
  it('delegates to createPayApplication endpoint', async () => {
    const { result } = renderMutation(() => useCreatePayApplication())
    await result.current.mutateAsync({ projectId: 'p1', payload: validPayload })
    expect(h.createPayApplication).toHaveBeenCalledWith('p1', validPayload)
    await waitFor(() =>
      expect(h.posthogCapture).toHaveBeenCalledWith('pay_application_created', expect.any(Object)),
    )
  })
})

describe('useUpdatePayApplication', () => {
  it('delegates to upsertPayApplication', async () => {
    const { result } = renderMutation(() => useUpdatePayApplication())
    await result.current.mutateAsync({
      projectId: 'p1',
      payload: { id: 'pa1', contract_id: validPayload.contract_id, period_to: validPayload.period_to },
    })
    expect(h.upsertPayApplication).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ id: 'pa1' }),
    )
  })
})

describe('useSubmitPayApplication', () => {
  it('delegates to submitPayApplication', async () => {
    const { result } = renderMutation(() => useSubmitPayApplication())
    await result.current.mutateAsync({ projectId: 'p1', id: 'pa1' })
    expect(h.submitPayApplication).toHaveBeenCalledWith('p1', 'pa1')
  })
})

describe('useApprovePayApplication', () => {
  it('requires budget.approve permission', async () => {
    h.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useApprovePayApplication())
    await expect(result.current.mutateAsync({ projectId: 'p1', id: 'pa1' })).rejects.toThrow(/permission/i)
  })
  it('delegates to approvePayApplication endpoint', async () => {
    const { result } = renderMutation(() => useApprovePayApplication())
    await result.current.mutateAsync({ projectId: 'p1', id: 'pa1' })
    expect(h.approvePayApplication).toHaveBeenCalledWith('p1', 'pa1')
  })
})

describe('useDeletePayApplication', () => {
  it('deletes row scoped to projectId', async () => {
    const { result } = renderMutation(() => useDeletePayApplication())
    await result.current.mutateAsync({ projectId: 'p1', id: 'pa1' })
    expect(h.supabase.from).toHaveBeenCalledWith('pay_applications')
    expect(h.chain.delete).toHaveBeenCalled()
    expect(h.chain.eq).toHaveBeenCalledWith('id', 'pa1')
  })
})
