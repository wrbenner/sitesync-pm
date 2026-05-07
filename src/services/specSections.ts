// Phase 4 — Spec Sections lookup service (global CSI MasterFormat reference).
//
// The table is seeded from migrations; clients only read. Returns rows for
// a given set of section numbers (so the SpecSectionsView can label each
// group). When the table doesn't exist (older environments), returns an
// empty list — callers fall back to "Section description not available".

import { fromTable } from '../lib/db/queries'
import { type Result, ok, fail, dbError } from './errors'

export interface SpecSection {
  section_number: string
  title: string
  division: number
  division_title: string
}

export const specSectionsService = {
  /** Look up a set of section numbers. Returns whatever the table has. */
  async lookup(sectionNumbers: string[]): Promise<Result<Record<string, SpecSection>>> {
    if (sectionNumbers.length === 0) return ok({})

    const { data, error } = await fromTable('spec_sections' as never)
      .select('*')
      .in('section_number' as never, sectionNumbers)

    if (error) {
      // Graceful degradation: if the table doesn't exist yet (pre-migration
      // environment), surface an empty map rather than crashing the page.
      if (/relation .* does not exist/i.test(error.message)) return ok({})
      return fail(dbError(error.message, {}))
    }

    const map: Record<string, SpecSection> = {}
    for (const row of (data as unknown as SpecSection[]) ?? []) {
      map[row.section_number] = row
    }
    return ok(map)
  },
}
