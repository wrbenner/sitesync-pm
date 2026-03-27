import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

interface EarnedValueProps {
  totalBudget: number;
  spent: number;
  progress: number;
}

interface EVMetric {
  label: string;
  fullName: string;
  value: string;
  status: 'good' | 'warning' | 'critical';
  description: string;
  explanation: string;
}

export const EarnedValueDashboard: React.FC<EarnedValueProps> = ({ totalBudget, spent, progress }) => {
  // EVM Calculations
  const BAC = totalBudget;
  const PV = BAC * 0.68; // Planned Value (planned 68% done by now)
  const EV = BAC * (progress / 100); // Earned Value (actual progress)
  const AC = spent; // Actual Cost

  const CPI = EV / AC; // Cost Performance Index
  const SPI = EV / PV; // Schedule Performance Index
  const EAC = BAC / CPI; // Estimate at Completion
  const ETC = EAC - AC; // Estimate to Complete
  const VAC = BAC - EAC; // Variance at Completion
  const CV = EV - AC; // Cost Variance
  // Schedule Variance: EV - PV (available for future use)

  const fmt = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n.toFixed(0)}`;

  const metrics: EVMetric[] = [
    {
      label: 'CPI',
      fullName: 'Cost Performance Index',
      value: CPI.toFixed(2),
      status: CPI >= 1 ? 'good' : CPI >= 0.95 ? 'warning' : 'critical',
      description: CPI >= 1 ? 'Under budget' : 'Over budget',
      explanation: 'Below 1.0 means spending more than planned per unit of work',
    },
    {
      label: 'SPI',
      fullName: 'Schedule Performance Index',
      value: SPI.toFixed(2),
      status: SPI >= 1 ? 'good' : SPI >= 0.95 ? 'warning' : 'critical',
      description: SPI >= 1 ? 'Ahead of schedule' : 'Behind schedule',
      explanation: 'Above 1.0 means earning value faster than planned',
    },
    {
      label: 'EAC',
      fullName: 'Estimate at Completion',
      value: fmt(EAC),
      status: EAC <= BAC ? 'good' : EAC <= BAC * 1.05 ? 'warning' : 'critical',
      description: `BAC: ${fmt(BAC)}`,
      explanation: 'Projected total cost based on current performance',
    },
    {
      label: 'ETC',
      fullName: 'Estimate to Complete',
      value: fmt(ETC),
      status: 'good',
      description: `${((ETC / BAC) * 100).toFixed(0)}% of total budget remaining`,
      explanation: 'Estimated remaining cost to complete the project',
    },
    {
      label: 'VAC',
      fullName: 'Variance at Completion',
      value: `${VAC >= 0 ? '+' : ''}${fmt(VAC)}`,
      status: VAC >= 0 ? 'good' : VAC >= -BAC * 0.05 ? 'warning' : 'critical',
      description: VAC >= 0 ? 'Projected under budget' : 'Projected over budget',
      explanation: 'Projected budget surplus or deficit at completion',
    },
    {
      label: 'CV',
      fullName: 'Cost Variance',
      value: `${CV >= 0 ? '+' : ''}${fmt(CV)}`,
      status: CV >= 0 ? 'good' : CV >= -BAC * 0.03 ? 'warning' : 'critical',
      description: CV >= 0 ? 'Favorable' : 'Unfavorable',
      explanation: 'Difference between earned value and actual cost',
    },
  ];

  const statusColors = {
    good: colors.statusActive,
    warning: colors.statusPending,
    critical: colors.statusCritical,
  };

  return (
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
  );
};
