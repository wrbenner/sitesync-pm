import { describe, it, expect } from 'vitest'
import { loadSnapshot } from '../snapshot'

describe('loadSnapshot', () => {
  it('returns a shell snapshot with the requested project_id and dates', async () => {
    const fakeSupabase = { from: () => null }
    const snap = await loadSnapshot(fakeSupabase, 'p1', new Date('2026-04-29T00:00:00Z'))
    expect(snap.meta.project_id).toBe('p1')
    expect(snap.meta.period_end).toContain('2026-04-29')
    expect(snap.rfis).toEqual([])
  })

  it('honors custom period start', async () => {
    const fakeSupabase = { from: () => null }
    const snap = await loadSnapshot(
      fakeSupabase,
      'p1',
      new Date('2026-04-29T00:00:00Z'),
      new Date('2026-04-01T00:00:00Z'),
    )
    expect(snap.meta.period_start).toContain('2026-04-01')
  })

  it('returns deterministic empty arrays for all sections', async () => {
    const snap = await loadSnapshot({ from: () => null }, 'p1', new Date())
    expect(snap.submittals).toEqual([])
    expect(snap.change_orders).toEqual([])
    expect(snap.punch_items).toEqual([])
    expect(snap.daily_logs).toEqual([])
    expect(snap.inspections).toEqual([])
    expect(snap.payments).toEqual([])
  })
})
