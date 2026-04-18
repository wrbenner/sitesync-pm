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

import {
  useCreateDirectoryContact,
  useUpdateDirectoryContact,
  useDeleteDirectoryContact,
} from '../../../hooks/mutations/directory-contacts'

const validContact = {
  name: 'Jane Doe',
  company: 'ACME Electric',
  role: 'Project Manager',
  email: 'jane@acme.com',
  phone: '555-0100',
  trade: 'Electrical',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hasPermission.mockReturnValue(true)
  sb.setResult({ data: { id: 'dc1', ...validContact }, error: null })
})

describe('useCreateDirectoryContact', () => {
  it('rejects without directory.manage permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useCreateDirectoryContact())
    await expect(result.current.mutateAsync({ data: validContact, projectId: 'p1' })).rejects.toThrow(/permission/i)
  })
  it('rejects empty name', async () => {
    const { result } = renderMutation(() => useCreateDirectoryContact())
    await expect(
      result.current.mutateAsync({ data: { ...validContact, name: '' }, projectId: 'p1' }),
    ).rejects.toThrow(/validation/i)
  })
  it('inserts and invalidates', async () => {
    const { result } = renderMutation(() => useCreateDirectoryContact())
    await result.current.mutateAsync({ data: validContact, projectId: 'p1' })
    expect(sb.supabase.from).toHaveBeenCalledWith('directory_contacts')
    await waitFor(() =>
      expect(mocks.posthogCapture).toHaveBeenCalledWith('directory_contact_created', expect.any(Object)),
    )
  })
})

describe('useUpdateDirectoryContact', () => {
  it('updates row', async () => {
    const { result } = renderMutation(() => useUpdateDirectoryContact())
    await result.current.mutateAsync({ id: 'dc1', updates: { phone: '555-0200' }, projectId: 'p1' })
    expect(sb.chain.update).toHaveBeenCalled()
  })
})

describe('useDeleteDirectoryContact', () => {
  it('deletes row', async () => {
    const { result } = renderMutation(() => useDeleteDirectoryContact())
    await result.current.mutateAsync({ id: 'dc1', projectId: 'p1' })
    expect(sb.chain.delete).toHaveBeenCalled()
  })
})
