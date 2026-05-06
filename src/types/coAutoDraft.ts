// =============================================================================
// RFI → CO Auto-Draft — shared types
// =============================================================================
// Kept in src/types/ rather than src/types/database.ts so the Database type
// generation (which mirrors public schema) stays clean and isn't polluted by
// app-level shapes.
// =============================================================================

export type ScopeChangeKind =
  | 'material_substitution'   // 1/2" → 1" insulation
  | 'quantity_change'         // 12 LF → 28 LF
  | 'new_scope_element'       // "install GFCI receptacles" not in original
  | 'sequence_change'         // "relocate this junction box"
  | 'detail_change'           // "use detail B instead of A"
  | 'no_change'               // "proceed as drawn"

/** Confidence the answer changes scope. Cost confidence is a separate signal. */
export type ScopeConfidence = 'high' | 'medium' | 'low'

export interface ScopeClassification {
  /** Is the architect's answer a scope change? */
  scopeChange: boolean
  /** Which pattern best describes the change. */
  kind: ScopeChangeKind
  /** Free-text reason — surfaces in the audit trail and the approval UI. */
  reasoning: string
  /** How confident we are scope changed. The drafter only writes a CO when
   *  this is 'high' OR 'medium' with a costable line item. */
  confidence: ScopeConfidence
  /** When the model can identify them — material/labor lines for the cost
   *  estimator. The model never returns money; it returns quantity + unit. */
  lineItems: ScopeLineItem[]
}

export interface ScopeLineItem {
  /** "1-inch rigid insulation", "GFCI receptacle (NEMA 5-15R)" */
  description: string
  /** Numeric quantity. Null if the model can't infer one (CO drafts with
   *  empty cost in that case). */
  quantity: number | null
  /** "sf", "lf", "ea", "hr". Free-text — the cost lookup matches this against
   *  cost_database.unit. */
  unit: string | null
  /** Optional CSI section to scope the cost lookup. */
  csiCode?: string | null
}

export interface CostEstimate {
  /** Per-line breakdown. Items where the cost lookup failed have unitCost=null. */
  lines: CostEstimateLine[]
  /** Sum of (qty × unitCost) across lines that priced. Null when no line
   *  could be priced — the drafter still writes the CO with an empty cost
   *  field rather than fabricating a number. */
  total: number | null
  /** Source string used in the audit trail.
   *  Example: "cost_database matches 3/4, 1 line unmatched" */
  provenance: string
}

export interface CostEstimateLine {
  description: string
  quantity: number | null
  unit: string | null
  unitCost: number | null
  /** quantity × unitCost. Null when either operand is null. */
  lineTotal: number | null
  /** ID of the cost_database row used (or null when no match). */
  costDatabaseId: string | null
  /** Why this line priced (or didn't). */
  matchNote: string
}

export interface DraftCoPayload {
  title: string
  narrative: string
  estimatedCost: number | null
  scheduleImpactDays: number
  reasonCode: 'design_change' | 'owner_directive' | 'unforeseen_condition' | 'rfi_clarification'
  sourceRfiId: string
  /** The classification + cost provenance, kept on the drafted action so the
   *  approval UI can render the audit context the PM needs to decide. */
  classification: ScopeClassification
  cost: CostEstimate
}
