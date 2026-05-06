import { describe, it, expect } from 'vitest'
import { classifySeverity } from '../severityClassifier'

describe('classifySeverity', () => {
  // ── Critical bucket ─────────────────────────────────────────
  it('flags leaks as critical', () => {
    const r = classifySeverity('There is a leaking pipe near the boiler')
    expect(r.severity).toBe('critical')
    expect(r.confidence).toBeGreaterThanOrEqual(0.55)
    expect(r.matched).toContain('leaking')
  })

  it('flags structural language as critical', () => {
    const r = classifySeverity('Looks like a structural crack in the beam')
    expect(r.severity).toBe('critical')
  })

  it('flags water damage as critical', () => {
    const r = classifySeverity('We have water damage in the corner')
    expect(r.severity).toBe('critical')
    expect(r.matched).toContain('water damage')
  })

  // ── High bucket ─────────────────────────────────────────────
  it('flags broken fixtures as high', () => {
    const r = classifySeverity('The light fixture is broken')
    expect(r.severity).toBe('high')
  })

  it('flags missing items as high', () => {
    const r = classifySeverity('Missing the trim around this door')
    expect(r.severity).toBe('high')
  })

  it('flags doesn\'t-work language as high', () => {
    const r = classifySeverity("This outlet doesn't work")
    expect(r.severity).toBe('high')
  })

  // ── Medium bucket ───────────────────────────────────────────
  it('flags needs-repair as medium', () => {
    const r = classifySeverity('This area needs repair before sign-off')
    expect(r.severity).toBe('medium')
  })

  it('flags rework as medium', () => {
    const r = classifySeverity('Rework on this corner please')
    expect(r.severity).toBe('medium')
  })

  // ── Low bucket ──────────────────────────────────────────────
  it('flags scratched paint as low', () => {
    const r = classifySeverity('Wall is scratched near the elevator door')
    expect(r.severity).toBe('low')
    expect(r.matched).toContain('scratched')
  })

  it('flags cosmetic as low', () => {
    const r = classifySeverity('Cosmetic ding on the trim')
    expect(r.severity).toBe('low')
  })

  it('flags touch-up requests as low', () => {
    const r = classifySeverity('Needs a touch up here')
    expect(r.severity).toBe('low')
  })

  // ── Ambiguous / multi-tier ──────────────────────────────────
  it('picks the highest tier when multiple tiers match', () => {
    // "small" is low, "leaking" is critical → critical wins.
    const r = classifySeverity('Small leak in the ceiling, also a scratched wall')
    expect(r.severity).toBe('critical')
  })

  it('boosts confidence when multiple keywords in same tier match', () => {
    const single = classifySeverity('Stained baseboard')
    const multi = classifySeverity('Stained, scratched, and minor cosmetic flaws')
    expect(multi.confidence).toBeGreaterThan(single.confidence)
    expect(multi.severity).toBe('low')
  })

  // ── Empty / fallback ────────────────────────────────────────
  it('defaults to medium with low confidence on empty transcript', () => {
    const r = classifySeverity('')
    expect(r.severity).toBe('medium')
    expect(r.confidence).toBeLessThan(0.5)
    expect(r.matched).toEqual([])
  })

  it('defaults to medium when no keywords match', () => {
    const r = classifySeverity('Looks fine to me, nothing of note')
    expect(r.severity).toBe('medium')
    expect(r.matched).toEqual([])
  })

  it('treats whole-word matching for single words', () => {
    // "smaller" should NOT trigger the "small" low keyword.
    const r = classifySeverity('A much smaller value than expected')
    expect(r.severity).toBe('medium')
    expect(r.matched).toEqual([])
  })
})
