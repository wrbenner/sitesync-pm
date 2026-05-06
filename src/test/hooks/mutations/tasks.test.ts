import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderMutation } from './_helpers'

const h = vi.hoisted(() => {
  const pending: { current: { data: Record<string, unknown> & { id: string }; error: { message: string } | null } } = { current: { data: { id: 'mock-id' }, error: null } }
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
      validateTaskStatusTransition: vi.fn().mockResolvedValue(undefined),
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
  validateTaskStatusTransition: h.validateTaskStatusTransition,
}))

import { useCreateTask, useUpdateTask, useDeleteTask } from '../../../hooks/mutations/tasks'

const validTask = {
  title: 'Install rebar',
  description: '',
  status: 'todo' as const,
  priority: 'medium' as const,
  assigned_to: '',
  start_date: '',
  end_date: '',
  is_critical_path: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  h.hasPermission.mockReturnValue(true)
  h.setResult({ data: { id: 't1', title: validTask.title }, error: null })
})

describe('useCreateTask', () => {
  it('rejects without tasks.create permission', async () => {
    h.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useCreateTask())
    await expect(result.current.mutateAsync({ data: validTask, projectId: 'p1' })).rejects.toThrow(/permission/i)
  })
  it('rejects empty title', async () => {
    const { result } = renderMutation(() => useCreateTask())
    await expect(
      result.current.mutateAsync({ data: { ...validTask, title: '' }, projectId: 'p1' }),
    ).rejects.toThrow(/validation/i)
  })
  it('inserts and invalidates', async () => {
    const { result } = renderMutation(() => useCreateTask())
    await result.current.mutateAsync({ data: validTask, projectId: 'p1' })
    expect(h.supabase.from).toHaveBeenCalledWith('tasks')
    expect(h.chain.insert).toHaveBeenCalledWith(validTask)
    await waitFor(() => expect(h.invalidateEntity).toHaveBeenCalledWith('task', 'test-project'))
  })
})

describe('useUpdateTask', () => {
  it('validates status transition before DB write', async () => {
    const { result } = renderMutation(() => useUpdateTask())
    await result.current.mutateAsync({ id: 't1', updates: { status: 'done' }, projectId: 'p1' })
    expect(h.validateTaskStatusTransition).toHaveBeenCalledWith('t1', 'p1', 'done')
    expect(h.chain.update).toHaveBeenCalled()
  })
  it('skips validator when no status change', async () => {
    const { result } = renderMutation(() => useUpdateTask())
    await result.current.mutateAsync({ id: 't1', updates: { title: 'new' }, projectId: 'p1' })
    expect(h.validateTaskStatusTransition).not.toHaveBeenCalled()
  })
})

describe('useDeleteTask', () => {
  it('requires tasks.delete permission', async () => {
    h.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useDeleteTask())
    await expect(result.current.mutateAsync({ id: 't1', projectId: 'p1' })).rejects.toThrow(/permission/i)
  })
  it('deletes and invalidates', async () => {
    const { result } = renderMutation(() => useDeleteTask())
    await result.current.mutateAsync({ id: 't1', projectId: 'p1' })
    expect(h.chain.delete).toHaveBeenCalled()
    await waitFor(() => expect(h.invalidateEntity).toHaveBeenCalledWith('task', 'test-project'))
  })
})
