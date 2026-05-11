// ────────────────────────────────────────────────────────────────────────────
// daily-log-compilation executor — compiles the day's field events into a draft
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/HARDENED_EXECUTORS_SPEC_2026-05-04.md
// Blast radius: additive — creates a *draft* daily log; finalization is a
// separate user action.

import type { ExecutorDecl, ExecutorPredicateResult } from './types'

export interface DailyLogCompilationInput {
  project_id: string
  date: string // YYYY-MM-DD
  /** Number of upstream field-event rows that fed the compilation. */
  source_event_count: number
  /** Confidence from the Drafter specialist's summarization pass. */
  confidence: number
}

export function dailyLogCompilationPredicate(
  input: DailyLogCompilationInput,
): ExecutorPredicateResult {
  const reasons: string[] = []
  if (!input.project_id) reasons.push('project_id required')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) reasons.push('date must be YYYY-MM-DD')
  if (!Number.isInteger(input.source_event_count) || input.source_event_count < 1) {
    reasons.push('source_event_count must be a positive integer (at least 1 event)')
  }
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    reasons.push('confidence must be in [0, 1]')
  }
  return { ok: reasons.length === 0, reasons }
}

export const DAILY_LOG_COMPILATION_DECL: ExecutorDecl<DailyLogCompilationInput> = {
  name: 'daily-log-compilation',
  version: '0.1.0',
  specialist: 'drafter',
  predicate: dailyLogCompilationPredicate,
  confidence_floor: 0.85, // super-persona threshold
  blast_radius: 'additive',
  description:
    'Compiles the day\'s field events into a draft daily log. Super finalizes via explicit tap. Additive write; rollback = delete the draft row.',
}
