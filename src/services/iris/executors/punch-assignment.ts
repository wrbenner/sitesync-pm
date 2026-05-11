// ────────────────────────────────────────────────────────────────────────────
// punch-assignment executor — assigns a punch-list item to a responsible party
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/HARDENED_EXECUTORS_SPEC_2026-05-04.md
// Blast radius: additive — sets the assignee + assigned_at; does not change
// item status or scope.

import type { ExecutorDecl, ExecutorPredicateResult } from './types'

export interface PunchAssignmentInput {
  punch_item_id: string
  assignee_user_id: string
  /** Trade / sub responsible (denormalized so the executor doesn't re-query). */
  trade: string
  confidence: number
}

export function punchAssignmentPredicate(
  input: PunchAssignmentInput,
): ExecutorPredicateResult {
  const reasons: string[] = []
  if (!input.punch_item_id) reasons.push('punch_item_id required')
  if (!input.assignee_user_id) reasons.push('assignee_user_id required')
  if (!input.trade || input.trade.trim().length === 0) reasons.push('trade required')
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    reasons.push('confidence must be in [0, 1]')
  }
  return { ok: reasons.length === 0, reasons }
}

export const PUNCH_ASSIGNMENT_DECL: ExecutorDecl<PunchAssignmentInput> = {
  name: 'punch-assignment',
  version: '0.1.0',
  specialist: 'drafter',
  predicate: punchAssignmentPredicate,
  confidence_floor: 0.9,
  blast_radius: 'additive',
  description:
    'Assigns an open punch-list item to a responsible sub/trade. Additive write; rollback = clear the assignee.',
}
