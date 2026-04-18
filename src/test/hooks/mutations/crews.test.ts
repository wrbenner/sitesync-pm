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

import { useCreateCrew, useUpdateCrew, useDeleteCrew } from '../../../hooks/mutations/crews'

const validCrew = { name: 'Tower Crew Alpha', trade: 'Concrete', foreman: 'J. Smith', size: '12', shift: 'day' as const }

beforeEach(() => {
  vi.clearAllMocks()
  h.hasPermission.mockReturnValue(true)
  h.setResult({ data: { id: 'c1', ...validCrew }, error: null })
})

describe('useCreateCrew', () => {
  it('rejects without crews.manage permission', async () => {
    h.hasPermission.mockReturnValue(false)
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
    expect(h.supabase.from).toHaveBeenCalledWith('crews')
    expect(h.chain.insert).toHaveBeenCalledWith(validCrew)
    await waitFor(() => expect(h.posthogCapture).toHaveBeenCalledWith('crew_created', expect.any(Object)))
  })
})

describe('useUpdateCrew', () => {
  it('updates row', async () => {
    const { result } = renderMutation(() => useUpdateCrew())
    await result.current.mutateAsync({ id: 'c1', updates: { size: '14' }, projectId: 'p1' })
    expect(h.chain.update).toHaveBeenCalled()
  })
})

describe('useDeleteCrew', () => {
  it('deletes', async () => {
    const { result } = renderMutation(() => useDeleteCrew())
    await result.current.mutateAsync({ id: 'c1', projectId: 'p1' })
    expect(h.chain.delete).toHaveBeenCalled()
  })
})
