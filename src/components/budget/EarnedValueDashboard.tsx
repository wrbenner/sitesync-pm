import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { computeEarnedValue } from '../../lib/financialEngine';
import { useBudgetData } from '../../hooks/useBudgetData';
import { Skeleton } from '../Primitives';

interface EVMetric {
  label: string;
  fullName: string;
  value: string;
  status: 'good' | 'warning' | 'critical';
  description: string;
  tooltip: string;
}

/** green >= 1.0, amber 0.85-0.99, red < 0.85 */
function indexStatus(value: number): 'good' | 'warning' | 'critical' {
  if (value >= 1.0) return 'good';
  if (value >= 0.85) return 'warning';
  return 'critical';
}

const fmt = (n: number): string => {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

export const EarnedValueDashboard: React.FC = () => {
  const { budgetItems, changeOrders, invoices, scheduleActivities, loading } = useBudgetData();

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['3'] }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={110} />
        ))}
      </div>
    );
  }

  const ev = computeEarnedValue(budgetItems, changeOrders, invoices, scheduleActivities);
  const { bcws, bcwp, acwp, spi, cpi, eac, etc, vac, scheduleVarianceDays, costVariance } = ev;

  // BAC for percentage displays
  const bac = budgetItems.reduce((s, b) => s + (b.original_amount ?? 0), 0)
    + changeOrders.filter(co => co.status === 'approved').reduce((s, co) => s + co.approved_cost, 0);

  const metrics: EVMetric[] = [
    {
      label: 'CPI',
      fullName: 'Cost Performance Index',
      value: cpi.toFixed(2),
      status: indexStatus(cpi),
      description: cpi >= 1 ? 'Under budget' : 'Over budget',
      tooltip:
        'CPI = Earned Value / Actual Cost (BCWP / ACWP). Above 1.0 means you are getting more than $1 of work done for every $1 spent. Below 1.0 means you are overspending.',
    },
    {
      label: 'SPI',
      fullName: 'Schedule Performance Index',
      value: spi.toFixed(2),
      status: indexStatus(spi),
      description: spi >= 1 ? 'Ahead of schedule' : 'Behind schedule',
      tooltip:
        'SPI = Earned Value / Planned Value (BCWP / BCWS). Above 1.0 means work is completing faster than planned. Below 1.0 means the project is running behind the time-based plan.',
    },
    {
      label: 'EAC',
      fullName: 'Estimate at Completion',
      value: fmt(eac),
      status: eac <= bac ? 'good' : eac <= bac * 1.05 ? 'warning' : 'critical',
      description: `BAC: ${fmt(bac)}`,
      tooltip:
        'EAC = BAC / CPI. The projected total cost to finish the project at the current spending rate. Compare against BAC (Budget at Completion) to see if the project will come in over or under budget.',
    },
    {
      label: 'ETC',
      fullName: 'Estimate to Complete',
      value: fmt(etc),
      status: 'good',
      description: `${bac > 0 ? ((etc / bac) * 100).toFixed(0) : 0}% of contract remaining`,
      tooltip:
        'ETC = EAC - ACWP. The estimated cost remaining to finish all outstanding work. This is how much more you expect to spend from today to project closeout.',
    },
    {
      label: 'VAC',
      fullName: 'Variance at Completion',
      value: `${vac >= 0 ? '+' : ''}${fmt(vac)}`,
      status: vac >= 0 ? 'good' : vac >= -bac * 0.05 ? 'warning' : 'critical',
      description: vac >= 0 ? 'Projected under budget' : 'Projected over budget',
      tooltip:
        'VAC = BAC - EAC. The projected budget surplus (positive) or overrun (negative) at project completion. A negative VAC means you are forecast to finish over budget.',
    },
    {
      label: 'CV',
      fullName: 'Cost Variance',
      value: `${costVariance >= 0 ? '+' : ''}${fmt(costVariance)}`,
      status: costVariance >= 0 ? 'good' : costVariance >= -bac * 0.03 ? 'warning' : 'critical',
      description: costVariance >= 0 ? 'Favorable' : 'Unfavorable',
      tooltip:
        'CV = Earned Value - Actual Cost (BCWP - ACWP). Positive means you completed more work than the money spent would predict. Negative means you spent more than the work is worth.',
    },
  ];

  const statusColors = {
    good: colors.statusActive,
    warning: colors.statusPending,
    critical: colors.statusCritical,
  };

  const svLabel =
    scheduleVarianceDays === 0
      ? 'On schedule'
      : scheduleVarianceDays > 0
        ? `${scheduleVarianceDays}d ahead (est.)`
        : `${Math.abs(scheduleVarianceDays)}d behind (est.)`;

  return (
    <div>
      {/* EV summary bar */}
      <div
        style={{
          display: 'flex',
          gap: spacing['3'],
          marginBottom: spacing['4'],
          padding: spacing['3'],
          backgroundColor: `${colors.primary}08`,
          borderRadius: borderRadius.md,
          border: `1px solid ${colors.primary}20`,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
          <span
            style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}
            title="BCWP: Budgeted Cost of Work Performed. The dollar value of work actually completed, measured against the original budget."
          >
            BCWP
          </span>{' '}
          {fmt(bcwp)}
        </div>
        <div style={{ color: colors.textTertiary }}>·</div>
        <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
          <span
            style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}
            title="BCWS: Budgeted Cost of Work Scheduled. The dollar value of work that was planned to be complete by today, based on project schedule dates."
          >
            BCWS
          </span>{' '}
          {fmt(bcws)}
        </div>
        <div style={{ color: colors.textTertiary }}>·</div>
        <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
          <span
            style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}
            title="ACWP: Actual Cost of Work Performed. The total real cost incurred for work completed to date, from approved invoices."
          >
            ACWP
          </span>{' '}
          {fmt(acwp)}
        </div>
        <div style={{ color: colors.textTertiary }}>·</div>
        <div
          style={{
            fontSize: typography.fontSize.caption,
            color:
              scheduleVarianceDays >= 0 ? colors.statusActive : colors.statusCritical,
          }}
        >
          <span style={{ fontWeight: typography.fontWeight.semibold }}>{svLabel}</span>
        </div>
      </div>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['3'] }}>
        {metrics.map((m) => {
          const color = statusColors[m.status];
          const TrendIcon =
            m.status === 'good' ? TrendingUp : m.status === 'critical' ? TrendingDown : Minus;
          return (
            <div
              key={m.label}
              title={m.tooltip}
              style={{
                padding: spacing['4'],
                borderRadius: borderRadius.md,
                backgroundColor: `${color}06`,
                border: `1px solid ${color}15`,
                cursor: 'default',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: spacing['2'],
                }}
              >
                <span
                  style={{
                    fontSize: typography.fontSize.heading,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.textPrimary,
                  }}
                >
                  {m.value}
                </span>
                <TrendIcon size={16} color={color} />
              </div>
              <p
                style={{
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary,
                  margin: 0,
                }}
              >
                {m.label}
              </p>
              <p
                style={{
                  fontSize: typography.fontSize.caption,
                  color: colors.textTertiary,
                  margin: 0,
                  marginTop: 2,
                }}
              >
                {m.fullName}
              </p>
              <p
                style={{
                  fontSize: typography.fontSize.caption,
                  color,
                  margin: 0,
                  marginTop: spacing['1'],
                  fontWeight: typography.fontWeight.medium,
                }}
              >
                {m.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
