import { describe, it, expect } from 'vitest'
import { parseScaleRatio, formatFeetInches } from './measurementUtils'

describe('measurementUtils — parseScaleRatio (architectural)', () => {
  it('1/4" = 1\'-0" → 48 real inches per paper inch', () => {
    const r = parseScaleRatio('1/4"=1\'-0"')
    expect(r?.realPerPaper).toBe(48)
  })

  it('1/8" = 1\'-0" → 96 real inches per paper inch', () => {
    expect(parseScaleRatio('1/8"=1\'-0"')?.realPerPaper).toBe(96)
  })

  it('3/16" = 1\'-0" → 64 real inches per paper inch', () => {
    expect(parseScaleRatio('3/16"=1\'-0"')?.realPerPaper).toBe(64)
  })

  it('handles whitespace around inch-mark + ft suffix', () => {
    // The implementation matches when paper side has explicit ' or " marks.
    // Bare "in" word form is not supported (would need regex tweak).
    expect(parseScaleRatio('1/4 " = 1\'')?.realPerPaper).toBe(48)
  })

  it('captures inches portion of mixed feet+inches ("1\\"=2\'-6\\"")', () => {
    // 1 paper inch = 2 ft 6 in = 30 real inches
    expect(parseScaleRatio('1"=2\'-6"')?.realPerPaper).toBe(30)
  })
})

describe('measurementUtils — parseScaleRatio (engineering)', () => {
  it('1" = 20\' → 240 real inches per paper inch', () => {
    expect(parseScaleRatio('1"=20\'')?.realPerPaper).toBe(240)
  })

  it('1" = 50 ft → 600 real inches per paper inch', () => {
    expect(parseScaleRatio('1" = 50 ft')?.realPerPaper).toBe(600)
  })
})

describe('measurementUtils — parseScaleRatio (unitless ratio)', () => {
  it('1:100 → 100 real per paper', () => {
    expect(parseScaleRatio('1:100')?.realPerPaper).toBe(100)
  })

  it('1:50 → 50 real per paper', () => {
    expect(parseScaleRatio('1:50')?.realPerPaper).toBe(50)
  })

  it('handles whitespace around the colon', () => {
    expect(parseScaleRatio('1 : 100')?.realPerPaper).toBe(100)
  })
})

describe('measurementUtils — parseScaleRatio (invalid input)', () => {
  it.each([
    null,
    undefined,
    '',
    '   ',
    'not-a-scale',
    '1:0',          // zero denominator
    '0:100',        // zero numerator
  ])('"%s" returns null', (input) => {
    expect(parseScaleRatio(input)).toBeNull()
  })
})

describe('measurementUtils — parseScaleRatio label preservation', () => {
  it('preserves the original input as label', () => {
    expect(parseScaleRatio('1/4"=1\'-0"')?.label).toBe('1/4"=1\'-0"')
    expect(parseScaleRatio('1:100')?.label).toBe('1:100')
  })
})

describe('measurementUtils — formatFeetInches', () => {
  it('0 inches → "0\\""', () => {
    expect(formatFeetInches(0)).toBe('0"')
  })

  it('negative input → "0\\"" (treated as zero)', () => {
    expect(formatFeetInches(-5)).toBe('0"')
  })

  it('Infinity / NaN → "0\\""', () => {
    expect(formatFeetInches(Infinity)).toBe('0"')
    expect(formatFeetInches(NaN)).toBe('0"')
  })

  it('inches under 12 → just inches without feet', () => {
    expect(formatFeetInches(6)).toBe('6"')
    expect(formatFeetInches(11.5)).toBe('11.5"')
  })

  it('exact feet → "N\'-0\\""', () => {
    expect(formatFeetInches(12)).toBe('1\'-0"')
    expect(formatFeetInches(60)).toBe('5\'-0"')
  })

  it('feet + inches → "F\'-I\\""', () => {
    expect(formatFeetInches(15)).toBe('1\'-3"')
    expect(formatFeetInches(81)).toBe('6\'-9"')
  })

  it('rounds to nearest half-inch', () => {
    expect(formatFeetInches(12.25)).toBe('1\'-0.5"')   // 0.25 rounds to 0.5
    expect(formatFeetInches(12.7)).toBe('1\'-0.5"')    // 0.7 rounds to 0.5
    expect(formatFeetInches(12.8)).toBe('1\'-1"')      // 0.8 rounds up to 1
  })

  it('rounding into the next foot carries when ft > 0', () => {
    // 23.99" → ft=1, rounded=12 → carries to "2'-0\""
    expect(formatFeetInches(23.99)).toBe('2\'-0"')
  })

  it('quirk: 11.99" returns "12\\"" not "1\'-0\\"" (ft===0 early return wins)', () => {
    // Documents an existing quirk: when ft is 0 the function returns the
    // inch value directly, even if rounding would otherwise carry up.
    // Removing the carry would change UI; pinning current behaviour.
    expect(formatFeetInches(11.99)).toBe('12"')
  })
})
