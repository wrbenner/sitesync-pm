import React from 'react';
import { Skeleton } from '../Primitives';
import { spacing, borderRadius, colors } from '../../styles/theme';

/**
 * Loading skeleton for the Punch List page.
 * Mirrors the layout: 3 metric card skeletons followed by 8 table row skeletons.
 */
const PunchListSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
    {/* Metric card row */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['3'] }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} height="120px" borderRadius={borderRadius.lg} />
      ))}
    </div>

    {/* Table row skeletons */}
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
          {/* Checkbox column */}
          <Skeleton width="16px" height="16px" borderRadius="3px" />
          {/* Item number */}
          <Skeleton width="56px" height="14px" />
          {/* Description */}
          <Skeleton width="240px" height="14px" />
          {/* Assigned */}
          <Skeleton width="100px" height="14px" />
          {/* Due date */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: spacing['3'] }}>
            <Skeleton width="64px" height="14px" />
            {/* Priority */}
            <Skeleton width="56px" height="20px" borderRadius="9999px" />
            {/* Status */}
            <Skeleton width="80px" height="14px" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default PunchListSkeleton;
