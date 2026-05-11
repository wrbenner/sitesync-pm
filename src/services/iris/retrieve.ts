// ────────────────────────────────────────────────────────────────────────────
// retrieve() — Phase 3c full implementation
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
// ADR-020: single retrieval entrypoint for every Iris specialist.
//
// Phase 3a shipped the typed surface with an empty-corpus stub.
// Phase 3c replaces the body with the real path:
//   1. Validate query + options (same as 3a).
//   2. Check the in-process LRU cache (30s TTL, key = hash(query|project|persona|opts)).
//   3. On cache miss: call iris-embed edge fn to embed the query text.
//   4. Call public.kb_retrieve(...) RPC with the embedding + text.
//   5. Map RPC rows -> KbChunk[]; populate cache; emit telemetry event.
//
// Telemetry: every call writes an `iris_kb_retrieve` row to iris_kb_telemetry
// (Phase 3c migration). Phase 3e's daily-acceptance workflow joins on this
// table to compute latency_p95 + cache_hit_rate.

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
const CACHE_TTL_MS = 30_000
const CACHE_MAX_ENTRIES = 200

export class RetrieveError extends Error {
  readonly code: 'invalid_args' | 'rls_blocked' | 'rpc_failed' | 'empty_query' | 'embed_failed'
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

// ── LRU cache ────────────────────────────────────────────────────────────────
// Tiny in-process cache. Cleared on hot module reload + on test setup. Not a
// shared cross-request cache; per-window only. The 30s window matches the
// human "ask the same thing twice" behavior pattern without going stale on
// fresh ingests.

interface CacheEntry {
  result: RetrieveResult
  expires_at: number
}

const cache = new Map<string, CacheEntry>()

function makeCacheKey(query: RetrieveQuery, opts: RetrieveOptions): string {
  const parts = [
    query.project_id,
    query.persona,
    query.text.trim().toLowerCase(),
    String(opts.k ?? DEFAULT_K),
    String(opts.min_score ?? DEFAULT_MIN_SCORE),
    (opts.source_types ?? []).slice().sort().join(','),
    String(opts.vector_weight ?? 0.7),
    String(opts.tsv_weight ?? 0.3),
    String(opts.freshness_decay ?? 0.001),
  ]
  return parts.join('|')
}

function readCache(key: string): RetrieveResult | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expires_at) {
    cache.delete(key)
    return null
  }
  // Re-stamp as cache_hit:true on the returned shape.
  return { ...hit.result, cache_hit: true }
}

function writeCache(key: string, result: RetrieveResult): void {
  // Evict oldest if over capacity.
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (oldestKey !== undefined) cache.delete(oldestKey)
  }
  cache.set(key, {
    result: { ...result, cache_hit: false },
    expires_at: Date.now() + CACHE_TTL_MS,
  })
}

/** Test hook only. Not part of the public surface. */
export function __resetRetrieveCacheForTests(): void {
  cache.clear()
}

// ── Embedding edge-fn proxy ──────────────────────────────────────────────────
// retrieve() is browser+edge-callable; we never bundle OpenAI client keys
// browser-side. The `iris-embed` edge fn (lands alongside this PR or in 3d's
// real ingest pass) reads OPENAI_API_KEY from edge secrets and returns a
// vector. For now, retrieve() requests embeddings via supabase.functions.invoke;
// when the fn isn't deployed yet (Phase 3a/3b/3c interim), the RPC accepts
// null embedding and falls back to ts_rank-only retrieval.

async function embedQuery(text: string): Promise<number[] | null> {
  try {
    const res = await supabase.functions.invoke<{ embedding: number[] }>('iris-embed', {
      body: { text },
    })
    if (res.error || !res.data?.embedding) {
      if (import.meta.env.DEV) {
        console.warn('[retrieve] iris-embed unavailable, falling back to ts_rank-only:', res.error?.message)
      }
      return null
    }
    return res.data.embedding
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[retrieve] iris-embed invoke threw, falling back to ts_rank-only:', err)
    }
    return null
  }
}

// ── Main entrypoint ──────────────────────────────────────────────────────────

interface KbRetrieveRpcRow {
  chunk_id: string
  source_type: string
  source_id: string
  source_anchor: unknown
  chunk_text: string
  sensitivity: string
  score: number
  ingested_at: string
  metadata: unknown
}

/**
 * Primary retrieval entrypoint. Embeds the query, calls kb_retrieve RPC,
 * caches the result for 30s, emits telemetry. Returns at most opts.k chunks.
 */
export async function retrieve(
  query: RetrieveQuery,
  opts: RetrieveOptions = {},
): Promise<RetrieveResult> {
  validateQuery(query)
  const { k, min_score } = validateOptions(opts)

  const t0 = performance.now()

  if (!FLAGS.irisKbEnabled) {
    return {
      chunks: [],
      latency_ms: Math.round(performance.now() - t0),
      cache_hit: false,
      empty_corpus: true,
    }
  }

  // 1. Cache lookup.
  const cacheKey = makeCacheKey(query, opts)
  const cached = readCache(cacheKey)
  if (cached) {
    void emitTelemetry({
      project_id: query.project_id,
      persona: query.persona,
      query_text: query.text,
      latency_ms: Math.round(performance.now() - t0),
      cache_hit: true,
      chunks_returned: cached.chunks.length,
      caller_tag: opts.caller_tag ?? null,
    })
    return { ...cached, latency_ms: Math.round(performance.now() - t0) }
  }

  // 2. Embed the query (may return null in 3c interim — RPC handles it).
  const embedding = await embedQuery(query.text)

  // 3. Call the RPC. q_embedding is typed as string by typegen (pgvector
  // serializes as a string literal); null is permitted at the SQL layer for
  // ts_rank-only fallback. We pass through whatever embedQuery returned.
  const { data, error } = await supabase.rpc('kb_retrieve', {
    q_embedding: embedding as unknown as string,
    q_text: query.text,
    p_project_id: query.project_id,
    p_persona: query.persona,
    p_top_k: k,
    p_vector_weight: opts.vector_weight ?? 0.7,
    p_tsv_weight: opts.tsv_weight ?? 0.3,
    p_freshness_decay: opts.freshness_decay ?? 0.001,
    p_min_score: min_score,
  })

  const latency_ms = Math.round(performance.now() - t0)

  if (error) {
    if (import.meta.env.DEV) {
      console.warn('[retrieve] kb_retrieve RPC failed:', error.message)
    }
    void emitTelemetry({
      project_id: query.project_id,
      persona: query.persona,
      query_text: query.text,
      latency_ms,
      cache_hit: false,
      chunks_returned: 0,
      error_code: error.code ?? 'rpc_failed',
      caller_tag: opts.caller_tag ?? null,
    })
    return { chunks: [], latency_ms, cache_hit: false, empty_corpus: false }
  }

  const rows = (data ?? []) as KbRetrieveRpcRow[]
  const chunks: KbChunk[] = rows.map(rpcRowToKbChunk)

  // empty_corpus is true only when retrieval returned zero AND the project
  // has no chunks at all (vs returning zero because nothing scored above
  // min_score). Cheap distinction — same probe as the 3a stub.
  let empty_corpus = false
  if (chunks.length === 0) {
    const probe = await supabase
      .from('iris_kb_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', query.project_id)
      .is('deleted_at', null)
      .limit(1)
    empty_corpus = !probe.error && (probe.count ?? 0) === 0
  }

  const result: RetrieveResult = {
    chunks,
    latency_ms,
    cache_hit: false,
    empty_corpus,
  }
  writeCache(cacheKey, result)

  void emitTelemetry({
    project_id: query.project_id,
    persona: query.persona,
    query_text: query.text,
    latency_ms,
    cache_hit: false,
    chunks_returned: chunks.length,
    caller_tag: opts.caller_tag ?? null,
  })

  return result
}

// ── Telemetry sink ───────────────────────────────────────────────────────────

interface TelemetryEvent {
  project_id: string
  persona: string
  query_text: string
  latency_ms: number
  cache_hit: boolean
  chunks_returned: number
  error_code?: string
  caller_tag: string | null
}

async function emitTelemetry(ev: TelemetryEvent): Promise<void> {
  // Fire-and-forget. Failures here must never break the user-facing path.
  try {
    await supabase.rpc('iris_kb_record_retrieve', {
      p_project_id: ev.project_id,
      p_persona: ev.persona,
      p_query_text: ev.query_text.slice(0, 1000),
      p_latency_ms: ev.latency_ms,
      p_cache_hit: ev.cache_hit,
      p_chunks_returned: ev.chunks_returned,
      p_error_code: ev.error_code,
      p_caller_tag: ev.caller_tag ?? undefined,
    })
  } catch {
    // Swallow — telemetry MUST NOT regress user-facing latency or correctness.
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
