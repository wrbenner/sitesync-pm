import React from 'react';
import { Skeleton } from '../Primitives';
import { spacing, borderRadius, colors } from '../../styles/theme';

/**
 * Loading skeleton for the Daily Log page.
 * Mirrors the layout: 4 metric card skeletons then log list rows with
 * date, status badge, summary text, and crew count placeholders.
 */
const DailyLogSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
    {/* 4 metric cards: Workers, Hours, Incidents, Weather */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['3'] }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          style={{
            backgroundColor: colors.white,
            borderRadius: borderRadius.xl,
            padding: spacing['5'],
            display: 'flex',
            flexDirection: 'column',
            gap: spacing['2'],
            border: `1px solid ${colors.borderSubtle}`,
          }}
        >
          {/* Icon + label row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <Skeleton width="16px" height="16px" borderRadius="4px" />
            <Skeleton width="64px" height="12px" />
          </div>
          {/* Value */}
          <Skeleton width="48px" height="28px" />
        </div>
      ))}
    </div>

    {/* Today's log card: title skeleton + 4 mini metric skeletons */}
    <div
      style={{
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        padding: spacing['5'],
        border: `1px solid ${colors.borderSubtle}`,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing['4'],
      }}
    >
      <Skeleton width="200px" height="20px" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['3'] }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height="72px" borderRadius={borderRadius.lg} />
        ))}
      </div>
    </div>

    {/* Previous Days log list rows */}
    <div
      style={{
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        border: `1px solid ${colors.borderSubtle}`,
        overflow: 'hidden',
      }}
    >
      {/* Section header */}
      <div style={{ padding: `${spacing['4']} ${spacing['5']}`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
        <Skeleton width="120px" height="16px" />
      </div>

      {/* Log rows: date | status badge | summary | crew count + hours */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['4'],
            padding: `${spacing['4']} ${spacing['5']}`,
            height: 48,
            borderBottom: i < 5 ? `1px solid ${colors.borderSubtle}` : 'none',
          }}
        >
          {/* Date: "Mon, Apr 1" */}
          <Skeleton width="100px" height="14px" />
          {/* Status badge pill */}
          <Skeleton width="64px" height="20px" borderRadius="9999px" />
          {/* Summary text — flexible */}
          <Skeleton height="13px" />
          {/* Crew count + hours on right */}
          <div style={{ display: 'flex', gap: spacing['4'], flexShrink: 0 }}>
            <Skeleton width="60px" height="12px" />
            <Skeleton width="48px" height="12px" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default DailyLogSkeleton;
