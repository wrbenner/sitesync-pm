// ────────────────────────────────────────────────────────────────────────────
// retrieve() typed surface — Phase 3a
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
// ADR-020: every Iris specialist calls retrieve() through this typed shape.

import type { PersonaSlug } from './context'

/**
 * The 16 canonical source artifact types. Mirrors the `iris_source_type` enum
 * in migration 20261008000000. CI lint asserts every new value here has a
 * companion entry in the enum.
 */
export type IrisSourceType =
  | 'drawing'
  | 'spec_section'
  | 'submittal'
  | 'rfi'
  | 'daily_log'
  | 'photo'
  | 'conversation'
  | 'contract'
  | 'change_order'
  | 'bulletin'
  | 'asi'
  | 'spreadsheet'
  | 'pay_app'
  | 'lien_waiver'
  | 'punch_item'
  | 'unclassified'

/**
 * Visibility tiers. Mirrors `iris_sensitivity` enum + RLS policy on
 * iris_kb_chunks. Defense-in-depth: the RPC enforces these AND table RLS
 * does too.
 */
export type IrisSensitivity =
  | 'public_to_project'
  | 'gc_only'
  | 'owner_only'
  | 'finance_only'

/**
 * Per-source anchor metadata that lets the citation side panel render a
 * deep-link to the exact location inside the source artifact. Discriminated
 * union — every source type has a typed shape.
 */
export type KbSourceAnchor =
  | { kind: 'drawing'; sheet: string; bbox?: [number, number, number, number] }
  | { kind: 'spec_section'; section: string; page?: number }
  | { kind: 'submittal'; submittal_id: string; package_idx?: number }
  | { kind: 'rfi'; rfi_id: string; response_idx?: number }
  | { kind: 'daily_log'; daily_log_id: string; section: 'manpower' | 'equipment' | 'weather' | 'narrative' | 'incident' }
  | { kind: 'photo'; asset_id: string; caption_hash?: string }
  | { kind: 'conversation'; thread_id: string; message_idx?: number }
  | { kind: 'contract'; contract_id: string; clause_number?: string }
  | { kind: 'change_order'; co_id: string; line_idx?: number }
  | { kind: 'bulletin'; bulletin_id: string }
  | { kind: 'asi'; asi_id: string }
  | { kind: 'spreadsheet'; asset_id: string; sheet_name: string; range_a1: string }
  | { kind: 'pay_app'; pay_app_id: string }
  | { kind: 'lien_waiver'; waiver_id: string }
  | { kind: 'punch_item'; punch_item_id: string }
  | { kind: 'unclassified'; asset_id: string }

export interface KbChunk {
  chunk_id: string
  source_type: IrisSourceType
  source_id: string
  source_anchor: KbSourceAnchor
  chunk_text: string
  sensitivity: IrisSensitivity
  score: number // 0..1 — hybrid blend output
  ingested_at: string // ISO
  metadata: Record<string, unknown>
}

export interface RetrieveQuery {
  /** Free-text user question. */
  text: string
  /** Project scope — required. retrieve() refuses to query without a project. */
  project_id: string
  /** Persona the caller's specialist resolved (per ADR-019). Drives sensitivity tier. */
  persona: PersonaSlug
}

export interface RetrieveOptions {
  /** Top-k cap. Default 5. Max 20. */
  k?: number
  /** Score floor. Default 0.1. */
  min_score?: number
  /** Restrict to these source types (e.g. spec lookup wants only spec_section + drawing). */
  source_types?: readonly IrisSourceType[]
  /** Tune the hybrid blend per call. Phase 3e defaults baked into the RPC. */
  vector_weight?: number
  tsv_weight?: number
  freshness_decay?: number
  /** Telemetry tag — surfaces the caller in `iris_kb_telemetry` per spec §6. */
  caller_tag?: string
}

export interface RetrieveResult {
  chunks: readonly KbChunk[]
  latency_ms: number
  cache_hit: boolean
  /** True if the corpus was empty for this project (vs no chunks above threshold). */
  empty_corpus: boolean
}

/** Phase 3 acceptance gates per spec §11. Used by the harness in 3e. */
export const PHASE_3_ACCEPTANCE = {
  recall_at_5_floor: 0.85,
  precision_at_5_floor: 0.7,
  latency_p95_ms_ceiling: 800,
  rls_pass_rate_required: 1.0, // zero tolerance
  embedding_leakage_pearson_r_ceiling: 0.05,
  cost_per_project_per_month_ceiling_dollars: 2,
} as const
