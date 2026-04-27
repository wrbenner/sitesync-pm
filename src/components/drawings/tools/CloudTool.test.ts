import { describe, it, expect } from 'vitest'
import { generateCloudSvgPath } from './CloudTool'

describe('CloudTool — generateCloudSvgPath', () => {
  it('emits an "M" move command and a "Z" close command', () => {
    const path = generateCloudSvgPath(10, 20, 100, 60)
    expect(path).toMatch(/^M /)
    expect(path).toMatch(/Z$/)
  })

  it('emits at least 2 quadratic bezier (Q) arcs per edge × 4 edges = 8+ arcs', () => {
    const path = generateCloudSvgPath(0, 0, 100, 100)
    const arcs = (path.match(/Q /g) ?? []).length
    expect(arcs).toBeGreaterThanOrEqual(8)
  })

  it('starts at the supplied (x, y)', () => {
    const path = generateCloudSvgPath(50, 75, 100, 100)
    expect(path.startsWith('M 50 75')).toBe(true)
  })

  it('arc count scales proportionally to edge length', () => {
    // Wider rectangle → more arcs along top/bottom
    const small = generateCloudSvgPath(0, 0, 30, 30)
    const wide = generateCloudSvgPath(0, 0, 200, 30)
    const smallArcs = (small.match(/Q /g) ?? []).length
    const wideArcs = (wide.match(/Q /g) ?? []).length
    expect(wideArcs).toBeGreaterThan(smallArcs)
  })

  it('arcRadius is clamped at minimum 4', () => {
    // arcRadius=1 should still produce a sensible cloud (clamped to 4 internally)
    const path1 = generateCloudSvgPath(0, 0, 100, 100, 1)
    const path4 = generateCloudSvgPath(0, 0, 100, 100, 4)
    // Same effective radius, same path
    expect(path1).toBe(path4)
  })

  it('handles small rectangles without zero-width arcs', () => {
    const path = generateCloudSvgPath(0, 0, 8, 8)
    // Still produces ≥2 arcs per edge per the Math.max(2, ...) guard
    const arcs = (path.match(/Q /g) ?? []).length
    expect(arcs).toBeGreaterThanOrEqual(8)
  })

  it('produces a closed path (last command returns to start)', () => {
    // The "Z" command closes the path back to the M point.
    const path = generateCloudSvgPath(10, 20, 50, 50)
    expect(path.split(' ').pop()).toBe('Z')
  })
})
