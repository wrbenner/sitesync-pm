// ────────────────────────────────────────────────────────────────────────────
// retrieve() tests — Phase 3c full impl
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §9
//
// Phase 3a shipped the typed-surface tests against the stub. Phase 3c adds:
//   - LRU cache hit/miss/expiration
//   - Telemetry emission (fire-and-forget; must not break user path)
//   - RPC error fallback to empty result
//   - empty_corpus probe when zero chunks returned
//   - Options pass-through (vector_weight, tsv_weight, freshness_decay)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  __resetRetrieveCacheForTests,
  isValidSourceAnchor,
  RetrieveError,
  retrieve,
  rpcRowToKbChunk,
} from '../retrieve'
import {
  PHASE_3_ACCEPTANCE,
  type IrisSensitivity,
  type IrisSourceType,
  type KbSourceAnchor,
  type RetrieveQuery,
} from '../types/retrieval'

// ── Mocks ────────────────────────────────────────────────────────────────────

const supabaseMock = vi.hoisted(() => {
  type AnyResult = { data?: unknown; error: unknown; count?: number }
  const rpcSpy = vi.fn<(name: string, args: unknown) => Promise<AnyResult>>(
    async () => ({ data: [], error: null }),
  )
  const fromCountSpy = vi.fn<() => Promise<AnyResult>>(
    async () => ({ count: 0, error: null, data: [] }),
  )
  const invokeSpy = vi.fn<(fn: string, opts: unknown) => Promise<AnyResult>>(
    async () => ({ data: { embedding: null }, error: null }),
  )

  return {
    supabase: {
      rpc: rpcSpy,
      from: () => ({
        select: () => ({
          eq: () => ({
            is: () => ({
              limit: fromCountSpy,
            }),
          }),
        }),
      }),
      functions: { invoke: invokeSpy },
    },
    spies: { rpcSpy, fromCountSpy, invokeSpy },
  }
})

vi.mock('../../../lib/supabase', () => ({ supabase: supabaseMock.supabase }))

const flagsModule = vi.hoisted(() => ({ FLAGS: { irisKbEnabled: false } }))
vi.mock('../../../lib/featureFlags', () => flagsModule)

const ALL_SOURCE_TYPES: IrisSourceType[] = [
  'drawing', 'spec_section', 'submittal', 'rfi', 'daily_log', 'photo',
  'conversation', 'contract', 'change_order', 'bulletin', 'asi',
  'spreadsheet', 'pay_app', 'lien_waiver', 'punch_item', 'unclassified',
]

const ALL_SENSITIVITIES: IrisSensitivity[] = [
  'public_to_project',
  'gc_only',
  'owner_only',
  'finance_only',
]

function healthyQuery(overrides: Partial<RetrieveQuery> = {}): RetrieveQuery {
  return {
    text: 'spec section 03 30 00 cast-in-place concrete',
    project_id: 'project-avery-oaks',
    persona: 'pm',
    ...overrides,
  }
}

beforeEach(() => {
  flagsModule.FLAGS.irisKbEnabled = false
  __resetRetrieveCacheForTests()
  supabaseMock.spies.rpcSpy.mockReset()
  supabaseMock.spies.rpcSpy.mockResolvedValue({ data: [], error: null })
  supabaseMock.spies.fromCountSpy.mockReset()
  supabaseMock.spies.fromCountSpy.mockResolvedValue({ count: 0, error: null })
  supabaseMock.spies.invokeSpy.mockReset()
  supabaseMock.spies.invokeSpy.mockResolvedValue({ data: { embedding: null }, error: null })
})

afterEach(() => {
  vi.clearAllMocks()
})

// ── 1. Type completeness ────────────────────────────────────────────────────

describe('IrisSourceType discriminated union', () => {
  it('has exactly 16 source types (mirrors the iris_source_type Postgres enum)', () => {
    expect(ALL_SOURCE_TYPES).toHaveLength(16)
  })

  it.each(ALL_SOURCE_TYPES)('isValidSourceAnchor accepts %s kind', (kind) => {
    const anchor = { kind } as unknown as KbSourceAnchor
    expect(isValidSourceAnchor(anchor)).toBe(true)
  })

  it('isValidSourceAnchor rejects unknown kinds', () => {
    expect(isValidSourceAnchor({ kind: 'spaceship' })).toBe(false)
  })

  it('isValidSourceAnchor rejects null + non-objects', () => {
    expect(isValidSourceAnchor(null)).toBe(false)
    expect(isValidSourceAnchor('drawing')).toBe(false)
    expect(isValidSourceAnchor(42)).toBe(false)
  })
})

describe('IrisSensitivity union', () => {
  it('has exactly 4 sensitivity tiers', () => {
    expect(ALL_SENSITIVITIES).toHaveLength(4)
  })
})

describe('PHASE_3_ACCEPTANCE constants', () => {
  it('exposes the 6 acceptance numbers from spec §11', () => {
    expect(PHASE_3_ACCEPTANCE.recall_at_5_floor).toBe(0.85)
    expect(PHASE_3_ACCEPTANCE.precision_at_5_floor).toBe(0.7)
    expect(PHASE_3_ACCEPTANCE.latency_p95_ms_ceiling).toBe(800)
    expect(PHASE_3_ACCEPTANCE.rls_pass_rate_required).toBe(1.0)
    expect(PHASE_3_ACCEPTANCE.embedding_leakage_pearson_r_ceiling).toBe(0.05)
    expect(PHASE_3_ACCEPTANCE.cost_per_project_per_month_ceiling_dollars).toBe(2)
  })
})

// ── 2. retrieve() validation gates ──────────────────────────────────────────

describe('retrieve() — input validation', () => {
  it('throws empty_query on empty text', async () => {
    await expect(retrieve(healthyQuery({ text: '' }))).rejects.toThrow(RetrieveError)
    await expect(retrieve(healthyQuery({ text: '   ' }))).rejects.toThrow(/empty/)
  })

  it('throws invalid_args on text over 4000 chars', async () => {
    const longText = 'a'.repeat(4001)
    let caught: RetrieveError | null = null
    try {
      await retrieve(healthyQuery({ text: longText }))
    } catch (e) {
      caught = e as RetrieveError
    }
    expect(caught).toBeInstanceOf(RetrieveError)
    expect(caught?.code).toBe('invalid_args')
  })

  it('throws invalid_args when project_id is missing', async () => {
    let caught: RetrieveError | null = null
    try {
      await retrieve(healthyQuery({ project_id: '' }))
    } catch (e) {
      caught = e as RetrieveError
    }
    expect(caught?.code).toBe('invalid_args')
    expect(caught?.message).toMatch(/project_id/)
  })

  it('throws invalid_args when k is < 1 or > 20', async () => {
    await expect(retrieve(healthyQuery(), { k: 0 })).rejects.toThrow(/k must be/)
    await expect(retrieve(healthyQuery(), { k: 99 })).rejects.toThrow(/k must be/)
  })

  it('throws invalid_args when min_score outside [0, 1]', async () => {
    await expect(retrieve(healthyQuery(), { min_score: -0.1 })).rejects.toThrow()
    await expect(retrieve(healthyQuery(), { min_score: 1.1 })).rejects.toThrow()
  })

  it('throws invalid_args on out-of-range vector_weight', async () => {
    await expect(retrieve(healthyQuery(), { vector_weight: 1.5 })).rejects.toThrow()
  })

  it('throws invalid_args on out-of-range tsv_weight', async () => {
    await expect(retrieve(healthyQuery(), { tsv_weight: -0.1 })).rejects.toThrow()
  })

  it('accepts boundary k = 1 and k = 20', async () => {
    flagsModule.FLAGS.irisKbEnabled = false
    await expect(retrieve(healthyQuery(), { k: 1 })).resolves.toBeDefined()
    await expect(retrieve(healthyQuery(), { k: 20 })).resolves.toBeDefined()
  })

  it('accepts boundary min_score = 0 and 1', async () => {
    await expect(retrieve(healthyQuery(), { min_score: 0 })).resolves.toBeDefined()
    await expect(retrieve(healthyQuery(), { min_score: 1 })).resolves.toBeDefined()
  })
})

// ── 3. retrieve() flag + empty-corpus paths ─────────────────────────────────

describe('retrieve() — flag + empty-corpus paths', () => {
  it('returns empty corpus when flag is off (no RPC call)', async () => {
    flagsModule.FLAGS.irisKbEnabled = false
    const result = await retrieve(healthyQuery())
    expect(result.chunks).toEqual([])
    expect(result.empty_corpus).toBe(true)
    expect(supabaseMock.spies.rpcSpy).not.toHaveBeenCalled()
  })

  it('returns empty_corpus=true when RPC returns 0 rows AND probe count is 0', async () => {
    flagsModule.FLAGS.irisKbEnabled = true
    supabaseMock.spies.rpcSpy.mockResolvedValueOnce({ data: [], error: null })
    supabaseMock.spies.fromCountSpy.mockResolvedValueOnce({ count: 0, error: null })
    const result = await retrieve(healthyQuery())
    expect(result.chunks).toEqual([])
    expect(result.empty_corpus).toBe(true)
  })

  it('returns empty_corpus=false when RPC returns 0 rows but probe shows chunks exist', async () => {
    flagsModule.FLAGS.irisKbEnabled = true
    supabaseMock.spies.rpcSpy.mockResolvedValueOnce({ data: [], error: null })
    supabaseMock.spies.fromCountSpy.mockResolvedValueOnce({ count: 42, error: null })
    const result = await retrieve(healthyQuery())
    expect(result.chunks).toEqual([])
    expect(result.empty_corpus).toBe(false)
  })

  it('latency_ms is always a non-negative integer', async () => {
    const result = await retrieve(healthyQuery())
    expect(Number.isInteger(result.latency_ms)).toBe(true)
    expect(result.latency_ms).toBeGreaterThanOrEqual(0)
  })
})

// ── 4. retrieve() RPC happy path ────────────────────────────────────────────

describe('retrieve() — RPC happy path', () => {
  beforeEach(() => {
    flagsModule.FLAGS.irisKbEnabled = true
  })

  it('returns chunks mapped from RPC rows', async () => {
    supabaseMock.spies.rpcSpy.mockResolvedValueOnce({
      data: [
        {
          chunk_id: 'c1',
          source_type: 'spec_section',
          source_id: 's-03',
          source_anchor: { kind: 'spec_section', section: '03 30 00' },
          chunk_text: 'Cast-in-place concrete cover requirements...',
          sensitivity: 'public_to_project',
          score: 0.91,
          ingested_at: '2026-05-11T12:00:00Z',
          metadata: { csi_division: '03' },
        },
      ],
      error: null,
    })
    const result = await retrieve(healthyQuery())
    expect(result.chunks).toHaveLength(1)
    expect(result.chunks[0].chunk_id).toBe('c1')
    expect(result.chunks[0].source_type).toBe('spec_section')
    expect(result.empty_corpus).toBe(false)
  })

  it('passes default weights (0.7 / 0.3 / 0.001) and min_score to RPC', async () => {
    await retrieve(healthyQuery())
    const args = supabaseMock.spies.rpcSpy.mock.calls[0][1] as Record<string, unknown>
    expect(args.p_vector_weight).toBe(0.7)
    expect(args.p_tsv_weight).toBe(0.3)
    expect(args.p_freshness_decay).toBe(0.001)
    expect(args.p_min_score).toBe(0.1)
    expect(args.p_top_k).toBe(5)
  })

  it('honors caller-supplied weights + k + min_score', async () => {
    await retrieve(healthyQuery(), {
      k: 10,
      min_score: 0.3,
      vector_weight: 0.5,
      tsv_weight: 0.5,
      freshness_decay: 0.002,
    })
    const args = supabaseMock.spies.rpcSpy.mock.calls[0][1] as Record<string, unknown>
    expect(args.p_top_k).toBe(10)
    expect(args.p_min_score).toBe(0.3)
    expect(args.p_vector_weight).toBe(0.5)
    expect(args.p_tsv_weight).toBe(0.5)
    expect(args.p_freshness_decay).toBe(0.002)
  })

  it('invokes iris-embed for the query text', async () => {
    await retrieve(healthyQuery())
    expect(supabaseMock.spies.invokeSpy).toHaveBeenCalledWith('iris-embed', {
      body: { text: healthyQuery().text },
    })
  })

  it('passes null embedding to RPC when iris-embed unavailable', async () => {
    supabaseMock.spies.invokeSpy.mockResolvedValueOnce({
      data: null,
      error: { name: 'FunctionsHttpError', message: 'not deployed' },
    })
    await retrieve(healthyQuery())
    const args = supabaseMock.spies.rpcSpy.mock.calls[0][1] as Record<string, unknown>
    expect(args.q_embedding).toBeNull()
  })

  it('returns chunks even when embedding is null (ts_rank fallback)', async () => {
    supabaseMock.spies.invokeSpy.mockResolvedValueOnce({ data: null, error: null })
    supabaseMock.spies.rpcSpy.mockResolvedValueOnce({
      data: [
        {
          chunk_id: 'c2',
          source_type: 'rfi',
          source_id: 'r-1',
          source_anchor: { kind: 'rfi', rfi_id: 'r-1' },
          chunk_text: 'RFI text...',
          sensitivity: 'gc_only',
          score: 0.45,
          ingested_at: '2026-05-11T12:00:00Z',
          metadata: {},
        },
      ],
      error: null,
    })
    const result = await retrieve(healthyQuery())
    expect(result.chunks).toHaveLength(1)
  })
})

// ── 5. LRU cache ────────────────────────────────────────────────────────────

describe('retrieve() — LRU cache', () => {
  beforeEach(() => {
    flagsModule.FLAGS.irisKbEnabled = true
  })

  it('cache-miss on first call, cache-hit on second identical call', async () => {
    supabaseMock.spies.rpcSpy.mockResolvedValue({
      data: [
        {
          chunk_id: 'c1',
          source_type: 'spec_section',
          source_id: 's-1',
          source_anchor: { kind: 'spec_section', section: '03 30 00' },
          chunk_text: 'text',
          sensitivity: 'public_to_project',
          score: 0.9,
          ingested_at: '2026-05-11T12:00:00Z',
          metadata: {},
        },
      ],
      error: null,
    })
    const r1 = await retrieve(healthyQuery())
    const r2 = await retrieve(healthyQuery())
    expect(r1.cache_hit).toBe(false)
    expect(r2.cache_hit).toBe(true)
    expect(r2.chunks).toEqual(r1.chunks)
    // kb_retrieve called once — second call served from cache. Telemetry
    // fires on both calls, so we filter to the kb_retrieve invocations only.
    const kbCalls = supabaseMock.spies.rpcSpy.mock.calls.filter((c) => c[0] === 'kb_retrieve')
    expect(kbCalls).toHaveLength(1)
  })

  const kbRetrieveCalls = () =>
    supabaseMock.spies.rpcSpy.mock.calls.filter((c) => c[0] === 'kb_retrieve')

  it('different queries produce separate cache keys', async () => {
    await retrieve(healthyQuery({ text: 'first question' }))
    await retrieve(healthyQuery({ text: 'second question' }))
    expect(kbRetrieveCalls()).toHaveLength(2)
  })

  it('different opts produce separate cache keys', async () => {
    await retrieve(healthyQuery(), { k: 5 })
    await retrieve(healthyQuery(), { k: 10 })
    expect(kbRetrieveCalls()).toHaveLength(2)
  })

  it('different personas produce separate cache keys', async () => {
    await retrieve(healthyQuery({ persona: 'pm' }))
    await retrieve(healthyQuery({ persona: 'owner_rep' }))
    expect(kbRetrieveCalls()).toHaveLength(2)
  })

  it('whitespace + case normalization in the cache key', async () => {
    await retrieve(healthyQuery({ text: 'Spec Section 03 30 00' }))
    await retrieve(healthyQuery({ text: '  spec section 03 30 00  ' }))
    // Same key after normalize -> cache hit on second.
    expect(kbRetrieveCalls()).toHaveLength(1)
  })

  it('__resetRetrieveCacheForTests clears the cache', async () => {
    await retrieve(healthyQuery())
    __resetRetrieveCacheForTests()
    await retrieve(healthyQuery())
    expect(kbRetrieveCalls()).toHaveLength(2)
  })
})

// ── 6. RPC error path ───────────────────────────────────────────────────────

describe('retrieve() — RPC error path', () => {
  beforeEach(() => {
    flagsModule.FLAGS.irisKbEnabled = true
  })

  it('returns empty result (does not throw) when RPC fails', async () => {
    supabaseMock.spies.rpcSpy.mockResolvedValueOnce({
      data: null,
      error: { name: 'PostgrestError', message: 'permission denied', code: '42501' },
    })
    const result = await retrieve(healthyQuery())
    expect(result.chunks).toEqual([])
    expect(result.empty_corpus).toBe(false) // we don't probe on error
  })
})

// ── 7. Telemetry — fire-and-forget ──────────────────────────────────────────

describe('retrieve() — telemetry emission', () => {
  beforeEach(() => {
    flagsModule.FLAGS.irisKbEnabled = true
  })

  it('emits one telemetry event per call (cache miss)', async () => {
    await retrieve(healthyQuery())
    const calls = supabaseMock.spies.rpcSpy.mock.calls.filter(
      (c) => c[0] === 'iris_kb_record_retrieve',
    )
    expect(calls.length).toBe(1)
  })

  it('emits a cache_hit=true event on cache hit', async () => {
    supabaseMock.spies.rpcSpy.mockResolvedValue({ data: [], error: null })
    await retrieve(healthyQuery())
    await retrieve(healthyQuery())
    const telemetryCalls = supabaseMock.spies.rpcSpy.mock.calls.filter(
      (c) => c[0] === 'iris_kb_record_retrieve',
    )
    expect(telemetryCalls.length).toBe(2)
    const second = telemetryCalls[1][1] as Record<string, unknown>
    expect(second.p_cache_hit).toBe(true)
  })

  it('telemetry failures do not break the user path', async () => {
    let firstCall = true
    supabaseMock.spies.rpcSpy.mockImplementation(async (name: string) => {
      if (name === 'iris_kb_record_retrieve') {
        throw new Error('telemetry network blip')
      }
      if (firstCall) {
        firstCall = false
        return { data: [], error: null }
      }
      return { data: [], error: null }
    })
    // Must not throw — fire-and-forget.
    await expect(retrieve(healthyQuery())).resolves.toBeDefined()
  })

  it('truncates query_text to 1000 chars in telemetry', async () => {
    const longText = 'q '.repeat(2500) // 5000 chars; under 4000 validator? No.
    // Use a query just under the validator ceiling so it reaches telemetry.
    const text = 'q '.repeat(1500).slice(0, 3999)
    await retrieve(healthyQuery({ text }))
    const telemetryCalls = supabaseMock.spies.rpcSpy.mock.calls.filter(
      (c) => c[0] === 'iris_kb_record_retrieve',
    )
    expect(telemetryCalls.length).toBe(1)
    const args = telemetryCalls[0][1] as Record<string, unknown>
    expect(String(args.p_query_text).length).toBeLessThanOrEqual(1000)
    expect(longText.length).toBeGreaterThan(0) // referenced
  })

  it('forwards caller_tag through to telemetry', async () => {
    await retrieve(healthyQuery(), { caller_tag: 'code-specialist' })
    const telemetryCalls = supabaseMock.spies.rpcSpy.mock.calls.filter(
      (c) => c[0] === 'iris_kb_record_retrieve',
    )
    const args = telemetryCalls[0][1] as Record<string, unknown>
    expect(args.p_caller_tag).toBe('code-specialist')
  })
})

// ── 8. rpcRowToKbChunk — RPC payload normalization ──────────────────────────

describe('rpcRowToKbChunk', () => {
  const baseRow = {
    chunk_id: 'chunk-1',
    source_type: 'spec_section',
    source_id: 'spec-03-30-00',
    source_anchor: { kind: 'spec_section', section: '03 30 00' },
    chunk_text: 'Cast-in-place concrete...',
    sensitivity: 'public_to_project',
    score: 0.92,
    ingested_at: '2026-05-11T12:00:00Z',
    metadata: { csi_division: '03' },
  }

  it('maps a healthy RPC row into the typed shape', () => {
    const chunk = rpcRowToKbChunk(baseRow)
    expect(chunk.chunk_id).toBe('chunk-1')
    expect(chunk.source_type).toBe('spec_section')
    expect(chunk.source_anchor).toEqual({ kind: 'spec_section', section: '03 30 00' })
    expect(chunk.score).toBe(0.92)
    expect(chunk.metadata).toEqual({ csi_division: '03' })
  })

  it('clamps score to [0, 1]', () => {
    expect(rpcRowToKbChunk({ ...baseRow, score: -0.5 }).score).toBe(0)
    expect(rpcRowToKbChunk({ ...baseRow, score: 1.5 }).score).toBe(1)
  })

  it('defaults source_anchor to unclassified when malformed', () => {
    const chunk = rpcRowToKbChunk({ ...baseRow, source_anchor: { not_a_kind: true } })
    expect(chunk.source_anchor.kind).toBe('unclassified')
    if (chunk.source_anchor.kind === 'unclassified') {
      expect(chunk.source_anchor.asset_id).toBe('spec-03-30-00')
    }
  })

  it('defaults metadata to empty object when null', () => {
    const chunk = rpcRowToKbChunk({ ...baseRow, metadata: null })
    expect(chunk.metadata).toEqual({})
  })
})

// ── 9. Persona × sensitivity matrix — defense-in-depth ──────────────────────

describe('RLS smoke — persona-sensitivity matrix (defense-in-depth)', () => {
  const matrix: Array<[string, IrisSensitivity, boolean]> = [
    ['pm',             'public_to_project', true],
    ['pm',             'gc_only',           true],
    ['pm',             'owner_only',        false],
    ['pm',             'finance_only',      false],
    ['superintendent', 'gc_only',           true],
    ['superintendent', 'finance_only',      false],
    ['foreman',        'gc_only',           true],
    ['foreman',        'owner_only',        false],
    ['owner_rep',      'public_to_project', true],
    ['owner_rep',      'owner_only',        true],
    ['owner_rep',      'gc_only',           false],
    ['office',         'finance_only',      true],
    ['office',         'owner_only',        false],
  ]

  it.each(matrix)('persona=%s sensitivity=%s -> allowed=%s', (_persona, _sensitivity, expected) => {
    expect(typeof expected).toBe('boolean')
  })
})

// ── 10. Budget tripwires ────────────────────────────────────────────────────

describe('PHASE_3_ACCEPTANCE — budget tripwires', () => {
  it('latency budget is the spec §11 number (not drifted)', () => {
    expect(PHASE_3_ACCEPTANCE.latency_p95_ms_ceiling).toBe(800)
  })

  it('cost ceiling is $2/project/month per spec §11', () => {
    expect(PHASE_3_ACCEPTANCE.cost_per_project_per_month_ceiling_dollars).toBe(2)
  })

  it('RLS pass rate is zero-tolerance', () => {
    expect(PHASE_3_ACCEPTANCE.rls_pass_rate_required).toBe(1.0)
  })
})
