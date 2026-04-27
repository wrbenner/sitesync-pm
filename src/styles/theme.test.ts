import { describe, it, expect } from 'vitest'
import {
  getStatusColor,
  getPriorityColor,
  getSeverityColor,
  spacing,
  zIndex,
  touchTarget,
  borderRadius,
} from './theme'

describe('theme — getStatusColor', () => {
  it.each([
    'open', 'pending', 'under_review', 'approved', 'rejected', 'closed',
    'draft', 'in_progress', 'todo', 'in_review', 'done', 'complete',
    'active', 'resolved', 'verified', 'at_risk', 'behind', 'on_track',
    'answered', 'resubmit', 'void', 'submitted',
  ])('"%s" returns a documented {fg, bg} pair', (status) => {
    const r = getStatusColor(status)
    expect(r.fg).toBeTruthy()
    expect(r.bg).toBeTruthy()
  })

  it('unknown status falls back to neutral', () => {
    const r = getStatusColor('mystery_status')
    expect(r.bg).toBeTruthy()
    expect(r.fg).toBeTruthy()
  })

  it('approved/done/complete/active/resolved/verified all share the same active color', () => {
    const a = getStatusColor('approved')
    expect(getStatusColor('done').fg).toBe(a.fg)
    expect(getStatusColor('complete').fg).toBe(a.fg)
    expect(getStatusColor('active').fg).toBe(a.fg)
    expect(getStatusColor('resolved').fg).toBe(a.fg)
    expect(getStatusColor('verified').fg).toBe(a.fg)
  })

  it('rejected and behind share the critical color (both negative-outcome)', () => {
    expect(getStatusColor('rejected').fg).toBe(getStatusColor('behind').fg)
  })

  it('open/in_progress/submitted share the info color', () => {
    expect(getStatusColor('open').fg).toBe(getStatusColor('in_progress').fg)
    expect(getStatusColor('open').fg).toBe(getStatusColor('submitted').fg)
  })
})

describe('theme — getPriorityColor', () => {
  it.each(['critical', 'high', 'medium', 'low'])('"%s" returns a {fg, bg} pair', (p) => {
    const r = getPriorityColor(p)
    expect(r.fg).toBeTruthy()
    expect(r.bg).toBeTruthy()
  })

  it('unknown priority falls back to "medium"', () => {
    const fallback = getPriorityColor('mystery')
    const medium = getPriorityColor('medium')
    expect(fallback).toEqual(medium)
  })

  it('critical and high have distinct colors (both signal urgency)', () => {
    expect(getPriorityColor('critical').fg).not.toBe(getPriorityColor('high').fg)
  })
})

describe('theme — getSeverityColor', () => {
  it.each(['critical', 'warning', 'info', 'success'])(
    '"%s" returns a {fg, bg} pair',
    (s) => {
      const r = getSeverityColor(s)
      expect(r.fg).toBeTruthy()
      expect(r.bg).toBeTruthy()
    },
  )

  it('unknown severity falls back to "info"', () => {
    expect(getSeverityColor('mystery')).toEqual(getSeverityColor('info'))
  })

  it('critical severity matches the critical priority color (consistency invariant)', () => {
    expect(getSeverityColor('critical').fg).toBe(getPriorityColor('critical').fg)
  })
})

describe('theme — spacing scale', () => {
  it('spacing values follow a 4px-based ladder', () => {
    // The default scale uses keys like '0', '0.5', '1', '1.5', etc.
    // Verify a few canonical entries.
    expect(spacing['0']).toBe('0')
    expect(spacing['1']).toBe('4px')
    expect(spacing['2']).toBe('8px')
    expect(spacing['4']).toBe('16px')
    expect(spacing['8']).toBe('32px')
  })

  it('every spacing value is either "0" or matches a "Npx" pattern', () => {
    for (const value of Object.values(spacing)) {
      expect(
        value === '0' || /^-?\d+(?:\.\d+)?(?:px|rem|em|%)?$/.test(value),
        `spacing value "${value}" is not a valid CSS length`,
      ).toBe(true)
    }
  })
})

describe('theme — zIndex stacking', () => {
  it('layers stack monotonically: dropdown < sticky < fixed < modal < popover < tooltip < command < toast', () => {
    expect(zIndex.dropdown).toBeLessThan(zIndex.sticky)
    expect(zIndex.sticky).toBeLessThan(zIndex.fixed)
    expect(zIndex.fixed).toBeLessThan(zIndex.modal)
    expect(zIndex.modal).toBeLessThan(zIndex.popover)
    expect(zIndex.popover).toBeLessThan(zIndex.tooltip)
    expect(zIndex.tooltip).toBeLessThan(zIndex.command)
    expect(zIndex.command).toBeLessThan(zIndex.toast)
  })

  it('hide is below base (negative)', () => {
    expect(zIndex.hide).toBeLessThan(zIndex.base as number)
  })
})

describe('theme — touchTarget (industrial-touch invariant)', () => {
  it('exposes min / comfortable / field sizes', () => {
    expect(touchTarget.min).toBe('44px')           // iOS HIG minimum
    expect(touchTarget.comfortable).toBe('48px')   // Material guideline
    expect(touchTarget.field).toBe('56px')         // Construction-glove friendly
  })

  it('field > comfortable > min (size invariant)', () => {
    const num = (s: string) => parseInt(s, 10)
    expect(num(touchTarget.field)).toBeGreaterThan(num(touchTarget.comfortable))
    expect(num(touchTarget.comfortable)).toBeGreaterThan(num(touchTarget.min))
  })
})

describe('theme — borderRadius', () => {
  it('exposes the documented size scale', () => {
    expect(borderRadius.none).toBe('0')
    expect(borderRadius.sm).toBe('4px')
    expect(borderRadius.full).toBe('9999px')
  })

  it('numeric sizes are monotonically increasing (sm < base < md < lg < xl < 2xl)', () => {
    const num = (s: string) => parseInt(s, 10) || 0
    expect(num(borderRadius.sm)).toBeLessThan(num(borderRadius.base))
    expect(num(borderRadius.base)).toBeLessThan(num(borderRadius.md))
    expect(num(borderRadius.md)).toBeLessThan(num(borderRadius.lg))
    expect(num(borderRadius.lg)).toBeLessThan(num(borderRadius.xl))
    expect(num(borderRadius.xl)).toBeLessThan(num(borderRadius['2xl']))
  })
})
