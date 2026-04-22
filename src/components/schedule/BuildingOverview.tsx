import React, { useMemo } from 'react';
import { Building2, CheckCircle2, AlertTriangle, Clock, Circle } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import type { SchedulePhase } from '../../stores/scheduleStore';

// ── Building grouping ────────────────────────────────────────
// Extracts the "building" segment from a wbs string. The import produces
// values like "Building A / Section 1" or "Clubhouse" or null. We group by
// the first "/" segment and fall back to a synthetic "Sitework / General"
// bucket for anything without wbs so no row is orphaned.

export const UNGROUPED_LABEL = 'Sitework / General';

export function buildingOf(phase: unknown): string {
  // Read wbs via index access — the Supabase generated types don't yet
  // include the wbs column that migration 20260422000002 added. At runtime
  // the field is present on every MappedSchedulePhase.
  const wbs = (phase as { wbs?: string | null })?.wbs;
  const raw = typeof wbs === 'string' ? wbs.trim() : '';
  if (!raw) return UNGROUPED_LABEL;
  return raw.split('/')[0].trim() || UNGROUPED_LABEL;
}

interface BuildingStats {
  key: string;
  label: string;
  total: number;
  completed: number;
  inProgress: number;
  behind: number;
  upcoming: number;
  progress: number;  // 0-100
  status: 'done' | 'on_track' | 'behind' | 'upcoming';
}

function computeBuildingStats(phases: SchedulePhase[]): BuildingStats[] {
  const byKey = new Map<string, SchedulePhase[]>();
  for (const p of phases) {
    const k = buildingOf(p);
    const list = byKey.get(k) ?? [];
    list.push(p);
    byKey.set(k, list);
  }

  const statsFor = (key: string, list: SchedulePhase[]): BuildingStats => {
    const total = list.length;
    const completed = list.filter((p) => p.status === 'completed').length;
    const inProgress = list.filter((p) => p.status === 'active' || p.status === 'on_track').length;
    const behind = list.filter((p) => p.status === 'delayed' || p.status === 'at_risk').length;
    const upcoming = list.filter((p) => p.status === 'upcoming' || !p.status).length;
    const progressSum = list.reduce((sum, p) => sum + (p.percent_complete ?? 0), 0);
    const progress = total > 0 ? Math.round(progressSum / total) : 0;
    const status: BuildingStats['status'] = (() => {
      if (total > 0 && completed === total) return 'done';
      if (behind > 0) return 'behind';
      if (inProgress > 0) return 'on_track';
      return 'upcoming';
    })();
    return { key, label: key, total, completed, inProgress, behind, upcoming, progress, status };
  };

  return Array.from(byKey.entries())
    .map(([k, list]) => statsFor(k, list))
    .sort((a, b) => {
      // Sitework last, Clubhouse after buildings, otherwise alpha.
      if (a.label === UNGROUPED_LABEL) return 1;
      if (b.label === UNGROUPED_LABEL) return -1;
      if (a.label === 'Clubhouse' && b.label.startsWith('Building')) return 1;
      if (b.label === 'Clubhouse' && a.label.startsWith('Building')) return -1;
      return a.label.localeCompare(b.label);
    });
}

// ── Visual tokens per status ─────────────────────────────────

const STATUS_TOKENS: Record<BuildingStats['status'], {
  bar: string; pill: string; pillBg: string; icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
}> = {
  done:     { bar: colors.statusActive,   pill: colors.statusActive,   pillBg: colors.statusActiveSubtle,   icon: CheckCircle2,   label: 'Complete'  },
  on_track: { bar: colors.statusInfo,     pill: colors.statusInfo,     pillBg: colors.statusInfoSubtle,     icon: Clock,          label: 'On track'  },
  behind:   { bar: colors.statusCritical, pill: colors.statusCritical, pillBg: colors.statusCriticalSubtle, icon: AlertTriangle,  label: 'Behind'    },
  upcoming: { bar: colors.borderDefault,  pill: colors.textTertiary,   pillBg: colors.surfaceInset,         icon: Circle,         label: 'Upcoming'  },
};

// ── The strip ────────────────────────────────────────────────

interface BuildingOverviewProps {
  phases: SchedulePhase[];
  activeBuilding: string | null;                   // null = "All"
  onSelectBuilding: (key: string | null) => void;
}

export const BuildingOverview: React.FC<BuildingOverviewProps> = ({
  phases,
  activeBuilding,
  onSelectBuilding,
}) => {
  const stats = useMemo(() => computeBuildingStats(phases), [phases]);
  const totalActivities = phases.length;

  // Don't show the strip for tiny schedules — no grouping value below ~12 rows
  // or when there's only one building bucket (the "All" card would be lonely).
  if (totalActivities < 6 || stats.length < 2) return null;

  // Overall stats for the "All" card.
  const allCompleted = phases.filter((p) => p.status === 'completed').length;
  const allBehind = phases.filter((p) => p.status === 'delayed' || p.status === 'at_risk').length;
  const allProgress = totalActivities > 0
    ? Math.round(phases.reduce((s, p) => s + (p.percent_complete ?? 0), 0) / totalActivities)
    : 0;
  const allStatus: BuildingStats['status'] = allBehind > 0 ? 'behind' : 'on_track';

  return (
    <div
      role="tablist"
      aria-label="Filter schedule by building"
      style={{
        display: 'flex',
        gap: spacing['3'],
        overflowX: 'auto',
        overflowY: 'hidden',
        padding: `${spacing['1']} 0 ${spacing['3']}`,
        marginBottom: spacing['4'],
        scrollbarWidth: 'thin',
      }}
    >
      <BuildingCard
        label="Entire project"
        sublabel={`${totalActivities} activities`}
        progress={allProgress}
        status={allStatus}
        behind={allBehind}
        completed={allCompleted}
        total={totalActivities}
        active={activeBuilding === null}
        onClick={() => onSelectBuilding(null)}
        isAll
      />
      {stats.map((s) => (
        <BuildingCard
          key={s.key}
          label={s.label}
          sublabel={`${s.total} activit${s.total === 1 ? 'y' : 'ies'}`}
          progress={s.progress}
          status={s.status}
          behind={s.behind}
          completed={s.completed}
          total={s.total}
          active={activeBuilding === s.key}
          onClick={() => onSelectBuilding(activeBuilding === s.key ? null : s.key)}
        />
      ))}
    </div>
  );
};

// ── Individual card ──────────────────────────────────────────

interface BuildingCardProps {
  label: string;
  sublabel: string;
  progress: number;
  status: BuildingStats['status'];
  behind: number;
  completed: number;
  total: number;
  active: boolean;
  onClick: () => void;
  isAll?: boolean;
}

const BuildingCard: React.FC<BuildingCardProps> = ({
  label, sublabel, progress, status, behind, completed, total, active, onClick, isAll,
}) => {
  const tokens = STATUS_TOKENS[status];
  const StatusIcon = tokens.icon;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        flex: '0 0 auto',
        minWidth: 220,
        maxWidth: 260,
        minHeight: 112,
        textAlign: 'left',
        padding: spacing['4'],
        border: `1px solid ${active ? tokens.bar : colors.borderSubtle}`,
        borderRadius: borderRadius.xl,
        backgroundColor: active ? colors.white : colors.surfaceRaised,
        boxShadow: active ? shadows.card : 'none',
        cursor: 'pointer',
        transition: transitions.quick,
        outline: 'none',
        fontFamily: typography.fontFamily,
        position: 'relative',
      }}
    >
      {/* Left accent rail */}
      <div style={{
        position: 'absolute', left: 0, top: 12, bottom: 12, width: 3,
        borderRadius: borderRadius.full,
        backgroundColor: active ? tokens.bar : colors.borderSubtle,
        transition: transitions.quick,
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
        <Building2 size={16} color={active ? tokens.bar : colors.textSecondary} />
        <span style={{
          fontSize: typography.fontSize.body,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
          letterSpacing: typography.letterSpacing.normal,
          lineHeight: typography.lineHeight.tight,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {label}
        </span>
      </div>

      <div style={{
        fontSize: typography.fontSize.caption,
        color: colors.textTertiary,
        marginBottom: spacing['3'],
        fontVariantNumeric: 'tabular-nums',
      }}>
        {sublabel}
      </div>

      {/* Progress bar */}
      <div style={{
        width: '100%', height: 6, backgroundColor: colors.surfaceInset,
        borderRadius: borderRadius.full, overflow: 'hidden', marginBottom: spacing['2'],
      }}>
        <div style={{
          width: `${progress}%`, height: '100%',
          backgroundColor: tokens.bar,
          borderRadius: borderRadius.full,
          transition: 'width 400ms cubic-bezier(0.32, 0.72, 0, 1)',
        }} />
      </div>

      {/* Bottom row: status pill + completion ratio */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing['2'] }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: `2px ${spacing['2']}`,
          backgroundColor: tokens.pillBg,
          color: tokens.pill,
          borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption,
          fontWeight: typography.fontWeight.semibold,
          letterSpacing: typography.letterSpacing.wide,
        }}>
          <StatusIcon size={12} color={tokens.pill} />
          {isAll && behind > 0 ? `${behind} behind` : tokens.label}
        </span>
        <span style={{
          fontSize: typography.fontSize.caption,
          color: colors.textSecondary,
          fontVariantNumeric: 'tabular-nums',
          fontWeight: typography.fontWeight.medium,
        }}>
          {completed}/{total} done
        </span>
      </div>
    </button>
  );
};
