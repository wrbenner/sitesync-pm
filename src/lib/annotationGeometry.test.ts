import { describe, it, expect } from 'vitest';
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
  type NormalizedGeometry,
} from './annotationGeometry';

const PAGE = { width: 1000, height: 800 };

describe('toNormalized / fromNormalized', () => {
  it('converts pixel point to normalized [0,1]', () => {
    expect(toNormalized({ x: 500, y: 400 }, PAGE)).toEqual({ x: 0.5, y: 0.5 });
    expect(toNormalized({ x: 0, y: 0 }, PAGE)).toEqual({ x: 0, y: 0 });
    expect(toNormalized({ x: 1000, y: 800 }, PAGE)).toEqual({ x: 1, y: 1 });
  });

  it('clamps out-of-range pixel coordinates', () => {
    expect(toNormalized({ x: -100, y: -50 }, PAGE)).toEqual({ x: 0, y: 0 });
    expect(toNormalized({ x: 5000, y: 4000 }, PAGE)).toEqual({ x: 1, y: 1 });
  });

  it('round-trips pixel → normalized → pixel', () => {
    const original = { x: 250, y: 600 };
    const normalized = toNormalized(original, PAGE);
    const result = fromNormalized(normalized, PAGE);
    expect(result.x).toBeCloseTo(250);
    expect(result.y).toBeCloseTo(600);
  });
});

describe('normalizeGeometry / denormalizeGeometry', () => {
  it('normalizes all points relative to page', () => {
    const pixel = [
      { x: 100, y: 200 },
      { x: 500, y: 400 },
    ];
    const result = normalizeGeometry('line', pixel, PAGE);
    expect(result.type).toBe('line');
    expect(result.points).toEqual([
      { x: 0.1, y: 0.25 },
      { x: 0.5, y: 0.5 },
    ]);
    expect(result.pathData).toBeUndefined();
  });

  it('preserves pathData when present', () => {
    const result = normalizeGeometry('path', [{ x: 0, y: 0 }], PAGE, 'M 0 0 L 10 10');
    expect(result.pathData).toBe('M 0 0 L 10 10');
  });

  it('denormalizes back to pixel coordinates', () => {
    const geom: NormalizedGeometry = {
      type: 'rect',
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.5, y: 0.5 },
      ],
    };
    const result = denormalizeGeometry(geom, PAGE);
    expect(result.points).toEqual([
      { x: 100, y: 160 },
      { x: 500, y: 400 },
    ]);
  });

  it('preserves pathData on denormalize', () => {
    const geom: NormalizedGeometry = {
      type: 'path',
      points: [],
      pathData: 'M 0 0',
    };
    expect(denormalizeGeometry(geom, PAGE).pathData).toBe('M 0 0');
  });
});

describe('normalizeStrokeWidth / denormalizeStrokeWidth', () => {
  it('normalizes stroke width by page diagonal', () => {
    // diag = sqrt(1000^2 + 800^2) ~= 1280.62
    const norm = normalizeStrokeWidth(12.8062, PAGE);
    expect(norm).toBeCloseTo(0.01, 4);
  });

  it('round-trips stroke width', () => {
    const px = 5;
    const norm = normalizeStrokeWidth(px, PAGE);
    const back = denormalizeStrokeWidth(norm, PAGE);
    expect(back).toBeCloseTo(px);
  });
});

describe('boundingBox', () => {
  it('returns zero box for empty points', () => {
    expect(boundingBox({ type: 'point', points: [] })).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  });

  it('returns bounds covering all points', () => {
    const geom: NormalizedGeometry = {
      type: 'polygon',
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.6, y: 0.4 },
        { x: 0.3, y: 0.7 },
      ],
    };
    const box = boundingBox(geom);
    expect(box.x).toBeCloseTo(0.1);
    expect(box.y).toBeCloseTo(0.2);
    expect(box.width).toBeCloseTo(0.5);
    expect(box.height).toBeCloseTo(0.5);
  });

  it('returns zero-size box for a single point', () => {
    expect(
      boundingBox({ type: 'point', points: [{ x: 0.4, y: 0.6 }] }),
    ).toEqual({ x: 0.4, y: 0.6, width: 0, height: 0 });
  });
});

describe('geometryContainsPoint', () => {
  it('point geometry: hits when within tolerance', () => {
    const geom: NormalizedGeometry = { type: 'point', points: [{ x: 0.5, y: 0.5 }] };
    expect(geometryContainsPoint(geom, { x: 0.505, y: 0.5 }, 0.01)).toBe(true);
    expect(geometryContainsPoint(geom, { x: 0.6, y: 0.6 }, 0.01)).toBe(false);
  });

  it('point geometry: returns false when no points', () => {
    expect(
      geometryContainsPoint({ type: 'point', points: [] }, { x: 0.5, y: 0.5 }),
    ).toBe(false);
  });

  it('line geometry: hits when point is near segment', () => {
    const geom: NormalizedGeometry = {
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    };
    expect(geometryContainsPoint(geom, { x: 0.5, y: 0.005 }, 0.01)).toBe(true);
    expect(geometryContainsPoint(geom, { x: 0.5, y: 0.5 }, 0.01)).toBe(false);
  });

  it('rect geometry: hits inside the bounding box', () => {
    const geom: NormalizedGeometry = {
      type: 'rect',
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.5, y: 0.5 },
      ],
    };
    expect(geometryContainsPoint(geom, { x: 0.3, y: 0.3 })).toBe(true);
    expect(geometryContainsPoint(geom, { x: 0.6, y: 0.6 })).toBe(false);
  });

  it('polygon geometry: hits inside polygon', () => {
    const square: NormalizedGeometry = {
      type: 'polygon',
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.5, y: 0.1 },
        { x: 0.5, y: 0.5 },
        { x: 0.1, y: 0.5 },
      ],
    };
    expect(geometryContainsPoint(square, { x: 0.3, y: 0.3 })).toBe(true);
    expect(geometryContainsPoint(square, { x: 0.7, y: 0.7 })).toBe(false);
  });

  it('polygon geometry: hits an edge within tolerance', () => {
    const square: NormalizedGeometry = {
      type: 'polygon',
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.5, y: 0.1 },
        { x: 0.5, y: 0.5 },
        { x: 0.1, y: 0.5 },
      ],
    };
    // Just outside the right edge
    expect(geometryContainsPoint(square, { x: 0.505, y: 0.3 }, 0.01)).toBe(true);
  });

  it('path geometry: hits along segments', () => {
    const path: NormalizedGeometry = {
      type: 'path',
      points: [
        { x: 0, y: 0 },
        { x: 0.5, y: 0 },
        { x: 0.5, y: 0.5 },
      ],
    };
    expect(geometryContainsPoint(path, { x: 0.25, y: 0 }, 0.01)).toBe(true);
    expect(geometryContainsPoint(path, { x: 0.5, y: 0.25 }, 0.01)).toBe(true);
    expect(geometryContainsPoint(path, { x: 0.9, y: 0.9 }, 0.01)).toBe(false);
  });

  it('measure / polyline behave like line', () => {
    const geom: NormalizedGeometry = {
      type: 'measure',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    };
    expect(geometryContainsPoint(geom, { x: 0.5, y: 0.505 }, 0.01)).toBe(true);
  });

  it('text/stamp/cloud use bounding box', () => {
    const stamp: NormalizedGeometry = {
      type: 'stamp',
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.4, y: 0.4 },
      ],
    };
    expect(geometryContainsPoint(stamp, { x: 0.3, y: 0.3 })).toBe(true);
    expect(geometryContainsPoint(stamp, { x: 0.5, y: 0.5 })).toBe(false);
  });

  it('returns false for unknown / fall-through cases without points', () => {
    const geom: NormalizedGeometry = { type: 'line', points: [] };
    expect(geometryContainsPoint(geom, { x: 0.5, y: 0.5 })).toBe(false);
  });
});

describe('generateCloudPath', () => {
  it('returns a closed SVG path string', () => {
    const path = generateCloudPath({ x: 0, y: 0, width: 100, height: 100 });
    expect(path).toMatch(/^M 0 0/);
    expect(path).toMatch(/Z$/);
    // Should contain arcs
    expect(path).toMatch(/A /);
  });

  it('falls back to plain rectangle for degenerate input', () => {
    expect(generateCloudPath({ x: 5, y: 5, width: 0, height: 10 })).toMatch(/^M 5 5/);
    expect(generateCloudPath({ x: 0, y: 0, width: 10, height: 10 }, 0)).not.toMatch(/A /);
  });

  it('honors explicit arcSize', () => {
    const small = generateCloudPath({ x: 0, y: 0, width: 100, height: 100 }, 5);
    const large = generateCloudPath({ x: 0, y: 0, width: 100, height: 100 }, 50);
    // Smaller bumps → more arc segments
    const smallArcs = (small.match(/A /g) || []).length;
    const largeArcs = (large.match(/A /g) || []).length;
    expect(smallArcs).toBeGreaterThan(largeArcs);
  });
});
