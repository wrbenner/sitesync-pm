import React from 'react';
import { Skeleton } from '../Primitives';
import { spacing, borderRadius, colors } from '../../styles/theme';

/**
 * Loading skeleton for the Field Capture page.
 * Mirrors the layout: 4 metric card skeletons, Quick Capture Bar, then 8 capture row skeletons.
 */
const FieldCaptureSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
    {/* Metric card row — 4 columns matching Photos Today, Voice Notes, Items Created, Pending Sync */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['3'] }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} height="88px" borderRadius={borderRadius.xl} />
      ))}
    </div>

    {/* Quick Capture Bar skeleton — the 5-button action strip */}
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: spacing['3'],
        padding: spacing['4'],
        borderRadius: borderRadius.lg,
        border: `1px solid ${colors.borderSubtle}`,
      }}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} height="80px" borderRadius={borderRadius.md} />
      ))}
    </div>

    {/* Capture row skeletons */}
    <div
      style={{
        borderRadius: borderRadius.lg,
        border: `1px solid ${colors.borderSubtle}`,
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['3'],
            height: 48,
            padding: `0 ${spacing['4']}`,
            borderBottom: i < 7 ? `1px solid ${colors.borderSubtle}` : 'none',
          }}
        >
          {/* Type icon circle */}
          <Skeleton width="32px" height="32px" borderRadius="50%" />
          {/* Title + meta */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width="200px" height="13px" />
            <Skeleton width="120px" height="11px" />
          </div>
          {/* Location */}
          <Skeleton width="72px" height="13px" />
          {/* Chevron */}
          <Skeleton width="14px" height="14px" />
        </div>
      ))}
    </div>
  </div>
);

export default FieldCaptureSkeleton;
