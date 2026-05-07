import { describe, it, expect } from 'vitest'
import {
  PATTERNS,
  answerHasScopeSignal,
  answerIsExplicitNoChange,
  inferKindFromSignals,
} from './scopeChangePatterns'

describe('PATTERNS', () => {
  it('covers all six ScopeChangeKind variants', () => {
    const kinds = PATTERNS.map((p) => p.kind).sort()
    expect(kinds).toEqual([
      'detail_change',
      'material_substitution',
      'new_scope_element',
      'no_change',
      'quantity_change',
      'sequence_change',
    ])
  })

  it('every pattern declares ≥1 regex signal', () => {
    for (const p of PATTERNS) {
      expect(p.signals.length).toBeGreaterThan(0)
      for (const r of p.signals) {
        expect(r).toBeInstanceOf(RegExp)
      }
    }
  })

  it('every pattern carries a few-shot example whose output matches its kind', () => {
    for (const p of PATTERNS) {
      expect(p.fewShot.output.kind).toBe(p.kind)
      expect(p.fewShot.question.length).toBeGreaterThan(0)
      expect(p.fewShot.answer.length).toBeGreaterThan(0)
    }
  })

  it('detail_change and no_change few-shots have scope_change=false', () => {
    const detail = PATTERNS.find((p) => p.kind === 'detail_change')!
    const noChange = PATTERNS.find((p) => p.kind === 'no_change')!
    expect(detail.fewShot.output.scope_change).toBe(false)
    expect(noChange.fewShot.output.scope_change).toBe(false)
  })

  it('change-bearing few-shots have scope_change=true', () => {
    const changeBearing = PATTERNS.filter(
      (p) => p.kind !== 'detail_change' && p.kind !== 'no_change',
    )
    for (const p of changeBearing) {
      expect(p.fewShot.output.scope_change).toBe(true)
    }
  })
})

describe('answerHasScopeSignal', () => {
  it('matches material substitution wording', () => {
    expect(
      answerHasScopeSignal(
        'install 1" rigid insulation instead of the 1/2" shown',
      ),
    ).toBe(true)
  })

  it('matches a quantity change phrase', () => {
    expect(answerHasScopeSignal('add 12 LF of pipe support')).toBe(true)
  })

  it('matches new scope element phrasing', () => {
    expect(
      answerHasScopeSignal('Provide additional GFCI receptacles in kitchen'),
    ).toBe(true)
  })

  it('matches sequence change wording', () => {
    expect(answerHasScopeSignal('relocate junction box JB-12 to grid D7')).toBe(
      true,
    )
  })

  it('does NOT count a "no change" phrase as a scope signal', () => {
    expect(answerHasScopeSignal('proceed as drawn. No change.')).toBe(false)
  })

  it('does NOT count a "detail change" phrase as a scope signal', () => {
    expect(
      answerHasScopeSignal('use detail B on sheet A8.04 instead of detail A'),
    ).toBe(false)
  })

  it('returns false on neutral text', () => {
    expect(answerHasScopeSignal('Confirm dimensions per attached.')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(answerHasScopeSignal('RELOCATE JB-12')).toBe(true)
  })
})

describe('answerIsExplicitNoChange', () => {
  it('detects "proceed as drawn"', () => {
    expect(answerIsExplicitNoChange('Proceed as drawn.')).toBe(true)
  })

  it('detects "no change"', () => {
    expect(answerIsExplicitNoChange('Per the spec — no change required.')).toBe(
      true,
    )
  })

  it('detects "confirmed as shown"', () => {
    expect(answerIsExplicitNoChange('Confirmed as shown on A.301.')).toBe(true)
  })

  it('does NOT match general text without confirm phrasing', () => {
    expect(answerIsExplicitNoChange('Add 12 LF of conduit.')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(answerIsExplicitNoChange('PROCEED AS DRAWN')).toBe(true)
  })
})

describe('inferKindFromSignals', () => {
  it('infers material_substitution', () => {
    expect(inferKindFromSignals('install 1" insulation in lieu of 1/2"')).toBe(
      'material_substitution',
    )
  })

  it('infers quantity_change', () => {
    expect(inferKindFromSignals('change from 12 LF to 28 LF')).toBe(
      'quantity_change',
    )
  })

  it('infers sequence_change for "reroute"', () => {
    expect(inferKindFromSignals('reroute conduit through chase')).toBe(
      'sequence_change',
    )
  })

  it('returns null when no signal matches', () => {
    expect(inferKindFromSignals('')).toBeNull()
    expect(
      inferKindFromSignals('Confirm dimensions per attached drawings.'),
    ).toBeNull()
  })

  it('infers no_change when "proceed as drawn" present', () => {
    expect(inferKindFromSignals('Proceed as drawn — no change.')).toBe(
      'no_change',
    )
  })
})
