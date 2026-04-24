import { Path as FabricPath } from 'fabric';

interface RevisionCloudOptions {
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
}

const DEFAULT_STROKE_COLOR = '#E05252';
const DEFAULT_STROKE_WIDTH = 2;
const DEFAULT_OPACITY = 0.85;
const DEFAULT_ARC_RADIUS = 12;

/**
 * Generates an SVG path string for a revision cloud (scalloped rectangle).
 * Arcs proceed clockwise around the rectangle exterior.
 */
export function generateCloudSvgPath(
  x: number,
  y: number,
  w: number,
  h: number,
  arcRadius: number = DEFAULT_ARC_RADIUS
): string {
  const r = Math.max(4, arcRadius);
  const segments: string[] = [];

  // Calculate arc count for each edge based on length
  const topCount = Math.max(2, Math.round(w / (r * 2)));
  const rightCount = Math.max(2, Math.round(h / (r * 2)));
  const bottomCount = Math.max(2, Math.round(w / (r * 2)));
  const leftCount = Math.max(2, Math.round(h / (r * 2)));

  const topStep = w / topCount;
  const rightStep = h / rightCount;
  const bottomStep = w / bottomCount;
  const leftStep = h / leftCount;

  // Start at top-left
  segments.push(`M ${x} ${y}`);

  // Top edge: left to right
  for (let i = 0; i < topCount; i++) {
    const sx = x + i * topStep;
    const ex = x + (i + 1) * topStep;
    const midX = (sx + ex) / 2;
    const bulgeY = y - r * 0.6;
    segments.push(`Q ${midX} ${bulgeY} ${ex} ${y}`);
  }

  // Right edge: top to bottom
  for (let i = 0; i < rightCount; i++) {
    const sy = y + i * rightStep;
    const ey = y + (i + 1) * rightStep;
    const midY = (sy + ey) / 2;
    const bulgeX = x + w + r * 0.6;
    segments.push(`Q ${bulgeX} ${midY} ${x + w} ${ey}`);
  }

  // Bottom edge: right to left
  for (let i = 0; i < bottomCount; i++) {
    const sx = x + w - i * bottomStep;
    const ex = x + w - (i + 1) * bottomStep;
    const midX = (sx + ex) / 2;
    const bulgeY = y + h + r * 0.6;
    segments.push(`Q ${midX} ${bulgeY} ${ex} ${y + h}`);
  }

  // Left edge: bottom to top
  for (let i = 0; i < leftCount; i++) {
    const sy = y + h - i * leftStep;
    const ey = y + h - (i + 1) * leftStep;
    const midY = (sy + ey) / 2;
    const bulgeX = x - r * 0.6;
    segments.push(`Q ${bulgeX} ${midY} ${x} ${ey}`);
  }

  segments.push('Z');
  return segments.join(' ');
}

/**
 * Creates a revision cloud Fabric.js Path on the given canvas.
 * The cloud is drawn as scalloped arcs around the rectangle
 * defined by (startX, startY) to (endX, endY).
 */
export function createRevisionCloud(
  canvas: fabric.Canvas,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  options?: RevisionCloudOptions
): FabricPath {
  const {
    strokeColor = DEFAULT_STROKE_COLOR,
    strokeWidth = DEFAULT_STROKE_WIDTH,
    opacity = DEFAULT_OPACITY,
  } = options ?? {};

  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const w = Math.abs(endX - startX);
  const h = Math.abs(endY - startY);

  // Scale arc radius proportionally, clamped to a sensible range
  const arcRadius = Math.min(DEFAULT_ARC_RADIUS, Math.min(w, h) / 4);
  const pathData = generateCloudSvgPath(x, y, w, h, arcRadius);

  const path = new FabricPath(pathData, {
    fill: 'transparent',
    stroke: strokeColor,
    strokeWidth,
    opacity,
    selectable: true,
    evented: true,
    objectCaching: false,
  });

  canvas.add(path);
  canvas.renderAll();

  return path;
}
