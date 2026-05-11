// ────────────────────────────────────────────────────────────────────────────
// Code retrieval cutover - Phase 3d parity tests
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md sec 9

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

const flagsModule = vi.hoisted(() => ({ FLAGS: { irisKbEnabled: true } }))
vi.mock('../../../lib/featureFlags', () => flagsModule)

import { __resetRetrieveCacheForTests } from '../retrieve'
import { runCodeRetrievalViaPgvector } from '../specialists/code-retrieval-cutover'
import type { CodeClause } from '../kb-stub'

const FIXTURE_CORPUS: CodeClause[] = [
  {
    id: 'ibc-1019.3',
    jurisdiction: 'ibc-2021',
    code: 'IBC 2021',
    section: '1019.3',
    title: 'Exit access stairways',
    body: 'Exit access stairways and ramps shall be enclosed in accordance with Section 1019.3.',
    tags: ['stair', 'exit', 'enclosure'],
  },
  {
    id: 'ibc-1010.1',
    jurisdiction: 'ibc-2021',
    code: 'IBC 2021',
    section: '1010.1',
    title: 'Doors',
    body: 'Means of egress doors shall meet the requirements of this section.',
    tags: ['door', 'egress'],
  },
  {
    id: 'ibc-0307',
    jurisdiction: 'ibc-2021',
    code: 'IBC 2021',
    section: '307',
    title: 'High-hazard occupancies',
    body: 'High-hazard Group H occupancy includes facilities that handle materials.',
    tags: ['hazard', 'occupancy', 'group h'],
  },
]

const baseInput = {
  question: 'What is the enclosure requirement for exit-access stairs in a Group H occupancy?',
  corpus: FIXTURE_CORPUS,
  jurisdictions: ['ibc-2021'],
  project_id: 'project-avery-oaks',
  persona: 'pm' as const,
  k: 5,
}

beforeEach(() => {
  flagsModule.FLAGS.irisKbEnabled = true
  __resetRetrieveCacheForTests()
  supabaseMock.spies.rpcSpy.mockReset()
  supabaseMock.spies.rpcSpy.mockResolvedValue({ data: [], error: null })
  supabaseMock.spies.fromCountSpy.mockReset()
  supabaseMock.spies.fromCountSpy.mockResolvedValue({ count: 0, error: null, data: [] })
  supabaseMock.spies.invokeSpy.mockReset()
  supabaseMock.spies.invokeSpy.mockResolvedValue({ data: { embedding: null }, error: null })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('cutover - pgvector returns chunks', () => {
  it('decides cite when pgvector returns >=1 chunk', async () => {
    supabaseMock.spies.rpcSpy.mockResolvedValueOnce({
      data: [
        {
          chunk_id: 'c1',
          source_type: 'spec_section',
          source_id: 's-03',
          source_anchor: { kind: 'spec_section', section: '03 30 00' },
          chunk_text: 'Concrete cover requirements for cast-in-place...',
          sensitivity: 'public_to_project',
          score: 0.91,
          ingested_at: '2026-05-11T12:00:00Z',
          metadata: {},
        },
      ],
      error: null,
    })
    const out = await runCodeRetrievalViaPgvector(baseInput)
    expect(out.decision).toBe('cite')
    expect(out.clauses).toHaveLength(1)
    expect(out.retrieval_path).toBe('retrieve_pgvector')
  })

  it('returns top-k chunks from pgvector capped at k=5', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      chunk_id: `c${i}`,
      source_type: 'spec_section',
      source_id: `s-${i}`,
      source_anchor: { kind: 'spec_section', section: `0${i} 00 00` },
      chunk_text: `text ${i}`,
      sensitivity: 'public_to_project',
      score: 0.9 - i * 0.05,
      ingested_at: '2026-05-11T12:00:00Z',
      metadata: {},
    }))
    supabaseMock.spies.rpcSpy.mockResolvedValueOnce({ data: rows, error: null })
    const out = await runCodeRetrievalViaPgvector(baseInput)
    expect(out.clauses).toHaveLength(5)
  })

  it('maps spec_section anchors to a clauseId with section', async () => {
    supabaseMock.spies.rpcSpy.mockResolvedValueOnce({
      data: [
        {
          chunk_id: 'c1',
          source_type: 'spec_section',
          source_id: 's-1',
          source_anchor: { kind: 'spec_section', section: '03 30 00' },
          chunk_text: 'text',
          sensitivity: 'public_to_project',
          score: 0.91,
          ingested_at: '2026-05-11T12:00:00Z',
          metadata: {},
        },
      ],
      error: null,
    })
    const out = await runCodeRetrievalViaPgvector(baseInput)
    expect(out.clauses[0].clause.id).toContain('#03 30 00')
    expect(out.clauses[0].clause.section).toBe('03 30 00')
  })

  it('maps contract anchors to a clauseId with clause_number', async () => {
    supabaseMock.spies.rpcSpy.mockResolvedValueOnce({
      data: [
        {
          chunk_id: 'c1',
          source_type: 'contract',
          source_id: 'k-1',
          source_anchor: { kind: 'contract', contract_id: 'k-1', clause_number: '3.2.1' },
          chunk_text: 'contract clause text',
          sensitivity: 'gc_only',
          score: 0.88,
          ingested_at: '2026-05-11T12:00:00Z',
          metadata: {},
        },
      ],
      error: null,
    })
    const out = await runCodeRetrievalViaPgvector(baseInput)
    expect(out.clauses[0].clause.section).toBe('3.2.1')
  })

  it('preserves chunk scores in the [0, 1] range', async () => {
    supabaseMock.spies.rpcSpy.mockResolvedValueOnce({
      data: [
        {
          chunk_id: 'c1',
          source_type: 'spec_section',
          source_id: 's',
          source_anchor: { kind: 'spec_section', section: '01 00 00' },
          chunk_text: 'text',
          sensitivity: 'public_to_project',
          score: 0.42,
          ingested_at: '2026-05-11T12:00:00Z',
          metadata: {},
        },
      ],
      error: null,
    })
    const out = await runCodeRetrievalViaPgvector(baseInput)
    expect(out.clauses[0].score).toBe(0.42)
  })

  it('passes the code-specialist caller_tag through to retrieve()', async () => {
    await runCodeRetrievalViaPgvector(baseInput)
    const kbCall = supabaseMock.spies.rpcSpy.mock.calls.find((c) => c[0] === 'kb_retrieve')
    expect(kbCall).toBeDefined()
    const telCall = supabaseMock.spies.rpcSpy.mock.calls.find((c) => c[0] === 'iris_kb_record_retrieve')
    expect(telCall).toBeDefined()
    const args = telCall![1] as Record<string, unknown>
    expect(args.p_caller_tag).toBe('code-specialist')
  })

  it('uses the resolved persona on the retrieve() call', async () => {
    await runCodeRetrievalViaPgvector({ ...baseInput, persona: 'owner_rep' })
    const kbCall = supabaseMock.spies.rpcSpy.mock.calls.find((c) => c[0] === 'kb_retrieve')
    const args = kbCall![1] as Record<string, unknown>
    expect(args.p_persona).toBe('owner_rep')
  })

  it('defaults persona to pm when not supplied', async () => {
    const { persona: _persona, ...inputWithoutPersona } = baseInput
    await runCodeRetrievalViaPgvector(inputWithoutPersona)
    const kbCall = supabaseMock.spies.rpcSpy.mock.calls.find((c) => c[0] === 'kb_retrieve')
    const args = kbCall![1] as Record<string, unknown>
    expect(args.p_persona).toBe('pm')
  })
})

describe('cutover - empty-corpus fallback', () => {
  it('falls back to kb-stub when pgvector empty AND empty_corpus is true', async () => {
    supabaseMock.spies.rpcSpy.mockResolvedValue({ data: [], error: null })
    supabaseMock.spies.fromCountSpy.mockResolvedValue({ count: 0, error: null, data: [] })
    const out = await runCodeRetrievalViaPgvector(baseInput)
    expect(out.retrieval_path).toBe('fallback_kb_stub')
    expect(['cite', 'reject']).toContain(out.decision)
  })

  it('kb-stub fallback inherits stub clauses when stub decides cite', async () => {
    const inputWithMatch = {
      ...baseInput,
      question: 'What is the exit access stairway enclosure requirement?',
    }
    supabaseMock.spies.rpcSpy.mockResolvedValue({ data: [], error: null })
    supabaseMock.spies.fromCountSpy.mockResolvedValue({ count: 0, error: null, data: [] })
    const out = await runCodeRetrievalViaPgvector(inputWithMatch)
    if (out.decision === 'cite') {
      expect(out.clauses.length).toBeGreaterThan(0)
      expect(out.retrieval_path).toBe('fallback_kb_stub')
    } else {
      expect(out.retrieval_path).toBe('fallback_kb_stub')
    }
  })

  it('returns reject path when corpus populated but pgvector empty', async () => {
    supabaseMock.spies.rpcSpy.mockResolvedValue({ data: [], error: null })
    supabaseMock.spies.fromCountSpy.mockResolvedValue({ count: 100, error: null, data: [] })
    const out = await runCodeRetrievalViaPgvector(baseInput)
    expect(out.decision).toBe('reject')
    expect(out.retrieval_path).toBe('retrieve_pgvector')
    expect(out.reason).toMatch(/zero candidates/)
  })
})

describe('cutover - audit path tracking', () => {
  it('every outcome records retrieval_path', async () => {
    const out1 = await runCodeRetrievalViaPgvector(baseInput)
    expect(out1.retrieval_path).toBe('fallback_kb_stub')

    supabaseMock.spies.rpcSpy.mockResolvedValueOnce({
      data: [
        {
          chunk_id: 'c1',
          source_type: 'spec_section',
          source_id: 's',
          source_anchor: { kind: 'spec_section', section: '01 00 00' },
          chunk_text: 'text',
          sensitivity: 'public_to_project',
          score: 0.91,
          ingested_at: '2026-05-11T12:00:00Z',
          metadata: {},
        },
      ],
      error: null,
    })
    const out2 = await runCodeRetrievalViaPgvector({
      ...baseInput,
      question: 'a fresh question to bust the cache',
    })
    expect(out2.retrieval_path).toBe('retrieve_pgvector')
  })

  it('reject reason explains the threshold miss', async () => {
    supabaseMock.spies.rpcSpy.mockResolvedValue({ data: [], error: null })
    supabaseMock.spies.fromCountSpy.mockResolvedValue({ count: 50, error: null, data: [] })
    const out = await runCodeRetrievalViaPgvector(baseInput)
    expect(out.reason).toBeDefined()
    expect(out.reason).toMatch(/threshold/)
  })
})

describe('cutover - caller options', () => {
  it('forwards k to retrieve()', async () => {
    await runCodeRetrievalViaPgvector({ ...baseInput, k: 8 })
    const kbCall = supabaseMock.spies.rpcSpy.mock.calls.find((c) => c[0] === 'kb_retrieve')
    const args = kbCall![1] as Record<string, unknown>
    expect(args.p_top_k).toBe(8)
  })

  it('defaults k to 5', async () => {
    const { k: _k, ...inputWithoutK } = baseInput
    await runCodeRetrievalViaPgvector(inputWithoutK)
    const kbCall = supabaseMock.spies.rpcSpy.mock.calls.find((c) => c[0] === 'kb_retrieve')
    const args = kbCall![1] as Record<string, unknown>
    expect(args.p_top_k).toBe(5)
  })

  it('refuses to query without a project_id', async () => {
    const { project_id: _pid, ...broken } = baseInput
    await expect(
      runCodeRetrievalViaPgvector({ ...broken, project_id: '' }),
    ).rejects.toThrow(/project_id/)
  })

  it('honors irisKbEnabled flag - when off, empty path goes to fallback', async () => {
    flagsModule.FLAGS.irisKbEnabled = false
    const out = await runCodeRetrievalViaPgvector(baseInput)
    expect(out.retrieval_path).toBe('fallback_kb_stub')
  })
})

describe('cutover - does not regress CODE_DECL surface', () => {
  it('runCodeRetrieval (legacy kb-stub) still works against the corpus', async () => {
    const mod = await import('../specialists/code')
    const out = mod.runCodeRetrieval({
      question: 'exit access stairway enclosure',
      corpus: FIXTURE_CORPUS,
      jurisdictions: ['ibc-2021'],
    })
    expect(['cite', 'reject']).toContain(out.decision)
  })
})
