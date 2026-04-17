import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------
const mockFrom = vi.fn()
const mockGetUser = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getUser: () => mockGetUser() },
  },
}))

// ---------------------------------------------------------------------------
// Base integration helpers mock
// ---------------------------------------------------------------------------
const mockLogSyncResult = vi.fn()
const mockUpdateIntegrationStatus = vi.fn()
const mockCreateIntegrationRecord = vi.fn()

vi.mock('./base', () => ({
  logSyncResult: (...args: unknown[]) => mockLogSyncResult(...args),
  updateIntegrationStatus: (...args: unknown[]) => mockUpdateIntegrationStatus(...args),
  createIntegrationRecord: (...args: unknown[]) => mockCreateIntegrationRecord(...args),
}))

import { procoreProvider } from './procore'

// ---------------------------------------------------------------------------
// Fetch mock
// ---------------------------------------------------------------------------
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeFetchOk(data: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
}

function makeFetchError(status: number, statusText: string) {
  return Promise.resolve({ ok: false, status, statusText, json: () => Promise.resolve({}) })
}

// ---------------------------------------------------------------------------
// Chain builder
// ---------------------------------------------------------------------------
function makeChain(
  listData: unknown = null,
  error: unknown = null,
  singleData?: unknown,
) {
  const singleResult = { data: singleData !== undefined ? singleData : null, error }
  const listResult = { data: listData, error }

  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.upsert = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(singleResult)
  chain.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
    Promise.resolve(listResult).then(resolve, reject)
  return chain
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('procoreProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockLogSyncResult.mockResolvedValue(undefined)
    mockUpdateIntegrationStatus.mockResolvedValue(undefined)
    mockCreateIntegrationRecord.mockResolvedValue('integration-abc')
    mockFrom.mockReturnValue(makeChain(null))
  })

  // ── connect ───────────────────────────────────────────────────────────────
  describe('connect', () => {
    it('returns error when apiKey is missing', async () => {
      const result = await procoreProvider.connect('proj-1', { companyId: '123' })

      expect(result.error).toBe('API Key and Company ID are required')
      expect(result.integrationId).toBe('')
    })

    it('returns error when companyId is missing', async () => {
      const result = await procoreProvider.connect('proj-1', { apiKey: 'key-abc' })

      expect(result.error).toBe('API Key and Company ID are required')
    })

    it('connects successfully when credentials are valid', async () => {
      mockFetch.mockReturnValue(makeFetchOk({ id: '999', name: 'Acme Corp' })) // company verify
      mockFrom.mockReturnValue(makeChain(null)) // update integration

      const result = await procoreProvider.connect('proj-1', { apiKey: 'abc12345xyz', companyId: '999' })

      expect(result.error).toBeUndefined()
      expect(result.integrationId).toBe('integration-abc')
      expect(mockCreateIntegrationRecord).toHaveBeenCalledWith(
        'procore_import',
        'proj-1',
        expect.objectContaining({ companyId: '999', apiKeyPrefix: 'abc12345...' }),
        'user-1',
      )
    })

    it('returns error when API verification fails', async () => {
      mockFetch.mockReturnValue(makeFetchError(401, 'Unauthorized'))

      const result = await procoreProvider.connect('proj-1', { apiKey: 'bad-key', companyId: '999' })

      expect(result.error).toContain('Procore API error')
      expect(result.integrationId).toBe('')
    })
  })

  // ── disconnect ────────────────────────────────────────────────────────────
  describe('disconnect', () => {
    it('updates integration status to disconnected', async () => {
      await procoreProvider.disconnect('integration-abc')

      expect(mockUpdateIntegrationStatus).toHaveBeenCalledWith('integration-abc', 'disconnected')
    })
  })

  // ── sync ──────────────────────────────────────────────────────────────────
  describe('sync', () => {
    it('rejects export direction', async () => {
      const result = await procoreProvider.sync('integration-abc', 'export')

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Procore integration only supports import')
    })

    it('returns error when integration config is missing', async () => {
      mockFrom.mockReturnValue(makeChain(null, null, { config: null }))

      const result = await procoreProvider.sync('integration-abc', 'import')

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Integration config not found')
    })

    it('imports RFIs and submittals successfully', async () => {
      const config = { apiKey: 'key-abc', companyId: '999', projectId: 'procore-proj-1' }
      const procoreRfis = [
        { id: 1, number: 1, subject: 'Footing depth', status: 'Open', priority: 'High', created_at: '2024-01-01T00:00:00Z' },
      ]
      const procoreSubmittals = [
        { id: 2, number: 2, title: 'Concrete mix', status: { name: 'Approved' }, created_at: '2024-01-02T00:00:00Z' },
      ]

      // Sequence: fetch config → fetch RFIs → upsert RFI → fetch submittals → upsert submittal
      mockFrom
        .mockReturnValueOnce(makeChain(null, null, { config })) // fetch config
        .mockReturnValueOnce(makeChain(null))                    // upsert rfi-1
        .mockReturnValueOnce(makeChain(null))                    // upsert submittal-1

      mockFetch
        .mockReturnValueOnce(makeFetchOk(procoreRfis))       // GET rfis
        .mockReturnValueOnce(makeFetchOk(procoreSubmittals)) // GET submittals

      const result = await procoreProvider.sync('integration-abc', 'import')

      expect(result.success).toBe(true)
      expect(result.recordsSynced).toBe(2)
      expect(result.recordsFailed).toBe(0)
    })

    it('tracks partial failures when individual upserts fail', async () => {
      const config = { apiKey: 'key-abc', companyId: '999', projectId: 'procore-proj-1' }
      const procoreRfis = [
        { id: 1, number: 1, subject: 'RFI A', status: 'Open', priority: 'Normal', created_at: '2024-01-01T00:00:00Z' },
      ]

      // The inner try/catch only fires when the await rejects — return a rejected promise
      mockFrom
        .mockReturnValueOnce(makeChain(null, null, { config })) // fetch config
        .mockReturnValueOnce({ upsert: vi.fn().mockRejectedValue(new Error('unique constraint')) }) // upsert throws

      mockFetch
        .mockReturnValueOnce(makeFetchOk(procoreRfis))
        .mockReturnValueOnce(makeFetchOk([]))

      const result = await procoreProvider.sync('integration-abc', 'import')

      expect(result.recordsFailed).toBeGreaterThan(0)
    })
  })

  // ── getStatus ─────────────────────────────────────────────────────────────
  describe('getStatus', () => {
    it('returns connected status with last sync', async () => {
      mockFrom.mockReturnValue(makeChain(null, null, {
        status: 'connected',
        last_sync: '2024-06-01T12:00:00Z',
        error_log: null,
      }))

      const status = await procoreProvider.getStatus('integration-abc')

      expect(status.status).toBe('connected')
      expect(status.lastSync).toBe('2024-06-01T12:00:00Z')
      expect(status.error).toBeUndefined()
    })

    it('returns first error from error_log array', async () => {
      mockFrom.mockReturnValue(makeChain(null, null, {
        status: 'error',
        last_sync: null,
        error_log: ['Token expired', 'Retry failed'],
      }))

      const status = await procoreProvider.getStatus('integration-abc')

      expect(status.status).toBe('error')
      expect(status.error).toBe('Token expired')
    })

    it('returns disconnected status when no data found', async () => {
      mockFrom.mockReturnValue(makeChain(null, null, null))

      const status = await procoreProvider.getStatus('integration-abc')

      expect(status.status).toBe('disconnected')
    })
  })

  // ── getCapabilities ───────────────────────────────────────────────────────
  describe('getCapabilities', () => {
    it('returns import capabilities', () => {
      const caps = procoreProvider.getCapabilities()

      expect(caps).toContain('rfi_import')
      expect(caps).toContain('submittal_import')
      expect(caps).toContain('project_import')
    })
  })
})

// ---------------------------------------------------------------------------
// Status mapping (via sync side-effects)
// ---------------------------------------------------------------------------
describe('Procore status mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockLogSyncResult.mockResolvedValue(undefined)
    mockUpdateIntegrationStatus.mockResolvedValue(undefined)
  })

  it('maps Procore RFI statuses to SiteSync equivalents', async () => {
    const config = { apiKey: 'key', companyId: '1', projectId: '10' }
    const rfis = [
      { id: 1, number: 1, subject: 'A', status: 'Draft', priority: 'Low', created_at: '2024-01-01T00:00:00Z' },
      { id: 2, number: 2, subject: 'B', status: 'Closed', priority: 'Medium', created_at: '2024-01-01T00:00:00Z' },
      { id: 3, number: 3, subject: 'C', status: 'Unknown', priority: 'High', created_at: '2024-01-01T00:00:00Z' },
    ]

    const upsertArgs: unknown[][] = []
    const upsertChain = {
      upsert: vi.fn((data: unknown) => { upsertArgs.push([data]); return upsertChain }),
      then: (r: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(r),
    }

    mockFrom
      .mockReturnValueOnce(makeChain(null, null, { config }))
      .mockReturnValue(upsertChain)

    mockFetch
      .mockReturnValueOnce(Promise.resolve({ ok: true, json: () => Promise.resolve(rfis) }))
      .mockReturnValueOnce(Promise.resolve({ ok: true, json: () => Promise.resolve([]) }))

    await procoreProvider.sync('int-1', 'import')

    expect(upsertArgs[0][0]).toMatchObject({ status: 'draft' })
    expect(upsertArgs[1][0]).toMatchObject({ status: 'closed' })
    expect(upsertArgs[2][0]).toMatchObject({ status: 'open' }) // default
  })
})
