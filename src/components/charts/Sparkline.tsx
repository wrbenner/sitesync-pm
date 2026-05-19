/**
 * Sparkline — minimal inline-sized chart for KPI tiles and trend rows.
 *
 * No axes, no grid, no labels — just the stroke. The most recent value
 * gets a small filled dot so the eye knows where "now" sits on the line.
 * Single-color by default (rust); the caller can swap to brand orange,
 * moss, or ink for tone-coded variants.
 *
 * Performance: pure SVG, no library, no transitions, no requestAnimationFrame.
 * Safe to render hundreds of these in a list view.
 */

import React, { useMemo } from 'react';
import { colors } from '../../styles/theme';

export interface SparklineProps {
  /** Series values, oldest → newest. Nulls are interpolated through. */
  data: Array<number | null>;
  width?: number;
  height?: number;
  /** Stroke + fill tone. */
  tone?: 'rust' | 'brand' | 'moss' | 'ink' | 'subtle';
  /** Stroke width in px. */
  strokeWidth?: number;
  /** Show a subtle area fill beneath the line. */
  area?: boolean;
  /** Highlight the most recent value with a filled dot. */
  showCurrent?: boolean;
  /** Force a baseline (e.g., 0) regardless of min(data). */
  baseline?: number;
  /** Accessibility label — required for non-decorative use. */
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

const TONE_MAP: Record<NonNullable<SparklineProps['tone']>, string> = {
  rust: colors.rust,
  brand: colors.primaryOrange,
  moss: colors.moss,
  ink: colors.ink2,
  subtle: colors.ink3,
};

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 96,
  height = 24,
  tone = 'rust',
  strokeWidth = 1.5,
  area = false,
  showCurrent = true,
  baseline,
  ariaLabel,
  className,
  style,
}) => {
  const stroke = TONE_MAP[tone];

  const { linePath, areaPath, lastPoint } = useMemo(() => {
    // Interpolate null gaps to keep the line continuous.
    const filled: number[] = [];
    let lastSeen: number | null = null;
    for (const v of data) {
      if (v === null || v === undefined || Number.isNaN(v)) {
        filled.push(lastSeen ?? 0);
      } else {
        filled.push(v);
        lastSeen = v;
      }
    }

    if (filled.length === 0) {
      return { linePath: '', areaPath: '', lastPoint: null as { x: number; y: number } | null };
    }

    const lo = baseline !== undefined ? Math.min(baseline, ...filled) : Math.min(...filled);
    const hi = Math.max(...filled);
    const range = hi - lo || 1;
    const pad = strokeWidth + 1;
    const innerH = height - pad * 2;
    const step = filled.length > 1 ? (width - pad * 2) / (filled.length - 1) : 0;

    const points = filled.map((v, i) => {
      const x = pad + i * step;
      const y = pad + innerH - ((v - lo) / range) * innerH;
      return { x, y };
    });

    const line = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(' ');
    const areaP = `${line} L${points[points.length - 1].x.toFixed(2)},${(height - pad).toFixed(2)} L${points[0].x.toFixed(2)},${(height - pad).toFixed(2)} Z`;

    return {
      linePath: line,
      areaPath: areaP,
      lastPoint: points[points.length - 1] ?? null,
    };
  }, [data, width, height, strokeWidth, baseline]);

  if (!linePath) {
    return null;
  }

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      {area && (
        <path d={areaPath} fill={stroke} opacity={0.10} />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showCurrent && lastPoint && (
        <circle cx={lastPoint.x} cy={lastPoint.y} r={strokeWidth + 1.5} fill={stroke} />
      )}
    </svg>
  );
};

export default Sparkline;
