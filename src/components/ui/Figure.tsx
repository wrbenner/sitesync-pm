/**
 * Figure — typographic numeral with tabular alignment.
 *
 * Use everywhere we display a dollar amount, count, percent, or
 * duration. Numerals render in JetBrains Mono with tabular-nums so
 * columns align; nulls render as an em-dash; delta values get tone-
 * coloring (rust for negative, moss for positive, ink for neutral).
 *
 * Pairs naturally with the editorial KPI tile shape on /day:
 *   <div>
 *     <Eyebrow>RFIs OPEN</Eyebrow>
 *     <Figure value={12} size="display" />
 *     <Figure value={3} delta size="sm" prefix="+" suffix=" this week" />
 *   </div>
 */

import React from 'react';
import { colors, typography } from '../../styles/theme';

export type FigureSize = 'sm' | 'md' | 'lg' | 'display';
export type FigureKind = 'number' | 'currency' | 'percent' | 'duration';

export interface FigureProps {
  /** The value. null / undefined renders an em-dash. */
  value: number | null | undefined;
  /** What kind of number — drives default formatting. */
  kind?: FigureKind;
  /** Currency code (only used when kind === 'currency'). Defaults to USD. */
  currency?: string;
  /** Decimal places for number / currency / percent. Default: 0. */
  precision?: number;
  /**
   * Render as a delta indicator. Positive → moss, negative → rust,
   * zero → ink3. Automatically prepends + sign on positives.
   */
  delta?: boolean;
  /** Typographic scale. */
  size?: FigureSize;
  /** Use the serif typeface instead of mono. Useful for big hero numerals. */
  serif?: boolean;
  /** Optional content rendered before the value (e.g., "$"). */
  prefix?: React.ReactNode;
  /** Optional content rendered after the value (e.g., " hr"). */
  suffix?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const SIZE_MAP: Record<FigureSize, { fontSize: string; lineHeight: number }> = {
  sm: { fontSize: '12px', lineHeight: 1.4 },
  md: { fontSize: '16px', lineHeight: 1.3 },
  lg: { fontSize: '24px', lineHeight: 1.2 },
  display: { fontSize: '40px', lineHeight: 1.05 },
};

function formatValue(
  value: number,
  kind: FigureKind,
  precision: number,
  currency: string,
): string {
  if (kind === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(value);
  }
  if (kind === 'percent') {
    return `${value.toLocaleString('en-US', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    })}%`;
  }
  if (kind === 'duration') {
    // Hours; show "Hh Mm" when fractional, "Hh" otherwise.
    const hours = Math.floor(Math.abs(value));
    const minutes = Math.round((Math.abs(value) - hours) * 60);
    const sign = value < 0 ? '-' : '';
    return minutes > 0 ? `${sign}${hours}h ${minutes}m` : `${sign}${hours}h`;
  }
  return value.toLocaleString('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

export const Figure: React.FC<FigureProps> = ({
  value,
  kind = 'number',
  currency = 'USD',
  precision = 0,
  delta = false,
  size = 'md',
  serif = false,
  prefix,
  suffix,
  className,
  style,
}) => {
  const s = SIZE_MAP[size];

  if (value === null || value === undefined || Number.isNaN(value)) {
    return (
      <span
        className={className}
        aria-label="no value"
        style={{
          fontFamily: serif ? typography.fontFamilySerif : typography.fontFamilyMono,
          fontSize: s.fontSize,
          lineHeight: s.lineHeight,
          color: colors.ink4,
          fontVariantNumeric: 'tabular-nums',
          ...style,
        }}
      >
        —
      </span>
    );
  }

  let color: string = colors.ink;
  let deltaPrefix = '';
  if (delta) {
    if (value > 0) {
      color = colors.moss;
      deltaPrefix = '+';
    } else if (value < 0) {
      color = colors.rust;
      // negative sign comes from formatValue
    } else {
      color = colors.ink3;
    }
  }

  const formatted = formatValue(value, kind, precision, currency);

  return (
    <span
      className={className}
      style={{
        fontFamily: serif ? typography.fontFamilySerif : typography.fontFamilyMono,
        fontSize: s.fontSize,
        lineHeight: s.lineHeight,
        fontWeight: serif ? 400 : 500,
        color,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: serif ? '-0.012em' : '-0.005em',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {prefix}
      {deltaPrefix}
      {formatted}
      {suffix}
    </span>
  );
};

export default Figure;
