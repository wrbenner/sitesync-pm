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
  updateProject: vi.fn().mockResolvedValue({ data: null, error: null }),
  deleteProject: vi.fn().mockResolvedValue({ data: null, error: null }),
}))

vi.mock('../../../services/projectService', () => ({
  projectService: {
    updateProject: mocks.updateProject,
    deleteProject: mocks.deleteProject,
  },
}))
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

import { useUpdateProject, useDeleteProject } from '../../../hooks/mutations/projects'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hasPermission.mockReturnValue(true)
  mocks.updateProject.mockResolvedValue({ data: null, error: null })
  mocks.deleteProject.mockResolvedValue({ data: null, error: null })
})

describe('useUpdateProject', () => {
  it('rejects without project.settings permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useUpdateProject())
    await expect(
      result.current.mutateAsync({ projectId: 'p1', updates: { name: 'New' } }),
    ).rejects.toThrow(/permission/i)
    expect(mocks.updateProject).not.toHaveBeenCalled()
  })
  it('calls projectService.updateProject and invalidates', async () => {
    const { result } = renderMutation(() => useUpdateProject())
    await result.current.mutateAsync({ projectId: 'p1', updates: { name: 'New Name' } })
    expect(mocks.updateProject).toHaveBeenCalledWith('p1', { name: 'New Name' })
    await waitFor(() => expect(mocks.posthogCapture).toHaveBeenCalledWith('project_updated', expect.any(Object)))
  })
  it('surfaces service errors', async () => {
    mocks.updateProject.mockResolvedValue({ data: null, error: { userMessage: 'not authorized' } })
    const { result } = renderMutation(() => useUpdateProject())
    await expect(
      result.current.mutateAsync({ projectId: 'p1', updates: { name: 'x' } }),
    ).rejects.toThrow(/not authorized/i)
  })
})

describe('useDeleteProject', () => {
  it('requires project.delete permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useDeleteProject())
    await expect(result.current.mutateAsync({ projectId: 'p1' })).rejects.toThrow(/permission/i)
  })
  it('calls projectService.deleteProject', async () => {
    const { result } = renderMutation(() => useDeleteProject())
    await result.current.mutateAsync({ projectId: 'p1' })
    expect(mocks.deleteProject).toHaveBeenCalledWith('p1')
  })
})
