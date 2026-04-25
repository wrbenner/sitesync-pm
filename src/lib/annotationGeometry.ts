// annotationGeometry.ts — Coordinate normalization utilities for construction drawing annotations.
// Converts between pixel coordinates and normalized [0,1] coordinates so annotations
// are resolution-independent.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface PageDimensions {
  width: number;
  height: number;
}

export type GeometryType =
  | 'point'
  | 'line'
  | 'rect'
  | 'polygon'
  | 'polyline'
  | 'path'
  | 'text'
  | 'cloud'
  | 'stamp'
  | 'measure';

export interface NormalizedGeometry {
  type: GeometryType;
  points: NormalizedPoint[];
  pathData?: string; // SVG path data for freehand strokes
  rotation?: number; // degrees
}

export interface AnnotationStyle {
  strokeColor: string;
  fillColor?: string;
  strokeWidth: number; // normalized units
  opacity: number;
  fontSize?: number;
  fontFamily?: string;
}

export type AnnotationLayer = 'default' | 'review' | 'field' | 'coordination';
export type AnnotationVisibility = 'private' | 'team' | 'all';
export type AnnotationStatus = 'active' | 'resolved' | 'archived';
export type StampType =
  | 'approved'
  | 'rejected'
  | 'revise_resubmit'
  | 'reviewed'
  | 'void'
  | 'not_for_construction'
  | 'preliminary';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function pageDiagonal(page: PageDimensions): number {
  return Math.sqrt(page.width * page.width + page.height * page.height);
}

// ---------------------------------------------------------------------------
// Point conversion
// ---------------------------------------------------------------------------

/** Convert a pixel-space point to normalized [0,1] coordinates, clamped. */
export function toNormalized(
  point: { x: number; y: number },
  page: PageDimensions,
): NormalizedPoint {
  return {
    x: clamp(point.x / page.width, 0, 1),
    y: clamp(point.y / page.height, 0, 1),
  };
}

/** Convert a normalized point back to pixel-space coordinates. */
export function fromNormalized(
  point: NormalizedPoint,
  page: PageDimensions,
): { x: number; y: number } {
  return {
    x: point.x * page.width,
    y: point.y * page.height,
  };
}

// ---------------------------------------------------------------------------
// Geometry conversion
// ---------------------------------------------------------------------------

/** Normalize an entire geometry (points + optional SVG path data) to [0,1]. */
export function normalizeGeometry(
  type: GeometryType,
  pixelPoints: { x: number; y: number }[],
  page: PageDimensions,
  pathData?: string,
): NormalizedGeometry {
  const points = pixelPoints.map((p) => toNormalized(p, page));
  const geometry: NormalizedGeometry = { type, points };
  if (pathData !== undefined) {
    geometry.pathData = pathData;
  }
  return geometry;
}

/** Convert a normalized geometry back to pixel-space. */
export function denormalizeGeometry(
  geometry: NormalizedGeometry,
  page: PageDimensions,
): { type: GeometryType; points: { x: number; y: number }[]; pathData?: string } {
  const points = geometry.points.map((p) => fromNormalized(p, page));
  const result: { type: GeometryType; points: { x: number; y: number }[]; pathData?: string } = {
    type: geometry.type,
    points,
  };
  if (geometry.pathData !== undefined) {
    result.pathData = geometry.pathData;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Stroke width
// ---------------------------------------------------------------------------

/** Normalize a pixel stroke width relative to the page diagonal. */
export function normalizeStrokeWidth(
  pixelWidth: number,
  page: PageDimensions,
): number {
  return pixelWidth / pageDiagonal(page);
}

/** Convert a normalized stroke width back to pixels. */
export function denormalizeStrokeWidth(
  normalizedWidth: number,
  page: PageDimensions,
): number {
  return normalizedWidth * pageDiagonal(page);
}

// ---------------------------------------------------------------------------
// Bounding box
// ---------------------------------------------------------------------------

/** Return the axis-aligned bounding box of a geometry in normalized space. */
export function boundingBox(
  geometry: NormalizedGeometry,
): { x: number; y: number; width: number; height: number } {
  if (geometry.points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of geometry.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ---------------------------------------------------------------------------
// Hit testing
// ---------------------------------------------------------------------------

/** Check whether a normalized point falls within / near a geometry. */
export function geometryContainsPoint(
  geometry: NormalizedGeometry,
  point: NormalizedPoint,
  tolerance: number = 0.01,
): boolean {
  const { type, points } = geometry;

  switch (type) {
    case 'point': {
      if (points.length === 0) return false;
      const dx = point.x - points[0].x;
      const dy = point.y - points[0].y;
      return Math.sqrt(dx * dx + dy * dy) <= tolerance;
    }

    case 'line':
    case 'polyline':
    case 'measure': {
      for (let i = 0; i < points.length - 1; i++) {
        if (distanceToSegment(point, points[i], points[i + 1]) <= tolerance) {
          return true;
        }
      }
      return false;
    }

    case 'rect':
    case 'stamp':
    case 'text':
    case 'cloud': {
      const box = boundingBox(geometry);
      return (
        point.x >= box.x - tolerance &&
        point.x <= box.x + box.width + tolerance &&
        point.y >= box.y - tolerance &&
        point.y <= box.y + box.height + tolerance
      );
    }

    case 'polygon': {
      if (pointInPolygon(point, points)) return true;
      // Check edges for tolerance
      for (let i = 0; i < points.length; i++) {
        const next = (i + 1) % points.length;
        if (distanceToSegment(point, points[i], points[next]) <= tolerance) {
          return true;
        }
      }
      return false;
    }

    case 'path': {
      // For freehand paths, check proximity to each segment
      for (let i = 0; i < points.length - 1; i++) {
        if (distanceToSegment(point, points[i], points[i + 1]) <= tolerance) {
          return true;
        }
      }
      return false;
    }

    default:
      return false;
  }
}

/** Shortest distance from a point to a line segment. */
function distanceToSegment(
  p: NormalizedPoint,
  a: NormalizedPoint,
  b: NormalizedPoint,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // Segment is a single point
    const ex = p.x - a.x;
    const ey = p.y - a.y;
    return Math.sqrt(ex * ex + ey * ey);
  }

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = clamp(t, 0, 1);

  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  const ex = p.x - projX;
  const ey = p.y - projY;
  return Math.sqrt(ex * ex + ey * ey);
}

/** Ray-casting point-in-polygon test. */
function pointInPolygon(
  point: NormalizedPoint,
  polygon: NormalizedPoint[],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------------------
// Revision cloud path generation
// ---------------------------------------------------------------------------

/**
 * Generate an SVG path string for a revision cloud — small semicircular bumps
 * along the perimeter of a rectangle. This is a standard construction markup
 * pattern used to highlight revisions on drawings.
 *
 * @param rect   Bounding rectangle (in any coordinate space).
 * @param arcSize  Approximate diameter of each bump. Defaults to
 *                 ~1/8 of the shorter side so clouds look proportional.
 */
export function generateCloudPath(
  rect: { x: number; y: number; width: number; height: number },
  arcSize?: number,
): string {
  const { x, y, width, height } = rect;
  const minDim = Math.min(width, height);
  const bump = arcSize ?? minDim / 8;

  // Guard against degenerate rectangles
  if (bump <= 0 || width <= 0 || height <= 0) {
    return `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`;
  }

  const segments: string[] = [];

  // Helper: emit arcs along one edge from (sx,sy) to (ex,ey)
  function arcsAlongEdge(sx: number, sy: number, ex: number, ey: number): void {
    const edgeDx = ex - sx;
    const edgeDy = ey - sy;
    const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);
    const count = Math.max(Math.round(edgeLen / bump), 2);
    const stepX = edgeDx / count;
    const stepY = edgeDy / count;
    const r = Math.sqrt(stepX * stepX + stepY * stepY) / 2;

    for (let i = 0; i < count; i++) {
      const arcEndX = sx + stepX * (i + 1);
      const arcEndY = sy + stepY * (i + 1);
      // Each arc is a semicircle bulging outward (sweep-flag 1)
      segments.push(`A ${r} ${r} 0 0 1 ${arcEndX} ${arcEndY}`);
    }
  }

  // Start at top-left
  segments.push(`M ${x} ${y}`);

  // Top edge: left to right
  arcsAlongEdge(x, y, x + width, y);
  // Right edge: top to bottom
  arcsAlongEdge(x + width, y, x + width, y + height);
  // Bottom edge: right to left
  arcsAlongEdge(x + width, y + height, x, y + height);
  // Left edge: bottom to top
  arcsAlongEdge(x, y + height, x, y);

  segments.push('Z');
  return segments.join(' ');
}
