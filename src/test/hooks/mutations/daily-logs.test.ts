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

import { useCreateDailyLog, useUpdateDailyLog, useDeleteDailyLog } from '../../../hooks/mutations/daily-logs'

const validLog = {
  date: '2026-04-18',
  weather_condition: 'clear' as const,
  temperature_high: '72',
  temperature_low: '55',
  crew_count: '18',
  activities: 'Pour concrete on level 3',
  safety_notes: '',
  delays: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hasPermission.mockReturnValue(true)
  sb.setResult({ data: { id: 'dl1', date: validLog.date }, error: null })
})

describe('useCreateDailyLog', () => {
  it('rejects without daily_log.create permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useCreateDailyLog())
    await expect(result.current.mutateAsync({ data: validLog, projectId: 'p1' })).rejects.toThrow(/permission/i)
  })
  it('rejects empty date via Zod', async () => {
    const { result } = renderMutation(() => useCreateDailyLog())
    await expect(
      result.current.mutateAsync({ data: { ...validLog, date: '' }, projectId: 'p1' }),
    ).rejects.toThrow(/validation/i)
  })
  it('inserts and invalidates', async () => {
    const { result } = renderMutation(() => useCreateDailyLog())
    await result.current.mutateAsync({ data: validLog, projectId: 'p1' })
    expect(sb.supabase.from).toHaveBeenCalledWith('daily_logs')
    expect(sb.chain.insert).toHaveBeenCalledWith(validLog)
    await waitFor(() => expect(mocks.invalidateEntity).toHaveBeenCalledWith('daily_log', 'test-project'))
  })
})

describe('useUpdateDailyLog', () => {
  it('updates row', async () => {
    const { result } = renderMutation(() => useUpdateDailyLog())
    await result.current.mutateAsync({ id: 'dl1', updates: { activities: 'new activity' }, projectId: 'p1' })
    expect(sb.chain.update).toHaveBeenCalled()
  })
})

describe('useDeleteDailyLog', () => {
  it('deletes row', async () => {
    const { result } = renderMutation(() => useDeleteDailyLog())
    await result.current.mutateAsync({ id: 'dl1', projectId: 'p1' })
    expect(sb.chain.delete).toHaveBeenCalled()
  })
})
