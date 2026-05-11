// ────────────────────────────────────────────────────────────────────────────
// retrieve() — Phase 3a stub
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
// ADR-020: single retrieval entrypoint for every Iris specialist.
//
// Phase 3a ships the wiring without the LLM-side embedding round-trip.
// `retrieve()` returns `{ chunks: [], empty_corpus: true }` for an empty
// project corpus. Phase 3c adds the real OpenAI-embed-then-RPC call;
// Phase 3d (Code specialist cutover) flips kb-stub callers to this surface.
//
// The contract is locked at this version. Phase 3b-3e callers depend on
// `RetrieveResult` shape staying stable; downstream specialist work
// inherits the typed surface unchanged.

import { FLAGS } from '../../lib/featureFlags'
import { supabase } from '../../lib/supabase'

import type {
  KbChunk,
  KbSourceAnchor,
  RetrieveOptions,
  RetrieveQuery,
  RetrieveResult,
} from './types/retrieval'

const DEFAULT_K = 5
const DEFAULT_MIN_SCORE = 0.1
const MAX_K = 20

export class RetrieveError extends Error {
  readonly code: 'invalid_args' | 'rls_blocked' | 'rpc_failed' | 'empty_query'
  constructor(message: string, code: RetrieveError['code']) {
    super(message)
    this.name = 'RetrieveError'
    this.code = code
  }
}

function validateQuery(query: RetrieveQuery): void {
  if (!query.text || query.text.trim().length === 0) {
    throw new RetrieveError('query.text is required (non-empty)', 'empty_query')
  }
  if (query.text.length > 4000) {
    throw new RetrieveError('query.text must be < 4000 chars', 'invalid_args')
  }
  if (!query.project_id) {
    throw new RetrieveError('query.project_id is required (retrieve() refuses to query without scope)', 'invalid_args')
  }
}

function validateOptions(opts: RetrieveOptions = {}): Required<Pick<RetrieveOptions, 'k' | 'min_score'>> {
  const k = opts.k ?? DEFAULT_K
  const min_score = opts.min_score ?? DEFAULT_MIN_SCORE
  if (k < 1 || k > MAX_K) {
    throw new RetrieveError(`opts.k must be in [1, ${MAX_K}]`, 'invalid_args')
  }
  if (min_score < 0 || min_score > 1) {
    throw new RetrieveError('opts.min_score must be in [0, 1]', 'invalid_args')
  }
  if (opts.vector_weight != null && (opts.vector_weight < 0 || opts.vector_weight > 1)) {
    throw new RetrieveError('opts.vector_weight must be in [0, 1]', 'invalid_args')
  }
  if (opts.tsv_weight != null && (opts.tsv_weight < 0 || opts.tsv_weight > 1)) {
    throw new RetrieveError('opts.tsv_weight must be in [0, 1]', 'invalid_args')
  }
  return { k, min_score }
}

/**
 * Primary retrieval entrypoint. Phase 3a stub returns an empty result for
 * any corpus. Phase 3c swaps the body for a real OpenAI embed + kb_retrieve
 * RPC call. The shape is stable across the cutover.
 */
export async function retrieve(
  query: RetrieveQuery,
  opts: RetrieveOptions = {},
): Promise<RetrieveResult> {
  validateQuery(query)
  validateOptions(opts)

  const t0 = performance.now()

  // Phase 3a: feature-flag gate. When off, return empty regardless of corpus.
  if (!FLAGS.irisKbEnabled) {
    return {
      chunks: [],
      latency_ms: Math.round(performance.now() - t0),
      cache_hit: false,
      empty_corpus: true,
    }
  }

  // Phase 3a stub: skip the embedding call. Just count how many chunks live
  // on the project to distinguish "empty corpus" from "no match". Phase 3c
  // replaces this with a real embed + RPC.
  const { data, error } = await supabase
    .from('iris_kb_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', query.project_id)
    .is('deleted_at', null)
    .limit(1)

  if (error) {
    if (import.meta.env.DEV) {
      console.warn('[retrieve] count probe failed:', error.message)
    }
    return {
      chunks: [],
      latency_ms: Math.round(performance.now() - t0),
      cache_hit: false,
      empty_corpus: true,
    }
  }

  const empty = !data || data.length === 0
  return {
    chunks: [],
    latency_ms: Math.round(performance.now() - t0),
    cache_hit: false,
    empty_corpus: empty,
  }
}

/** Exposed for tests + downstream parity checks. */
export function isValidSourceAnchor(anchor: unknown): anchor is KbSourceAnchor {
  if (!anchor || typeof anchor !== 'object') return false
  const kind = (anchor as { kind?: unknown }).kind
  return typeof kind === 'string' && [
    'drawing', 'spec_section', 'submittal', 'rfi', 'daily_log', 'photo',
    'conversation', 'contract', 'change_order', 'bulletin', 'asi',
    'spreadsheet', 'pay_app', 'lien_waiver', 'punch_item', 'unclassified',
  ].includes(kind)
}

/** Convert an RPC row into the typed KbChunk shape used by callers. */
export function rpcRowToKbChunk(row: {
  chunk_id: string
  source_type: string
  source_id: string
  source_anchor: unknown
  chunk_text: string
  sensitivity: string
  score: number
  ingested_at: string
  metadata: unknown
}): KbChunk {
  const anchor = isValidSourceAnchor(row.source_anchor)
    ? row.source_anchor
    : ({ kind: 'unclassified', asset_id: row.source_id } as KbSourceAnchor)
  return {
    chunk_id: row.chunk_id,
    source_type: row.source_type as KbChunk['source_type'],
    source_id: row.source_id,
    source_anchor: anchor,
    chunk_text: row.chunk_text,
    sensitivity: row.sensitivity as KbChunk['sensitivity'],
    score: Math.max(0, Math.min(1, row.score)),
    ingested_at: row.ingested_at,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}
