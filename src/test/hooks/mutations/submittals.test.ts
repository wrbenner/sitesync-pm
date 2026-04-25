import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderMutation } from './_helpers'

const h = vi.hoisted(() => {
  const pending = { current: { data: { id: 's1' }, error: null as { message: string } | null } }
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
    validateSubmittalStatusTransition: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('../../../lib/supabase', () => ({ supabase: h.supabase, fromTable: h.supabase.from, isSupabaseConfigured: true }))
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
  validateSubmittalStatusTransition: h.validateSubmittalStatusTransition,
}))

import { useCreateSubmittal, useUpdateSubmittal, useDeleteSubmittal } from '../../../hooks/mutations/submittals'

const validSubmittal = {
  title: 'Structural shop drawings',
  spec_section: '05 12 00',
  type: 'shop_drawing' as const,
  subcontractor: '',
  due_date: '',
  description: '',
  related_rfi_id: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  h.hasPermission.mockReturnValue(true)
  h.setResult({ data: { id: 's1' }, error: null })
})

describe('useCreateSubmittal', () => {
  it('rejects without submittals.create permission', async () => {
    h.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useCreateSubmittal())
    await expect(result.current.mutateAsync({ data: validSubmittal, projectId: 'p1' })).rejects.toThrow(/permission/i)
    expect(h.chain.insert).not.toHaveBeenCalled()
  })
  it('rejects empty title via Zod', async () => {
    const { result } = renderMutation(() => useCreateSubmittal())
    await expect(result.current.mutateAsync({ data: { ...validSubmittal, title: '' }, projectId: 'p1' })).rejects.toThrow(/validation/i)
  })
  it('inserts and invalidates', async () => {
    const { result } = renderMutation(() => useCreateSubmittal())
    await result.current.mutateAsync({ data: validSubmittal, projectId: 'p1' })
    expect(h.supabase.from).toHaveBeenCalledWith('submittals')
    // sanitizeSubmittalData converts empty-string optional fields to null
    expect(h.chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: validSubmittal.title,
        spec_section: validSubmittal.spec_section,
        type: validSubmittal.type,
      }),
    )
    await waitFor(() => expect(h.invalidateEntity).toHaveBeenCalledWith('submittal', 'test-project'))
    expect(h.posthogCapture).toHaveBeenCalledWith('submittal_created', expect.any(Object))
  })
})

describe('useUpdateSubmittal', () => {
  it('validates status transition before DB write', async () => {
    const { result } = renderMutation(() => useUpdateSubmittal())
    await result.current.mutateAsync({ id: 's1', updates: { status: 'approved' }, projectId: 'p1' })
    expect(h.validateSubmittalStatusTransition).toHaveBeenCalledWith('s1', 'p1', 'approved')
    expect(h.chain.update).toHaveBeenCalled()
  })
  it('skips validator when no status change', async () => {
    const { result } = renderMutation(() => useUpdateSubmittal())
    await result.current.mutateAsync({ id: 's1', updates: { description: 'x' }, projectId: 'p1' })
    expect(h.validateSubmittalStatusTransition).not.toHaveBeenCalled()
  })
})

describe('useDeleteSubmittal', () => {
  it('requires submittals.delete permission', async () => {
    h.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useDeleteSubmittal())
    await expect(result.current.mutateAsync({ id: 's1', projectId: 'p1' })).rejects.toThrow(/permission/i)
  })
  it('deletes and invalidates', async () => {
    const { result } = renderMutation(() => useDeleteSubmittal())
    await result.current.mutateAsync({ id: 's1', projectId: 'p1' })
    expect(h.chain.delete).toHaveBeenCalled()
    await waitFor(() => expect(h.invalidateEntity).toHaveBeenCalledWith('submittal', 'test-project'))
  })
})
