import React from 'react';
import { colors, typography } from '../styles/theme';

interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  color?: string;
}

function getColor(value: number): string {
  if (value >= 80) return colors.statusActive;
  if (value >= 60) return colors.statusInfo;
  if (value >= 40) return colors.statusPending;
  return colors.statusCritical;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  size = 64,
  strokeWidth = 5,
  showLabel = true,
  color,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const ringColor = color ?? getColor(value);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.surfaceInset}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
        />
      </svg>
      {showLabel && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size < 48 ? typography.fontSize.caption : typography.fontSize.sm,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
          }}
        >
          {value}
        </div>
      )}
    </div>
  );
};
