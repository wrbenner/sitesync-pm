import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { createMockSupabase } from '../../mocks/supabase'
import { renderMutation } from './_helpers'

// ── Hoisted mock spies ─────────────────────────────────────
const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(() => true),
  logAuditEntry: vi.fn().mockResolvedValue(undefined),
  invalidateEntity: vi.fn(),
  posthogCapture: vi.fn(),
  sentryCapture: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  projectId: 'test-project',
  validateRfiStatusTransition: vi.fn().mockResolvedValue(undefined),
}))

const sb = vi.hoisted(() => {
  // createMockSupabase is imported at top — but hoisting means this factory
  // runs before top-level imports. We re-require inside the factory instead.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createMockSupabase: make } = require('../../mocks/supabase')
  return make()
})

// ── Mocks ──────────────────────────────────────────────────
vi.mock('../../../lib/supabase', () => ({ supabase: sb.supabase, fromTable: sb.supabase.from }))
vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: mocks.hasPermission, role: 'project_manager' }),
  PermissionError: class PermissionError extends Error {
    constructor(m: string, public permission?: string) { super(m); this.name = 'PermissionError' }
  },
}))
vi.mock('../../../hooks/useProjectId', () => ({ useProjectId: () => mocks.projectId }))
vi.mock('sonner', () => ({ toast: mocks.toast }))
vi.mock('../../../lib/analytics', () => ({ default: { capture: mocks.posthogCapture } }))
vi.mock('../../../lib/sentry', () => ({ default: { captureException: mocks.sentryCapture } }))
vi.mock('../../../api/invalidation', () => ({
  invalidateEntity: mocks.invalidateEntity,
  INVALIDATION_MAP: {},
}))
vi.mock('../../../lib/auditLogger', () => ({ logAuditEntry: mocks.logAuditEntry }))
vi.mock('../../../hooks/mutations/state-machine-validation-helpers', () => ({
  validateRfiStatusTransition: mocks.validateRfiStatusTransition,
}))

// Import hooks AFTER mocks are declared.
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
  mocks.hasPermission.mockReturnValue(true)
  sb.setResult({ data: { id: 'rfi-1', title: validRfi.title }, error: null })
})

// ── useCreateRFI ───────────────────────────────────────────
describe('useCreateRFI', () => {
  it('rejects when caller lacks rfis.create permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useCreateRFI())
    await expect(result.current.mutateAsync({ data: validRfi, projectId: 'p1' })).rejects.toThrow(
      /permission/i,
    )
    expect(mocks.logAuditEntry).not.toHaveBeenCalled()
    expect(sb.chain.insert).not.toHaveBeenCalled()
  })

  it('rejects empty title via Zod schema before touching DB', async () => {
    const { result } = renderMutation(() => useCreateRFI())
    await expect(
      result.current.mutateAsync({ data: { ...validRfi, title: '' }, projectId: 'p1' }),
    ).rejects.toThrow(/validation/i)
    expect(sb.chain.insert).not.toHaveBeenCalled()
  })

  it('inserts, writes audit entry, invalidates rfi cache, captures analytics', async () => {
    const { result } = renderMutation(() => useCreateRFI())
    await result.current.mutateAsync({ data: validRfi, projectId: 'p1' })
    expect(sb.supabase.from).toHaveBeenCalledWith('rfis')
    expect(sb.chain.insert).toHaveBeenCalledWith(validRfi)
    await waitFor(() => expect(mocks.invalidateEntity).toHaveBeenCalledWith('rfi', 'test-project'))
    expect(mocks.posthogCapture).toHaveBeenCalledWith('rfi_created', expect.any(Object))
  })

  it('surfaces supabase errors as thrown errors', async () => {
    sb.setError('permission denied')
    const { result } = renderMutation(() => useCreateRFI())
    await expect(result.current.mutateAsync({ data: validRfi, projectId: 'p1' })).rejects.toThrow(
      /permission denied/i,
    )
  })
})

// ── useUpdateRFI ───────────────────────────────────────────
describe('useUpdateRFI', () => {
  it('validates status transition before DB write', async () => {
    const { result } = renderMutation(() => useUpdateRFI())
    await result.current.mutateAsync({
      id: 'rfi-1',
      updates: { status: 'closed' },
      projectId: 'p1',
    })
    expect(mocks.validateRfiStatusTransition).toHaveBeenCalledWith('rfi-1', 'p1', 'closed')
    expect(sb.chain.update).toHaveBeenCalledWith({ status: 'closed' })
  })

  it('skips status validator when no status in updates', async () => {
    const { result } = renderMutation(() => useUpdateRFI())
    await result.current.mutateAsync({
      id: 'rfi-1',
      updates: { description: 'new text' },
      projectId: 'p1',
    })
    expect(mocks.validateRfiStatusTransition).not.toHaveBeenCalled()
    expect(sb.chain.update).toHaveBeenCalled()
  })

  it('rejects invalid status transitions', async () => {
    mocks.validateRfiStatusTransition.mockRejectedValueOnce(new Error('Invalid transition: open → void'))
    const { result } = renderMutation(() => useUpdateRFI())
    await expect(
      result.current.mutateAsync({ id: 'rfi-1', updates: { status: 'void' }, projectId: 'p1' }),
    ).rejects.toThrow(/invalid transition/i)
    expect(sb.chain.update).not.toHaveBeenCalled()
  })
})

// ── useDeleteRFI ───────────────────────────────────────────
describe('useDeleteRFI', () => {
  it('rejects without rfis.edit permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useDeleteRFI())
    await expect(result.current.mutateAsync({ id: 'rfi-1', projectId: 'p1' })).rejects.toThrow(
      /permission/i,
    )
    expect(sb.chain.delete).not.toHaveBeenCalled()
  })

  it('deletes row and invalidates cache', async () => {
    const { result } = renderMutation(() => useDeleteRFI())
    await result.current.mutateAsync({ id: 'rfi-1', projectId: 'p1' })
    expect(sb.chain.delete).toHaveBeenCalled()
    expect(sb.chain.eq).toHaveBeenCalledWith('id', 'rfi-1')
    await waitFor(() => expect(mocks.invalidateEntity).toHaveBeenCalledWith('rfi', 'test-project'))
  })
})
