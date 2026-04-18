import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderMutation } from './_helpers'

// ── Hoisted mocks — everything vi.mock references must live in vi.hoisted ─
const h = vi.hoisted(() => {
  const pending = { current: { data: { id: 'rfi-1' }, error: null as { message: string } | null } }
  const methods = [
    'insert', 'update', 'delete', 'upsert', 'select', 'eq', 'neq',
    'in', 'is', 'gt', 'gte', 'lt', 'lte', 'order', 'limit', 'range',
  ] as const
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of methods) chain[m] = vi.fn(() => chain)
  chain.single = vi.fn(() => Promise.resolve(pending.current))
  chain.maybeSingle = vi.fn(() => Promise.resolve(pending.current))
  // then() makes the chain awaitable like a real PostgrestBuilder
  ;(chain as unknown as { then: (r: (v: unknown) => unknown) => Promise<unknown> }).then =
    (r) => Promise.resolve(pending.current).then(r)

  const supabase = {
    from: vi.fn(() => chain),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user' } } } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
    removeChannel: vi.fn(),
  }

  return {
    supabase,
    chain,
    setResult: (r: typeof pending.current) => { pending.current = r },
    setError: (msg: string) => { pending.current = { data: null as unknown as { id: string }, error: { message: msg } } },
    hasPermission: vi.fn(() => true),
    logAuditEntry: vi.fn().mockResolvedValue(undefined),
    invalidateEntity: vi.fn(),
    posthogCapture: vi.fn(),
    sentryCapture: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
    projectId: 'test-project',
    validateRfiStatusTransition: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('../../../lib/supabase', () => ({ supabase: h.supabase, fromTable: h.supabase.from, isSupabaseConfigured: true }))
vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: h.hasPermission, role: 'project_manager' }),
  PermissionError: class PermissionError extends Error {
    constructor(m: string, public permission?: string) { super(m); this.name = 'PermissionError' }
  },
}))
vi.mock('../../../hooks/useProjectId', () => ({ useProjectId: () => h.projectId }))
vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('../../../lib/analytics', () => ({ default: { capture: h.posthogCapture } }))
vi.mock('../../../lib/sentry', () => ({ default: { captureException: h.sentryCapture } }))
vi.mock('../../../api/invalidation', () => ({ invalidateEntity: h.invalidateEntity, INVALIDATION_MAP: {} }))
vi.mock('../../../lib/auditLogger', () => ({ logAuditEntry: h.logAuditEntry }))
vi.mock('../../../hooks/mutations/state-machine-validation-helpers', () => ({
  validateRfiStatusTransition: h.validateRfiStatusTransition,
}))

import { useCreateRFI, useUpdateRFI, useDeleteRFI } from '../../../hooks/mutations/rfis'

const validRfi = {
  title: 'Structural clarification',
  description: 'Grid line C conflict',
  priority: 'medium' as const,
  assigned_to: '',
  spec_section: '',
  drawing_reference: '',
  due_date: '',
  related_submittal_id: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  h.hasPermission.mockReturnValue(true)
  h.setResult({ data: { id: 'rfi-1' }, error: null })
})

describe('useCreateRFI', () => {
  it('rejects when caller lacks rfis.create permission', async () => {
    h.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useCreateRFI())
    await expect(result.current.mutateAsync({ data: validRfi, projectId: 'p1' })).rejects.toThrow(/permission/i)
    expect(h.logAuditEntry).not.toHaveBeenCalled()
    expect(h.chain.insert).not.toHaveBeenCalled()
  })

  it('rejects empty title via Zod schema before touching DB', async () => {
    const { result } = renderMutation(() => useCreateRFI())
    await expect(
      result.current.mutateAsync({ data: { ...validRfi, title: '' }, projectId: 'p1' }),
    ).rejects.toThrow(/validation/i)
    expect(h.chain.insert).not.toHaveBeenCalled()
  })

  it('inserts, writes audit entry, invalidates rfi cache, captures analytics', async () => {
    const { result } = renderMutation(() => useCreateRFI())
    await result.current.mutateAsync({ data: validRfi, projectId: 'p1' })
    expect(h.supabase.from).toHaveBeenCalledWith('rfis')
    expect(h.chain.insert).toHaveBeenCalledWith(validRfi)
    await waitFor(() => expect(h.invalidateEntity).toHaveBeenCalledWith('rfi', 'test-project'))
    expect(h.posthogCapture).toHaveBeenCalledWith('rfi_created', expect.any(Object))
  })

  it('surfaces supabase errors as thrown errors', async () => {
    h.setError('permission denied')
    const { result } = renderMutation(() => useCreateRFI())
    await expect(result.current.mutateAsync({ data: validRfi, projectId: 'p1' })).rejects.toThrow(/permission denied/i)
  })
})

describe('useUpdateRFI', () => {
  it('validates status transition before DB write', async () => {
    const { result } = renderMutation(() => useUpdateRFI())
    await result.current.mutateAsync({ id: 'rfi-1', updates: { status: 'closed' }, projectId: 'p1' })
    expect(h.validateRfiStatusTransition).toHaveBeenCalledWith('rfi-1', 'p1', 'closed')
    expect(h.chain.update).toHaveBeenCalledWith({ status: 'closed' })
  })

  it('skips status validator when no status in updates', async () => {
    const { result } = renderMutation(() => useUpdateRFI())
    await result.current.mutateAsync({ id: 'rfi-1', updates: { description: 'new text' }, projectId: 'p1' })
    expect(h.validateRfiStatusTransition).not.toHaveBeenCalled()
    expect(h.chain.update).toHaveBeenCalled()
  })

  it('rejects invalid status transitions', async () => {
    h.validateRfiStatusTransition.mockRejectedValueOnce(new Error('Invalid transition: open → void'))
    const { result } = renderMutation(() => useUpdateRFI())
    await expect(
      result.current.mutateAsync({ id: 'rfi-1', updates: { status: 'void' }, projectId: 'p1' }),
    ).rejects.toThrow(/invalid transition/i)
    expect(h.chain.update).not.toHaveBeenCalled()
  })
})

describe('useDeleteRFI', () => {
  it('rejects without rfis.edit permission', async () => {
    h.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useDeleteRFI())
    await expect(result.current.mutateAsync({ id: 'rfi-1', projectId: 'p1' })).rejects.toThrow(/permission/i)
    expect(h.chain.delete).not.toHaveBeenCalled()
  })

  it('deletes row and invalidates cache', async () => {
    const { result } = renderMutation(() => useDeleteRFI())
    await result.current.mutateAsync({ id: 'rfi-1', projectId: 'p1' })
    expect(h.chain.delete).toHaveBeenCalled()
    expect(h.chain.eq).toHaveBeenCalledWith('id', 'rfi-1')
    await waitFor(() => expect(h.invalidateEntity).toHaveBeenCalledWith('rfi', 'test-project'))
  })
})
