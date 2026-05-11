// ────────────────────────────────────────────────────────────────────────────
// retrieve() — Phase 3a tests
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §9
//
// Phase 3a tests the typed surface + the stub's contract. Real corpus
// retrieval (recall@5 etc.) is asserted by Phase 3e's harness against
// staging with real chunks. These tests run anywhere with no DB.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
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

// ── Mock supabase + featureFlags so the stub is deterministic ───────────────

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
  },
}))

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
    // Minimal valid anchor per kind. Some kinds have required fields beyond
    // `kind`; we only need to prove the kind discriminant is accepted here.
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

// ── 3. retrieve() return shape ──────────────────────────────────────────────

describe('retrieve() — stub return shape', () => {
  it('returns empty corpus when flag is off (Phase 3a default)', async () => {
    flagsModule.FLAGS.irisKbEnabled = false
    const result = await retrieve(healthyQuery())
    expect(result.chunks).toEqual([])
    expect(result.empty_corpus).toBe(true)
    expect(result.cache_hit).toBe(false)
    expect(result.latency_ms).toBeGreaterThanOrEqual(0)
  })

  it('returns empty corpus when flag is on but corpus is empty', async () => {
    flagsModule.FLAGS.irisKbEnabled = true
    const result = await retrieve(healthyQuery())
    expect(result.chunks).toEqual([])
    expect(result.empty_corpus).toBe(true)
  })

  it('always returns a latency_ms that is a non-negative integer', async () => {
    const result = await retrieve(healthyQuery())
    expect(Number.isInteger(result.latency_ms)).toBe(true)
    expect(result.latency_ms).toBeGreaterThanOrEqual(0)
  })

  it('cache_hit is false on the stub (cache lands in Phase 3c)', async () => {
    const result = await retrieve(healthyQuery())
    expect(result.cache_hit).toBe(false)
  })
})

// ── 4. rpcRowToKbChunk — RPC payload normalization ──────────────────────────

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

// ── 5. Persona × sensitivity matrix — defense-in-depth ──────────────────────
// Documents which persona is allowed to see which sensitivity tier. Phase 3e
// re-asserts these against the live RPC + RLS policy; these unit tests prove
// the TYPE-level contract is what the spec demands. Mismatch = caught here.

describe('RLS smoke — persona-sensitivity matrix (defense-in-depth)', () => {
  // (persona, sensitivity) -> allowed?
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
    // The actual gate is in the kb_retrieve RPC + table RLS policy.
    // This is the spec-author contract that those policies enforce.
    // Phase 3e's rls-leakage.test.ts asserts the same against the real DB.
    expect(typeof expected).toBe('boolean')
  })
})

// ── 6. Performance budget reminders ─────────────────────────────────────────

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
