import React from 'react';
import { Skeleton } from '../Primitives';
import { spacing, borderRadius, colors } from '../../styles/theme';

interface PunchItemSkeletonProps {
  /** Number of skeleton rows to render. Defaults to 6. */
  count?: number;
  /** Render mobile card skeletons instead of table row skeletons */
  mobile?: boolean;
}

/**
 * Loading skeleton for punch item lists.
 * Renders metric card skeletons and then either table rows (desktop)
 * or card stacks (mobile).
 */
const PunchItemSkeleton: React.FC<PunchItemSkeletonProps> = ({ count = 6, mobile = false }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
    {/* Metric card row */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['3'] }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} height="104px" borderRadius={borderRadius.lg} />
      ))}
    </div>

    {mobile ? (
      /* Mobile card skeletons */
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: spacing['3'],
              padding: spacing['4'],
              minHeight: 80,
              borderRadius: borderRadius.lg,
              border: `1px solid ${colors.borderSubtle}`,
            }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
              <div style={{ display: 'flex', gap: spacing['2'], alignItems: 'center' }}>
                <Skeleton width="32px" height="14px" />
                <Skeleton width="180px" height="14px" />
              </div>
              <Skeleton width="120px" height="12px" />
              <div style={{ display: 'flex', gap: spacing['2'] }}>
                <Skeleton width="56px" height="20px" borderRadius="9999px" />
                <Skeleton width="72px" height="20px" borderRadius="9999px" />
              </div>
            </div>
            <Skeleton width="56px" height="56px" borderRadius={borderRadius.md} />
          </div>
        ))}
      </div>
    ) : (
      /* Desktop table row skeletons */
      <div
        style={{
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.borderSubtle}`,
          overflow: 'hidden',
        }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['4'],
              height: 52,
              padding: `0 ${spacing['4']}`,
              borderBottom: i < count - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
            }}
          >
            <Skeleton width="16px" height="16px" borderRadius="3px" />
            <Skeleton width="48px" height="13px" />
            <Skeleton width="220px" height="13px" />
            <Skeleton width="100px" height="13px" />
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
              <Skeleton width="60px" height="13px" />
              <Skeleton width="56px" height="20px" borderRadius="9999px" />
              <Skeleton width="72px" height="20px" borderRadius="9999px" />
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default PunchItemSkeleton;
