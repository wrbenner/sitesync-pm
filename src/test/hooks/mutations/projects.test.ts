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
      updateProject: vi.fn().mockResolvedValue({ data: null, error: null }),
      deleteProject: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
})

vi.mock('../../../services/projectService', () => ({
  projectService: {
    updateProject: h.updateProject,
    deleteProject: h.deleteProject,
  },
}))
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

import { useUpdateProject, useDeleteProject } from '../../../hooks/mutations/projects'

beforeEach(() => {
  vi.clearAllMocks()
  h.hasPermission.mockReturnValue(true)
  h.updateProject.mockResolvedValue({ data: null, error: null })
  h.deleteProject.mockResolvedValue({ data: null, error: null })
})

describe('useUpdateProject', () => {
  it('rejects without project.settings permission', async () => {
    h.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useUpdateProject())
    await expect(
      result.current.mutateAsync({ projectId: 'p1', updates: { name: 'New' } }),
    ).rejects.toThrow(/permission/i)
    expect(h.updateProject).not.toHaveBeenCalled()
  })
  it('calls projectService.updateProject and invalidates', async () => {
    const { result } = renderMutation(() => useUpdateProject())
    await result.current.mutateAsync({ projectId: 'p1', updates: { name: 'New Name' } })
    expect(h.updateProject).toHaveBeenCalledWith('p1', { name: 'New Name' })
    await waitFor(() => expect(h.posthogCapture).toHaveBeenCalledWith('project_updated', expect.any(Object)))
  })
  it('surfaces service errors', async () => {
    h.updateProject.mockResolvedValue({ data: null, error: { userMessage: 'not authorized' } })
    const { result } = renderMutation(() => useUpdateProject())
    await expect(
      result.current.mutateAsync({ projectId: 'p1', updates: { name: 'x' } }),
    ).rejects.toThrow(/not authorized/i)
  })
})

describe('useDeleteProject', () => {
  it('requires project.delete permission', async () => {
    h.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useDeleteProject())
    await expect(result.current.mutateAsync({ projectId: 'p1' })).rejects.toThrow(/permission/i)
  })
  it('calls projectService.deleteProject', async () => {
    const { result } = renderMutation(() => useDeleteProject())
    await result.current.mutateAsync({ projectId: 'p1' })
    expect(h.deleteProject).toHaveBeenCalledWith('p1')
  })
})
