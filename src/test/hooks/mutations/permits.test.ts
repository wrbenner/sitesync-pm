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

import { useCreatePermit, useUpdatePermit, useDeletePermit } from '../../../hooks/queries/permits'

const validPermit = {
  type: 'building',
  permit_number: 'BP-2026-001',
  jurisdiction: 'City of Dallas',
  status: 'not_applied' as const,
  applied_date: '',
  expiration_date: '',
  notes: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hasPermission.mockReturnValue(true)
  sb.setResult({ data: { id: 'pe1', ...validPermit }, error: null })
})

describe('useCreatePermit', () => {
  it('rejects without project.settings permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useCreatePermit())
    await expect(result.current.mutateAsync({ projectId: 'p1', data: validPermit })).rejects.toThrow(/permission/i)
  })
  it('rejects empty type via Zod', async () => {
    const { result } = renderMutation(() => useCreatePermit())
    await expect(
      result.current.mutateAsync({ projectId: 'p1', data: { ...validPermit, type: '' } }),
    ).rejects.toThrow(/validation/i)
  })
  it('inserts with project_id and invalidates', async () => {
    const { result } = renderMutation(() => useCreatePermit())
    await result.current.mutateAsync({ projectId: 'p1', data: validPermit })
    expect(sb.supabase.from).toHaveBeenCalledWith('permits')
    expect(sb.chain.insert).toHaveBeenCalledWith(expect.objectContaining({ project_id: 'p1' }))
    await waitFor(() =>
      expect(mocks.posthogCapture).toHaveBeenCalledWith('permit_created', expect.any(Object)),
    )
  })
})

describe('useUpdatePermit', () => {
  it('updates row', async () => {
    const { result } = renderMutation(() => useUpdatePermit())
    await result.current.mutateAsync({ id: 'pe1', projectId: 'p1', updates: { status: 'approved' } })
    expect(sb.chain.update).toHaveBeenCalled()
  })
})

describe('useDeletePermit', () => {
  it('deletes row', async () => {
    const { result } = renderMutation(() => useDeletePermit())
    await result.current.mutateAsync({ id: 'pe1', projectId: 'p1' })
    expect(sb.chain.delete).toHaveBeenCalled()
  })
})
