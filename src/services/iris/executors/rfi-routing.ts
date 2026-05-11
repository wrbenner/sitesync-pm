// ────────────────────────────────────────────────────────────────────────────
// rfi-routing executor — assigns an RFI to a ball-in-court recipient
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/HARDENED_EXECUTORS_SPEC_2026-05-04.md
// Blast radius: additive — sets/changes assignment, does not delete prior
// state. Easy to undo (revert assignment).

import type { ExecutorDecl, ExecutorPredicateResult } from './types'

export interface RfiRoutingInput {
  rfi_id: string
  assignee_user_id: string
  /** Confidence from the Drafter specialist's classification of "who owns this". */
  confidence: number
  /** Optional explanation the executor logs alongside the assignment. */
  rationale?: string
}

export function rfiRoutingPredicate(input: RfiRoutingInput): ExecutorPredicateResult {
  const reasons: string[] = []
  if (!input.rfi_id) reasons.push('rfi_id required')
  if (!input.assignee_user_id) reasons.push('assignee_user_id required')
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    reasons.push('confidence must be in [0, 1]')
  }
  return { ok: reasons.length === 0, reasons }
}

export const RFI_ROUTING_DECL: ExecutorDecl<RfiRoutingInput> = {
  name: 'rfi-routing',
  version: '0.1.0',
  specialist: 'drafter',
  predicate: rfiRoutingPredicate,
  confidence_floor: 0.92, // per AUTO_EXECUTE_CANCEL_WINDOW_SPEC default
  blast_radius: 'additive',
  description:
    'Routes an open RFI to the resolved ball-in-court recipient. Additive write; rollback = revert assignment.',
}
