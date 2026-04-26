import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase Functions invoke before importing the service.
const h = vi.hoisted(() => {
  const invoke = vi.fn()
  return { invoke }
})

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: { invoke: h.invoke },
  },
}))

import { importFromProcore } from './procoreImport'

describe('procoreImport', () => {
  beforeEach(() => {
    h.invoke.mockReset()
  })

  it('forwards the target project id, credentials, and scopes', async () => {
    h.invoke.mockResolvedValue({
      data: {
        ok: true,
        imported: { rfis: 5, submittals: 0, change_orders: 0, drawings: 0 },
        errors: [],
      },
      error: null,
    })

    await importFromProcore(
      'proj-1',
      { apiKey: 'pk-test', companyId: '99', procoreProjectId: 1234 },
      ['rfis', 'submittals'],
    )

    expect(h.invoke).toHaveBeenCalledTimes(1)
    expect(h.invoke).toHaveBeenCalledWith('procore-import', {
      body: {
        target_project_id: 'proj-1',
        procore: { api_key: 'pk-test', company_id: '99', procore_project_id: 1234 },
        scopes: ['rfis', 'submittals'],
      },
    })
  })

  it('passes scopes through unchanged when caller specifies a subset', async () => {
    h.invoke.mockResolvedValue({
      data: { ok: true, imported: { rfis: 0, submittals: 0, change_orders: 3, drawings: 0 }, errors: [] },
      error: null,
    })

    await importFromProcore(
      'proj-2',
      { apiKey: 'k', companyId: 'c', procoreProjectId: '7' },
      ['change_orders'],
    )

    expect(h.invoke.mock.calls[0][1]?.body.scopes).toEqual(['change_orders'])
  })

  it('omits the scopes field when none specified (server defaults to all)', async () => {
    h.invoke.mockResolvedValue({
      data: { ok: true, imported: { rfis: 1, submittals: 1, change_orders: 1, drawings: 1 }, errors: [] },
      error: null,
    })

    await importFromProcore('proj-3', { apiKey: 'k', companyId: 'c', procoreProjectId: '1' })

    expect(h.invoke.mock.calls[0][1]?.body.scopes).toBeUndefined()
  })

  it('returns the function result verbatim on success', async () => {
    const expected = {
      ok: true,
      imported: { rfis: 47, submittals: 12, change_orders: 6, drawings: 5 },
      errors: [],
    }
    h.invoke.mockResolvedValue({ data: expected, error: null })

    const r = await importFromProcore('p', { apiKey: 'k', companyId: 'c', procoreProjectId: 1 })
    expect(r).toEqual(expected)
  })

  it('normalizes invoke errors into the ImportResult shape', async () => {
    h.invoke.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const r = await importFromProcore('p', { apiKey: 'k', companyId: 'c', procoreProjectId: 1 })
    expect(r.ok).toBe(false)
    expect(r.imported).toEqual({ rfis: 0, submittals: 0, change_orders: 0, drawings: 0 })
    expect(r.errors).toEqual([{ scope: 'invoke', error: 'boom' }])
  })

  it('handles a successful invoke that somehow returns no data', async () => {
    h.invoke.mockResolvedValue({ data: null, error: null })

    const r = await importFromProcore('p', { apiKey: 'k', companyId: 'c', procoreProjectId: 1 })
    expect(r.ok).toBe(false)
    expect(r.errors[0].scope).toBe('invoke')
  })
})
