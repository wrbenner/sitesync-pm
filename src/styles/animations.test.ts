import { describe, it, expect } from 'vitest'
import { easing, easingArray, duration, motion, variants } from './animations'

describe('animations — easing curves', () => {
  it('exposes 6 documented easing curves', () => {
    expect(Object.keys(easing).sort()).toEqual([
      'apple', 'enter', 'exit', 'linear', 'spring', 'standard',
    ])
  })

  it('every non-linear easing is a cubic-bezier(...) string', () => {
    for (const [name, value] of Object.entries(easing)) {
      if (name === 'linear') continue
      expect(value, `${name} not a cubic-bezier`).toMatch(/^cubic-bezier\([\d.,\s-]+\)$/)
    }
  })

  it('linear is exactly "linear"', () => {
    expect(easing.linear).toBe('linear')
  })
})

describe('animations — easingArray (framer-motion arrays)', () => {
  it('has 5 named tuples (no "linear" — framer uses string)', () => {
    expect(Object.keys(easingArray).sort()).toEqual([
      'apple', 'enter', 'exit', 'spring', 'standard',
    ])
  })

  it('every tuple has exactly 4 numeric components (cubic bezier control points)', () => {
    for (const [name, arr] of Object.entries(easingArray)) {
      expect(arr, `${name} length`).toHaveLength(4)
      for (const n of arr) expect(typeof n).toBe('number')
    }
  })

  it('numbers in easingArray match the corresponding cubic-bezier in easing', () => {
    for (const name of ['standard', 'enter', 'exit', 'spring', 'apple'] as const) {
      const cssCurve = easing[name]
      const arr = easingArray[name]
      // Extract numbers from the cubic-bezier(a, b, c, d) string
      const match = cssCurve.match(/cubic-bezier\(([^)]+)\)/)
      expect(match).toBeTruthy()
      const css = match![1].split(',').map((s) => parseFloat(s.trim()))
      expect(css).toEqual([...arr])
    }
  })
})

describe('animations — duration scale', () => {
  it('values increase monotonically: instant < fast < normal < smooth < slow < glacial', () => {
    expect(duration.instant).toBeLessThan(duration.fast)
    expect(duration.fast).toBeLessThan(duration.normal)
    expect(duration.normal).toBeLessThan(duration.smooth)
    expect(duration.smooth).toBeLessThan(duration.slow)
    expect(duration.slow).toBeLessThan(duration.glacial)
  })

  it('every duration is a positive integer (milliseconds)', () => {
    for (const ms of Object.values(duration)) {
      expect(Number.isInteger(ms)).toBe(true)
      expect(ms).toBeGreaterThan(0)
    }
  })

  it('documented values: 80/120/200/300/500/800', () => {
    expect(duration).toEqual({
      instant: 80,
      fast: 120,
      normal: 200,
      smooth: 300,
      slow: 500,
      glacial: 800,
    })
  })
})

describe('animations — motion CSS strings', () => {
  it('every motion is a non-empty CSS transition string', () => {
    for (const [name, css] of Object.entries(motion)) {
      expect(css, `${name} is empty`).toBeTruthy()
      expect(css).toMatch(/\d+ms/)
    }
  })

  it('hover uses the instant duration (80ms)', () => {
    expect(motion.hover).toContain(`${duration.instant}ms`)
  })

  it('modalEnter uses the smooth duration + apple easing', () => {
    expect(motion.modalEnter).toContain(`${duration.smooth}ms`)
    expect(motion.modalEnter).toContain(easing.apple)
  })
})

describe('animations — framer-motion variants', () => {
  it('fadeIn / slideUp / scaleIn have initial + animate + exit phases', () => {
    for (const v of [variants.fadeIn, variants.slideUp, variants.scaleIn] as const) {
      expect(v.initial).toBeDefined()
      expect(v.animate).toBeDefined()
      expect(v.exit).toBeDefined()
    }
  })

  it('cardHover variant has rest + hover + tap states', () => {
    expect(variants.cardHover.rest).toBeDefined()
    expect(variants.cardHover.hover).toBeDefined()
    expect(variants.cardHover.tap).toBeDefined()
  })

  it('transition durations are seconds (ms / 1000) per framer-motion convention', () => {
    expect(variants.fadeIn.transition.duration).toBe(duration.smooth / 1000)
    expect(variants.scaleIn.transition.duration).toBe(duration.smooth / 1000)
  })
})
