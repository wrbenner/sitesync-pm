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
  createPayApplication: vi.fn().mockResolvedValue({ id: 'pa1', status: 'draft' }),
  upsertPayApplication: vi.fn().mockResolvedValue({ id: 'pa1', status: 'draft' }),
  submitPayApplication: vi.fn().mockResolvedValue({ id: 'pa1', status: 'submitted' }),
  approvePayApplication: vi.fn().mockResolvedValue({ payApp: { id: 'pa1', status: 'approved' }, waivers: [] }),
}))
const sb = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createMockSupabase } = require('../../mocks/supabase')
  return createMockSupabase()
})

vi.mock('../../../lib/supabase', () => ({ supabase: sb.supabase, fromTable: sb.supabase.from }))
vi.mock('../../../api/endpoints/payApplications', () => ({
  getPayApplications: vi.fn().mockResolvedValue([]),
  createPayApplication: mocks.createPayApplication,
  upsertPayApplication: mocks.upsertPayApplication,
  submitPayApplication: mocks.submitPayApplication,
  approvePayApplication: mocks.approvePayApplication,
}))
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
  period_from: '2026-04-01',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hasPermission.mockReturnValue(true)
  sb.setResult({ data: { id: 'pa1' }, error: null })
})

describe('useCreatePayApplication', () => {
  it('rejects without financials.edit permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
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
    expect(mocks.createPayApplication).toHaveBeenCalledWith('p1', validPayload)
    await waitFor(() =>
      expect(mocks.posthogCapture).toHaveBeenCalledWith('pay_application_created', expect.any(Object)),
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
    expect(mocks.upsertPayApplication).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ id: 'pa1' }),
    )
  })
})

describe('useSubmitPayApplication', () => {
  it('delegates to submitPayApplication', async () => {
    const { result } = renderMutation(() => useSubmitPayApplication())
    await result.current.mutateAsync({ projectId: 'p1', id: 'pa1' })
    expect(mocks.submitPayApplication).toHaveBeenCalledWith('p1', 'pa1')
  })
})

describe('useApprovePayApplication', () => {
  it('requires budget.approve permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useApprovePayApplication())
    await expect(result.current.mutateAsync({ projectId: 'p1', id: 'pa1' })).rejects.toThrow(/permission/i)
  })
  it('delegates to approvePayApplication endpoint', async () => {
    const { result } = renderMutation(() => useApprovePayApplication())
    await result.current.mutateAsync({ projectId: 'p1', id: 'pa1' })
    expect(mocks.approvePayApplication).toHaveBeenCalledWith('p1', 'pa1')
  })
})

describe('useDeletePayApplication', () => {
  it('deletes row scoped to projectId', async () => {
    const { result } = renderMutation(() => useDeletePayApplication())
    await result.current.mutateAsync({ projectId: 'p1', id: 'pa1' })
    expect(sb.supabase.from).toHaveBeenCalledWith('pay_applications')
    expect(sb.chain.delete).toHaveBeenCalled()
    expect(sb.chain.eq).toHaveBeenCalledWith('id', 'pa1')
  })
})
