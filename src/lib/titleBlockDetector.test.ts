import { describe, it, expect } from 'vitest'
import {
  defaultTitleBlockRegion,
  rightEdgeStripRegion,
} from './titleBlockDetector'

describe('titleBlockDetector — defaultTitleBlockRegion', () => {
  it('produces the bottom-right 35%×30% region', () => {
    const r = defaultTitleBlockRegion(1000, 800)
    expect(r.w).toBe(350)
    expect(r.h).toBe(240)
    expect(r.x).toBe(650)  // page width - region width
    expect(r.y).toBe(0)    // pdfjs y=0 is page bottom
  })

  it('region stays inside the page bounds (right edge aligned)', () => {
    const r = defaultTitleBlockRegion(1000, 800)
    expect(r.x + r.w).toBe(1000)
  })

  it('scales proportionally to page size', () => {
    const small = defaultTitleBlockRegion(500, 400)
    const large = defaultTitleBlockRegion(2000, 1600)
    expect(large.w).toBe(small.w * 4)
    expect(large.h).toBe(small.h * 4)
  })

  it('handles zero-sized pages without throwing', () => {
    const r = defaultTitleBlockRegion(0, 0)
    expect(r.w).toBe(0)
    expect(r.h).toBe(0)
  })
})

describe('titleBlockDetector — rightEdgeStripRegion', () => {
  it('produces a right-edge vertical strip 20% wide × full height', () => {
    const r = rightEdgeStripRegion(1000, 800)
    expect(r.w).toBe(200)
    expect(r.h).toBe(800)
    expect(r.x).toBe(800)
    expect(r.y).toBe(0)
  })

  it('right edge of the strip lines up with page edge', () => {
    const r = rightEdgeStripRegion(1000, 800)
    expect(r.x + r.w).toBe(1000)
  })

  it('full-height span equals page height', () => {
    const r = rightEdgeStripRegion(1000, 800)
    expect(r.y).toBe(0)
    expect(r.h).toBe(800)
  })

  it('strip is narrower than the default fallback', () => {
    const strip = rightEdgeStripRegion(1000, 800)
    const def = defaultTitleBlockRegion(1000, 800)
    // 20% < 35% on width
    expect(strip.w).toBeLessThan(def.w)
  })
})
