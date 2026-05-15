/**
 * FMEA B.DRAW.1 (Wave 4) — drawing SUPERSEDE revision-number integrity.
 *
 * The `drawingMachine.SUPERSEDE` event mutates state only (published →
 * draft); the actual new-revision row is inserted by the service layer.
 * Wave-4 FMDC surfaced that there is no application-side validator
 * guarding revision-number monotonicity — integrity rests entirely on a
 * DB-layer UNIQUE constraint.
 *
 * This module provides the application-side backstop: a pure function
 * that throws if the candidate `next_revision_number` is not strictly
 * greater than every existing `revision_number` in the same drawing
 * series. Call from any service-layer code that processes SUPERSEDE.
 */

export interface DrawingRevisionRow {
  /** Identifier for the row — opaque to the validator. */
  id?: string | null;
  /**
   * Drawing series id — groups every revision of the same logical
   * drawing. For schemas that key revisions by `drawing_id` instead
   * of a separate `drawing_series_id`, pass `drawing_id` here.
   */
  drawing_series_id?: string | null;
  drawing_id?: string | null;
  /** Revision number — required for the integrity check. */
  revision_number: number;
}

/** Throws on invalid input. */
export class SupersedeRevisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupersedeRevisionError';
  }
}

function seriesKey(row: DrawingRevisionRow): string | null {
  return row.drawing_series_id ?? row.drawing_id ?? null;
}

/**
 * Compute the next valid revision number for a series given existing
 * rows. Returns `max(revision_number) + 1`, or `1` for an empty series.
 *
 * Why `max + 1` rather than `length + 1`: archived rows leave gaps in
 * the sequence (e.g. rev 3 deleted out-of-band). `length + 1` would
 * wrap backwards and collide with an existing row; `max + 1` is
 * monotonic.
 */
export function computeNextRevisionNumber(rows: DrawingRevisionRow[]): number {
  if (rows.length === 0) return 1;
  const maxRev = rows.reduce(
    (m, r) =>
      Number.isFinite(r.revision_number) ? Math.max(m, r.revision_number) : m,
    0,
  );
  return maxRev + 1;
}

/**
 * Throws if `candidate.next_revision_number` is not strictly greater
 * than every `existingRow.revision_number` (i.e. not a duplicate and
 * not a backwards step).
 *
 * @param existingRows  all revision rows in the same series, INCLUDING
 *                      archived / superseded rows. Pass an empty array
 *                      for a brand-new series — the validator accepts
 *                      `next_revision_number = 1`.
 * @param candidate     the candidate insert. `next_revision_number`
 *                      must be a positive integer.
 *
 * @throws {SupersedeRevisionError} when the candidate revision_number
 *         duplicates an existing row, is not the strictly-next value,
 *         or is non-positive / non-finite.
 */
export function validateSupersedeInsert(
  existingRows: readonly DrawingRevisionRow[],
  candidate: {
    drawing_series_id?: string | null;
    drawing_id?: string | null;
    next_revision_number: number;
    /**
     * Caller may pass the existing current-published revision number
     * for a stronger contract: candidate.next_revision_number must
     * also be > current_revision_number (catches the "max() computed
     * on stale projection" bug class).
     */
    current_revision_number?: number;
  },
): { ok: true; nextRev: number } {
  const nextRev = candidate.next_revision_number;
  if (!Number.isFinite(nextRev) || !Number.isInteger(nextRev) || nextRev <= 0) {
    throw new SupersedeRevisionError(
      `next_revision_number must be a positive integer; got ${String(nextRev)}`,
    );
  }

  // Narrow to the same series. We accept either drawing_series_id or
  // drawing_id as the grouping key — depending on the schema variant.
  const candidateKey = candidate.drawing_series_id ?? candidate.drawing_id ?? null;
  const inSeries = candidateKey == null
    ? existingRows.slice()
    : existingRows.filter((r) => seriesKey(r) === candidateKey);

  // Duplicate check — the headline hazard.
  const duplicate = inSeries.find((r) => r.revision_number === nextRev);
  if (duplicate) {
    throw new SupersedeRevisionError(
      `revision_number ${nextRev} already exists for this drawing series ` +
        `(row id: ${duplicate.id ?? 'unknown'}). Refusing duplicate insert.`,
    );
  }

  // Strict monotonicity — nextRev must be max+1.
  const expected = computeNextRevisionNumber(inSeries.slice());
  if (nextRev !== expected) {
    throw new SupersedeRevisionError(
      `next_revision_number ${nextRev} is not the next expected value ` +
        `(${expected}). Gaps and out-of-order inserts are not allowed.`,
    );
  }

  // Optional current-revision backstop.
  if (
    typeof candidate.current_revision_number === 'number' &&
    Number.isFinite(candidate.current_revision_number) &&
    nextRev <= candidate.current_revision_number
  ) {
    throw new SupersedeRevisionError(
      `next_revision_number ${nextRev} must be > current_revision_number ` +
        `${candidate.current_revision_number}. Backwards SUPERSEDE rejected.`,
    );
  }

  return { ok: true, nextRev };
}
