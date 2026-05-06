import React from 'react';
import { colors, typography } from '../../styles/theme';

interface StatusToken {
  fg: string;
  bg: string;
  label: string;
}

const TOKENS: Record<string, StatusToken> = {
  on_track: { fg: '#1F6F4F', bg: '#E5F2EC', label: 'On track' },
  at_risk: { fg: '#7A5C12', bg: '#FCF2DE', label: 'At risk' },
  behind: { fg: '#9A2929', bg: '#FCE7E7', label: 'Behind' },
  not_started: { fg: '#5C5550', bg: '#F1ECE2', label: 'Not started' },
  active: { fg: '#1F6F4F', bg: '#E5F2EC', label: 'Active' },
  in_progress: { fg: '#1F6F4F', bg: '#E5F2EC', label: 'In progress' },
  completed: { fg: '#3F4754', bg: '#EEF0F4', label: 'Complete' },
  delayed: { fg: '#9A2929', bg: '#FCE7E7', label: 'Delayed' },
  upcoming: { fg: '#5C5550', bg: '#F1ECE2', label: 'Upcoming' },
};

interface ScheduleStatusChipProps {
  status: string | null | undefined;
  label?: string;
  size?: 'sm' | 'md';
}

export const ScheduleStatusChip: React.FC<ScheduleStatusChipProps> = ({
  status,
  label,
  size = 'sm',
}) => {
  const key = (status ?? 'not_started').toLowerCase();
  const token = TOKENS[key] ?? TOKENS.not_started;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        borderRadius: 999,
        backgroundColor: token.bg,
        color: token.fg,
        fontFamily: typography.fontFamily,
        fontSize: size === 'sm' ? 11 : 12,
        fontWeight: 500,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: token.fg,
        }}
      />
      {label ?? token.label}
    </span>
  );
};

interface BehindDotProps {
  daysBehind: number;
}

export const BehindDot: React.FC<BehindDotProps> = ({ daysBehind }) => (
  <span
    role="img"
    aria-label={`${daysBehind} ${daysBehind === 1 ? 'day' : 'days'} behind`}
    title={`${daysBehind} ${daysBehind === 1 ? 'day' : 'days'} behind`}
    style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      backgroundColor: colors.statusCritical,
      flexShrink: 0,
    }}
  />
);
