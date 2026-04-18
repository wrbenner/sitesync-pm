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
  validateTaskStatusTransition: vi.fn().mockResolvedValue(undefined),
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
vi.mock('../../../hooks/mutations/state-machine-validation-helpers', () => ({
  validateTaskStatusTransition: mocks.validateTaskStatusTransition,
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
  mocks.hasPermission.mockReturnValue(true)
  sb.setResult({ data: { id: 't1', title: validTask.title }, error: null })
})

describe('useCreateTask', () => {
  it('rejects without tasks.create permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
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
    expect(sb.supabase.from).toHaveBeenCalledWith('tasks')
    expect(sb.chain.insert).toHaveBeenCalledWith(validTask)
    await waitFor(() => expect(mocks.invalidateEntity).toHaveBeenCalledWith('task', 'test-project'))
  })
})

describe('useUpdateTask', () => {
  it('validates status transition before DB write', async () => {
    const { result } = renderMutation(() => useUpdateTask())
    await result.current.mutateAsync({ id: 't1', updates: { status: 'done' }, projectId: 'p1' })
    expect(mocks.validateTaskStatusTransition).toHaveBeenCalledWith('t1', 'p1', 'done')
    expect(sb.chain.update).toHaveBeenCalled()
  })
  it('skips validator when no status change', async () => {
    const { result } = renderMutation(() => useUpdateTask())
    await result.current.mutateAsync({ id: 't1', updates: { title: 'new' }, projectId: 'p1' })
    expect(mocks.validateTaskStatusTransition).not.toHaveBeenCalled()
  })
})

describe('useDeleteTask', () => {
  it('requires tasks.delete permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useDeleteTask())
    await expect(result.current.mutateAsync({ id: 't1', projectId: 'p1' })).rejects.toThrow(/permission/i)
  })
  it('deletes and invalidates', async () => {
    const { result } = renderMutation(() => useDeleteTask())
    await result.current.mutateAsync({ id: 't1', projectId: 'p1' })
    expect(sb.chain.delete).toHaveBeenCalled()
    await waitFor(() => expect(mocks.invalidateEntity).toHaveBeenCalledWith('task', 'test-project'))
  })
})
