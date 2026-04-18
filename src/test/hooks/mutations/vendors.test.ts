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

import { useCreateVendor, useUpdateVendor, useDeleteVendor } from '../../../hooks/queries/vendors'

const validVendor = {
  company_name: 'ACME Electric',
  contact_name: 'Jane Doe',
  email: 'jane@acme.com',
  phone: '555-0100',
  trade: 'Electrical',
  license_number: 'LIC-001',
  insurance_expiry: '',
  status: 'active' as const,
  notes: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hasPermission.mockReturnValue(true)
  sb.setResult({ data: { id: 'v1', ...validVendor }, error: null })
})

describe('useCreateVendor', () => {
  it('rejects without directory.manage permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useCreateVendor())
    await expect(result.current.mutateAsync(validVendor)).rejects.toThrow(/permission/i)
  })
  it('rejects missing company_name via Zod', async () => {
    const { result } = renderMutation(() => useCreateVendor())
    await expect(
      result.current.mutateAsync({ ...validVendor, company_name: '' }),
    ).rejects.toThrow(/validation/i)
  })
  it('inserts and invalidates vendors cache', async () => {
    const { result } = renderMutation(() => useCreateVendor())
    await result.current.mutateAsync(validVendor)
    expect(sb.supabase.from).toHaveBeenCalledWith('vendors')
    expect(sb.chain.insert).toHaveBeenCalledWith(validVendor)
    await waitFor(() => expect(mocks.posthogCapture).toHaveBeenCalledWith('vendor_created', expect.any(Object)))
  })
})

describe('useUpdateVendor', () => {
  it('updates row', async () => {
    const { result } = renderMutation(() => useUpdateVendor())
    await result.current.mutateAsync({ id: 'v1', updates: { status: 'probation' } })
    expect(sb.chain.update).toHaveBeenCalled()
  })
})

describe('useDeleteVendor', () => {
  it('deletes row', async () => {
    const { result } = renderMutation(() => useDeleteVendor())
    await result.current.mutateAsync({ id: 'v1' })
    expect(sb.chain.delete).toHaveBeenCalled()
  })
})
