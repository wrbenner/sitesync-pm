// Phase 5b — Submittal reviewer chain initialization service.
//
// Calls submittal_initialize_chain RPC to materialize the reviewer chain
// when a new submittal is created. Phase 5b ships the create-time path;
// Phase 5b-2 adds mid-flight chain editing via Re-route action.

import { supabase } from '../lib/supabase'
import { type Result, ok, fail, dbError } from './errors'
import type { ReviewerChainStep } from './iris/submittalDraft'

export const submittalReviewerChainService = {
  /**
   * Materialize the chain. Atomic: wipes any existing chain rows on the
   * submittal first (idempotent re-init), inserts the new steps, flips
   * is_open on the first step. Returns the count of steps inserted.
   */
  async initialize(submittalId: string, steps: ReviewerChainStep[]): Promise<Result<number>> {
    if (!submittalId) {
      return fail({ category: 'ValidationError', code: 'MISSING_ID', message: 'submittalId required', userMessage: 'Submittal id missing' })
    }
    // Trim + validate before sending — the RPC also validates but cheaper here.
    const sanitized = steps
      .filter((s) => s.reviewer_role.trim().length > 0 || s.reviewer_name.trim().length > 0)
      .map((s, idx) => ({
        sequence: idx + 1,
        reviewer_role: s.reviewer_role.trim() || `Reviewer ${idx + 1}`,
        reviewer_name: s.reviewer_name.trim(),
        parallel_group: s.parallel_group || 0,
        due_date_offset_days: Math.max(0, s.due_date_offset_days || 7),
      }))

    if (sanitized.length === 0) {
      return ok(0)
    }

    const { data, error } = await supabase.rpc('submittal_initialize_chain' as never, {
      p_submittal_id: submittalId,
      p_steps: sanitized,
    } as never)

    if (error) return fail(dbError(error.message, { submittalId, stepCount: sanitized.length }))
    return ok((data as unknown as number) ?? sanitized.length)
  },
}

// ── Validation helpers ──────────────────────────────────────────────────────

export interface ChainValidationResult {
  valid: boolean
  errors: string[]
}

/** Validates the chain UI-side before submit. Empty chains are valid (the
 *  legacy single-reviewer pattern still works). */
export function validateReviewerChain(steps: ReviewerChainStep[]): ChainValidationResult {
  const errors: string[] = []
  if (steps.length === 0) return { valid: true, errors: [] }

  // Every step needs at least a role.
  for (const [idx, s] of steps.entries()) {
    if (!s.reviewer_role.trim() && !s.reviewer_name.trim()) {
      errors.push(`Step ${idx + 1}: needs a reviewer role or name`)
    }
  }

  // Parallel groups must contain ≥ 2 steps OR be 0 (sequential).
  const groupCounts = new Map<number, number>()
  for (const s of steps) {
    if (s.parallel_group > 0) {
      groupCounts.set(s.parallel_group, (groupCounts.get(s.parallel_group) ?? 0) + 1)
    }
  }
  for (const [group, count] of groupCounts) {
    if (count < 2) {
      errors.push(`Parallel group ${group} only has 1 step — needs at least 2 to be a parallel branch`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Renumber sequence values to be 1, 2, 3... after a reorder/insert/delete.
 * Preserves parallel_group assignments.
 */
export function renumberChain(steps: ReviewerChainStep[]): ReviewerChainStep[] {
  return steps.map((s, idx) => ({ ...s, sequence: idx + 1 }))
}
