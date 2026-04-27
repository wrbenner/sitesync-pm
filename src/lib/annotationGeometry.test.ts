import { describe, it, expect } from 'vitest'
import {
  toNormalized,
  fromNormalized,
  normalizeGeometry,
  denormalizeGeometry,
  normalizeStrokeWidth,
  denormalizeStrokeWidth,
  boundingBox,
  geometryContainsPoint,
  generateCloudPath,
} from './annotationGeometry'

const PAGE = { width: 1000, height: 800 }

describe('annotationGeometry — toNormalized / fromNormalized', () => {
  it('round-trips a point with no precision loss', () => {
    const px = { x: 250, y: 400 }
    const normalized = toNormalized(px, PAGE)
    expect(normalized).toEqual({ x: 0.25, y: 0.5 })
    expect(fromNormalized(normalized, PAGE)).toEqual(px)
  })

  it('clamps points outside the page bounds to [0,1]', () => {
    expect(toNormalized({ x: -100, y: 1200 }, PAGE)).toEqual({ x: 0, y: 1 })
    expect(toNormalized({ x: 2000, y: -50 }, PAGE)).toEqual({ x: 1, y: 0 })
  })

  it('handles edge points (0,0) and (width,height)', () => {
    expect(toNormalized({ x: 0, y: 0 }, PAGE)).toEqual({ x: 0, y: 0 })
    expect(toNormalized({ x: 1000, y: 800 }, PAGE)).toEqual({ x: 1, y: 1 })
  })
})

describe('annotationGeometry — normalizeGeometry / denormalizeGeometry', () => {
  it('round-trips a polygon geometry', () => {
    const px = [
      { x: 100, y: 100 },
      { x: 500, y: 100 },
      { x: 300, y: 600 },
    ]
    const normalized = normalizeGeometry('polygon', px, PAGE)
    expect(normalized.type).toBe('polygon')
    expect(normalized.points).toHaveLength(3)

    const back = denormalizeGeometry(normalized, PAGE)
    expect(back.points).toEqual(px)
  })

  it('preserves pathData when present', () => {
    const r = normalizeGeometry('path', [{ x: 0, y: 0 }], PAGE, 'M 0 0 L 1 1')
    expect(r.pathData).toBe('M 0 0 L 1 1')

    const back = denormalizeGeometry(r, PAGE)
    expect(back.pathData).toBe('M 0 0 L 1 1')
  })

  it('omits pathData from output when not provided', () => {
    const r = normalizeGeometry('rect', [{ x: 0, y: 0 }], PAGE)
    expect('pathData' in r).toBe(false)
  })
})

describe('annotationGeometry — stroke width', () => {
  it('round-trips through page diagonal', () => {
    const px = 4
    const normalized = normalizeStrokeWidth(px, PAGE)
    const back = denormalizeStrokeWidth(normalized, PAGE)
    expect(back).toBeCloseTo(px, 6)
  })

  it('scales the same stroke proportionally on a smaller page', () => {
    const a = normalizeStrokeWidth(4, { width: 1000, height: 800 })
    const b = normalizeStrokeWidth(4, { width: 500, height: 400 })
    // Smaller page → larger relative stroke width.
    expect(b).toBeGreaterThan(a)
  })
})

describe('annotationGeometry — boundingBox', () => {
  it('returns zeros for an empty geometry', () => {
    expect(boundingBox({ type: 'polygon', points: [] })).toEqual({
      x: 0, y: 0, width: 0, height: 0,
    })
  })

  it('computes the AABB of a triangle correctly', () => {
    const r = boundingBox({
      type: 'polygon',
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.5, y: 0.2 },
        { x: 0.3, y: 0.7 },
      ],
    })
    expect(r).toEqual({ x: 0.1, y: 0.1, width: 0.4, height: 0.6 })
  })

  it('width/height are 0 for a single-point geometry', () => {
    const r = boundingBox({ type: 'point', points: [{ x: 0.5, y: 0.5 }] })
    expect(r).toEqual({ x: 0.5, y: 0.5, width: 0, height: 0 })
  })
})

describe('annotationGeometry — geometryContainsPoint', () => {
  it('point geometry: hit if within tolerance distance', () => {
    const geo = { type: 'point' as const, points: [{ x: 0.5, y: 0.5 }] }
    expect(geometryContainsPoint(geo, { x: 0.501, y: 0.5 }, 0.01)).toBe(true)
    expect(geometryContainsPoint(geo, { x: 0.6, y: 0.5 }, 0.01)).toBe(false)
  })

  it('point with no points returns false', () => {
    expect(
      geometryContainsPoint({ type: 'point', points: [] }, { x: 0, y: 0 }),
    ).toBe(false)
  })

  it('line: hit if within tolerance of any segment', () => {
    const geo = {
      type: 'line' as const,
      points: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    }
    expect(geometryContainsPoint(geo, { x: 0.5, y: 0.005 }, 0.01)).toBe(true)
    expect(geometryContainsPoint(geo, { x: 0.5, y: 0.5 }, 0.01)).toBe(false)
  })

  it('rect: hit when the point lies inside (with tolerance)', () => {
    const geo = {
      type: 'rect' as const,
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.6, y: 0.6 },
      ],
    }
    expect(geometryContainsPoint(geo, { x: 0.4, y: 0.4 })).toBe(true)
    expect(geometryContainsPoint(geo, { x: 0.65, y: 0.65 }, 0.01)).toBe(false)
  })

  it('rect tolerance extends the hit zone slightly outside the box', () => {
    const geo = {
      type: 'rect' as const,
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.6, y: 0.6 },
      ],
    }
    // 0.605 is outside the box but within tolerance 0.01
    expect(geometryContainsPoint(geo, { x: 0.605, y: 0.4 }, 0.01)).toBe(true)
  })

  it('polygon: hit inside via ray-cast', () => {
    // Triangle with vertices (0,0), (1,0), (0.5,1)
    const geo = {
      type: 'polygon' as const,
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0.5, y: 1 },
      ],
    }
    expect(geometryContainsPoint(geo, { x: 0.5, y: 0.5 })).toBe(true)
    expect(geometryContainsPoint(geo, { x: 0.99, y: 0.99 })).toBe(false)
  })

  it('path: treats sequence of points as connected segments', () => {
    const geo = {
      type: 'path' as const,
      points: [
        { x: 0, y: 0 },
        { x: 0.5, y: 0 },
        { x: 0.5, y: 0.5 },
      ],
    }
    // Hit on the second segment
    expect(geometryContainsPoint(geo, { x: 0.5, y: 0.25 }, 0.01)).toBe(true)
    // Far away
    expect(geometryContainsPoint(geo, { x: 1, y: 1 }, 0.01)).toBe(false)
  })

  it('unknown type returns false (defensive default)', () => {
    expect(
      // @ts-expect-error — exercising the default branch
      geometryContainsPoint({ type: 'circle', points: [{ x: 0, y: 0 }] }, { x: 0, y: 0 }),
    ).toBe(false)
  })
})

describe('annotationGeometry — generateCloudPath', () => {
  it('starts with M and ends with Z', () => {
    const path = generateCloudPath({ x: 0, y: 0, width: 100, height: 50 })
    expect(path.startsWith('M ')).toBe(true)
    expect(path.endsWith('Z')).toBe(true)
  })

  it('uses straight lines (no arcs) for degenerate rectangles', () => {
    const path = generateCloudPath({ x: 0, y: 0, width: 0, height: 0 })
    expect(path).not.toContain('A ') // no arc commands
    expect(path).toContain('L ')      // line commands present
  })

  it('emits arc commands for normal-sized clouds', () => {
    const path = generateCloudPath({ x: 0, y: 0, width: 200, height: 100 })
    expect(path).toContain('A ')
    // Multiple arcs along each edge.
    const arcCount = (path.match(/A /g) ?? []).length
    expect(arcCount).toBeGreaterThan(4)
  })

  it('respects an explicit arcSize override', () => {
    const small = generateCloudPath({ x: 0, y: 0, width: 100, height: 100 }, 2)
    const large = generateCloudPath({ x: 0, y: 0, width: 100, height: 100 }, 50)
    // Smaller arcSize = more arcs.
    const smallCount = (small.match(/A /g) ?? []).length
    const largeCount = (large.match(/A /g) ?? []).length
    expect(smallCount).toBeGreaterThan(largeCount)
  })
})
