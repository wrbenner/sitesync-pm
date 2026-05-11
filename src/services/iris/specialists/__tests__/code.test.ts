// Code specialist + KB stub tests — Phase 2d
// Spec: docs/audits/IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md (Code §)

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { citeOrReject, retrieveClauses, type CodeClause } from '../../kb-stub'
import {
  CODE_DECL,
  codeDeterministicCheck,
  codeShouldRun,
  runCodeRetrieval,
  type CodeInput,
} from '../code'
import { buildContext } from '../../contextFabric'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CORPUS_PATH = join(__dirname, '../../../../../tests/fixtures/code-kb/clauses.json')
const CORPUS = JSON.parse(readFileSync(CORPUS_PATH, 'utf8')) as CodeClause[]

function emptyContext() {
  const { context } = buildContext({
    user_id: 'u',
    org_id: 'org',
    project_id: 'project-avery-oaks',
    current_page: '/iris',
    entity_type: null,
    entity_id: null,
    invocation_intent: 'classify',
  })
  return context
}

describe('CODE_DECL — ADR-018 boundary conformance', () => {
  it('declares the canonical specialist shape', () => {
    expect(CODE_DECL.name).toBe('code')
    expect(CODE_DECL.llmScope).toBe('synthesis')
    expect(CODE_DECL.modelTier).toBe('sonnet')
    expect(CODE_DECL.writeScope).toEqual([])
  })

  it('audit fields include corpus_size + retrieval_count + cite_or_reject + top_score', () => {
    const declared = new Set(CODE_DECL.auditFields)
    expect(declared.has('corpus_size')).toBe(true)
    expect(declared.has('retrieval_count')).toBe(true)
    expect(declared.has('cite_or_reject')).toBe(true)
    expect(declared.has('top_score')).toBe(true)
  })

  it('tool allow-list contains query_kb + cite_spec_reference', () => {
    expect(CODE_DECL.toolAllowList).toContain('query_kb')
    expect(CODE_DECL.toolAllowList).toContain('cite_spec_reference')
  })
})

describe('codeDeterministicCheck — gate decisions', () => {
  const ctx = emptyContext()

  it('passes a healthy egress question against the IBC corpus', () => {
    const input: CodeInput = {
      question: 'What is the minimum stairway width for egress?',
      corpus: CORPUS,
    }
    expect(codeDeterministicCheck(input, ctx).ok).toBe(true)
  })

  it('blocks empty question', () => {
    const result = codeDeterministicCheck({ question: '   ', corpus: CORPUS }, ctx)
    expect(result.ok).toBe(false)
    expect(result.blockers?.some((b: string) => b.includes('question'))).toBe(true)
  })

  it('blocks question over 4000 chars', () => {
    const longQ = 'a'.repeat(4001)
    const result = codeDeterministicCheck({ question: longQ, corpus: CORPUS }, ctx)
    expect(result.ok).toBe(false)
    expect(result.blockers?.some((b: string) => b.includes('4000'))).toBe(true)
  })

  it('blocks empty corpus', () => {
    const result = codeDeterministicCheck({ question: 'egress', corpus: [] }, ctx)
    expect(result.ok).toBe(false)
    expect(result.blockers?.some((b: string) => b.includes('corpus'))).toBe(true)
  })

  it('blocks k outside [1, 20]', () => {
    const result = codeDeterministicCheck(
      { question: 'egress', corpus: CORPUS, k: 99 },
      ctx,
    )
    expect(result.ok).toBe(false)
    expect(result.blockers?.some((b: string) => b.includes('k must be'))).toBe(true)
  })

  it('blocks when jurisdiction filter yields empty corpus', () => {
    const result = codeDeterministicCheck(
      { question: 'egress', corpus: CORPUS, jurisdictions: ['LOCAL-MARS-2099'] },
      ctx,
    )
    expect(result.ok).toBe(false)
    expect(result.blockers?.some((b: string) => b.includes('jurisdiction filter'))).toBe(true)
  })

  it('warns (no blocker) when retrieval returns zero candidates', () => {
    const result = codeDeterministicCheck(
      { question: 'xyz123 nonsense quantum unicorn', corpus: CORPUS },
      ctx,
    )
    expect(result.ok).toBe(true)
    expect(result.warnings?.some((w: string) => w.includes('zero candidates'))).toBe(true)
  })

  it('codeShouldRun mirrors codeDeterministicCheck', () => {
    const input: CodeInput = { question: 'egress', corpus: CORPUS }
    expect(codeShouldRun(input, ctx)).toEqual(codeDeterministicCheck(input, ctx))
  })
})

describe('retrieveClauses + citeOrReject — retrieval correctness', () => {
  it('returns clauses ranked by Jaccard similarity', () => {
    const results = retrieveClauses('egress stairway minimum width', CORPUS, { k: 3 })
    expect(results.length).toBeGreaterThan(0)
    expect(results.length).toBeLessThanOrEqual(3)
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score)
    }
  })

  it('boosts exact section-id matches', () => {
    const results = retrieveClauses('IBC 1011.2 stairway width', CORPUS, { k: 1 })
    expect(results.length).toBe(1)
    expect(results[0].clause.section).toBe('1011.2')
  })

  it('returns empty on a query with no token overlap', () => {
    const results = retrieveClauses('xyz123 unicorn pegasus quantum', CORPUS)
    expect(results).toEqual([])
  })

  it('citeOrReject returns reject decision when no clauses match', () => {
    const decision = citeOrReject('xyz123 unicorn pegasus quantum', CORPUS)
    expect(decision.decision).toBe('reject')
    expect(decision.clauses).toEqual([])
    expect(decision.reason).toBeDefined()
  })

  it('citeOrReject returns cite decision with clauses on a real query', () => {
    const decision = citeOrReject('GFCI protection for kitchens', CORPUS)
    expect(decision.decision).toBe('cite')
    expect(decision.clauses.length).toBeGreaterThan(0)
  })
})

describe('runCodeRetrieval — specialist pipeline', () => {
  it('applies jurisdiction filter before retrieval', () => {
    const result = runCodeRetrieval({
      question: 'egress',
      corpus: CORPUS,
      jurisdictions: ['NEC'],
    })
    for (const c of result.clauses) {
      expect(c.clause.jurisdiction).toBe('NEC')
    }
  })

  it('returns cite decision with the asked-for top-k', () => {
    const result = runCodeRetrieval({
      question: 'fire-rating penetration firestop',
      corpus: CORPUS,
      k: 2,
    })
    expect(result.decision).toBe('cite')
    expect(result.clauses.length).toBeLessThanOrEqual(2)
  })
})

describe('perf — retrieval sweep stays under p95 budget', () => {
  it('1000-iteration retrieval sweep completes in well under 5s', () => {
    const t0 = performance.now()
    for (let i = 0; i < 1000; i++) {
      retrieveClauses('egress stairway minimum width', CORPUS)
    }
    const dt = performance.now() - t0
    expect(dt).toBeLessThan(5000)
  })
})
