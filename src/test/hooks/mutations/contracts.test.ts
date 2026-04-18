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

import { useCreateContract, useUpdateContract, useDeleteContract } from '../../../hooks/queries/enterprise-modules'

const validContract = {
  title: 'Electrical subcontract',
  contract_type: 'subcontract' as const,
  counterparty_name: 'ACME Electric',
  contract_amount: 2500000,
  start_date: '2026-04-01',
  end_date: '2026-12-31',
  retention_percentage: 10,
  scope_of_work: 'Full electrical build-out',
  insurance_required: true,
  bonding_required: false,
  status: 'draft' as const,
  project_id: 'p1',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hasPermission.mockReturnValue(true)
  sb.setResult({ data: { id: 'co1', ...validContract }, error: null })
})

describe('useCreateContract', () => {
  it('rejects without project.settings permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useCreateContract())
    await expect(result.current.mutateAsync(validContract)).rejects.toThrow(/permission/i)
  })
  it('rejects missing title via Zod', async () => {
    const { result } = renderMutation(() => useCreateContract())
    await expect(
      result.current.mutateAsync({ ...validContract, title: '' }),
    ).rejects.toThrow(/validation/i)
  })
  it('inserts and invalidates contracts cache', async () => {
    const { result } = renderMutation(() => useCreateContract())
    await result.current.mutateAsync(validContract)
    expect(sb.supabase.from).toHaveBeenCalledWith('contracts')
    expect(sb.chain.insert).toHaveBeenCalledWith(validContract)
    await waitFor(() => expect(mocks.posthogCapture).toHaveBeenCalledWith('contract_created', expect.any(Object)))
  })
})

describe('useUpdateContract', () => {
  it('updates row', async () => {
    const { result } = renderMutation(() => useUpdateContract())
    await result.current.mutateAsync({ id: 'co1', projectId: 'p1', updates: { status: 'active' } })
    expect(sb.chain.update).toHaveBeenCalled()
  })
})

describe('useDeleteContract', () => {
  it('deletes row', async () => {
    const { result } = renderMutation(() => useDeleteContract())
    await result.current.mutateAsync({ id: 'co1', projectId: 'p1' })
    expect(sb.chain.delete).toHaveBeenCalled()
  })
})
