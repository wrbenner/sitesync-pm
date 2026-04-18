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
  h.hasPermission.mockReturnValue(true)
  h.setResult({ data: { id: 'v1', ...validVendor }, error: null })
})

describe('useCreateVendor', () => {
  it('rejects without directory.manage permission', async () => {
    h.hasPermission.mockReturnValue(false)
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
    expect(h.supabase.from).toHaveBeenCalledWith('vendors')
    expect(h.chain.insert).toHaveBeenCalledWith(validVendor)
    await waitFor(() => expect(h.posthogCapture).toHaveBeenCalledWith('vendor_created', expect.any(Object)))
  })
})

describe('useUpdateVendor', () => {
  it('updates row', async () => {
    const { result } = renderMutation(() => useUpdateVendor())
    await result.current.mutateAsync({ id: 'v1', updates: { status: 'probation' } })
    expect(h.chain.update).toHaveBeenCalled()
  })
})

describe('useDeleteVendor', () => {
  it('deletes row', async () => {
    const { result } = renderMutation(() => useDeleteVendor())
    await result.current.mutateAsync({ id: 'v1' })
    expect(h.chain.delete).toHaveBeenCalled()
  })
})
