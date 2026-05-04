/**
 * MeasurementOverlay — Steve-Jobs-level measurement tools for the drawing viewer.
 *
 * Design philosophy: The measurement IS the interface. Numbers emerge from the
 * geometry like the drawing is revealing its own dimensions. Proper architectural
 * dimension lines with witness lines and tick marks. Frosted glass labels that
 * feel native to the drawing. One read, zero parsing.
 *
 * Tools:
 *  - Tape: Architectural dimension line with witness lines, centered frosted pill
 *  - Area: Polygon with subtle fill, centered glass card showing ft² + perimeter
 *  - Count: Numbered circles with running total in a floating summary pill
 *  - Calibrate: Two-point scale definition with smooth reveal
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { parseScaleRatio, formatFeetInches } from './measurementUtils';
import type { NormalizedPoint } from '../../lib/annotationGeometry';

// ── Types ──────────────────────────────────────────────────────────────────

/** Tools this overlay actively handles. Passing any other tool makes the overlay non-interactive
 *  while still rendering already-completed measurements. */
type MeasureTool = 'measure' | 'area' | 'count' | 'calibrate' | 'path';
type OverlayTool = MeasureTool | 'select' | 'pin' | 'highlight' | 'text' | 'draw';

interface MeasurementOverlayProps {
  activeTool: OverlayTool;
  imageSize: { width: number; height: number };
  containerSize: { width: number; height: number };
  viewportBounds: { x: number; y: number; width: number; height: number } | null;
  scaleRatioText?: string | null;
  calibrationScale?: number | null;
  onCalibrate?: (realInchesPerNormUnit: number) => void;
  /** Fired when a measurement is fully drawn so the parent can persist it. */
  onMeasurementAdd?: (result: MeasurementResult) => void;
  /** Custom CSS cursor string for the SVG overlay (falls back to crosshair). */
  cursor?: string;
  /** Existing measurement endpoints to magnetically snap to. Normalized [0,1]. */
  snapPoints?: NormalizedPoint[];
  /** Fired when the cursor enters/leaves snap range so the parent can pulse the loupe. */
  onSnapStateChange?: (active: boolean) => void;
  /** Persisted measurements (loaded from DB or other pages) to render with the same rich styling as in-session ones. */
  externalMeasurements?: MeasurementResult[];
}

const isMeasureTool = (t: OverlayTool): t is MeasureTool =>
  t === 'measure' || t === 'area' || t === 'count' || t === 'calibrate' || t === 'path';

export interface MeasurementResult {
  id: string;
  type: 'linear' | 'area' | 'count' | 'path';
  points: NormalizedPoint[];
  /** Primary label (e.g. "81'-3"" for a measurement, or "24'-6" total" for a path) */
  label: string;
  /** Secondary label (e.g. "24.77 m" or "42.0 ft perim" or "3 segs") */
  sublabel?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

/** How far witness lines extend past the measurement line (screen px) */
const WITNESS_OVERSHOOT = 8;
/** How far witness lines sit from the measured edge */
const WITNESS_GAP = 6;
/** Tick mark half-width at dimension line endpoints */
const TICK_SIZE = 5;
/** Frosted label pill padding */
const PILL_PAD_X = 10;

// Architectural orange — warm, confident, reads on any background
const DIM_COLOR = '#F47820';
// Subtle cyan for area fills
const AREA_FILL = 'rgba(244,120,32,0.06)';
const AREA_STROKE = '#F47820';
// Count marker
const COUNT_COLOR = '#F47820';

// ── Helpers ───────────────────────────────────────────────────────────────

const genId = () => crypto.randomUUID();

function normalizedDistance(
  a: NormalizedPoint,
  b: NormalizedPoint,
  imageSize: { width: number; height: number },
): number {
  const dx = (b.x - a.x) * imageSize.width;
  const dy = (b.y - a.y) * imageSize.height;
  return Math.sqrt(dx * dx + dy * dy);
}

function polygonArea(
  points: NormalizedPoint[],
  imageSize: { width: number; height: number },
): number {
  if (points.length < 3) return 0;
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = points[i].x * imageSize.width;
    const yi = points[i].y * imageSize.height;
    const xj = points[j].x * imageSize.width;
    const yj = points[j].y * imageSize.height;
    area += xi * yj - xj * yi;
  }
  return Math.abs(area) / 2;
}

function polygonPerimeter(
  points: NormalizedPoint[],
  imageSize: { width: number; height: number },
): number {
  let perim = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    perim += normalizedDistance(points[i], points[j], imageSize);
  }
  return perim;
}

/** Angle of the line from a to b in radians */
function lineAngle(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** Perpendicular unit vector to the line from a to b */
function perpUnit(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
  const angle = lineAngle(a, b);
  // Perpendicular = rotate 90° (always pick the "up" side)
  return { x: -Math.sin(angle), y: Math.cos(angle) };
}

// ── Sub-components ────────────────────────────────────────────────────────

/**
 * ArchDimensionLine — A proper architectural dimension line with:
 *  - Witness lines extending from the measured points
 *  - A dimension line connecting the witness lines
 *  - Tick marks (45° slash or dot) at endpoints
 *  - Frosted-glass label pill centered on the dimension line
 */
const ArchDimensionLine: React.FC<{
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  label: string;
  sublabel?: string;
  offset?: number;
}> = ({ p1, p2, label, sublabel: _sublabel, offset = 16 }) => {
  const perp = perpUnit(p1, p2);
  const angle = lineAngle(p1, p2);
  const angleDeg = (angle * 180) / Math.PI;

  // Offset the dimension line from the actual measured edge
  const d1 = { x: p1.x + perp.x * offset, y: p1.y + perp.y * offset };
  const d2 = { x: p2.x + perp.x * offset, y: p2.y + perp.y * offset };

  // Witness lines from measured point to beyond dimension line
  const w1Start = { x: p1.x + perp.x * WITNESS_GAP, y: p1.y + perp.y * WITNESS_GAP };
  const w1End = { x: d1.x + perp.x * WITNESS_OVERSHOOT, y: d1.y + perp.y * WITNESS_OVERSHOOT };
  const w2Start = { x: p2.x + perp.x * WITNESS_GAP, y: p2.y + perp.y * WITNESS_GAP };
  const w2End = { x: d2.x + perp.x * WITNESS_OVERSHOOT, y: d2.y + perp.y * WITNESS_OVERSHOOT };

  // Label midpoint
  const mid = { x: (d1.x + d2.x) / 2, y: (d1.y + d2.y) / 2 };

  // Approximate label width for the gap in the dimension line
  const labelWidth = label.length * 8 + PILL_PAD_X * 2;
  const halfGap = labelWidth / 2 + 4;

  // Points along the dimension line, before and after the label gap
  const lineLen = Math.sqrt((d2.x - d1.x) ** 2 + (d2.y - d1.y) ** 2);
  const dir = { x: (d2.x - d1.x) / lineLen, y: (d2.y - d1.y) / lineLen };
  const gapStart = { x: mid.x - dir.x * halfGap, y: mid.y - dir.y * halfGap };
  const gapEnd = { x: mid.x + dir.x * halfGap, y: mid.y + dir.y * halfGap };

  // Flip text if line is going right-to-left so it reads left-to-right
  const textAngle = angleDeg > 90 || angleDeg < -90 ? angleDeg + 180 : angleDeg;

  return (
    <g>
      {/* Witness lines — thin, subtle */}
      <line x1={w1Start.x} y1={w1Start.y} x2={w1End.x} y2={w1End.y}
        stroke={DIM_COLOR} strokeWidth={0.75} opacity={0.5} />
      <line x1={w2Start.x} y1={w2Start.y} x2={w2End.x} y2={w2End.y}
        stroke={DIM_COLOR} strokeWidth={0.75} opacity={0.5} />

      {/* Dimension line — split around label */}
      <line x1={d1.x} y1={d1.y} x2={gapStart.x} y2={gapStart.y}
        stroke={DIM_COLOR} strokeWidth={1.25} />
      <line x1={gapEnd.x} y1={gapEnd.y} x2={d2.x} y2={d2.y}
        stroke={DIM_COLOR} strokeWidth={1.25} />

      {/* Tick marks at endpoints — 45° slash, architectural style */}
      <line
        x1={d1.x - TICK_SIZE * Math.cos(angle + Math.PI / 4)}
        y1={d1.y - TICK_SIZE * Math.sin(angle + Math.PI / 4)}
        x2={d1.x + TICK_SIZE * Math.cos(angle + Math.PI / 4)}
        y2={d1.y + TICK_SIZE * Math.sin(angle + Math.PI / 4)}
        stroke={DIM_COLOR} strokeWidth={1.5} />
      <line
        x1={d2.x - TICK_SIZE * Math.cos(angle + Math.PI / 4)}
        y1={d2.y - TICK_SIZE * Math.sin(angle + Math.PI / 4)}
        x2={d2.x + TICK_SIZE * Math.cos(angle + Math.PI / 4)}
        y2={d2.y + TICK_SIZE * Math.sin(angle + Math.PI / 4)}
        stroke={DIM_COLOR} strokeWidth={1.5} />

      {/* Dimension label — minimal chrome. The number IS the interface. */}
      <g transform={`translate(${mid.x}, ${mid.y}) rotate(${textAngle})`}>
        {/* Subtle background capsule so the number reads on any drawing. Narrower + lighter by default. */}
        <rect
          x={-halfGap} y={-10}
          width={halfGap * 2} height={20}
          rx={10}
          fill="rgba(20,20,20,0.58)"
        />
        {/* Primary measurement — readable, not dominant */}
        <text
          x={0} y={4}
          textAnchor="middle"
          fill="#fff"
          fontSize={11.5}
          fontWeight={600}
          fontFamily="'SF Mono', 'Menlo', 'Consolas', monospace"
          letterSpacing={0.2}
        >
          {label}
        </text>
      </g>
    </g>
  );
};

/**
 * AreaCard — Frosted glass card centered in a polygon showing area + perimeter.
 */
const AreaCard: React.FC<{
  centroid: { x: number; y: number };
  areaLabel: string;
  perimLabel: string;
}> = ({ centroid, areaLabel, perimLabel }) => {
  // Compact capsule — a whisper of chrome, not a billboard. Perimeter on a secondary line only if present.
  const twoLine = !!perimLabel;
  const cardW = Math.max(areaLabel.length * 7.5 + 18, 76);
  const cardH = twoLine ? 34 : 22;
  return (
    <g>
      <rect
        x={centroid.x - cardW / 2} y={centroid.y - cardH / 2}
        width={cardW} height={cardH}
        rx={twoLine ? 10 : 11}
        fill="rgba(20,20,20,0.58)"
      />
      <text
        x={centroid.x} y={twoLine ? centroid.y - 2 : centroid.y + 4}
        textAnchor="middle"
        fill="#fff"
        fontSize={12}
        fontWeight={600}
        fontFamily="'SF Mono', 'Menlo', 'Consolas', monospace"
        letterSpacing={0.2}
      >
        {areaLabel}
      </text>
      {twoLine && (
        <text
          x={centroid.x} y={centroid.y + 11}
          textAnchor="middle"
          fill="rgba(255,255,255,0.55)"
          fontSize={9.5}
          fontWeight={500}
          fontFamily="'SF Mono', 'Menlo', 'Consolas', monospace"
        >
          {perimLabel}
        </text>
      )}
    </g>
  );
};

/**
 * CountMarker — A single numbered circle that feels like a precision instrument.
 */
const CountMarker: React.FC<{
  pos: { x: number; y: number };
  number: number;
}> = ({ pos, number }) => (
  <g>
    {/* Tiny dot marking the exact tap position — won't obscure what you're counting. */}
    <circle cx={pos.x} cy={pos.y} r={3} fill={COUNT_COLOR} stroke="#fff" strokeWidth={1} />
    {/* Number floats just above-right of the dot with a stroke halo for legibility. */}
    <text
      x={pos.x + 4.5} y={pos.y - 4}
      fill={COUNT_COLOR}
      fontSize={10}
      fontWeight={700}
      fontFamily="'SF Mono', 'Menlo', 'Consolas', monospace"
      paintOrder="stroke"
      stroke="#fff"
      strokeWidth={2.5}
      strokeLinejoin="round"
    >
      {number}
    </text>
  </g>
);

/**
 * CountSummaryPill — Floating total in the corner.
 */
const CountSummaryPill: React.FC<{
  count: number;
  x: number;
  y: number;
}> = ({ count, x, y }) => {
  const text = `${count} item${count !== 1 ? 's' : ''}`;
  const w = text.length * 7.5 + 32;
  return (
    <g>
      <rect
        x={x - w} y={y - 28}
        width={w} height={32}
        rx={16}
        fill="rgba(20,20,20,0.85)"
        stroke="rgba(244,120,32,0.3)"
        strokeWidth={1}
      />
      {/* Count circle */}
      <circle cx={x - w + 18} cy={y - 12} r={10} fill={COUNT_COLOR} />
      <text
        x={x - w + 18} y={y - 11}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={10}
        fontWeight={700}
        fontFamily="'SF Mono', 'Menlo', 'Consolas', monospace"
      >
        {count}
      </text>
      {/* Label */}
      <text
        x={x - w + 36} y={y - 11}
        dominantBaseline="central"
        fill="rgba(255,255,255,0.7)"
        fontSize={12}
        fontWeight={600}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {text}
      </text>
    </g>
  );
};

/**
 * ScaleBadge — Persistent, subtle indicator of the active scale.
 * Bottom-left, doesn't compete for attention.
 */
const ScaleBadge: React.FC<{
  label: string;
  x: number;
  y: number;
}> = ({ label, x, y }) => {
  const text = `Scale: ${label}`;
  const w = text.length * 6 + 20;
  return (
    <g>
      <rect
        x={x} y={y - 20}
        width={w} height={24}
        rx={12}
        fill="rgba(20,20,20,0.6)"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={0.5}
      />
      <text
        x={x + 10} y={y - 6}
        fill="rgba(255,255,255,0.4)"
        fontSize={10}
        fontWeight={500}
        fontFamily="'SF Mono', 'Menlo', 'Consolas', monospace"
      >
        {text}
      </text>
    </g>
  );
};

/**
 * CalibrationGuide — In-progress calibration with a pulsing dot and instructional label.
 */
const CalibrationGuide: React.FC<{
  point: { x: number; y: number };
}> = ({ point }) => (
  <g>
    {/* Pulse ring */}
    <circle cx={point.x} cy={point.y} r={12} fill="none" stroke={DIM_COLOR} strokeWidth={1.5} opacity={0.4}>
      <animate attributeName="r" values="8;16;8" dur="1.5s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1.5s" repeatCount="indefinite" />
    </circle>
    {/* Center dot */}
    <circle cx={point.x} cy={point.y} r={4} fill={DIM_COLOR} />
    {/* Instruction */}
    <g transform={`translate(${point.x + 16}, ${point.y - 4})`}>
      <rect x={0} y={-10} width={120} height={22} rx={11} fill="rgba(20,20,20,0.85)" />
      <text x={10} y={4} fill="rgba(255,255,255,0.7)" fontSize={11} fontWeight={500}
        fontFamily="system-ui, -apple-system, sans-serif">
        Click second point
      </text>
    </g>
  </g>
);

// ── Main Component ────────────────────────────────────────────────────────

export const MeasurementOverlay: React.FC<MeasurementOverlayProps> = ({
  activeTool,
  imageSize,
  containerSize,
  viewportBounds,
  scaleRatioText,
  calibrationScale,
  onCalibrate,
  onMeasurementAdd,
  cursor,
  snapPoints,
  onSnapStateChange,
  externalMeasurements,
}) => {
  // Snap radius in normalized units — roughly 8-12px at normal zoom on a large sheet.
  const SNAP_RADIUS_NORM = 0.006;
  const snapTo = useCallback((pt: NormalizedPoint): { pt: NormalizedPoint; snapped: boolean } => {
    if (!snapPoints || snapPoints.length === 0) return { pt, snapped: false };
    let best: NormalizedPoint | null = null;
    let bestDist = SNAP_RADIUS_NORM;
    for (const sp of snapPoints) {
      const d = Math.hypot(pt.x - sp.x, pt.y - sp.y);
      if (d < bestDist) { bestDist = d; best = sp; }
    }
    return best ? { pt: best, snapped: true } : { pt, snapped: false };
  }, [snapPoints]);
  const [measurements, setMeasurements] = useState<MeasurementResult[]>([]);
  const [inProgressPoints, setInProgressPoints] = useState<NormalizedPoint[]>([]);
  const [countIndex, setCountIndex] = useState(1);
  const [calibratePoints, setCalibratePoints] = useState<NormalizedPoint[]>([]);

  // When the user leaves any measure tool (e.g. hits Escape → select), drop any in-progress points.
  // Without this, switching tools and coming back would resume a half-drawn measurement.
  useEffect(() => {
    if (!isMeasureTool(activeTool)) {
      setInProgressPoints([]);
      setCalibratePoints([]);
    }
  }, [activeTool]);

  const scaleParsed = useMemo(() => parseScaleRatio(scaleRatioText), [scaleRatioText]);

  const pixelsToRealInches = useCallback(
    (pixelDist: number): number | null => {
      if (calibrationScale && calibrationScale > 0) return pixelDist * calibrationScale;
      if (scaleParsed) return (pixelDist / 150) * scaleParsed.realPerPaper;
      return null;
    },
    [calibrationScale, scaleParsed],
  );

  const hasScale = !!(calibrationScale || scaleParsed);

  const toScreen = useCallback(
    (nx: number, ny: number): { x: number; y: number } | null => {
      if (!viewportBounds || containerSize.width === 0) return null;
      const vpFracX = (nx - viewportBounds.x) / viewportBounds.width;
      const vpFracY = (ny - viewportBounds.y) / viewportBounds.height;
      return { x: vpFracX * containerSize.width, y: vpFracY * containerSize.height };
    },
    [viewportBounds, containerSize],
  );

  const screenToNorm = useCallback(
    (sx: number, sy: number): NormalizedPoint | null => {
      if (!viewportBounds || containerSize.width === 0) return null;
      const vpFracX = sx / containerSize.width;
      const vpFracY = sy / containerSize.height;
      return {
        x: Math.max(0, Math.min(1, viewportBounds.x + vpFracX * viewportBounds.width)),
        y: Math.max(0, Math.min(1, viewportBounds.y + vpFracY * viewportBounds.height)),
      };
    },
    [viewportBounds, containerSize],
  );

  /** Format area and perimeter from pixel values */
  const formatArea = useCallback(
    (areaPx: number, perimPx: number): { area: string; perim: string } => {
      if (hasScale) {
        const linearScale = calibrationScale || (scaleParsed ? scaleParsed.realPerPaper / 150 : 1);
        const sqIn = areaPx * linearScale * linearScale;
        const sqFt = sqIn / 144;
        const perimIn = perimPx * linearScale;
        return {
          area: `${sqFt.toFixed(1)} ft²`,
          perim: `${formatFeetInches(perimIn)} perim`,
        };
      }
      return { area: `${Math.round(areaPx)} px²`, perim: `${Math.round(perimPx)} px perim` };
    },
    [hasScale, calibrationScale, scaleParsed],
  );

  // ── Click handler ──────────────────────────────────────────────────────
  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      // Non-measure tools leave this overlay purely visual — don't intercept their clicks.
      if (!isMeasureTool(activeTool)) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const raw = screenToNorm(e.clientX - rect.left, e.clientY - rect.top);
      if (!raw) return;
      const { pt } = snapTo(raw);

      // ── Calibrate ──
      if (activeTool === 'calibrate') {
        const newPts = [...calibratePoints, pt];
        if (newPts.length === 2) {
          const pxDist = normalizedDistance(newPts[0], newPts[1], imageSize);
          const realInStr = window.prompt(
            'Enter the known distance between the two points (e.g. "12" for 12 inches, or "10\'" for 10 feet):',
            '12',
          );
          if (realInStr) {
            let realIn = 0;
            // Parse feet: "10'" or "10ft"
            const ftMatch = realInStr.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft)/i);
            if (ftMatch) {
              realIn = parseFloat(ftMatch[1]) * 12;
            } else {
              realIn = parseFloat(realInStr);
            }
            if (realIn > 0 && pxDist > 0) {
              onCalibrate?.(realIn / pxDist);
            }
          }
          setCalibratePoints([]);
        } else {
          setCalibratePoints(newPts);
        }
        return;
      }

      // ── Count ──
      if (activeTool === 'count') {
        // Compute the next number from the authoritative render list (externalMeasurements
        // when provided) so counts continue correctly after reload or across a page revisit.
        const existingCounts = (externalMeasurements ?? measurements).filter((m) => m.type === 'count').length;
        const nextNum = existingCounts + 1;
        const result: MeasurementResult = { id: genId(), type: 'count', points: [pt], label: `${nextNum}` };
        setMeasurements((prev) => [...prev, result]);
        setCountIndex(nextNum + 1);
        onMeasurementAdd?.(result);
        return;
      }

      // ── Path (multi-segment distance) ──
      if (activeTool === 'path') {
        // Each click adds a vertex. Finalize via double-click.
        setInProgressPoints((prev) => [...prev, pt]);
        return;
      }

      // ── Linear measure ──
      if (activeTool === 'measure') {
        const newPts = [...inProgressPoints, pt];
        if (newPts.length === 2) {
          const pxDist = normalizedDistance(newPts[0], newPts[1], imageSize);
          const realIn = pixelsToRealInches(pxDist);
          const label = realIn !== null ? formatFeetInches(realIn) : `${Math.round(pxDist)} px`;
          // Single clean dimension — no metric conversion unless explicitly requested.
          const result: MeasurementResult = { id: genId(), type: 'linear', points: newPts, label };
          setMeasurements((prev) => [...prev, result]);
          setInProgressPoints([]);
          onMeasurementAdd?.(result);
        } else {
          setInProgressPoints(newPts);
        }
        return;
      }

      // ── Area ──
      if (activeTool === 'area') {
        const newPts = [...inProgressPoints, pt];
        if (newPts.length >= 3) {
          const first = newPts[0];
          const dx = Math.abs(pt.x - first.x);
          const dy = Math.abs(pt.y - first.y);
          if (dx < 0.01 && dy < 0.01 && newPts.length > 3) {
            newPts.pop();
            const areaPx = polygonArea(newPts, imageSize);
            const perimPx = polygonPerimeter(newPts, imageSize);
            const { area, perim } = formatArea(areaPx, perimPx);
            const result: MeasurementResult = { id: genId(), type: 'area', points: newPts, label: area, sublabel: perim };
            setMeasurements((prev) => [...prev, result]);
            setInProgressPoints([]);
            onMeasurementAdd?.(result);
            return;
          }
        }
        setInProgressPoints(newPts);
      }
    },
    [activeTool, inProgressPoints, calibratePoints, imageSize, countIndex, pixelsToRealInches, formatArea, screenToNorm, onCalibrate, calibrationScale, scaleParsed, onMeasurementAdd, snapTo, externalMeasurements, measurements],
  );

  // Detect snap range on cursor move so the parent can pulse the loupe.
  const handleSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isMeasureTool(activeTool) || !onSnapStateChange) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = screenToNorm(e.clientX - rect.left, e.clientY - rect.top);
    if (!raw) { onSnapStateChange(false); return; }
    const { snapped } = snapTo(raw);
    onSnapStateChange(snapped);
  }, [activeTool, onSnapStateChange, screenToNorm, snapTo]);

  const handleDoubleClick = useCallback(() => {
    if (activeTool === 'area' && inProgressPoints.length >= 3) {
      const areaPx = polygonArea(inProgressPoints, imageSize);
      const perimPx = polygonPerimeter(inProgressPoints, imageSize);
      const { area, perim } = formatArea(areaPx, perimPx);
      const result: MeasurementResult = { id: genId(), type: 'area', points: [...inProgressPoints], label: area, sublabel: perim };
      setMeasurements((prev) => [...prev, result]);
      setInProgressPoints([]);
      onMeasurementAdd?.(result);
      return;
    }
    if (activeTool === 'path' && inProgressPoints.length >= 2) {
      // Total length = sum of segment pixel distances × calibration
      let totalPx = 0;
      for (let i = 0; i < inProgressPoints.length - 1; i++) {
        totalPx += normalizedDistance(inProgressPoints[i], inProgressPoints[i + 1], imageSize);
      }
      const realIn = pixelsToRealInches(totalPx);
      const label = realIn !== null ? formatFeetInches(realIn) : `${Math.round(totalPx)} px`;
      const segCount = inProgressPoints.length - 1;
      const result: MeasurementResult = {
        id: genId(),
        type: 'path',
        points: [...inProgressPoints],
        label,
        sublabel: `${segCount} seg${segCount === 1 ? '' : 's'}`,
      };
      setMeasurements((prev) => [...prev, result]);
      setInProgressPoints([]);
      onMeasurementAdd?.(result);
    }
  }, [activeTool, inProgressPoints, imageSize, formatArea, onMeasurementAdd, pixelsToRealInches]);

  if (!viewportBounds) return null;

  // Single source of truth for what we render. If the parent provides externalMeasurements,
  // it owns the list; internal state is only used when the overlay is used standalone.
  const displayList = externalMeasurements ?? measurements;
  const countTotal = displayList.filter((m) => m.type === 'count').length;
  const interactive = isMeasureTool(activeTool);

  // ── Smart label collision avoidance ───────────────────────────────────
  // For each linear measurement, compute its label midpoint in screen space. Greedy pass:
  // if a new label would overlap an already-placed one, push it further from the dimension line.
  const linearOffsets = new Map<string, number>();
  {
    type Placed = { cx: number; cy: number; r: number };
    const placed: Placed[] = [];
    const DEFAULT_OFFSET = 16;
    const MAX_TRY = 3;
    const BUMP = 14;
    for (const m of displayList) {
      if (m.type !== 'linear' || m.points.length < 2) continue;
      const p1 = toScreen(m.points[0].x, m.points[0].y);
      const p2 = toScreen(m.points[1].x, m.points[1].y);
      if (!p1 || !p2) continue;
      const perp = perpUnit(p1, p2);
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      // Rough label radius based on character count — good-enough collision geometry.
      const r = Math.max(24, m.label.length * 4 + 12);
      let off = DEFAULT_OFFSET;
      for (let i = 0; i < MAX_TRY; i++) {
        const cx = mid.x + perp.x * off;
        const cy = mid.y + perp.y * off;
        const overlap = placed.some((pp) => Math.hypot(pp.cx - cx, pp.cy - cy) < (pp.r + r) * 0.85);
        if (!overlap) {
          placed.push({ cx, cy, r });
          break;
        }
        off += BUMP;
      }
      linearOffsets.set(m.id, off);
    }
  }

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        // When not in a measure tool, pass clicks through so pan/select still work.
        pointerEvents: interactive ? 'all' : 'none',
        cursor: interactive ? (cursor || 'crosshair') : 'default',
        zIndex: 4,
      }}
      viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
      onClick={handleClick}
      onMouseMove={handleSvgMouseMove}
      onMouseLeave={() => onSnapStateChange?.(false)}
      onDoubleClick={handleDoubleClick}
    >
      {/* ── Completed measurements ──────────────────────────────────── */}
      {displayList.map((m) => {
        const pts = m.points.map((p) => toScreen(p.x, p.y)).filter(Boolean) as { x: number; y: number }[];
        if (pts.length === 0) return null;

        // ── Linear: Architectural dimension line ──
        if (m.type === 'linear' && pts.length === 2) {
          return (
            <ArchDimensionLine
              key={m.id}
              p1={pts[0]}
              p2={pts[1]}
              label={m.label}
              sublabel={m.sublabel}
              offset={linearOffsets.get(m.id)}
            />
          );
        }

        // ── Area: Polygon with frosted card ──
        if (m.type === 'area' && pts.length >= 3) {
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
          const centroid = {
            x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
            y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
          };

          return (
            <g key={m.id}>
              {/* Polygon fill — subtle, doesn't compete with drawing */}
              <path d={d} fill={AREA_FILL} stroke={AREA_STROKE} strokeWidth={1.5} strokeDasharray="8 4" />
              {/* Vertex dots */}
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={AREA_STROKE} opacity={0.7} />
              ))}
              {/* Edge measurements — subtle, small dimension on each side */}
              {pts.map((p, i) => {
                const j = (i + 1) % pts.length;
                const next = pts[j];
                const edgeMid = { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 };
                const pxDist = normalizedDistance(m.points[i], m.points[j], imageSize);
                const realIn = pixelsToRealInches(pxDist);
                const edgeLabel = realIn !== null ? formatFeetInches(realIn) : `${Math.round(pxDist)}`;
                const angle = lineAngle(p, next);
                const angleDeg = (angle * 180) / Math.PI;
                const textAngleDeg = angleDeg > 90 || angleDeg < -90 ? angleDeg + 180 : angleDeg;
                // Offset label slightly from edge
                const perpDir = perpUnit(p, next);
                const labelPos = { x: edgeMid.x + perpDir.x * 12, y: edgeMid.y + perpDir.y * 12 };
                return (
                  <text
                    key={`edge-${i}`}
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="middle"
                    transform={`rotate(${textAngleDeg}, ${labelPos.x}, ${labelPos.y})`}
                    fill="rgba(255,255,255,0.42)"
                    fontSize={8.5}
                    fontWeight={500}
                    fontFamily="'SF Mono', 'Menlo', 'Consolas', monospace"
                    paintOrder="stroke"
                    stroke="rgba(0,0,0,0.55)"
                    strokeWidth={2}
                    strokeLinejoin="round"
                  >
                    {edgeLabel}
                  </text>
                );
              })}
              {/* Centered area card */}
              <AreaCard centroid={centroid} areaLabel={m.label} perimLabel={m.sublabel || ''} />
            </g>
          );
        }

        // ── Count: Numbered marker ──
        if (m.type === 'count') {
          return (
            <CountMarker key={m.id} pos={pts[0]} number={parseInt(m.label, 10)} />
          );
        }

        // ── Path: multi-segment polyline with total-length pill ──
        if (m.type === 'path' && pts.length >= 2) {
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          // Pill anchored near the mid-segment for readability
          const midIdx = Math.floor((pts.length - 1) / 2);
          const a = pts[midIdx];
          const b = pts[midIdx + 1] ?? a;
          const midPt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          return (
            <g key={m.id}>
              {/* Subtle shadow pass then the accent stroke */}
              <path d={d} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
              <path d={d} fill="none" stroke={DIM_COLOR} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              {/* Vertex dots */}
              {pts.map((p, i) => (
                <g key={`v-${i}`}>
                  <circle cx={p.x} cy={p.y} r={4.5} fill="#FFFFFF" />
                  <circle cx={p.x} cy={p.y} r={3} fill={DIM_COLOR} />
                </g>
              ))}
              {/* Total pill at mid-segment, reuses the AreaCard frosted style for consistency */}
              <AreaCard centroid={midPt} areaLabel={m.label} perimLabel={m.sublabel || ''} />
            </g>
          );
        }

        return null;
      })}

      {/* ── In-progress measurement ────────────────────────────────── */}
      {inProgressPoints.length > 0 && (() => {
        const pts = inProgressPoints.map((p) => toScreen(p.x, p.y)).filter(Boolean) as { x: number; y: number }[];
        if (pts.length === 0) return null;

        if (activeTool === 'area') {
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          return (
            <g>
              <path d={d} fill="none" stroke={AREA_STROKE} strokeWidth={1.5} strokeDasharray="6 4" opacity={0.6} />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={AREA_STROKE} opacity={0.6} />
              ))}
              {/* Close hint on first point */}
              {pts.length >= 3 && (
                <circle cx={pts[0].x} cy={pts[0].y} r={8} fill="none" stroke={AREA_STROKE} strokeWidth={1}
                  strokeDasharray="3 3" opacity={0.4} />
              )}
            </g>
          );
        }

        if (activeTool === 'path') {
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          return (
            <g>
              <path d={d} fill="none" stroke={DIM_COLOR} strokeWidth={2} strokeDasharray="6 4" opacity={0.7} strokeLinecap="round" strokeLinejoin="round" />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={DIM_COLOR} opacity={0.8} />
              ))}
              {pts.length >= 2 && (
                <text
                  x={pts[pts.length - 1].x + 10}
                  y={pts[pts.length - 1].y - 10}
                  fill="rgba(255,255,255,0.85)"
                  fontSize={11}
                  fontWeight={600}
                  fontFamily="'SF Mono', 'Menlo', 'Consolas', monospace"
                  paintOrder="stroke"
                  stroke="rgba(0,0,0,0.7)"
                  strokeWidth={3}
                  strokeLinejoin="round"
                >
                  double-click to finish
                </text>
              )}
            </g>
          );
        }

        if (activeTool === 'measure' && pts.length === 1) {
          return (
            <g>
              <circle cx={pts[0].x} cy={pts[0].y} r={4} fill={DIM_COLOR} opacity={0.7} />
              {/* Pulse ring */}
              <circle cx={pts[0].x} cy={pts[0].y} r={8} fill="none" stroke={DIM_COLOR} strokeWidth={1} opacity={0.3}>
                <animate attributeName="r" values="6;14;6" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0.05;0.4" dur="1.5s" repeatCount="indefinite" />
              </circle>
            </g>
          );
        }

        return null;
      })()}

      {/* ── Calibration in-progress ────────────────────────────────── */}
      {calibratePoints.length === 1 && (() => {
        const p = toScreen(calibratePoints[0].x, calibratePoints[0].y);
        if (!p) return null;
        return <CalibrationGuide point={p} />;
      })()}

      {/* ── Scale badge — bottom-left ──────────────────────────────── */}
      {hasScale && (
        <ScaleBadge
          label={scaleRatioText || 'Calibrated'}
          x={8}
          y={containerSize.height - 8}
        />
      )}

      {/* ── Count total pill — bottom-right ────────────────────────── */}
      {activeTool === 'count' && countTotal > 0 && (
        <CountSummaryPill
          count={countTotal}
          x={containerSize.width - 12}
          y={containerSize.height - 8}
        />
      )}
    </svg>
  );
};

export default MeasurementOverlay;
