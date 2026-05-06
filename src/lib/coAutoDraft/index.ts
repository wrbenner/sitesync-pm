// =============================================================================
// RFI → CO Auto-Draft — public surface
// =============================================================================
// Re-exports the pure-logic pieces. The edge function uses the Deno-side
// duplicates under supabase/functions/shared/coAutoDraft/.
// =============================================================================

export {
  PATTERNS,
  answerHasScopeSignal,
  answerIsExplicitNoChange,
  inferKindFromSignals,
} from './scopeChangePatterns'

export {
  estimateCost,
  estimateCostFromCandidates,
} from './costEstimator'

export type {
  ScopeChangeKind,
  ScopeConfidence,
  ScopeClassification,
  ScopeLineItem,
  CostEstimate,
  CostEstimateLine,
  DraftCoPayload,
} from '../../types/coAutoDraft'

// =============================================================================
// reasonCode mapping — used by the edge function and the approval UI to keep
// the CO's reason_code field consistent across paths.
// =============================================================================

import type { ScopeChangeKind } from '../../types/coAutoDraft'

export function reasonCodeForKind(kind: ScopeChangeKind):
  'design_change' | 'owner_directive' | 'unforeseen_condition' | 'rfi_clarification' {
  switch (kind) {
    case 'material_substitution':
    case 'detail_change':
      return 'design_change'
    case 'quantity_change':
    case 'new_scope_element':
      return 'rfi_clarification'
    case 'sequence_change':
      return 'design_change'
    case 'no_change':
      return 'rfi_clarification'  // unreachable in practice — drafter skips no_change
  }
}
