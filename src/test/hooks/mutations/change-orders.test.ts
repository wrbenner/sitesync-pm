import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderMutation } from './_helpers'

const h = vi.hoisted(() => {
  const pending: { current: { data: Record<string, unknown> & { id: string }; error: { message: string } | null } } = { current: { data: { id: 'mock-id' }, error: null } }
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
      validateChangeOrderStatusTransition: vi.fn().mockResolvedValue(undefined),
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
vi.mock('../../../hooks/mutations/state-machine-validation-helpers', () => ({
  validateChangeOrderStatusTransition: h.validateChangeOrderStatusTransition,
}))

import {
  useCreateChangeOrder,
  useUpdateChangeOrder,
  useDeleteChangeOrder,
  useSubmitChangeOrder,
  useApproveChangeOrder,
  useRejectChangeOrder,
} from '../../../hooks/mutations/change-orders'

const validCO = {
  title: 'Revised steel takeoff',
  type: 'pco' as const,
  description: 'Grid-line shift on level 5',
  amount: '12500',
  cost_codes: '05 12 00',
  justification: 'Owner scope change',
  requested_by: 'GC',
  requested_date: '2026-04-18',
}

beforeEach(() => {
  vi.clearAllMocks()
  h.hasPermission.mockReturnValue(true)
  h.setResult({ data: { id: 'co1', title: validCO.title }, error: null })
})

describe('useCreateChangeOrder', () => {
  it('rejects without change_orders.create permission', async () => {
    h.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useCreateChangeOrder())
    await expect(result.current.mutateAsync({ data: validCO, projectId: 'p1' })).rejects.toThrow(/permission/i)
  })
  it('rejects empty title', async () => {
    const { result } = renderMutation(() => useCreateChangeOrder())
    await expect(
      result.current.mutateAsync({ data: { ...validCO, title: '' }, projectId: 'p1' }),
    ).rejects.toThrow(/validation/i)
  })
  it('inserts and invalidates', async () => {
    const { result } = renderMutation(() => useCreateChangeOrder())
    await result.current.mutateAsync({ data: validCO, projectId: 'p1' })
    expect(h.supabase.from).toHaveBeenCalledWith('change_orders')
    expect(h.chain.insert).toHaveBeenCalledWith(validCO)
    await waitFor(() => expect(h.invalidateEntity).toHaveBeenCalledWith('change_order', 'test-project'))
  })
})

describe('useUpdateChangeOrder', () => {
  it('validates status transition on status change', async () => {
    const { result } = renderMutation(() => useUpdateChangeOrder())
    await result.current.mutateAsync({ id: 'co1', updates: { status: 'approved' }, projectId: 'p1' })
    expect(h.validateChangeOrderStatusTransition).toHaveBeenCalledWith('co1', 'p1', 'approved')
    expect(h.chain.update).toHaveBeenCalled()
  })
})

describe('useSubmitChangeOrder', () => {
  it('gates submission via state-machine validator', async () => {
    const { result } = renderMutation(() => useSubmitChangeOrder())
    await result.current.mutateAsync({ id: 'co1', userId: 'u1', projectId: 'p1' })
    expect(h.validateChangeOrderStatusTransition).toHaveBeenCalledWith('co1', 'p1', 'pending_review')
    expect(h.chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending_review', submitted_by: 'u1' }),
    )
  })
  it('rejects when validator throws', async () => {
    h.validateChangeOrderStatusTransition.mockRejectedValueOnce(new Error('Invalid transition'))
    const { result } = renderMutation(() => useSubmitChangeOrder())
    await expect(
      result.current.mutateAsync({ id: 'co1', userId: 'u1', projectId: 'p1' }),
    ).rejects.toThrow(/invalid transition/i)
    expect(h.chain.update).not.toHaveBeenCalled()
  })
})

describe('useApproveChangeOrder', () => {
  it('requires change_orders.approve permission', async () => {
    h.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useApproveChangeOrder())
    await expect(
      result.current.mutateAsync({ id: 'co1', userId: 'u1', projectId: 'p1' }),
    ).rejects.toThrow(/permission/i)
  })
  it('writes approved status + approved_by', async () => {
    const { result } = renderMutation(() => useApproveChangeOrder())
    await result.current.mutateAsync({ id: 'co1', userId: 'u1', projectId: 'p1' })
    expect(h.chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved', approved_by: 'u1' }),
    )
  })
})

describe('useRejectChangeOrder', () => {
  it('writes rejected status + comments', async () => {
    const { result } = renderMutation(() => useRejectChangeOrder())
    await result.current.mutateAsync({
      id: 'co1',
      userId: 'u1',
      comments: 'Scope not justified',
      projectId: 'p1',
    })
    expect(h.chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'rejected',
        rejected_by: 'u1',
        rejection_comments: 'Scope not justified',
      }),
    )
  })
})

describe('useDeleteChangeOrder', () => {
  it('requires change_orders.delete permission', async () => {
    h.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useDeleteChangeOrder())
    await expect(result.current.mutateAsync({ id: 'co1', projectId: 'p1' })).rejects.toThrow(/permission/i)
  })
  it('deletes and invalidates', async () => {
    const { result } = renderMutation(() => useDeleteChangeOrder())
    await result.current.mutateAsync({ id: 'co1', projectId: 'p1' })
    expect(h.chain.delete).toHaveBeenCalled()
    await waitFor(() => expect(h.invalidateEntity).toHaveBeenCalledWith('change_order', 'test-project'))
  })
})
