/**
 * Unit tests for the test framework itself. Catches helper regressions
 * before they cascade into "all scenarios fail" CI noise.
 */

import { describe, it, expect } from 'vitest'
import { FIXTURE_PROJECT_IDS } from '../../e2e/helpers/fixtureIds'

describe('FIXTURE_PROJECT_IDS', () => {
  it('has exactly 3 fixture projects (small, mid, enterprise)', () => {
    expect(FIXTURE_PROJECT_IDS).toHaveLength(3)
  })

  it('every fixture ID is a valid v4 UUID', () => {
    const v4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    for (const id of FIXTURE_PROJECT_IDS) {
      expect(id).toMatch(v4)
    }
  })

  it('fixture IDs are deterministic — never change without coordinated update', () => {
    // Stamp the IDs so a refactor that re-orders them is loud.
    expect(FIXTURE_PROJECT_IDS[0]).toBe('e2000001-0000-4000-8000-000000000001')
    expect(FIXTURE_PROJECT_IDS[1]).toBe('e2000001-0000-4000-8000-000000000002')
    expect(FIXTURE_PROJECT_IDS[2]).toBe('e2000001-0000-4000-8000-000000000003')
  })
})
