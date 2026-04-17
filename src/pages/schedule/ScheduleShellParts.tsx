import React from 'react';
import { Calendar, Upload } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import { PermissionGate } from '../../components/auth/PermissionGate';

export const ScheduleLiveIndicator: React.FC<{ liveActive: boolean }> = ({ liveActive }) => {
  if (!liveActive) return null;
  return (
    <div
      aria-label="Live updates active"
      role="status"
      title="Live updates active"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: colors.textSecondary,
        fontWeight: 500,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: colors.statusActive,
          animation: 'livePulse 1.8s ease-in-out infinite',
          flexShrink: 0,
        }}
      />
      Live
    </div>
  );
};

interface ActionsProps {
  onImport: () => void;
  liveActive: boolean;
}

export const ScheduleHeaderActions: React.FC<ActionsProps> = ({ onImport, liveActive }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
    <PermissionGate permission="schedule.edit">
      <button
        aria-label="Import schedule from Primavera P6 or Microsoft Project"
        onClick={onImport}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          padding: `0 ${spacing.lg}`,
          height: '40px',
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: borderRadius.md,
          backgroundColor: colors.white,
          cursor: 'pointer',
          fontSize: typography.fontSize.body,
          fontWeight: typography.fontWeight.medium,
          color: colors.textPrimary,
          fontFamily: 'inherit',
          transition: transitions.quick,
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.surfaceHover)}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = colors.white)}
      >
        <Calendar size={15} />
        <Upload size={15} />
        Import Schedule
      </button>
    </PermissionGate>
    <ScheduleLiveIndicator liveActive={liveActive} />
  </div>
);

export const ScheduleSkipLink: React.FC = () => (
  <a
    href="#gantt-activities"
    style={{
      position: 'absolute',
      left: -9999,
      top: 'auto',
      width: 1,
      height: 1,
      overflow: 'hidden',
      zIndex: 1000,
      backgroundColor: colors.darkNavy,
      color: colors.white,
      padding: '8px 16px',
      borderRadius: '4px',
      textDecoration: 'none',
      fontSize: '14px',
      fontFamily: 'inherit',
      fontWeight: 500,
    }}
    onFocus={e => Object.assign(e.currentTarget.style, { left: '16px', top: '16px', width: 'auto', height: 'auto', overflow: 'visible' })}
    onBlur={e => Object.assign(e.currentTarget.style, { left: '-9999px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' })}
  >
    Skip to schedule chart
  </a>
);

interface ErrorBannerProps {
  error: string | null;
  refetch: () => void;
}

export const ScheduleErrorBanner: React.FC<ErrorBannerProps> = ({ error, refetch }) => {
  if (!error) return null;
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
        padding: `${spacing.md} ${spacing.lg}`,
        backgroundColor: colors.statusCriticalSubtle,
        border: `1px solid ${colors.statusCritical}`,
        borderRadius: borderRadius.md,
        marginBottom: spacing.lg,
      }}
    >
      <span style={{ fontSize: typography.fontSize.body, color: colors.statusCritical }}>
        Unable to load schedule
      </span>
      <button
        onClick={refetch}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          padding: `${spacing['1']} ${spacing.md}`,
          backgroundColor: colors.statusCritical,
          color: colors.white,
          border: 'none',
          borderRadius: borderRadius.base,
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          cursor: 'pointer',
          flexShrink: 0,
          fontFamily: typography.fontFamily,
        }}
      >
        Retry
      </button>
    </div>
  );
};
