import React from 'react';
import { AlertTriangle, CheckCircle, TrendingUp, Calendar } from 'lucide-react';
import { MetricBox } from '../../components/Primitives';
import { colors, spacing, typography } from '../../styles/theme';

interface ScheduleKPICardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor: string;
  trend: 'up' | 'down' | 'neutral';
  progressPct?: number;
  ariaLabel?: string;
  isMobile?: boolean;
}

const ScheduleKPICard: React.FC<ScheduleKPICardProps> = ({ icon, label, value, valueColor, trend, progressPct, ariaLabel, isMobile }) => (
  <div aria-label={ariaLabel} style={{
    backgroundColor: colors.white,
    borderRadius: '12px',
    padding: '24px',
    border: `1px solid ${colors.borderLight}`,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  }}>
    {icon}
    <span style={{ fontSize: '12px', color: colors.textTertiary, fontWeight: typography.fontWeight.medium, lineHeight: typography.lineHeight.normal }}>
      {label}
    </span>
    <span style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: typography.fontWeight.semibold, color: valueColor, lineHeight: 1.1 }}>
      {value}
    </span>
    {progressPct != null && (
      <div style={{ marginTop: '2px' }}>
        <div style={{ height: '4px', borderRadius: '2px', backgroundColor: colors.borderLight, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, progressPct))}%`, borderRadius: '2px', backgroundColor: colors.statusActive, transition: 'width 0.4s ease' }} />
        </div>
      </div>
    )}
    <span style={{ fontSize: '12px', color: trend === 'up' ? colors.statusActive : trend === 'down' ? colors.statusCritical : colors.textTertiary }}>
      <span aria-hidden="true">{trend === 'up' ? '▲' : trend === 'down' ? '▼' : '─'}</span>
      <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
        {trend === 'up' ? 'Status: Improving' : trend === 'down' ? 'Status: Declining' : 'Status: Stable'}
      </span>
    </span>
  </div>
);

interface ActivityMetrics {
  scheduleVarianceDays: number;
  criticalPathCount: number;
  onTrackPct: number;
  completePct: number;
}

interface ScheduleKPIsProps {
  activityMetrics: ActivityMetrics;
  metrics: {
    daysBeforeSchedule: number;
    milestonesHit: number;
    milestoneTotal: number;
  };
  projectMetrics?: { aiConfidenceLevel?: number | null } | null;
  isMobile: boolean;
  isNarrow: boolean;
}

export const ScheduleKPIs: React.FC<ScheduleKPIsProps> = ({ activityMetrics, metrics, projectMetrics, isMobile, isNarrow }) => (
  <>
    {/* KPI Metric Cards */}
    <div
      role="group"
      aria-label="Schedule metrics"
      style={{
        display: 'grid',
        gridTemplateColumns: isNarrow ? '1fr' : isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: spacing.lg,
        marginBottom: spacing['2xl'],
      }}
    >
      {/* Card 1: Schedule Variance */}
      <ScheduleKPICard
        icon={<Calendar size={24} color={
          activityMetrics.scheduleVarianceDays <= 0 ? colors.statusActive
          : activityMetrics.scheduleVarianceDays <= 5 ? colors.statusPending
          : colors.statusCritical
        } />}
        label="Schedule Variance"
        value={`${activityMetrics.scheduleVarianceDays > 0 ? '+' : ''}${activityMetrics.scheduleVarianceDays}d`}
        valueColor={
          activityMetrics.scheduleVarianceDays <= 0 ? colors.statusActive
          : activityMetrics.scheduleVarianceDays <= 5 ? colors.statusPending
          : colors.statusCritical
        }
        trend={activityMetrics.scheduleVarianceDays > 0 ? 'down' : activityMetrics.scheduleVarianceDays < 0 ? 'up' : 'neutral'}
        ariaLabel={`Schedule Variance: ${activityMetrics.scheduleVarianceDays > 0 ? '+' : ''}${activityMetrics.scheduleVarianceDays}d`}
        isMobile={isMobile}
      />
      {/* Card 2: Critical Path Items */}
      <ScheduleKPICard
        icon={<AlertTriangle size={24} color={activityMetrics.criticalPathCount > 0 ? colors.statusCritical : colors.statusActive} />}
        label="Critical Path Items"
        value={String(activityMetrics.criticalPathCount)}
        valueColor={activityMetrics.criticalPathCount > 0 ? colors.statusCritical : colors.textPrimary}
        trend="neutral"
        ariaLabel={`Critical Path Items: ${activityMetrics.criticalPathCount}`}
        isMobile={isMobile}
      />
      {/* Card 3: On Track */}
      <ScheduleKPICard
        icon={<TrendingUp size={24} color={
          activityMetrics.onTrackPct >= 80 ? colors.statusActive
          : activityMetrics.onTrackPct >= 60 ? colors.statusPending
          : colors.statusCritical
        } />}
        label="On Track"
        value={`${activityMetrics.onTrackPct}%`}
        valueColor={
          activityMetrics.onTrackPct >= 80 ? colors.statusActive
          : activityMetrics.onTrackPct >= 60 ? colors.statusPending
          : colors.statusCritical
        }
        trend={activityMetrics.onTrackPct >= 80 ? 'up' : 'down'}
        ariaLabel={`On Track: ${activityMetrics.onTrackPct}%`}
        isMobile={isMobile}
      />
      {/* Card 4: Complete */}
      <ScheduleKPICard
        icon={<CheckCircle size={24} color={colors.primaryOrange} />}
        label="Complete"
        value={`${activityMetrics.completePct}%`}
        valueColor={colors.textPrimary}
        trend="neutral"
        progressPct={activityMetrics.completePct}
        ariaLabel={`Complete: ${activityMetrics.completePct}%`}
        isMobile={isMobile}
      />
    </div>

    {/* Metrics */}
    <div
      role="region"
      aria-label="Schedule Summary"
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: spacing.lg,
        marginBottom: spacing['2xl'],
      }}
    >
      <MetricBox label="Days Ahead" value={metrics.daysBeforeSchedule} />
      <MetricBox label="Milestones" value={`${metrics.milestonesHit}/${metrics.milestoneTotal}`} />
      <MetricBox
        label="AI Confidence"
        value={projectMetrics?.aiConfidenceLevel == null ? 'Insufficient data' : projectMetrics.aiConfidenceLevel}
        unit={projectMetrics?.aiConfidenceLevel == null ? undefined : '%'}
      />
    </div>
  </>
);
