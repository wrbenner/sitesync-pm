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
  validatePunchItemStatusTransition: vi.fn().mockResolvedValue(undefined),
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
  validatePunchItemStatusTransition: mocks.validatePunchItemStatusTransition,
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
  mocks.hasPermission.mockReturnValue(true)
  sb.setResult({ data: { id: 'pi1', title: validItem.title }, error: null })
})

describe('useCreatePunchItem', () => {
  it('rejects without punch_list.create permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
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
    expect(sb.supabase.from).toHaveBeenCalledWith('punch_items')
    expect(sb.chain.insert).toHaveBeenCalledWith(validItem)
    await waitFor(() => expect(mocks.invalidateEntity).toHaveBeenCalledWith('punch_item', 'test-project'))
  })
})

describe('useUpdatePunchItem', () => {
  it('validates status transition when status changes', async () => {
    const { result } = renderMutation(() => useUpdatePunchItem())
    await result.current.mutateAsync({ id: 'pi1', updates: { status: 'resolved' }, projectId: 'p1' })
    expect(mocks.validatePunchItemStatusTransition).toHaveBeenCalledWith('pi1', 'p1', 'resolved')
    expect(sb.chain.update).toHaveBeenCalled()
  })
})

describe('useDeletePunchItem', () => {
  it('requires punch_list.delete permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useDeletePunchItem())
    await expect(result.current.mutateAsync({ id: 'pi1', projectId: 'p1' })).rejects.toThrow(/permission/i)
  })
  it('deletes and invalidates', async () => {
    const { result } = renderMutation(() => useDeletePunchItem())
    await result.current.mutateAsync({ id: 'pi1', projectId: 'p1' })
    expect(sb.chain.delete).toHaveBeenCalled()
    await waitFor(() => expect(mocks.invalidateEntity).toHaveBeenCalledWith('punch_item', 'test-project'))
  })
})
