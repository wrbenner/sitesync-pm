/**
 * FMEA A.DRAW.2 — Drawing tile orphaning when parent set deleted
 *
 * Hazard: `drawing_sets.drawing_ids` is a `UUID[]` array column, NOT a
 *         many-to-many junction table with FK constraints. When a
 *         drawing_set row is deleted, the UUIDs in `drawing_ids` are
 *         simply discarded — but the *drawings* (and their tiled assets
 *         in storage) remain. Conversely, when a drawing is hard-deleted,
 *         every set that referenced it now contains a dangling UUID.
 *
 *   Migration: supabase/migrations/20260421000001_drawing_tiles_and_sets.sql
 *     - `drawing_sets.project_id REFERENCES projects(id) ON DELETE CASCADE`
 *     - `drawing_sets.drawing_ids UUID[]` ← NO FK, NO cascade.
 *
 *   Confirmed via static scan: there is no trigger on drawings DELETE that
 *   sweeps `drawing_sets.drawing_ids`, nor a `drawing_set_members` junction
 *   table.
 *
 * Test approach:
 *   1. Static layer (always runs): scan the migration, assert the array
 *      column is present + the FK constraint is absent + no junction table
 *      is defined elsewhere.
 *   2. Pure-logic layer: pin the "orphan-safe" query shape — production
 *      code must filter `drawing_ids` against the live `drawings.id` set
 *      before rendering. Author the canonical filter and assert its
 *      behaviour on a synthetic dataset.
 *   3. KNOWN-VIOLATION ledger entry: array-FK gap is a real, current
 *      schema hazard. Fix path: replace UUID[] with `drawing_set_members
 *      (set_id, drawing_id)` junction + CASCADE on drawings.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const MIGRATION_PATH = resolve(
  __dirname,
  '..',
  '..',
  'supabase',
  'migrations',
  '20260421000001_drawing_tiles_and_sets.sql',
)

describe('FMEA A.DRAW.2 — drawing tile orphan on parent set delete', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf-8')

  it('drawing_sets has the UUID[] array column (current schema)', () => {
    expect(/drawing_sets/.test(sql)).toBe(true)
    expect(/drawing_ids\s+UUID\[\]/.test(sql)).toBe(true)
  })

  it('KNOWN-VIOLATION: drawing_sets.drawing_ids has NO foreign-key constraint', () => {
    // Slice the drawing_sets CREATE TABLE block.
    const start = sql.indexOf('CREATE TABLE IF NOT EXISTS drawing_sets')
    expect(start).toBeGreaterThan(-1)
    const end = sql.indexOf(');', start)
    const block = sql.slice(start, end)

    // project_id has a REFERENCES clause; drawing_ids does NOT.
    expect(/project_id.*REFERENCES\s+projects/i.test(block)).toBe(true)

    // drawing_ids line should not contain REFERENCES.
    const drawingIdsLine = block.match(/drawing_ids[^,\n]*/)?.[0] ?? ''
    expect(
      /REFERENCES/i.test(drawingIdsLine),
      'KNOWN-VIOLATION: drawing_sets.drawing_ids is a bare UUID[] with no FK to drawings. Deleting a drawing leaves dangling UUIDs in every set that referenced it. Fix: replace with `drawing_set_members(set_id, drawing_id)` junction + ON DELETE CASCADE on drawings.',
    ).toBe(false)
  })

  it('no drawing_set_members junction table is defined in this migration', () => {
    expect(/CREATE TABLE\s+(IF NOT EXISTS\s+)?drawing_set_members/i.test(sql)).toBe(false)
  })

  it('no AFTER DELETE trigger sweeps drawing_sets.drawing_ids when a drawing is deleted', () => {
    // Static probe: grep for any trigger on drawings that updates drawing_sets.
    expect(/CREATE TRIGGER[\s\S]+AFTER DELETE ON drawings[\s\S]+drawing_sets/i.test(sql)).toBe(false)
  })

  it('orphan-safe filter: drawing_ids ∩ live drawings.id is the canonical render set', () => {
    // Pure-unit contract: this is the filter every consumer should run
    // when reading drawing_sets.drawing_ids. If a row contains a UUID
    // that no longer exists in drawings, it must be filtered out at the
    // application layer — that's the workaround until the schema is
    // migrated.
    const orphanSafe = (sourceIds: string[], liveIds: Set<string>): string[] =>
      sourceIds.filter((id) => liveIds.has(id))

    const liveDrawings = new Set(['d1', 'd2', 'd3'])
    const setDrawings = ['d1', 'd2', 'orphan-d4', 'd3', 'orphan-d5']

    const rendered = orphanSafe(setDrawings, liveDrawings)
    expect(rendered).toEqual(['d1', 'd2', 'd3'])
    expect(rendered).not.toContain('orphan-d4')
    expect(rendered).not.toContain('orphan-d5')
  })

  it('cascade probe: deleting the parent set must not delete underlying drawings (correct)', () => {
    // This is the OPPOSITE direction — the set's UUID[] doesn't own the
    // drawings, so dropping a set must leave the drawings intact. The
    // intent is to assert that the schema's CASCADE only targets
    // project_id, NOT drawing_ids. (A future "fix" that added CASCADE on
    // drawing_set delete to drawings would be CATASTROPHIC — drawings
    // could vanish on bookkeeping changes.)
    const setBlock = sql.slice(
      sql.indexOf('CREATE TABLE IF NOT EXISTS drawing_sets'),
      sql.indexOf(');', sql.indexOf('CREATE TABLE IF NOT EXISTS drawing_sets')),
    )
    // The ONLY ON DELETE CASCADE here is on project_id.
    const cascades = setBlock.match(/ON DELETE CASCADE/g) ?? []
    expect(cascades.length).toBe(1)
    expect(/project_id.*ON DELETE CASCADE/i.test(setBlock)).toBe(true)
  })

  it('drawing_set_members migration absent from src (no follow-up shipped yet)', () => {
    // Best-effort: scan the whole migration directory for `drawing_set_members`
    // since the fix could land in a later file. If a future migration adds
    // the junction, this assertion flips and the catalog entry moves to
    // VALIDATED.
    const dir = resolve(__dirname, '..', '..', 'supabase', 'migrations')
    let found = false
    try {
      const files: string[] = readdirSync(dir)
      for (const f of files) {
        if (!/\.sql$/i.test(f)) continue
        const content = readFileSync(resolve(dir, f), 'utf-8')
        if (/drawing_set_members/i.test(content)) {
          found = true
          break
        }
      }
    } catch {
      // best-effort
    }
    expect(found, 'expected no drawing_set_members table yet (KNOWN-VIOLATION still open)').toBe(false)
  })
})
