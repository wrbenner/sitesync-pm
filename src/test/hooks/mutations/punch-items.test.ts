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
      validatePunchItemStatusTransition: vi.fn().mockResolvedValue(undefined),
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
vi.mock('../../../hooks/mutations/state-machine-validation-helpers', () => ({
  validatePunchItemStatusTransition: h.validatePunchItemStatusTransition,
}))

import { useCreatePunchItem, useUpdatePunchItem, useDeletePunchItem } from '../../../hooks/mutations/punch-items'

const validItem = {
  title: 'Paint touch-up in lobby',
  location: 'Lobby',
  floor: '1',
  trade: 'Painting',
  assigned_to: '',
  priority: 'medium' as const,
  due_date: '',
  description: '',
  drawing_id: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  h.hasPermission.mockReturnValue(true)
  h.setResult({ data: { id: 'pi1', title: validItem.title }, error: null })
})

describe('useCreatePunchItem', () => {
  it('rejects without punch_list.create permission', async () => {
    h.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useCreatePunchItem())
    await expect(result.current.mutateAsync({ data: validItem, projectId: 'p1' })).rejects.toThrow(/permission/i)
  })
  it('rejects empty title via Zod', async () => {
    const { result } = renderMutation(() => useCreatePunchItem())
    await expect(
      result.current.mutateAsync({ data: { ...validItem, title: '' }, projectId: 'p1' }),
    ).rejects.toThrow(/validation/i)
  })
  it('inserts and invalidates', async () => {
    const { result } = renderMutation(() => useCreatePunchItem())
    await result.current.mutateAsync({ data: validItem, projectId: 'p1' })
    expect(h.supabase.from).toHaveBeenCalledWith('punch_items')
    expect(h.chain.insert).toHaveBeenCalledWith(validItem)
    await waitFor(() => expect(h.invalidateEntity).toHaveBeenCalledWith('punch_item', 'test-project'))
  })
})

describe('useUpdatePunchItem', () => {
  it('validates status transition when status changes', async () => {
    const { result } = renderMutation(() => useUpdatePunchItem())
    await result.current.mutateAsync({ id: 'pi1', updates: { status: 'resolved' }, projectId: 'p1' })
    expect(h.validatePunchItemStatusTransition).toHaveBeenCalledWith('pi1', 'p1', 'resolved')
    expect(h.chain.update).toHaveBeenCalled()
  })
})

describe('useDeletePunchItem', () => {
  it('requires punch_list.delete permission', async () => {
    h.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useDeletePunchItem())
    await expect(result.current.mutateAsync({ id: 'pi1', projectId: 'p1' })).rejects.toThrow(/permission/i)
  })
  it('deletes and invalidates', async () => {
    const { result } = renderMutation(() => useDeletePunchItem())
    await result.current.mutateAsync({ id: 'pi1', projectId: 'p1' })
    expect(h.chain.delete).toHaveBeenCalled()
    await waitFor(() => expect(h.invalidateEntity).toHaveBeenCalledWith('punch_item', 'test-project'))
  })
})
