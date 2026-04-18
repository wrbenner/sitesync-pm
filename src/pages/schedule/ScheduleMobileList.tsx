import React from 'react';
import { Upload } from 'lucide-react';
import { useToast, Tag } from '../../components/Primitives';
import { colors, typography } from '../../styles/theme';
import { PermissionGate } from '../../components/auth/PermissionGate';
import type { SchedulePhase } from '../../stores/scheduleStore';

type MobileFilter = 'all' | 'in_progress' | 'delayed' | 'critical_path';

interface ScheduleMobileListProps {
  schedulePhases: SchedulePhase[];
  mobileFilter: MobileFilter;
  setMobileFilter: (f: MobileFilter) => void;
  setShowImportModal: (v: boolean) => void;
  setScheduleAnnouncement: (s: string) => void;
}

export const ScheduleMobileList: React.FC<ScheduleMobileListProps> = ({
  schedulePhases,
  mobileFilter,
  setMobileFilter,
  setShowImportModal,
  setScheduleAnnouncement,
}) => {
  const { addToast } = useToast();

  return (
    <div>
      {/* Sticky mobile header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: colors.surfacePage,
        padding: '12px 0 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
      }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: colors.textPrimary }}>Schedule</span>
        <PermissionGate permission="schedule.edit">
        <button
          onClick={() => setShowImportModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 56,
            minWidth: 44,
            padding: '0 16px',
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: 8,
            backgroundColor: colors.white,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
            color: colors.textPrimary,
            fontFamily: 'inherit',
          }}
        >
          <Upload size={14} />
          Import
        </button>
        </PermissionGate>
      </div>
      {/* Filter tabs — horizontally scrollable */}
      <div role="tablist" aria-label="Filter activities by status" style={{ overflowX: 'auto', whiteSpace: 'nowrap', marginBottom: 12, WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        {(['all', 'in_progress', 'delayed', 'critical_path'] as const).map((f) => {
          const labels: Record<string, string> = { all: 'All', in_progress: 'In Progress', delayed: 'Delayed', critical_path: 'Critical Path' };
          const active = mobileFilter === f;
          return (
            <button
              key={f}
              role="tab"
              aria-selected={active}
              onClick={() => setMobileFilter(f)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 56,
                padding: '0 16px',
                marginRight: 8,
                border: active ? 'none' : `1px solid ${colors.borderDefault}`,
                borderRadius: 22,
                backgroundColor: active ? colors.primaryOrange : colors.white,
                color: active ? colors.white : colors.textSecondary,
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                fontFamily: typography.fontFamily,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {labels[f]}
            </button>
          );
        })}
      </div>
      <div data-schedule-list style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {schedulePhases
          .filter((p) => {
            if (mobileFilter === 'all') return true;
            if (mobileFilter === 'critical_path') return p.is_critical_path === true;
            return p.status === mobileFilter;
          })
          .map((phase) => {
          const statusColor =
            phase.status === 'completed' ? colors.statusActive
            : phase.status === 'in_progress' ? colors.statusInfo
            : phase.status === 'delayed' ? colors.statusCritical
            : colors.statusPending;
          const statusLabel = (phase.status ?? 'not started').replace(/_/g, ' ');
          const floatDays = phase.float_days ?? (phase as unknown as Record<string, unknown>).floatDays ?? 0;
          return (
            <div
              key={phase.id}
              role="row"
              tabIndex={0}
              aria-label={`${phase.name}, ${phase.progress}% complete, ${statusLabel}`}
              onClick={() => addToast('info', phase.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  addToast('info', phase.name);
                  setScheduleAnnouncement(`Selected: ${phase.name}, ${statusLabel}`);
                } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  const list = e.currentTarget.closest('[data-schedule-list]');
                  const rows = Array.from(list?.querySelectorAll<HTMLElement>('[role="row"]') ?? []);
                  const idx = rows.indexOf(e.currentTarget);
                  const next = e.key === 'ArrowDown' ? rows[idx + 1] : rows[idx - 1];
                  next?.focus();
                }
              }}
              style={{
                backgroundColor: colors.white,
                borderRadius: 8,
                border: `1px solid ${colors.borderLight}`,
                borderLeft: phase.is_critical_path === true ? `3px solid ${colors.statusCritical}` : `1px solid ${colors.borderLight}`,
                padding: 16,
                minHeight: 64,
                cursor: 'pointer',
                outline: 'none',
                marginBottom: 8,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 14, color: colors.textPrimary, display: 'block', marginBottom: 6 }}>
                {phase.is_milestone ? '◆ ' : ''}{phase.name}
              </span>
              <span style={{ fontSize: 14, color: colors.textSecondary, display: 'block', marginBottom: 8 }}>
                {new Date(phase.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
                {' \u2014 '}
                {new Date(phase.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
              </span>
              {!phase.is_milestone && (
                <div style={{ height: 6, backgroundColor: colors.borderLight, borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: `${phase.progress ?? 0}%`, backgroundColor: statusColor, borderRadius: 3 }} />
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span aria-label={`Status: ${statusLabel}`} role="img">
                  <Tag label={statusLabel} color={statusColor} backgroundColor={statusColor + '22'} />
                </span>
                <span style={{ fontSize: 12, color: colors.textTertiary }}>
                  {floatDays}d float
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ margin: '16px 0 0', fontSize: 12, color: colors.textTertiary, textAlign: 'center' }}>
        Switch to desktop for Gantt chart view.
      </p>
    </div>
  );
};
