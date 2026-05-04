// RFI Flow Integration — exercises the create → list → detail → respond →
// close path against a mocked Supabase client + the rfiMachine. Complements
// the per-step lifecycle coverage in lifecycles.test.ts with a single
// end-to-end walk-through that mirrors what a real user would do.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createActor } from 'xstate'
import { rfiMachine, getNextStatus as getRfiNext } from '../../machines/rfiMachine'
import { rfiFactory } from '../factories'

const { makeChain, mockInsertRow, mockListRows, mockDetailRow, mockUpdateRow } =
  vi.hoisted(() => {
    const state: {
      insertRow: Record<string, unknown> | null
      listRows: Record<string, unknown>[]
      detailRow: Record<string, unknown> | null
      updateRow: Record<string, unknown> | null
    } = {
      insertRow: null,
      listRows: [],
      detailRow: null,
      updateRow: null,
    }

    function chain() {
      const c: Record<string, unknown> = {}
      // Read path
      c.select = vi.fn().mockReturnValue(c)
      c.eq = vi.fn().mockReturnValue(c)
      c.in = vi.fn().mockReturnValue(c)
      c.order = vi.fn().mockResolvedValue({ data: state.listRows, error: null, count: state.listRows.length })
      c.range = vi.fn().mockResolvedValue({ data: state.listRows, error: null, count: state.listRows.length })
      c.single = vi.fn().mockImplementation(() => {
        if (state.updateRow) return Promise.resolve({ data: state.updateRow, error: null })
        if (state.insertRow) return Promise.resolve({ data: state.insertRow, error: null })
        return Promise.resolve({ data: state.detailRow, error: null })
      })
      c.maybeSingle = vi.fn().mockResolvedValue({ data: state.detailRow, error: null })
      // Write path
      c.insert = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        state.insertRow = {
          id: 'rfi-id-1',
          number: 1,
          status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...payload,
        }
        return c
      })
      c.update = vi.fn().mockImplementation((patch: Record<string, unknown>) => {
        state.updateRow = { ...(state.detailRow ?? state.insertRow ?? {}), ...patch, updated_at: new Date().toISOString() }
        return c
      })
      c.delete = vi.fn().mockReturnValue(c)
      return c
    }

    return {
      makeChain: chain,
      mockInsertRow: (row: Record<string, unknown> | null) => { state.insertRow = row },
      mockListRows: (rows: Record<string, unknown>[]) => { state.listRows = rows },
      mockDetailRow: (row: Record<string, unknown> | null) => { state.detailRow = row },
      mockUpdateRow: (row: Record<string, unknown> | null) => { state.updateRow = row },
    }
  })

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn().mockImplementation(() => makeChain()) },
  isSupabaseConfigured: true,
}))

import { supabase } from '../../lib/supabase'

describe('RFI end-to-end flow', () => {
  beforeEach(() => {
    mockInsertRow(null)
    mockListRows([])
    mockDetailRow(null)
    mockUpdateRow(null)
    vi.clearAllMocks()
  })

  it('create → appears in list → detail loads → response → status updates', async () => {
    // Step 1: Create
    const payload = { project_id: 'proj-1', title: 'Clarify grid B3 connection', created_by: 'user-1' }
    const insertRes = await supabase.from('rfis').insert(payload).select().single()
    expect(insertRes.data).toMatchObject({ id: 'rfi-id-1', title: payload.title, status: 'draft' })
    const createdId = (insertRes.data as Record<string, unknown>).id as string

    // Step 2: Appears in list (seed list from the insert row)
    mockListRows([insertRes.data as Record<string, unknown>])
    const listRes = await supabase.from('rfis').select('*').eq('project_id', 'proj-1').order('created_at')
    expect(listRes.data).toHaveLength(1)
    expect(((listRes.data as Record<string, unknown>[])[0]).id).toBe(createdId)

    // Step 3: Detail load by id
    mockDetailRow(insertRes.data as Record<string, unknown>)
    mockUpdateRow(null) // single() should return detail, not update row
    const detailRes = await supabase.from('rfis').select('*').eq('id', createdId).single()
    expect(detailRes.data).toMatchObject({ id: createdId, status: 'draft' })

    // Step 4: State-machine lifecycle — submit (draft → open)
    const actor = createActor(rfiMachine)
    actor.start()
    expect(actor.getSnapshot().value).toBe('draft')
    actor.send({ type: 'SUBMIT' })
    expect(actor.getSnapshot().value).toBe('open')
    expect(getRfiNext('draft', 'Submit')).toBe('open')

    // Persist the status move
    const openRes = await supabase.from('rfis').update({ status: 'open' } as never).eq('id', createdId).select().single()
    expect(openRes.data).toMatchObject({ status: 'open' })

    // Step 5: Add a response — assign to reviewer, then respond
    actor.send({ type: 'ASSIGN', assigneeId: 'reviewer-1' })
    expect(actor.getSnapshot().value).toBe('under_review')
    actor.send({ type: 'RESPOND', content: 'Use W14x22 per spec 5.2', userId: 'reviewer-1' })
    expect(actor.getSnapshot().value).toBe('answered')

    const respondRes = await supabase
      .from('rfis')
      .update({ status: 'answered', response: 'Use W14x22 per spec 5.2' } as never)
      .eq('id', createdId)
      .select()
      .single()
    expect(respondRes.data).toMatchObject({ status: 'answered', response: 'Use W14x22 per spec 5.2' })

    // Step 6: Close
    actor.send({ type: 'CLOSE', userId: 'user-1' })
    expect(actor.getSnapshot().value).toBe('closed')
    const closeRes = await supabase.from('rfis').update({ status: 'closed' } as never).eq('id', createdId).select().single()
    expect(closeRes.data).toMatchObject({ status: 'closed' })
    actor.stop()
  })

  it('list pagination returns multiple factories', async () => {
    const rows = rfiFactory.buildList(3)
    mockListRows(rows)
    const res = await supabase.from('rfis').select('*').order('created_at')
    expect(res.data).toHaveLength(3)
  })

  it('insert payload is passed through unchanged', async () => {
    const payload = { project_id: 'p', title: 'T', priority: 'high' }
    const res = await supabase.from('rfis').insert(payload).select().single()
    expect(res.data).toMatchObject(payload)
  })
})
