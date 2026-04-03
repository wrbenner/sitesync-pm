import { useEffect } from 'react';
import { colors } from '../styles/theme';

function injectPulseAnimation() {
  if (document.getElementById('skeleton-pulse-style')) return;
  const style = document.createElement('style');
  style.id = 'skeleton-pulse-style';
  style.textContent = '@keyframes skeletonPulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.7; } }';
  document.head.appendChild(style);
}

interface SkeletonBoxProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
  flex?: number | string;
}

export function SkeletonBox({ width, height, borderRadius = '4px', flex }: SkeletonBoxProps) {
  useEffect(() => {
    injectPulseAnimation();
  }, []);

  return (
    <div
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
        background: colors.border,
        animation: 'skeletonPulse 1.5s ease-in-out infinite',
        flexShrink: 0,
        ...(flex !== undefined ? { flex } : {}),
      }}
    />
  );
}

export function SkeletonMetricCard() {
  return (
    <div
      style={{
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid ' + colors.border,
        background: colors.cardBackground,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <SkeletonBox width={24} height={24} borderRadius="6px" />
      <SkeletonBox width={80} height={12} />
      <SkeletonBox width={120} height={28} />
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <div
      style={{
        display: 'flex',
        gap: '16px',
        height: '48px',
        alignItems: 'center',
        padding: '0 16px',
      }}
    >
      <SkeletonBox width={40} height={14} />
      <SkeletonBox flex={2} height={14} />
      <SkeletonBox flex={1} height={14} />
      <SkeletonBox width={80} height={14} />
    </div>
  );
}

interface SkeletonTableProps {
  rowCount?: number;
}

export function SkeletonTable({ rowCount = 8 }: SkeletonTableProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          gap: '16px',
          height: '40px',
          alignItems: 'center',
          padding: '0 16px',
          borderBottom: '1px solid ' + colors.border,
        }}
      >
        <SkeletonBox width={40} height={12} />
        <SkeletonBox flex={2} height={12} />
        <SkeletonBox flex={1} height={12} />
        <SkeletonBox width={80} height={12} />
      </div>
      {Array.from({ length: rowCount }, (_, i) => (
        <SkeletonTableRow key={i} />
      ))}
    </div>
  );
}
