import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderMutation } from './_helpers'

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(() => true),
  logAuditEntry: vi.fn().mockResolvedValue(undefined),
  invalidateEntity: vi.fn(),
  posthogCapture: vi.fn(),
  sentryCapture: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  projectId: 'test-project',
  validateChangeOrderStatusTransition: vi.fn().mockResolvedValue(undefined),
}))
const sb = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createMockSupabase } = require('../../mocks/supabase')
  return createMockSupabase()
})

vi.mock('../../../lib/supabase', () => ({ supabase: sb.supabase, fromTable: sb.supabase.from }))
vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: mocks.hasPermission, role: 'project_manager' }),
  PermissionError: class extends Error { constructor(m: string) { super(m); this.name = 'PermissionError' } },
}))
vi.mock('../../../hooks/useProjectId', () => ({ useProjectId: () => mocks.projectId }))
vi.mock('sonner', () => ({ toast: mocks.toast }))
vi.mock('../../../lib/analytics', () => ({ default: { capture: mocks.posthogCapture } }))
vi.mock('../../../lib/sentry', () => ({ default: { captureException: mocks.sentryCapture } }))
vi.mock('../../../api/invalidation', () => ({ invalidateEntity: mocks.invalidateEntity, INVALIDATION_MAP: {} }))
vi.mock('../../../lib/auditLogger', () => ({ logAuditEntry: mocks.logAuditEntry }))
vi.mock('../../../hooks/mutations/state-machine-validation-helpers', () => ({
  validateChangeOrderStatusTransition: mocks.validateChangeOrderStatusTransition,
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
  mocks.hasPermission.mockReturnValue(true)
  sb.setResult({ data: { id: 'co1', title: validCO.title }, error: null })
})

describe('useCreateChangeOrder', () => {
  it('rejects without change_orders.create permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
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
    expect(sb.supabase.from).toHaveBeenCalledWith('change_orders')
    expect(sb.chain.insert).toHaveBeenCalledWith(validCO)
    await waitFor(() => expect(mocks.invalidateEntity).toHaveBeenCalledWith('change_order', 'test-project'))
  })
})

describe('useUpdateChangeOrder', () => {
  it('validates status transition on status change', async () => {
    const { result } = renderMutation(() => useUpdateChangeOrder())
    await result.current.mutateAsync({ id: 'co1', updates: { status: 'approved' }, projectId: 'p1' })
    expect(mocks.validateChangeOrderStatusTransition).toHaveBeenCalledWith('co1', 'p1', 'approved')
    expect(sb.chain.update).toHaveBeenCalled()
  })
})

describe('useSubmitChangeOrder', () => {
  it('gates submission via state-machine validator', async () => {
    const { result } = renderMutation(() => useSubmitChangeOrder())
    await result.current.mutateAsync({ id: 'co1', userId: 'u1', projectId: 'p1' })
    expect(mocks.validateChangeOrderStatusTransition).toHaveBeenCalledWith('co1', 'p1', 'pending_review')
    expect(sb.chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending_review', submitted_by: 'u1' }),
    )
  })
  it('rejects when validator throws', async () => {
    mocks.validateChangeOrderStatusTransition.mockRejectedValueOnce(new Error('Invalid transition'))
    const { result } = renderMutation(() => useSubmitChangeOrder())
    await expect(
      result.current.mutateAsync({ id: 'co1', userId: 'u1', projectId: 'p1' }),
    ).rejects.toThrow(/invalid transition/i)
    expect(sb.chain.update).not.toHaveBeenCalled()
  })
})

describe('useApproveChangeOrder', () => {
  it('requires change_orders.approve permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useApproveChangeOrder())
    await expect(
      result.current.mutateAsync({ id: 'co1', userId: 'u1', projectId: 'p1' }),
    ).rejects.toThrow(/permission/i)
  })
  it('writes approved status + approved_by', async () => {
    const { result } = renderMutation(() => useApproveChangeOrder())
    await result.current.mutateAsync({ id: 'co1', userId: 'u1', projectId: 'p1' })
    expect(sb.chain.update).toHaveBeenCalledWith(
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
    expect(sb.chain.update).toHaveBeenCalledWith(
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
    mocks.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useDeleteChangeOrder())
    await expect(result.current.mutateAsync({ id: 'co1', projectId: 'p1' })).rejects.toThrow(/permission/i)
  })
  it('deletes and invalidates', async () => {
    const { result } = renderMutation(() => useDeleteChangeOrder())
    await result.current.mutateAsync({ id: 'co1', projectId: 'p1' })
    expect(sb.chain.delete).toHaveBeenCalled()
    await waitFor(() => expect(mocks.invalidateEntity).toHaveBeenCalledWith('change_order', 'test-project'))
  })
})
