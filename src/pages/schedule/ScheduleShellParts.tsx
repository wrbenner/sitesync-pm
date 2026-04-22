import React from 'react';
import { Upload, Plus, Download } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { exportToXlsx } from '../../lib/exportXlsx';
import { toast } from 'sonner';
import { PresenceAvatars } from '../../components/shared/PresenceAvatars';

export const ScheduleLiveIndicator: React.FC<{ liveActive: boolean }> = ({ liveActive }) => {
  if (!liveActive) return null;
  return (
    <div
      aria-label="Live updates active" role="status" title="Live updates active"
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: typography.fontSize.caption, color: colors.textSecondary, fontWeight: typography.fontWeight.medium,
      }}
    >
      <span style={{
        display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%',
        backgroundColor: '#16A34A',
        animation: 'livePulse 1.8s ease-in-out infinite', flexShrink: 0,
      }} />
      Live
    </div>
  );
};

interface SchedulePhaseExport {
  name: string;
  status: string;
  start_date: string;
  end_date: string;
  percent_complete: number;
  is_critical_path: boolean;
}

interface ActionsProps {
  onImport: () => void;
  onAddPhase?: () => void;
  liveActive: boolean;
  projectName?: string;
  phases?: SchedulePhaseExport[];
}

function handleExportSchedule(projectName: string, phases: SchedulePhaseExport[]) {
  if (!phases.length) {
    toast.info('Nothing to export — schedule is empty.');
    return;
  }
  exportToXlsx({
    filename: `${projectName}_Schedule`,
    sheets: [
      {
        name: 'Schedule',
        headers: ['Phase', 'Status', 'Start', 'End', '% Complete', 'Critical Path'],
        rows: phases.map((p) => [
          p.name, p.status, p.start_date, p.end_date,
          Number(p.percent_complete ?? 0), p.is_critical_path ? 'Yes' : 'No',
        ]),
        columnWidths: [32, 14, 12, 12, 12, 14],
      },
    ],
  });
  toast.success('Schedule exported');
}

// ── Shared button style ──────────────────────────────────
const btnBase: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: spacing['2'],
  padding: `0 ${spacing['4']}`, height: '36px',
  borderRadius: borderRadius.lg,
  fontSize: typography.fontSize.sm,
  fontWeight: typography.fontWeight.medium,
  fontFamily: 'inherit', cursor: 'pointer',
  transition: transitions.quick,
};

export const ScheduleHeaderActions: React.FC<ActionsProps> = ({ onImport, onAddPhase, liveActive, projectName, phases }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
    <PresenceAvatars page="schedule" size={28} />

    {onAddPhase && (
      <PermissionGate
        permission="schedule.edit"
        fallback={
          <button disabled aria-label="Add phase requires permissions"
            title="Your role doesn't allow editing the schedule."
            style={{
              ...btnBase, border: 'none',
              backgroundColor: colors.primaryOrange, color: colors.white,
              cursor: 'not-allowed', opacity: 0.4,
            }}
          >
            <Plus size={15} /> Add Phase
          </button>
        }
      >
        <button aria-label="Add schedule phase" onClick={onAddPhase}
          style={{
            ...btnBase, border: 'none',
            backgroundColor: colors.primaryOrange, color: colors.white,
            boxShadow: '0 1px 2px rgba(244,120,32,0.2)',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <Plus size={15} /> Add Phase
        </button>
      </PermissionGate>
    )}

    <PermissionGate permission="schedule.edit">
      <button aria-label="Import schedule" onClick={onImport}
        style={{
          ...btnBase,
          border: `1px solid ${colors.borderDefault}`,
          backgroundColor: colors.white, color: colors.textPrimary,
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.surfaceHover)}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = colors.white)}
      >
        <Upload size={14} /> Import
      </button>
    </PermissionGate>

    <button
      aria-label="Export schedule as XLSX"
      onClick={() => handleExportSchedule(projectName ?? 'Project', phases ?? [])}
      data-testid="export-schedule-button"
      style={{
        ...btnBase,
        border: `1px solid ${colors.borderDefault}`,
        backgroundColor: colors.white, color: colors.textPrimary,
      }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.surfaceHover)}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = colors.white)}
    >
      <Download size={14} /> Export
    </button>

    <ScheduleLiveIndicator liveActive={liveActive} />
  </div>
);

export const ScheduleSkipLink: React.FC = () => (
  <a
    href="#gantt-activities"
    style={{
      position: 'absolute', left: -9999, top: 'auto', width: 1, height: 1,
      overflow: 'hidden', zIndex: 1000,
      backgroundColor: colors.primaryOrange, color: colors.white,
      padding: '8px 16px', borderRadius: borderRadius.lg,
      textDecoration: 'none', fontSize: typography.fontSize.sm,
      fontFamily: 'inherit', fontWeight: typography.fontWeight.medium,
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
    <div role="alert" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing['3'],
      padding: `${spacing['3']} ${spacing['4']}`,
      backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2',
      borderRadius: borderRadius.lg, marginBottom: spacing['4'],
    }}>
      <span style={{ fontSize: typography.fontSize.sm, color: '#991B1B', fontWeight: typography.fontWeight.medium }}>
        Unable to load schedule
      </span>
      <button onClick={refetch} style={{
        display: 'flex', alignItems: 'center', gap: spacing['1'],
        padding: `${spacing['1.5']} ${spacing['4']}`,
        backgroundColor: '#DC2626', color: colors.white,
        border: 'none', borderRadius: borderRadius.lg,
        fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
        cursor: 'pointer', flexShrink: 0, fontFamily: typography.fontFamily,
      }}>
        Retry
      </button>
    </div>
  );
};
