// =============================================================================
// Daily-log revision diffs
// =============================================================================
// Once a log is signed, mutations are forbidden. The "edit" UI calls into
// this module which:
//   1. Diffs the old vs proposed values into per-field changes
//   2. Validates the required reason text
//   3. Inserts daily_log_revisions rows (one per field) — never UPDATE-ing
//      the daily_logs row
//
// The DB-side trigger (in 20260501110001_daily_log_revisions.sql) blocks any
// UPDATE attempt on a signed log. This module is what makes the legitimate
// edit path work.
// =============================================================================

import { sha256Hex } from './_hash'

export interface DailyLogValueBag {
  summary?: string | null
  weather?: string | null
  temperature_high?: number | null
  temperature_low?: number | null
  workers_onsite?: number | null
  total_hours?: number | null
  incidents?: number | null
}

export interface RevisionEntry {
  field: keyof DailyLogValueBag
  oldValue: unknown
  newValue: unknown
}

export interface RevisionInputs {
  dailyLogId: string
  projectId: string
  before: DailyLogValueBag
  after: DailyLogValueBag
  reason: string
  revisedBy: string
  /** Hash of the prior revision (or chain root for the first). */
  prevRevisionHash: string
}

const TRACKED_FIELDS: Array<keyof DailyLogValueBag> = [
  'summary', 'weather', 'temperature_high', 'temperature_low',
  'workers_onsite', 'total_hours', 'incidents',
]

export function diffRevisions(before: DailyLogValueBag, after: DailyLogValueBag): RevisionEntry[] {
  const out: RevisionEntry[] = []
  for (const field of TRACKED_FIELDS) {
    const a = (before as Record<string, unknown>)[field] ?? null
    const b = (after as Record<string, unknown>)[field] ?? null
    if (a !== b) out.push({ field, oldValue: a, newValue: b })
  }
  return out
}

export class InvalidRevisionError extends Error {
  constructor(message: string) { super(message); this.name = 'InvalidRevisionError' }
}

export function validateReason(reason: string): void {
  const trimmed = reason.trim()
  if (trimmed.length < 5) {
    throw new InvalidRevisionError('Revision reason must be at least 5 characters.')
  }
}

export interface BuildRevisionRowsResult {
  rows: Array<{
    daily_log_id: string
    project_id: string
    field: string
    old_value: unknown
    new_value: unknown
    reason: string
    revised_by: string
    revised_at: string
    prev_revision_hash: string
    revision_hash: string
  }>
}

/**
 * Build the rows to insert into daily_log_revisions. Each entry from the diff
 * becomes a separate row, chained: revision N's prev_revision_hash equals
 * revision N-1's revision_hash so a forensic walk can verify the edit history.
 *
 * Throws when there are no actual changes (signed-log edit form should
 * disable submit when nothing changed).
 */
export async function buildRevisionRows(
  inputs: RevisionInputs,
): Promise<BuildRevisionRowsResult> {
  validateReason(inputs.reason)
  const diffs = diffRevisions(inputs.before, inputs.after)
  if (diffs.length === 0) {
    throw new InvalidRevisionError('No fields changed; nothing to revise.')
  }
  const revisedAt = new Date().toISOString()
  let prev = inputs.prevRevisionHash
  const rows: BuildRevisionRowsResult['rows'] = []
  for (const d of diffs) {
    const hash = await sha256Hex(
      `${prev}|${String(d.field)}|${JSON.stringify(d.newValue)}|${inputs.revisedBy}|${revisedAt}`,
    )
    rows.push({
      daily_log_id: inputs.dailyLogId,
      project_id: inputs.projectId,
      field: String(d.field),
      old_value: d.oldValue,
      new_value: d.newValue,
      reason: inputs.reason.trim(),
      revised_by: inputs.revisedBy,
      revised_at: revisedAt,
      prev_revision_hash: prev,
      revision_hash: hash,
    })
    prev = hash
  }
  return { rows }
}
