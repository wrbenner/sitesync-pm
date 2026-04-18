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

import { useCreateBudgetItem, useDeleteBudgetItem } from '../../../hooks/mutations/budget'

const validItem = { description: 'Structural steel', csi_code: '05 12 00', original_amount: 150000 }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hasPermission.mockReturnValue(true)
  sb.setResult({ data: { id: 'bi1', ...validItem }, error: null })
})

describe('useCreateBudgetItem', () => {
  it('rejects without budget.edit permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useCreateBudgetItem())
    await expect(
      result.current.mutateAsync({ data: validItem, projectId: 'p1' }),
    ).rejects.toThrow(/permission/i)
  })
  it('rejects empty description via Zod', async () => {
    const { result } = renderMutation(() => useCreateBudgetItem())
    await expect(
      result.current.mutateAsync({ data: { ...validItem, description: '' }, projectId: 'p1' }),
    ).rejects.toThrow(/validation/i)
  })
  it('inserts with project_id and invalidates cost caches', async () => {
    const { result } = renderMutation(() => useCreateBudgetItem())
    await result.current.mutateAsync({ data: validItem, projectId: 'p1' })
    expect(sb.supabase.from).toHaveBeenCalledWith('budget_line_items')
    expect(sb.chain.insert).toHaveBeenCalledWith(expect.objectContaining({ project_id: 'p1' }))
    await waitFor(() => expect(mocks.posthogCapture).toHaveBeenCalledWith('budget_item_created', expect.any(Object)))
  })
})

describe('useDeleteBudgetItem', () => {
  it('requires budget.edit permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    const { result } = renderMutation(() => useDeleteBudgetItem())
    await expect(result.current.mutateAsync({ id: 'bi1', projectId: 'p1' })).rejects.toThrow(/permission/i)
  })
  it('deletes row', async () => {
    const { result } = renderMutation(() => useDeleteBudgetItem())
    await result.current.mutateAsync({ id: 'bi1', projectId: 'p1' })
    expect(sb.chain.delete).toHaveBeenCalled()
    expect(sb.chain.eq).toHaveBeenCalledWith('id', 'bi1')
  })
})
