import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock hoists to the top of the file so any module-scope vars it
// references must be hoisted alongside it via vi.hoisted().
const h = vi.hoisted(() => {
  const upsertMock = vi.fn().mockResolvedValue({ error: null })
  const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock })
  return { upsertMock, fromMock }
})

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: h.fromMock,
  },
}))

import { seedDemoProject, resetDemoProject } from './demoSeed'

const { upsertMock, fromMock } = h

describe('demoSeed', () => {
  beforeEach(() => {
    upsertMock.mockClear()
    fromMock.mockClear()
    upsertMock.mockResolvedValue({ error: null })
  })

  it('seedDemoProject upserts the project first', async () => {
    const result = await seedDemoProject('org-test-1')
    expect(result.ok).toBe(true)
    expect(fromMock).toHaveBeenCalled()
    // First from() call should be 'projects'
    expect(fromMock.mock.calls[0][0]).toBe('projects')
  })

  it('seedDemoProject touches all 8 expected tables', async () => {
    await seedDemoProject('org-test-2')
    const tablesCalled = fromMock.mock.calls.map((c) => c[0])
    expect(tablesCalled).toContain('projects')
    expect(tablesCalled).toContain('schedule_phases')
    expect(tablesCalled).toContain('rfis')
    expect(tablesCalled).toContain('submittals')
    expect(tablesCalled).toContain('change_orders')
    expect(tablesCalled).toContain('punch_items')
    expect(tablesCalled).toContain('daily_logs')
    expect(tablesCalled).toContain('drawings')
  })

  it('seedDemoProject is fail-soft: records errors and continues', async () => {
    // Make schedule_phases insert fail; others should still try.
    upsertMock.mockImplementation(() => Promise.resolve({ error: null }))
    let callIdx = 0
    upsertMock.mockImplementation(() => {
      callIdx++
      // Second call (after projects) is schedule_phases — fail it.
      if (callIdx === 2) return Promise.resolve({ error: { message: 'fk violation' } })
      return Promise.resolve({ error: null })
    })

    const result = await seedDemoProject('org-test-3')
    expect(result.ok).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: 'schedule_phases', error: 'fk violation' }),
      ]),
    )
    // The seeder should still have called all 8 tables despite the one failure.
    const tablesCalled = fromMock.mock.calls.map((c) => c[0])
    expect(new Set(tablesCalled).size).toBeGreaterThanOrEqual(7)
  })

  it('seedDemoProject aborts only if the project upsert itself fails', async () => {
    upsertMock.mockResolvedValueOnce({ error: { message: 'projects table missing' } })
    const result = await seedDemoProject('org-test-4')
    expect(result.ok).toBe(false)
    expect(result.rows_inserted).toBe(0)
    expect(result.errors).toEqual([{ table: 'projects', error: 'projects table missing' }])
  })

  it('resetDemoProject is just an alias of seedDemoProject (idempotent reseed)', async () => {
    await resetDemoProject('org-test-5')
    const tablesCalled = fromMock.mock.calls.map((c) => c[0])
    expect(tablesCalled[0]).toBe('projects')
  })

  it('different orgs produce different derived ids on the same logical row', async () => {
    // Inspect the first arg passed to projects.upsert for two different orgs.
    fromMock.mockClear()

    await seedDemoProject('org-A')
    const projectRowA = upsertMock.mock.calls[0][0] as { id: string }

    fromMock.mockClear()
    upsertMock.mockClear()
    await seedDemoProject('org-B')
    const projectRowB = upsertMock.mock.calls[0][0] as { id: string }

    expect(projectRowA.id).not.toEqual(projectRowB.id)
    expect(projectRowA.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('same org produces identical derived ids on re-seed (idempotency)', async () => {
    await seedDemoProject('org-stable')
    const idsRun1 = upsertMock.mock.calls.map((c) => (c[0] as { id?: string } | { id?: string }[])).flat()

    fromMock.mockClear()
    upsertMock.mockClear()
    await seedDemoProject('org-stable')
    const idsRun2 = upsertMock.mock.calls.map((c) => (c[0] as { id?: string } | { id?: string }[])).flat()

    expect(idsRun1.length).toEqual(idsRun2.length)
    // First (project) row id must match exactly across runs.
    expect((idsRun1[0] as { id?: string })?.id).toEqual((idsRun2[0] as { id?: string })?.id)
  })

  it('all derived ids are valid UUID-shaped strings', async () => {
    await seedDemoProject('org-shape-check')
    const allRows = upsertMock.mock.calls.flatMap((c) => {
      const arg = c[0]
      return Array.isArray(arg) ? arg : [arg]
    }) as Array<{ id?: string }>
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    for (const row of allRows) {
      expect(row.id).toMatch(uuidPattern)
    }
  })
})
