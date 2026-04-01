import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { computeEarnedValue } from '../../lib/financialEngine';
import type { MappedDivision } from '../../api/endpoints/budget';

interface EarnedValueProps {
  divisions: MappedDivision[];
  contractValue: number;
  elapsedFraction: number; // 0-1, derived from schedule progress
}

interface EVMetric {
  label: string;
  fullName: string;
  value: string;
  status: 'good' | 'warning' | 'critical';
  description: string;
  explanation: string;
}

function indexStatus(value: number): 'good' | 'warning' | 'critical' {
  if (value >= 1.0) return 'good';
  if (value >= 0.9) return 'warning';
  return 'critical';
}

const fmt = (n: number): string => {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

export const EarnedValueDashboard: React.FC<EarnedValueProps> = ({ divisions, contractValue, elapsedFraction }) => {
  const ev = computeEarnedValue(divisions, contractValue, elapsedFraction);
  const { bcws, bcwp, acwp, spi, cpi, eac, etc, vac, scheduleVarianceDays, costVariance } = ev;

  const metrics: EVMetric[] = [
    {
      label: 'CPI',
      fullName: 'Cost Performance Index',
      value: cpi.toFixed(2),
      status: indexStatus(cpi),
      description: cpi >= 1 ? 'Under budget' : 'Over budget',
      explanation: 'Below 1.0 means spending more than planned per unit of work',
    },
    {
      label: 'SPI',
      fullName: 'Schedule Performance Index',
      value: spi.toFixed(2),
      status: indexStatus(spi),
      description: spi >= 1 ? 'Ahead of schedule' : 'Behind schedule',
      explanation: 'Above 1.0 means earning value faster than planned',
    },
    {
      label: 'EAC',
      fullName: 'Estimate at Completion',
      value: fmt(eac),
      status: eac <= contractValue ? 'good' : eac <= contractValue * 1.05 ? 'warning' : 'critical',
      description: `BAC: ${fmt(contractValue)}`,
      explanation: 'Projected total cost based on current cost performance',
    },
    {
      label: 'ETC',
      fullName: 'Estimate to Complete',
      value: fmt(etc),
      status: 'good',
      description: `${contractValue > 0 ? ((etc / contractValue) * 100).toFixed(0) : 0}% of contract remaining`,
      explanation: 'Estimated remaining cost to complete the project',
    },
    {
      label: 'VAC',
      fullName: 'Variance at Completion',
      value: `${vac >= 0 ? '+' : ''}${fmt(vac)}`,
      status: vac >= 0 ? 'good' : vac >= -contractValue * 0.05 ? 'warning' : 'critical',
      description: vac >= 0 ? 'Projected under budget' : 'Projected over budget',
      explanation: 'Projected budget surplus or deficit at completion',
    },
    {
      label: 'CV',
      fullName: 'Cost Variance',
      value: `${costVariance >= 0 ? '+' : ''}${fmt(costVariance)}`,
      status: costVariance >= 0 ? 'good' : costVariance >= -contractValue * 0.03 ? 'warning' : 'critical',
      description: costVariance >= 0 ? 'Favorable' : 'Unfavorable',
      explanation: 'Difference between earned value and actual cost',
    },
  ];

  const statusColors = {
    good: colors.statusActive,
    warning: colors.statusPending,
    critical: colors.statusCritical,
  };

  const svLabel = scheduleVarianceDays === 0
    ? 'On schedule'
    : scheduleVarianceDays > 0
      ? `${scheduleVarianceDays}d ahead (est.)`
      : `${Math.abs(scheduleVarianceDays)}d behind (est.)`;

  return (
    <div>
      <div style={{
        display: 'flex', gap: spacing['3'], marginBottom: spacing['4'],
        padding: spacing['3'], backgroundColor: `${colors.primary}08`,
        borderRadius: borderRadius.md, border: `1px solid ${colors.primary}20`,
        flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
          <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>BCWP</span>
          {' '}{fmt(bcwp)}
        </div>
        <div style={{ color: colors.textTertiary }}>·</div>
        <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
          <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>BCWS</span>
          {' '}{fmt(bcws)}
        </div>
        <div style={{ color: colors.textTertiary }}>·</div>
        <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
          <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>ACWP</span>
          {' '}{fmt(acwp)}
        </div>
        <div style={{ color: colors.textTertiary }}>·</div>
        <div style={{ fontSize: typography.fontSize.caption, color: scheduleVarianceDays >= 0 ? colors.statusActive : colors.statusCritical }}>
          <span style={{ fontWeight: typography.fontWeight.semibold }}>{svLabel}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['3'] }}>
        {metrics.map((m) => {
          const color = statusColors[m.status];
          const TrendIcon = m.status === 'good' ? TrendingUp : m.status === 'critical' ? TrendingDown : Minus;
          return (
            <div
              key={m.label}
              style={{
                padding: spacing['4'], borderRadius: borderRadius.md,
                backgroundColor: `${color}06`, border: `1px solid ${color}15`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
                <div>
                  <span style={{ fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{m.value}</span>
                </div>
                <TrendIcon size={16} color={color} />
              </div>
              <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{m.label}</p>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: 2 }}>{m.fullName}</p>
              <p style={{ fontSize: typography.fontSize.caption, color, margin: 0, marginTop: spacing['1'], fontWeight: typography.fontWeight.medium }}>{m.description}</p>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: spacing['1'], opacity: 0.75, lineHeight: 1.3 }}>{m.explanation}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
