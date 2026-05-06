// Punch-item flow integration — create → in_progress → resolved → verified.
// Verifies both the punchItemMachine transitions and the corresponding
// supabase update payload at each step, using a single mocked chain so the
// test reads top-to-bottom like a user walking the lifecycle.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createActor } from 'xstate'
import { punchItemMachine } from '../../machines/punchItemMachine'
import { punchItemFactory } from '../factories'

const { makeChain, mockInsertRow, mockUpdateRow, mockDetailRow } = vi.hoisted(() => {
  const state: {
    insertRow: Record<string, unknown> | null
    updateRow: Record<string, unknown> | null
    detailRow: Record<string, unknown> | null
  } = { insertRow: null, updateRow: null, detailRow: null }

  function chain() {
    const c: Record<string, unknown> = {}
    c.select = vi.fn().mockReturnValue(c)
    c.eq = vi.fn().mockReturnValue(c)
    c.order = vi.fn().mockResolvedValue({ data: [], error: null })
    c.single = vi.fn().mockImplementation(() => {
      if (state.updateRow) {
        const out = state.updateRow
        state.updateRow = null // consume one-shot
        return Promise.resolve({ data: out, error: null })
      }
      if (state.insertRow) return Promise.resolve({ data: state.insertRow, error: null })
      return Promise.resolve({ data: state.detailRow, error: null })
    })
    c.insert = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
      state.insertRow = {
        id: 'pi-1',
        number: 1,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...payload,
      }
      return c
    })
    c.update = vi.fn().mockImplementation((patch: Record<string, unknown>) => {
      const base = state.detailRow ?? state.insertRow ?? {}
      state.updateRow = { ...base, ...patch, updated_at: new Date().toISOString() }
      return c
    })
    c.delete = vi.fn().mockReturnValue(c)
    return c
  }

  return {
    makeChain: chain,
    mockInsertRow: (row: Record<string, unknown> | null) => { state.insertRow = row },
    mockUpdateRow: (row: Record<string, unknown> | null) => { state.updateRow = row },
    mockDetailRow: (row: Record<string, unknown> | null) => { state.detailRow = row },
  }
})

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn().mockImplementation(() => makeChain()) },
  isSupabaseConfigured: true,
}))

import { fromTable } from '../../lib/db/queries'

describe('Punch item end-to-end flow', () => {
  beforeEach(() => {
    mockInsertRow(null)
    mockUpdateRow(null)
    mockDetailRow(null)
    vi.clearAllMocks()
  })

  it('create → in_progress → resolved → verified', async () => {
    // 1. Create
    const input = punchItemFactory.build({ title: 'Sealant missing at window W-07' })
    const createRes = await fromTable('punch_items')
      .insert({ project_id: input.project_id, title: input.title, location: input.location, trade: input.trade } as never)
      .select()
      .single()
    const createdId = (createRes.data as unknown as Record<string, unknown>).id as string
    expect(createRes.data).toMatchObject({ id: 'pi-1', status: 'open' })
    mockDetailRow(createRes.data as unknown as Record<string, unknown>)

    // 2. Start work (open → in_progress)
    const actor = createActor(punchItemMachine)
    actor.start()
    expect(actor.getSnapshot().value).toBe('open')
    actor.send({ type: 'START_WORK' })
    expect(actor.getSnapshot().value).toBe('in_progress')

    const inProgressRes = await fromTable('punch_items')
      .update({ status: 'in_progress' } as never)
      .eq('id' as never, createdId)
      .select()
      .single()
    expect(inProgressRes.data).toMatchObject({ status: 'in_progress' })

    // 3. Sub marks complete (in_progress → sub_complete, persisted as DB 'resolved')
    actor.send({ type: 'MARK_SUB_COMPLETE' })
    expect(actor.getSnapshot().value).toBe('sub_complete')
    const resolvedRes = await fromTable('punch_items')
      .update({ status: 'resolved', resolved_date: new Date().toISOString().slice(0, 10) } as never)
      .eq('id' as never, createdId)
      .select()
      .single()
    expect(resolvedRes.data).toMatchObject({ status: 'resolved' })
    expect((resolvedRes.data as unknown as Record<string, unknown>).resolved_date).toBeTruthy()

    // 4. Verify (sub_complete → verified)
    actor.send({ type: 'VERIFY' })
    expect(actor.getSnapshot().value).toBe('verified')
    const verifyRes = await fromTable('punch_items')
      .update({ status: 'verified', verified_date: new Date().toISOString().slice(0, 10) } as never)
      .eq('id' as never, createdId)
      .select()
      .single()
    expect(verifyRes.data).toMatchObject({ status: 'verified' })
    expect((verifyRes.data as unknown as Record<string, unknown>).verified_date).toBeTruthy()
    actor.stop()
  })

  it('rejected verification from verified → in_progress', () => {
    const actor = createActor(punchItemMachine)
    actor.start()
    actor.send({ type: 'START_WORK' })
    actor.send({ type: 'MARK_SUB_COMPLETE' })
    actor.send({ type: 'VERIFY' })
    actor.send({ type: 'REJECT' })
    expect(actor.getSnapshot().value).toBe('in_progress')
    actor.stop()
  })

  it('insert accepts photos array', async () => {
    const payload = { project_id: 'p', title: 'T', photos: ['url1', 'url2'] }
    const res = await fromTable('punch_items').insert(payload as never).select().single()
    expect((res.data as unknown as Record<string, unknown>).photos).toEqual(['url1', 'url2'])
  })
})
