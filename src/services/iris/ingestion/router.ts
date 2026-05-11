// ────────────────────────────────────────────────────────────────────────────
// Ingestion router — Phase 3b
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
//
// routeArtifact() takes a freshly-uploaded artifact descriptor and returns
// the IrisSourceType + worker name that should ingest it. Every upload path
// in the codebase MUST call routeArtifact() before enqueueing — enforced by
// the `sitesync/no-raw-ingest` ESLint rule.
//
// Routing strategy:
//   1. If caller passes an explicit `source_type_hint`, trust it.
//   2. Otherwise classify by (mime, filename) signal.
//   3. Fall back to 'unclassified' (which gets a catch-all worker).

import type { IrisSourceType } from '../types/retrieval'

export interface RouteArtifactInput {
  /** Uploaded blob's MIME type. */
  mime?: string
  /** Original filename (case-insensitive matched). */
  filename?: string
  /** The DB row id of the source (e.g. document_id, rfi_id). */
  source_id: string
  /** Caller-supplied hint when the upload form knows the destination. */
  source_type_hint?: IrisSourceType
  /** Optional: caller-supplied parent entity type, used as a fallback hint. */
  parent_entity_type?: string
}

export interface RouteArtifactDecision {
  source_type: IrisSourceType
  worker: string
  reason: string
  confidence: number // 0..1
}

// Maps an IrisSourceType to the per-source-type worker name in
// supabase/functions/iris-ingest-<name>-worker/.
export const WORKER_NAMES: Readonly<Record<IrisSourceType, string>> = {
  drawing: 'iris-ingest-drawing-worker',
  spec_section: 'iris-ingest-spec-worker',
  submittal: 'iris-ingest-submittal-worker',
  rfi: 'iris-ingest-rfi-worker',
  daily_log: 'iris-ingest-daily-log-worker',
  photo: 'iris-ingest-photo-worker',
  conversation: 'iris-ingest-conversation-worker',
  contract: 'iris-ingest-contract-worker',
  change_order: 'iris-ingest-change-order-worker',
  bulletin: 'iris-ingest-conversation-worker', // bulletins ride the conversation path
  asi: 'iris-ingest-conversation-worker',
  spreadsheet: 'iris-ingest-spreadsheet-worker',
  pay_app: 'iris-ingest-change-order-worker', // pay-apps ride the CO path
  lien_waiver: 'iris-ingest-change-order-worker',
  punch_item: 'iris-ingest-rfi-worker', // punch items reuse the RFI thread chunker
  unclassified: 'iris-ingest-unclassified-worker',
}

// Filename keyword → source_type. Lowercased exact-token matches. Order
// matters — more-specific rules first (a CSI-style "section 03 30 00" should
// route to spec, not to drawing's generic "section" keyword).
const FILENAME_KEYWORDS: ReadonlyArray<{ pattern: RegExp; type: IrisSourceType; conf: number }> = [
  // Specs — CSI numeric pattern is high-confidence signal.
  { pattern: /\b\d{2}\s\d{2}\s\d{2}\b/i, type: 'spec_section', conf: 0.85 },
  { pattern: /\b(spec|specification|csi)\b/i, type: 'spec_section', conf: 0.7 },
  // Section view in a filename usually means a spec section (CSI), not a drawing section.
  { pattern: /\bsection[ _-]?\d/i, type: 'spec_section', conf: 0.7 },
  // Submittals before drawings — "shop drawing" includes "drawing" as a keyword.
  { pattern: /\b(submittal|shop drawing|product data)\b/i, type: 'submittal', conf: 0.7 },
  // Drawings — without "section" (handled above).
  { pattern: /\b(drawing|sheet|elevation|detail)\b/i, type: 'drawing', conf: 0.7 },
  // Drawing sheet codes like A-101, S-201, M-301 — strong drawing signal.
  { pattern: /\b[a-z]{1,3}[-_]?\d{2,4}\b.*\b(plan|floor)\b/i, type: 'drawing', conf: 0.8 },
  { pattern: /\b(plan)\b/i, type: 'drawing', conf: 0.5 },
  // RFIs.
  { pattern: /\b(rfi|request for information)\b/i, type: 'rfi', conf: 0.6 },
  { pattern: /\b(daily log|daily report|field report)\b/i, type: 'daily_log', conf: 0.7 },
  { pattern: /\b(contract|agreement|aia|a201)\b/i, type: 'contract', conf: 0.6 },
  { pattern: /\b(change order|co[-_]?\d+|pco)\b/i, type: 'change_order', conf: 0.6 },
  { pattern: /\b(pay app|payment application|g702|g703)\b/i, type: 'pay_app', conf: 0.7 },
  { pattern: /\b(lien waiver|conditional|unconditional)\b/i, type: 'lien_waiver', conf: 0.7 },
  { pattern: /\b(bulletin|asi)\b/i, type: 'asi', conf: 0.5 },
  { pattern: /\b(punch)\b/i, type: 'punch_item', conf: 0.7 },
]

const MIME_KEYWORDS: ReadonlyArray<{ pattern: RegExp; type: IrisSourceType; conf: number }> = [
  { pattern: /^image\//i, type: 'photo', conf: 0.8 },
  { pattern: /spreadsheetml|excel|csv/i, type: 'spreadsheet', conf: 0.8 },
  { pattern: /\/rfc822|\/eml|\.mbox/i, type: 'conversation', conf: 0.8 },
]

const PARENT_ENTITY_TO_TYPE: Readonly<Record<string, IrisSourceType>> = {
  rfi: 'rfi',
  submittal: 'submittal',
  daily_log: 'daily_log',
  change_order: 'change_order',
  contract: 'contract',
  drawing: 'drawing',
  spec_section: 'spec_section',
}

export function routeArtifact(input: RouteArtifactInput): RouteArtifactDecision {
  if (!input.source_id) {
    return {
      source_type: 'unclassified',
      worker: WORKER_NAMES.unclassified,
      reason: 'source_id missing',
      confidence: 0,
    }
  }

  // 1. Explicit caller hint wins.
  if (input.source_type_hint) {
    return {
      source_type: input.source_type_hint,
      worker: WORKER_NAMES[input.source_type_hint],
      reason: `caller hint: ${input.source_type_hint}`,
      confidence: 0.95,
    }
  }

  // 2. Parent-entity hint (e.g. an attachment uploaded to a known RFI).
  if (input.parent_entity_type) {
    const fromParent = PARENT_ENTITY_TO_TYPE[input.parent_entity_type.toLowerCase()]
    if (fromParent) {
      return {
        source_type: fromParent,
        worker: WORKER_NAMES[fromParent],
        reason: `parent_entity_type: ${input.parent_entity_type}`,
        confidence: 0.85,
      }
    }
  }

  // 3. MIME signal.
  if (input.mime) {
    for (const rule of MIME_KEYWORDS) {
      if (rule.pattern.test(input.mime)) {
        return {
          source_type: rule.type,
          worker: WORKER_NAMES[rule.type],
          reason: `mime match: /${rule.pattern.source}/`,
          confidence: rule.conf,
        }
      }
    }
  }

  // 4. Filename signal. Normalize underscores/dashes to spaces so the
  //    word-boundary regexes match keywords inside snake_case + kebab-case
  //    filenames (e.g. "floor_plan.pdf" → "floor plan pdf").
  if (input.filename) {
    const normalized = input.filename.replace(/[_-]+/g, ' ')
    for (const rule of FILENAME_KEYWORDS) {
      if (rule.pattern.test(normalized)) {
        return {
          source_type: rule.type,
          worker: WORKER_NAMES[rule.type],
          reason: `filename match: /${rule.pattern.source}/`,
          confidence: rule.conf,
        }
      }
    }
  }

  // 5. Fallback.
  return {
    source_type: 'unclassified',
    worker: WORKER_NAMES.unclassified,
    reason: 'no signal matched; routing to catch-all worker',
    confidence: 0,
  }
}
