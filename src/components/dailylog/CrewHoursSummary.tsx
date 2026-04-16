import React from 'react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

export interface CrewHoursEntry {
  trade: string;
  workers: number;
  hours: number;
  plannedHours: number;
  color: string;
}

interface CrewHoursSummaryProps {
  crews: CrewHoursEntry[];
}

export const CrewHoursSummary: React.FC<CrewHoursSummaryProps> = React.memo(({ crews }) => {
  const totalActual = crews.reduce((s, c) => s + c.hours, 0);
  const totalPlanned = crews.reduce((s, c) => s + c.plannedHours, 0);
  const totalWorkers = crews.reduce((s, c) => s + c.workers, 0);
  const overallVariance = totalPlanned > 0 ? ((totalActual - totalPlanned) / totalPlanned) * 100 : 0;
  const maxHours = Math.max(...crews.map(c => Math.max(c.hours, c.plannedHours)));

  return (
    <div>
      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['3'], marginBottom: spacing['4'] }}>
        <div style={{ padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md }}>
          <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Workers</p>
          <p style={{ fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: `${spacing['1']} 0 0`, letterSpacing: typography.letterSpacing.tighter }}>{totalWorkers}</p>
        </div>
        <div style={{ padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md }}>
          <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Actual Hours</p>
          <p style={{ fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: `${spacing['1']} 0 0`, letterSpacing: typography.letterSpacing.tighter }}>{totalActual.toLocaleString()}</p>
        </div>
        <div style={{ padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md }}>
          <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Planned Hours</p>
          <p style={{ fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: `${spacing['1']} 0 0`, letterSpacing: typography.letterSpacing.tighter }}>{totalPlanned.toLocaleString()}</p>
        </div>
        <div style={{ padding: spacing['3'], backgroundColor: overallVariance >= 0 ? colors.statusActiveSubtle : colors.statusCriticalSubtle, borderRadius: borderRadius.md }}>
          <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Variance</p>
          <p style={{ fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold, color: overallVariance >= 0 ? colors.statusActive : colors.statusCritical, margin: `${spacing['1']} 0 0`, letterSpacing: typography.letterSpacing.tighter }}>
            {overallVariance >= 0 ? '+' : ''}{overallVariance.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Breakdown by trade */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '120px 60px 1fr 80px 80px 70px', gap: spacing['2'], padding: `0 ${spacing['2']}` }}>
          {['Trade', 'Crew', '', 'Actual', 'Planned', 'Var.'].map(h => (
            <span key={h} style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>{h}</span>
          ))}
        </div>

        {crews.map(crew => {
          const variance = crew.plannedHours > 0 ? ((crew.hours - crew.plannedHours) / crew.plannedHours) * 100 : 0;
          const actualWidth = maxHours > 0 ? (crew.hours / maxHours) * 100 : 0;
          const plannedWidth = maxHours > 0 ? (crew.plannedHours / maxHours) * 100 : 0;

          return (
            <div key={crew.trade} style={{ display: 'grid', gridTemplateColumns: '120px 60px 1fr 80px 80px 70px', gap: spacing['2'], alignItems: 'center', padding: `${spacing['2']}`, borderRadius: borderRadius.sm }}>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{crew.trade}</span>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{crew.workers}</span>
              <div style={{ position: 'relative', height: 16 }}>
                {/* Planned (background) */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: `${plannedWidth}%`, height: '100%', backgroundColor: colors.surfaceInset, borderRadius: borderRadius.sm }} />
                {/* Actual (foreground) */}
                <div style={{ position: 'absolute', top: 2, left: 0, width: `${actualWidth}%`, height: 12, backgroundColor: crew.color, borderRadius: borderRadius.sm, opacity: 0.85 }} />
              </div>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textAlign: 'right' }}>{crew.hours}</span>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, textAlign: 'right' }}>{crew.plannedHours}</span>
              <span style={{
                fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, textAlign: 'right',
                color: Math.abs(variance) < 5 ? colors.textTertiary : variance > 0 ? colors.statusActive : colors.statusCritical,
              }}>
                {variance >= 0 ? '+' : ''}{variance.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
CrewHoursSummary.displayName = 'CrewHoursSummary';
