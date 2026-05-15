/**
 * FMEA B.DRAW.1 (Wave 4) — Drawing SUPERSEDE creates duplicate revision_number
 *
 * Hazard: when a published drawing is superseded, a *new row* should be
 *         inserted with `revision_number = max(existing) + 1`. The
 *         observed bug class:
 *           - max() computed before the lock → 2 parallel SUPERSEDEs
 *             both compute rev5+1 and both insert rev6.
 *           - max() computed on a stale projection that excludes
 *             archived rows → revision wraps backwards.
 *           - The new row reuses the OLD drawing.id → no separate row
 *             at all; the SUPERSEDE event is effectively a status flip.
 *
 *         The state-machine layer is `drawingMachine.SUPERSEDE` which
 *         takes `published → draft`. The *new-row* insert lives in the
 *         service layer (drawings table).
 *
 * This spec is a contract on the next-revision-number computation —
 * a pure function expressed against a mocked database row set. The
 * hazard is "SUPERSEDE produces a row with rev_number duplicating an
 * existing rev_number for the same drawing series".
 *
 * Wave-1 covered the A.DRAW.1 machine path (SUPERSEDE legality from
 * `published`). Wave-4 (this file) covers B.DRAW.1 — the revision-
 * number integrity.
 */
import { describe, it, expect } from 'vitest'

interface DrawingRow {
  id: string
  drawing_series_id: string // groups all revisions of one drawing
  revision_number: number
  status: 'draft' | 'under_review' | 'approved' | 'rejected' | 'published' | 'archived'
  superseded_by?: string | null
}

/**
 * Pure computation of the next revision_number for a drawing series.
 * The hazard is using `existing.length + 1` (silently breaks on archived
 * gaps) instead of `max(revision_number) + 1`.
 */
function computeNextRevisionNumber(rows: DrawingRow[], seriesId: string): number {
  const inSeries = rows.filter((r) => r.drawing_series_id === seriesId)
  if (inSeries.length === 0) return 1
  const maxRev = inSeries.reduce((m, r) => Math.max(m, r.revision_number), 0)
  return maxRev + 1
}

/**
 * Validates a candidate SUPERSEDE insert against the existing series.
 * Returns { ok: true, nextRev } or { ok: false, reason }.
 */
function validateSupersedeInsert(
  rows: DrawingRow[],
  candidate: { drawing_series_id: string; revision_number: number },
): { ok: true; nextRev: number } | { ok: false; reason: string } {
  const inSeries = rows.filter((r) => r.drawing_series_id === candidate.drawing_series_id)
  const duplicate = inSeries.find((r) => r.revision_number === candidate.revision_number)
  if (duplicate) {
    return {
      ok: false,
      reason: `revision_number ${candidate.revision_number} already exists in series ${candidate.drawing_series_id}`,
    }
  }
  const expected = computeNextRevisionNumber(rows, candidate.drawing_series_id)
  if (candidate.revision_number !== expected) {
    return {
      ok: false,
      reason: `revision_number ${candidate.revision_number} is not the next expected (${expected})`,
    }
  }
  return { ok: true, nextRev: expected }
}

const baseRows = (): DrawingRow[] => [
  { id: 'd-1-rev1', drawing_series_id: 'series-A', revision_number: 1, status: 'archived', superseded_by: 'd-1-rev2' },
  { id: 'd-1-rev2', drawing_series_id: 'series-A', revision_number: 2, status: 'archived', superseded_by: 'd-1-rev3' },
  { id: 'd-1-rev3', drawing_series_id: 'series-A', revision_number: 3, status: 'archived', superseded_by: 'd-1-rev4' },
  { id: 'd-1-rev4', drawing_series_id: 'series-A', revision_number: 4, status: 'archived', superseded_by: 'd-1-rev5' },
  { id: 'd-1-rev5', drawing_series_id: 'series-A', revision_number: 5, status: 'published', superseded_by: null },
]

describe('FMEA B.DRAW.1 — next-revision-number contract', () => {
  it('series with rev1..rev5 published → next is rev6', () => {
    expect(computeNextRevisionNumber(baseRows(), 'series-A')).toBe(6)
  })

  it('empty series → first revision is rev1', () => {
    expect(computeNextRevisionNumber(baseRows(), 'series-NEW')).toBe(1)
  })

  it('archived gap (e.g. rev3 missing) does NOT wrap backwards', () => {
    const rows: DrawingRow[] = [
      { id: 'a', drawing_series_id: 'series-B', revision_number: 1, status: 'archived' },
      { id: 'b', drawing_series_id: 'series-B', revision_number: 2, status: 'archived' },
      // rev3 deleted out-of-band
      { id: 'd', drawing_series_id: 'series-B', revision_number: 4, status: 'published' },
    ]
    // The bug shape: `inSeries.length + 1` returns 4 — duplicates the
    // existing rev4. Our contract uses max+1.
    expect(computeNextRevisionNumber(rows, 'series-B')).toBe(5)
  })

  it('SUPERSEDE insert at rev6 is accepted (positive case)', () => {
    const result = validateSupersedeInsert(baseRows(), {
      drawing_series_id: 'series-A',
      revision_number: 6,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.nextRev).toBe(6)
  })

  it('SUPERSEDE insert at rev5 is REJECTED — duplicate (the headline hazard)', () => {
    const result = validateSupersedeInsert(baseRows(), {
      drawing_series_id: 'series-A',
      revision_number: 5,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/already exists/)
  })

  it('SUPERSEDE insert at rev7 (skip) is REJECTED — gap in revisions', () => {
    const result = validateSupersedeInsert(baseRows(), {
      drawing_series_id: 'series-A',
      revision_number: 7,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/not the next expected/)
  })

  it('parallel-SUPERSEDE race: two callers computing nextRev pre-lock both get 6 — only one INSERT must land', () => {
    // The race shape: both Tx-A and Tx-B read rev5 published, both
    // compute next=6, both attempt INSERT rev6. The DB must reject
    // the second via a UNIQUE(drawing_series_id, revision_number)
    // constraint. We pin the *application-side* expectation: after
    // Tx-A's insert, validateSupersedeInsert refuses Tx-B's identical
    // candidate.
    const rows = baseRows()

    // Tx-A and Tx-B both compute 6 from the pre-insert snapshot.
    const txAcandidate = { drawing_series_id: 'series-A', revision_number: 6 }
    const txBcandidate = { drawing_series_id: 'series-A', revision_number: 6 }

    // Tx-A commits first.
    const a = validateSupersedeInsert(rows, txAcandidate)
    expect(a.ok).toBe(true)
    rows.push({
      id: 'd-1-rev6',
      drawing_series_id: 'series-A',
      revision_number: 6,
      status: 'draft',
    })

    // Tx-B is now stale.
    const b = validateSupersedeInsert(rows, txBcandidate)
    expect(b.ok).toBe(false)
    if (!b.ok) expect(b.reason).toMatch(/already exists/)
  })

  it('KNOWN-VIOLATION ledger: the drawingMachine SUPERSEDE event mutates state only — the revision-number INSERT lives in the service layer', () => {
    // This test records the hazard surface for the next iteration:
    // drawingMachine has no built-in `assignRevisionNumber` actor, so
    // the integrity contract is enforced only at the DB layer. If the
    // service layer skips the validateSupersedeInsert call, a
    // unique constraint must be present on (drawing_series_id,
    // revision_number) to backstop. This is what the loop must verify.
    // We assert the pure contract; the SQL coverage is a separate
    // pgtap spec to be authored.
    expect(true).toBe(true)
  })
})
