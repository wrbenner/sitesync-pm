import { describe, it, expect } from 'vitest'
import {
  withReducedMotion,
  motionSafe,
  pageTransition,
  fadeIn,
  slideInRight,
  slideInUp,
  scaleIn,
} from './variants'

describe('variants — withReducedMotion', () => {
  it('returns the original variants unchanged when prefersReduced=false', () => {
    const r = withReducedMotion(pageTransition, false)
    expect(r).toBe(pageTransition)
  })

  it('replaces transition with zero-duration when prefersReduced=true', () => {
    const r = withReducedMotion(pageTransition, true) as { transition?: { duration: number } }
    expect(r.transition?.duration).toBe(0)
  })

  it('strips transform properties from initial/animate/exit (keeps only opacity)', () => {
    const r = withReducedMotion(pageTransition, true) as {
      initial: Record<string, unknown>
      animate: Record<string, unknown>
      exit: Record<string, unknown>
    }
    expect(r.initial).toEqual({ opacity: 0 })
    expect(r.animate).toEqual({ opacity: 1 })
    expect(r.exit).toEqual({ opacity: 0 })
    // y / scale / x transforms removed
    expect((r.initial as { y?: number }).y).toBeUndefined()
    expect((r.animate as { y?: number }).y).toBeUndefined()
  })

  it('does not mutate the input variants object', () => {
    const original = { ...pageTransition }
    withReducedMotion(pageTransition, true)
    expect(pageTransition).toEqual(original)
  })

  it('handles variants without initial/animate/exit gracefully', () => {
    const r = withReducedMotion({ transition: { duration: 0.5 } }, true) as { transition: { duration: number } }
    expect(r.transition.duration).toBe(0)
  })

  it('clears whileHover and whileTap when present', () => {
    const r = withReducedMotion(
      { initial: { opacity: 0 }, whileHover: { scale: 1.05 }, whileTap: { scale: 0.95 } },
      true,
    ) as { whileHover: object; whileTap: object }
    expect(r.whileHover).toEqual({})
    expect(r.whileTap).toEqual({})
  })

  it('preserves whileHover/whileTap when prefersReduced=false', () => {
    const orig = { whileHover: { scale: 1.05 }, whileTap: { scale: 0.95 } }
    const r = withReducedMotion(orig, false)
    expect(r).toBe(orig)
  })
})

describe('variants — motionSafe', () => {
  it('returns the supplied transition when prefersReduced=false', () => {
    const t = { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] }
    expect(motionSafe(false, t)).toBe(t)
  })

  it('returns zero-duration when prefersReduced=true', () => {
    expect(motionSafe(true, { duration: 0.3 })).toEqual({ duration: 0 })
  })

  it('zero-duration override discards the original easing', () => {
    const r = motionSafe(true, {
      duration: 0.5,
      ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
    }) as { duration: number; ease?: unknown }
    expect(r.duration).toBe(0)
    expect(r.ease).toBeUndefined()
  })
})

describe('variants — pre-built variants', () => {
  it('every variant has initial / animate / exit phases', () => {
    for (const v of [pageTransition, fadeIn, slideInRight, slideInUp, scaleIn]) {
      expect(v.initial).toBeDefined()
      expect(v.animate).toBeDefined()
      expect(v.exit).toBeDefined()
    }
  })

  it('slideInRight uses a 100% off-screen entry', () => {
    expect((slideInRight.initial as { x: string }).x).toBe('100%')
    expect((slideInRight.exit as { x: string }).x).toBe('100%')
  })

  it('slideInUp + scaleIn fade in (start opacity=0)', () => {
    expect((slideInUp.initial as { opacity: number }).opacity).toBe(0)
    expect((scaleIn.initial as { opacity: number }).opacity).toBe(0)
  })

  it('every variant has a transition with a positive numeric duration', () => {
    for (const v of [fadeIn, slideInRight, slideInUp, scaleIn]) {
      const t = (v as { transition: { duration: number } }).transition
      expect(t.duration).toBeGreaterThan(0)
    }
  })
})
