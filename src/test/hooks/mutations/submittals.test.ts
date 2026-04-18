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
  validateSubmittalStatusTransition: vi.fn().mockResolvedValue(undefined),
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
  validateSubmittalStatusTransition: mocks.validateSubmittalStatusTransition,
}))

import { useCreateSubmittal, useUpdateSubmittal, useDeleteSubmittal } from '../../../hooks/mutations/submittals'

const validSubmittal = {
  title: 'Structural shop drawings',
  spec_section: '05 12 00',
  type: 'shop_drawing' as const,
  subcontractor: '',
  due_date: '',
  description: '',
  related_rfi_id: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hasPermission.mockReturnValue(true)
  sb.setResult({ data: { id: 's1', title: validSubmittal.title }, error: null })
})

describe('useCreateSubmittal', () => {
  it('rejects without submittals.create permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useCreateSubmittal())
    await expect(result.current.mutateAsync({ data: validSubmittal, projectId: 'p1' })).rejects.toThrow(/permission/i)
    expect(sb.chain.insert).not.toHaveBeenCalled()
  })
  it('rejects empty title via Zod', async () => {
    const { result } = renderMutation(() => useCreateSubmittal())
    await expect(
      result.current.mutateAsync({ data: { ...validSubmittal, title: '' }, projectId: 'p1' }),
    ).rejects.toThrow(/validation/i)
  })
  it('inserts and invalidates', async () => {
    const { result } = renderMutation(() => useCreateSubmittal())
    await result.current.mutateAsync({ data: validSubmittal, projectId: 'p1' })
    expect(sb.supabase.from).toHaveBeenCalledWith('submittals')
    expect(sb.chain.insert).toHaveBeenCalledWith(validSubmittal)
    await waitFor(() => expect(mocks.invalidateEntity).toHaveBeenCalledWith('submittal', 'test-project'))
    expect(mocks.posthogCapture).toHaveBeenCalledWith('submittal_created', expect.any(Object))
  })
})

describe('useUpdateSubmittal', () => {
  it('validates status transition before DB write', async () => {
    const { result } = renderMutation(() => useUpdateSubmittal())
    await result.current.mutateAsync({ id: 's1', updates: { status: 'approved' }, projectId: 'p1' })
    expect(mocks.validateSubmittalStatusTransition).toHaveBeenCalledWith('s1', 'p1', 'approved')
    expect(sb.chain.update).toHaveBeenCalled()
  })
  it('skips validator when no status change', async () => {
    const { result } = renderMutation(() => useUpdateSubmittal())
    await result.current.mutateAsync({ id: 's1', updates: { description: 'x' }, projectId: 'p1' })
    expect(mocks.validateSubmittalStatusTransition).not.toHaveBeenCalled()
  })
})

describe('useDeleteSubmittal', () => {
  it('requires submittals.delete permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useDeleteSubmittal())
    await expect(result.current.mutateAsync({ id: 's1', projectId: 'p1' })).rejects.toThrow(/permission/i)
  })
  it('deletes and invalidates', async () => {
    const { result } = renderMutation(() => useDeleteSubmittal())
    await result.current.mutateAsync({ id: 's1', projectId: 'p1' })
    expect(sb.chain.delete).toHaveBeenCalled()
    await waitFor(() => expect(mocks.invalidateEntity).toHaveBeenCalledWith('submittal', 'test-project'))
  })
})
