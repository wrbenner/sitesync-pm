// =============================================================================
// scopeChangePatterns — anchor unit tests
// =============================================================================
// The patterns gate the auto-CO drafter — if a model's scope_change=true
// claim isn't backed by at least one anchor, we skip the CO write and only
// drop an Iris inbox card. These tests pin which strings should/shouldn't
// trip an anchor so a future "be more permissive" change can't silently
// open the door to false-positive COs.
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  answerHasScopeSignal,
  answerIsExplicitNoChange,
  inferKindFromSignals,
} from '../scopeChangePatterns'

describe('answerHasScopeSignal', () => {
  it.each([
    ['Per attached sketch, install 1" rigid insulation instead of the 1/2" shown', true],
    ['Quantity revised — install 28 LF total', true],
    ['In addition to standard outlets, provide GFCI receptacles at all kitchen counter locations', true],
    ['Relocate JB-12 to grid D7', true],
    ['Substitute aluminum-clad windows in lieu of vinyl on north elevation', true],
  ])('flags scope-change phrasing: %s', (text, expected) => {
    expect(answerHasScopeSignal(text)).toBe(expected)
  })

  it.each([
    ['Yes, proceed as drawn. No change.', false],
    ['Confirmed as specified.', false],
    ['Use detail B instead of A.', false],  // detail-only change is excluded
  ])('does not flag scope-neutral phrasing: %s', (text, expected) => {
    expect(answerHasScopeSignal(text)).toBe(expected)
  })
})

describe('answerIsExplicitNoChange', () => {
  it('matches "proceed as drawn"', () => {
    expect(answerIsExplicitNoChange('Yes, proceed as drawn.')).toBe(true)
  })

  it('matches "no change"', () => {
    expect(answerIsExplicitNoChange('No change. Verify shop drawings.')).toBe(true)
  })

  it('matches "confirmed as shown"', () => {
    expect(answerIsExplicitNoChange('Confirmed as shown on A2.10.')).toBe(true)
  })

  it('does not match a scope-changing answer', () => {
    expect(answerIsExplicitNoChange('Install 1" rigid instead of 1/2".')).toBe(false)
  })
})

describe('inferKindFromSignals', () => {
  it('classifies a thickness substitution', () => {
    expect(inferKindFromSignals('Install 1" rigid instead of the 1/2" shown'))
      .toBe('material_substitution')
  })

  it('classifies a quantity revision', () => {
    expect(inferKindFromSignals('Change from 12 LF to 28 LF total'))
      .toBe('quantity_change')
  })

  it('classifies a relocation', () => {
    expect(inferKindFromSignals('Relocate JB-12 to grid D7'))
      .toBe('sequence_change')
  })

  it('classifies a detail change', () => {
    expect(inferKindFromSignals('Use detail B from A8.04'))
      .toBe('detail_change')
  })

  it('returns null when nothing matches', () => {
    expect(inferKindFromSignals('OK to proceed.')).toBeNull()
  })

  it('classifies an explicit no-change', () => {
    expect(inferKindFromSignals('Proceed as drawn'))
      .toBe('no_change')
  })
})
