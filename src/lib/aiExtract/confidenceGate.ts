/**
 * AI extraction confidence gate.
 *
 * AI extraction is NEVER auto-applied without confidence support. This
 * gate enforces three tiers:
 *   - confidence >= 0.85 → 'auto_apply'
 *   - 0.7 <= conf < 0.85 → 'auto_apply_with_warning'
 *   - confidence < 0.7   → 'manual_review'
 *
 * Per-field confidence is preserved so the UI can highlight low-confidence
 * fields even on an overall auto_apply result.
 */

export type GateStatus = 'auto_apply' | 'auto_apply_with_warning' | 'manual_review'

export interface ExtractionResult<T> {
  payload: T
  /** Overall (e.g., document-level) confidence in [0, 1]. */
  confidence: number
  /** Per-field confidence, optional. */
  field_confidence?: Record<string, number>
  /** Source PDF page (1-indexed). */
  pdf_page?: number
  /** Bounding box for hallucination verification. */
  bbox?: { x0: number; y0: number; x1: number; y1: number }
}

export interface GatedResult<T> extends ExtractionResult<T> {
  status: GateStatus
  /** Fields whose individual confidence is below 0.7 — flagged for review. */
  flagged_fields: string[]
}

export function gate<T>(extracted: ExtractionResult<T>): GatedResult<T> {
  let status: GateStatus
  if (extracted.confidence >= 0.85) status = 'auto_apply'
  else if (extracted.confidence >= 0.7) status = 'auto_apply_with_warning'
  else status = 'manual_review'

  const flagged: string[] = []
  if (extracted.field_confidence) {
    for (const [field, conf] of Object.entries(extracted.field_confidence)) {
      if (conf < 0.7) flagged.push(field)
    }
  }
  return { ...extracted, status, flagged_fields: flagged }
}

export const GATE_THRESHOLDS = {
  AUTO_APPLY: 0.85,
  WARNING: 0.7,
} as const
