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

import { useCreateCrew, useUpdateCrew, useDeleteCrew } from '../../../hooks/mutations/crews'

const validCrew = { name: 'Tower Crew Alpha', trade: 'Concrete', foreman: 'J. Smith', size: '12', shift: 'day' as const }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hasPermission.mockReturnValue(true)
  sb.setResult({ data: { id: 'c1', ...validCrew }, error: null })
})

describe('useCreateCrew', () => {
  it('rejects without crews.manage permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useCreateCrew())
    await expect(result.current.mutateAsync({ data: validCrew, projectId: 'p1' })).rejects.toThrow(/permission/i)
  })
  it('rejects empty name via Zod', async () => {
    const { result } = renderMutation(() => useCreateCrew())
    await expect(
      result.current.mutateAsync({ data: { ...validCrew, name: '' }, projectId: 'p1' }),
    ).rejects.toThrow(/validation/i)
  })
  it('inserts and invalidates', async () => {
    const { result } = renderMutation(() => useCreateCrew())
    await result.current.mutateAsync({ data: validCrew, projectId: 'p1' })
    expect(sb.supabase.from).toHaveBeenCalledWith('crews')
    expect(sb.chain.insert).toHaveBeenCalledWith(validCrew)
    await waitFor(() => expect(mocks.posthogCapture).toHaveBeenCalledWith('crew_created', expect.any(Object)))
  })
})

describe('useUpdateCrew', () => {
  it('updates row', async () => {
    const { result } = renderMutation(() => useUpdateCrew())
    await result.current.mutateAsync({ id: 'c1', updates: { size: '14' }, projectId: 'p1' })
    expect(sb.chain.update).toHaveBeenCalled()
  })
})

describe('useDeleteCrew', () => {
  it('deletes', async () => {
    const { result } = renderMutation(() => useDeleteCrew())
    await result.current.mutateAsync({ id: 'c1', projectId: 'p1' })
    expect(sb.chain.delete).toHaveBeenCalled()
  })
})
