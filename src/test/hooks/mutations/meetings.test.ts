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

import { useCreateMeeting, useUpdateMeeting, useDeleteMeeting } from '../../../hooks/mutations/meetings'

const validMeeting = {
  title: 'OAC weekly coordination',
  type: 'oac' as const,
  date: '2026-04-22',
  time: '09:00',
  location: 'Trailer conference room',
  duration_minutes: '60',
  agenda: 'Schedule review, RFI status',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hasPermission.mockReturnValue(true)
  sb.setResult({ data: { id: 'm1', title: validMeeting.title }, error: null })
})

describe('useCreateMeeting', () => {
  it('rejects without meetings.create permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useCreateMeeting())
    await expect(result.current.mutateAsync({ data: validMeeting, projectId: 'p1' })).rejects.toThrow(/permission/i)
  })
  it('rejects empty title', async () => {
    const { result } = renderMutation(() => useCreateMeeting())
    await expect(
      result.current.mutateAsync({ data: { ...validMeeting, title: '' }, projectId: 'p1' }),
    ).rejects.toThrow(/validation/i)
  })
  it('inserts and invalidates', async () => {
    const { result } = renderMutation(() => useCreateMeeting())
    await result.current.mutateAsync({ data: validMeeting, projectId: 'p1' })
    expect(sb.supabase.from).toHaveBeenCalledWith('meetings')
    expect(sb.chain.insert).toHaveBeenCalledWith(validMeeting)
    await waitFor(() => expect(mocks.invalidateEntity).toHaveBeenCalledWith('meeting', 'test-project'))
  })
})

describe('useUpdateMeeting', () => {
  it('updates row and invalidates', async () => {
    const { result } = renderMutation(() => useUpdateMeeting())
    await result.current.mutateAsync({ id: 'm1', updates: { location: 'Room 201' }, projectId: 'p1' })
    expect(sb.chain.update).toHaveBeenCalled()
  })
})

describe('useDeleteMeeting', () => {
  it('requires meetings.delete permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useDeleteMeeting())
    await expect(result.current.mutateAsync({ id: 'm1', projectId: 'p1' })).rejects.toThrow(/permission/i)
  })
  it('deletes and invalidates', async () => {
    const { result } = renderMutation(() => useDeleteMeeting())
    await result.current.mutateAsync({ id: 'm1', projectId: 'p1' })
    expect(sb.chain.delete).toHaveBeenCalled()
    await waitFor(() => expect(mocks.invalidateEntity).toHaveBeenCalledWith('meeting', 'test-project'))
  })
})
