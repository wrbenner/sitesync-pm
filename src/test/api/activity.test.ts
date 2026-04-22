import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../api/client', () => ({
  supabase: { from: vi.fn() },
  transformSupabaseError: vi.fn((e) => e),
}))

vi.mock('../../api/middleware/projectScope', () => ({
  assertProjectAccess: vi.fn(),
}))

vi.mock('../../hooks/useProjectCache', () => ({
  getCachedEntityLabel: vi.fn(() => undefined),
  setCachedEntityLabel: vi.fn(),
}))

import { supabase } from '../../api/client'
import { enrichActivityItem } from '../../api/endpoints/activity'

const PROJECT_A = 'project-a'
const PROJECT_B = 'project-b'
const ENTITY_ID = 'entity-from-b'

function makeChain(returnData: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: returnData, error: null }),
  }
  return chain
}

describe('fetchEntityLabel project_id isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes project_id eq filter for rfi queries', async () => {
    const chain = makeChain({ number: 1, title: 'Leak' })
    vi.mocked(supabase.from).mockReturnValue(chain as never)

    await enrichActivityItem(
      { id: 'act-1', type: 'rfi', metadata: { entity_id: ENTITY_ID }, project_id: PROJECT_A },
      PROJECT_A,
    )

    expect(supabase.from).toHaveBeenCalledWith('rfis')
    const eqCalls: [string, string][] = chain.eq.mock.calls
    expect(eqCalls).toContainEqual(['id', ENTITY_ID])
    expect(eqCalls).toContainEqual(['project_id', PROJECT_A])
  })

  it('passes project_id eq filter for submittal queries', async () => {
    const chain = makeChain({ number: 2, title: 'Steel shop drawings' })
    vi.mocked(supabase.from).mockReturnValue(chain as never)

    await enrichActivityItem(
      { id: 'act-2', type: 'submittal', metadata: { entity_id: ENTITY_ID }, project_id: PROJECT_A },
      PROJECT_A,
    )

    expect(supabase.from).toHaveBeenCalledWith('submittals')
    const eqCalls: [string, string][] = chain.eq.mock.calls
    expect(eqCalls).toContainEqual(['id', ENTITY_ID])
    expect(eqCalls).toContainEqual(['project_id', PROJECT_A])
  })

  it('passes project_id eq filter for change_order queries', async () => {
    const chain = makeChain({ co_number: 3, description: 'Added scope' })
    vi.mocked(supabase.from).mockReturnValue(chain as never)

    await enrichActivityItem(
      { id: 'act-3', type: 'change_order', metadata: { entity_id: ENTITY_ID }, project_id: PROJECT_A },
      PROJECT_A,
    )

    expect(supabase.from).toHaveBeenCalledWith('change_orders')
    const eqCalls: [string, string][] = chain.eq.mock.calls
    expect(eqCalls).toContainEqual(['id', ENTITY_ID])
    expect(eqCalls).toContainEqual(['project_id', PROJECT_A])
  })

  it('returns empty string when entity belongs to a different project', async () => {
    // Supabase returns null data when project_id filter excludes the row
    const chain = makeChain(null)
    vi.mocked(supabase.from).mockReturnValue(chain as never)

    const result = await enrichActivityItem(
      { id: 'act-4', type: 'rfi', metadata: { entity_id: ENTITY_ID }, project_id: PROJECT_A, title: '' },
      PROJECT_A,
    )

    // entity is from PROJECT_B but we query with PROJECT_A — no data returned
    expect(result.entityLabel).toBe('')
  })

  it('never queries without a project_id eq call', async () => {
    for (const entityType of ['rfi', 'submittal', 'change_order']) {
      vi.clearAllMocks()
      const chain = makeChain({ number: 1, title: 'x', co_number: 1, description: 'x' })
      vi.mocked(supabase.from).mockReturnValue(chain as never)

      await enrichActivityItem(
        { id: 'act-5', type: entityType, metadata: { entity_id: ENTITY_ID }, project_id: PROJECT_B },
        PROJECT_B,
      )

      const eqCalls: [string, string][] = chain.eq.mock.calls
      const projectIdFiltered = eqCalls.some(([col]) => col === 'project_id')
      expect(projectIdFiltered, `${entityType} query missing project_id filter`).toBe(true)
    }
  })
})
