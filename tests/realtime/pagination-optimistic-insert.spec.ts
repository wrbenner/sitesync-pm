/**
 * FMEA M.OPT.3 — Pagination + optimistic insert breaks count
 *
 * Hazard: a paginated list (TanStack useInfiniteQuery, cursor-based) holds
 *         page 1 with 20 items + total: 240. Optimistic insert prepends a
 *         row. Now (a) page 1 has 21 items + the server cursor doesn't know,
 *         (b) `total` is stale by +1 on every cached page, (c) rollback
 *         must splice the optimistic row out without disturbing the cursor.
 *
 * Pure-unit test on the canonical InfiniteData merger.
 */
import { describe, it, expect } from 'vitest'

// ── Canonical InfiniteData<T> shape used by src/api/client.ts ────────
interface Page<T> {
  data: T[]
  nextCursor: string | null
  hasMore: boolean
  total: number
}
interface InfiniteData<T> {
  pages: Page<T>[]
  pageParams: (string | undefined)[]
}
interface Item {
  id: string
  title: string
  _optimistic?: boolean
}

// ── Canonical optimistic mergers (the contracts under test) ──────────
function optimisticInsert<T extends { id: string }>(
  data: InfiniteData<T>,
  newItem: T,
): InfiniteData<T> {
  if (data.pages.length === 0) {
    return {
      pageParams: [undefined],
      pages: [{ data: [newItem], nextCursor: null, hasMore: false, total: 1 }],
    }
  }
  const [firstPage, ...rest] = data.pages
  return {
    pageParams: data.pageParams,
    pages: [
      { ...firstPage, data: [newItem, ...firstPage.data], total: firstPage.total + 1 },
      // Every cached page must keep total in sync.
      ...rest.map((p) => ({ ...p, total: p.total + 1 })),
    ],
  }
}

function rollbackOptimistic<T extends { id: string }>(
  data: InfiniteData<T>,
  rolledBackId: string,
): InfiniteData<T> {
  return {
    pageParams: data.pageParams,
    pages: data.pages.map((p) => {
      const filtered = p.data.filter((d) => d.id !== rolledBackId)
      const removed = filtered.length !== p.data.length
      return {
        ...p,
        data: filtered,
        total: removed ? p.total - 1 : p.total,
      }
    }),
  }
}

function dedupOnServerEcho<T extends { id: string; _optimistic?: boolean }>(
  data: InfiniteData<T>,
  serverItem: T,
): InfiniteData<T> {
  // Splice server row over the optimistic placeholder, dropping _optimistic.
  return {
    pageParams: data.pageParams,
    pages: data.pages.map((p) => ({
      ...p,
      data: p.data.map((d) => (d.id === serverItem.id ? { ...serverItem } : d)),
    })),
  }
}

// ── Tests ────────────────────────────────────────────────────────────

function seedPage1(): InfiniteData<Item> {
  return {
    pageParams: [undefined],
    pages: [
      {
        data: Array.from({ length: 20 }, (_, i) => ({
          id: `row-${i + 1}`,
          title: `Row ${i + 1}`,
        })),
        nextCursor: 'cursor-page-2',
        hasMore: true,
        total: 240,
      },
    ],
  }
}

describe('FMEA M.OPT.3 — pagination + optimistic insert breaks count', () => {
  it('optimistic insert: page 1 grows by 1, total grows by 1', () => {
    const seed = seedPage1()
    const next = optimisticInsert(seed, {
      id: 'optim-1',
      title: 'fresh',
      _optimistic: true,
    })
    expect(next.pages[0].data).toHaveLength(21)
    expect(next.pages[0].total).toBe(241)
    expect(next.pages[0].data[0].id).toBe('optim-1')
    // Original list still readable.
    expect(next.pages[0].data[1].id).toBe('row-1')
    expect(next.pages[0].data[20].id).toBe('row-20')
  })

  it('multi-page: total stays in sync across all cached pages', () => {
    const seed: InfiniteData<Item> = {
      pageParams: [undefined, 'cursor-page-2'],
      pages: [
        {
          data: Array.from({ length: 20 }, (_, i) => ({ id: `p1-${i}`, title: `P1-${i}` })),
          nextCursor: 'cursor-page-2',
          hasMore: true,
          total: 240,
        },
        {
          data: Array.from({ length: 20 }, (_, i) => ({ id: `p2-${i}`, title: `P2-${i}` })),
          nextCursor: 'cursor-page-3',
          hasMore: true,
          total: 240,
        },
      ],
    }
    const next = optimisticInsert(seed, { id: 'optim-A', title: 'new' })

    expect(next.pages[0].total).toBe(241)
    expect(next.pages[1].total).toBe(241) // every page agrees
    expect(next.pages[0].data).toHaveLength(21)
    expect(next.pages[1].data).toHaveLength(20) // unchanged
  })

  it('rollback: removes the optimistic row without disturbing the cursor', () => {
    const seed = seedPage1()
    const inserted = optimisticInsert(seed, {
      id: 'optim-1',
      title: 'fresh',
      _optimistic: true,
    })
    const rolled = rollbackOptimistic(inserted, 'optim-1')

    expect(rolled.pages[0].data).toHaveLength(20)
    expect(rolled.pages[0].total).toBe(240)
    expect(rolled.pages[0].nextCursor).toBe('cursor-page-2') // cursor preserved
    expect(rolled.pages[0].data[0].id).toBe('row-1')
  })

  it('dedup on server echo: optimistic row is replaced by server row in place', () => {
    const seed = seedPage1()
    const inserted = optimisticInsert(seed, {
      id: 'server-id-1',
      title: 'fresh (optim)',
      _optimistic: true,
    })
    const merged = dedupOnServerEcho(inserted, {
      id: 'server-id-1',
      title: 'fresh (server)',
    })
    expect(merged.pages[0].data).toHaveLength(21)
    expect(merged.pages[0].data[0].title).toBe('fresh (server)')
    expect(merged.pages[0].data[0]._optimistic).toBeUndefined()
    expect(merged.pages[0].total).toBe(241) // total preserved across echo
  })

  it('empty cache: optimistic insert seeds page 1 correctly', () => {
    const empty: InfiniteData<Item> = { pageParams: [], pages: [] }
    const next = optimisticInsert(empty, { id: 'first', title: 'first' })
    expect(next.pages).toHaveLength(1)
    expect(next.pages[0].data).toHaveLength(1)
    expect(next.pages[0].total).toBe(1)
    expect(next.pages[0].hasMore).toBe(false)
  })

  it('contract: render-count never exceeds total, hasMore preserved', () => {
    // UI displays "showing N of M": N from pages.flatMap(p=>p.data).length,
    // M from pages[0].total. Inserts must keep N <= M and hasMore intact.
    const seed = seedPage1()
    const inserted = optimisticInsert(seed, { id: 'optim', title: 't' })
    const renderedCount = inserted.pages.flatMap((p) => p.data).length
    expect(renderedCount).toBe(21)
    expect(inserted.pages[0].total).toBe(241)
    expect(renderedCount).toBeLessThanOrEqual(inserted.pages[0].total)
    expect(inserted.pages[0].hasMore).toBe(true)
    expect(inserted.pages[0].nextCursor).toBe('cursor-page-2')
  })
})
