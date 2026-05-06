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
  h.hasPermission.mockReturnValue(true)
  h.setResult({ data: { id: 'm1', title: validMeeting.title }, error: null })
})

describe('useCreateMeeting', () => {
  it('rejects without meetings.create permission', async () => {
    h.hasPermission.mockReturnValue(false)
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
    expect(h.supabase.from).toHaveBeenCalledWith('meetings')
    expect(h.chain.insert).toHaveBeenCalledWith(validMeeting)
    await waitFor(() => expect(h.invalidateEntity).toHaveBeenCalledWith('meeting', 'test-project'))
  })
})

describe('useUpdateMeeting', () => {
  it('updates row and invalidates', async () => {
    const { result } = renderMutation(() => useUpdateMeeting())
    await result.current.mutateAsync({ id: 'm1', updates: { location: 'Room 201' }, projectId: 'p1' })
    expect(h.chain.update).toHaveBeenCalled()
  })
})

describe('useDeleteMeeting', () => {
  it('requires meetings.delete permission', async () => {
    h.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useDeleteMeeting())
    await expect(result.current.mutateAsync({ id: 'm1', projectId: 'p1' })).rejects.toThrow(/permission/i)
  })
  it('deletes and invalidates', async () => {
    const { result } = renderMutation(() => useDeleteMeeting())
    await result.current.mutateAsync({ id: 'm1', projectId: 'p1' })
    expect(h.chain.delete).toHaveBeenCalled()
    await waitFor(() => expect(h.invalidateEntity).toHaveBeenCalledWith('meeting', 'test-project'))
  })
})
