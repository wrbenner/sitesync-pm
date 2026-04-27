import { describe, it, expect, beforeEach, vi } from 'vitest'

// search.ts holds an Orama instance at module scope. Reset modules between
// tests so a stale searchDb from one test doesn't leak into the next.
let createSearchIndex: typeof import('./search').createSearchIndex
let searchAll: typeof import('./search').searchAll
let invalidateSearchIndex: typeof import('./search').invalidateSearchIndex

beforeEach(async () => {
  vi.resetModules()
  const mod = await import('./search')
  createSearchIndex = mod.createSearchIndex
  searchAll = mod.searchAll
  invalidateSearchIndex = mod.invalidateSearchIndex
})

describe('search — createSearchIndex', () => {
  it('builds an index from an empty source set without throwing', async () => {
    const db = await createSearchIndex({})
    expect(db).toBeDefined()
  })

  it('indexes documents from every supported source bucket', async () => {
    await createSearchIndex({
      rfis: [{ id: 1, rfiNumber: 'RFI-001', title: 'Slab pour clearance', status: 'open', from: 'Foreman A' }],
      submittals: [{ id: 2, submittalNumber: 'SUB-009', title: 'Anchor bolts', status: 'in_review', from: 'Steel sub' }],
      punchList: [{ id: 3, itemNumber: 'PI-011', description: 'Caulk gap level 2', area: 'East wing', status: 'open' }],
      drawings: [{ id: 4, setNumber: 'A-101', title: 'Floor plan', discipline: 'Architectural' }],
      tasks: [{ id: 5, title: 'Survey grade', assignee: { name: 'John' }, status: 'open' }],
      directory: [{ id: 6, contactName: 'Jane', company: 'Acme', role: 'PE' }],
      files: [{ id: 7, name: 'photo.jpg', type: 'image/jpeg' }],
    })

    const r = await searchAll('slab')
    expect(r.length).toBeGreaterThan(0)
    expect(r[0].type).toBe('rfi')
  })
})

describe('search — searchAll', () => {
  it('finds entities across types via partial term match', async () => {
    await createSearchIndex({
      rfis: [{ id: 1, rfiNumber: 'RFI-007', title: 'Concrete strength', status: 'open', from: 'Foreman' }],
      submittals: [{ id: 2, submittalNumber: 'SUB-001', title: 'Concrete mix design', status: 'open', from: 'GC' }],
    })
    const r = await searchAll('concrete')
    const types = new Set(r.map((h) => h.type))
    expect(types.has('rfi')).toBe(true)
    expect(types.has('submittal')).toBe(true)
  })

  it('respects the limit parameter', async () => {
    const rfis = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      rfiNumber: `RFI-${i}`,
      title: 'shared keyword',
      status: 'open',
      from: 'F',
    }))
    await createSearchIndex({ rfis })
    const r = await searchAll('shared', 5)
    expect(r.length).toBeLessThanOrEqual(5)
  })

  it('returns an empty array for a no-match query', async () => {
    await createSearchIndex({
      rfis: [{ id: 1, rfiNumber: 'RFI-1', title: 'lighting', status: 'open', from: 'Z' }],
    })
    const r = await searchAll('xyzqrs_does_not_exist')
    expect(r).toEqual([])
  })

  it('lazy-builds an index when searchAll is called before createSearchIndex', async () => {
    const r = await searchAll('anything', 10, {
      rfis: [{ id: 1, rfiNumber: 'RFI-1', title: 'anything goes here', status: 'open', from: 'Z' }],
    })
    expect(Array.isArray(r)).toBe(true)
  })

  it('result rows expose the route link for navigation', async () => {
    await createSearchIndex({
      drawings: [{ id: 4, setNumber: 'A-101', title: 'Floor plan', discipline: 'Architectural' }],
    })
    const r = await searchAll('floor')
    expect(r[0].link).toBe('/drawings')
  })
})

describe('search — invalidateSearchIndex', () => {
  it('forces a rebuild on next search call', async () => {
    await createSearchIndex({
      rfis: [{ id: 1, rfiNumber: 'RFI-1', title: 'old data', status: 'open', from: 'Z' }],
    })
    expect((await searchAll('old')).length).toBeGreaterThan(0)

    invalidateSearchIndex()

    // After invalidation, searchAll must lazy-rebuild from the supplied sources
    // (otherwise it would surface the stale "old data" doc).
    const after = await searchAll('fresh', 10, {
      rfis: [{ id: 2, rfiNumber: 'RFI-2', title: 'fresh data', status: 'open', from: 'A' }],
    })
    expect(after[0]?.title.toLowerCase().includes('fresh')).toBe(true)
  })
})
