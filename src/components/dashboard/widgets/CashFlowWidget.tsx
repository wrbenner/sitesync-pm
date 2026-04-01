import React, { useState, useMemo } from 'react';
import { DollarSign } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows } from '../../../styles/theme';
import { useProjectId } from '../../../hooks/useProjectId';
import { useBudgetItems } from '../../../hooks/queries';
import { compute13WeekCashFlow } from '../../../lib/financialEngine';
import type { MappedDivision } from '../../../api/endpoints/budget';
import type { PayApplicationRow, SubInvoiceRow } from '../../../types/financial';

const RETAINAGE_OPTIONS = [
  { label: '5%', value: 0.05 },
  { label: '10%', value: 0.10 },
];

const COLLECTION_LAG_DAYS = 30;
const PAYMENT_LAG_DAYS = 30;

// No pay apps or sub invoices in DB yet — empty until those tables are connected
const EMPTY_PAY_APPS: PayApplicationRow[] = [];
const EMPTY_SUB_INVOICES: SubInvoiceRow[] = [];

function formatWeekLabel(isoDate: string): string {
  const [, mm, dd] = isoDate.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(mm, 10) - 1]} ${parseInt(dd, 10)}`;
}

function formatDollars(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${n < 0 ? '-' : ''}$${Math.round(abs / 1_000)}K`;
  return `${n < 0 ? '-' : ''}$${Math.round(abs)}`;
}

export const CashFlowWidget: React.FC = React.memo(() => {
  const [hovered, setHovered] = useState<number | null>(null);
  const [retainageRate, setRetainageRate] = useState(0.10);
  const projectId = useProjectId();
  const { data: budgetItems } = useBudgetItems(projectId);

  const divisions: MappedDivision[] = useMemo(() => {
    if (!budgetItems) return [];
    return budgetItems.map(b => ({
      id: b.id,
      name: b.division,
      budget: b.original_amount ?? 0,
      spent: b.actual_amount ?? 0,
      committed: b.committed_amount ?? 0,
      progress: b.percent_complete ?? 0,
      cost_code: b.cost_code ?? null,
    }));
  }, [budgetItems]);

  const rows = useMemo(
    () => compute13WeekCashFlow(
      EMPTY_PAY_APPS,
      EMPTY_SUB_INVOICES,
      divisions,
      retainageRate,
      COLLECTION_LAG_DAYS,
      PAYMENT_LAG_DAYS,
    ),
    [divisions, retainageRate]
  );

  if (rows.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <DollarSign size={24} color={colors.textTertiary} />
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, marginTop: spacing['2'] }}>Loading budget data...</p>
      </div>
    );
  }

  const chartHeight = 120;
  const chartWidth = 260;
  const barGroupWidth = chartWidth / rows.length;
  const barWidth = barGroupWidth * 0.35;
  const padding = 4;

  const maxOutflow = Math.max(...rows.map(r => r.outflow));
  const maxInflow = Math.max(...rows.map(r => r.inflow));
  const maxBar = Math.max(maxOutflow, maxInflow, 1);

  const minCumulative = Math.min(...rows.map(r => r.cumulativeBalance));
  const maxCumulative = Math.max(...rows.map(r => r.cumulativeBalance), 0);
  const cumulativeRange = Math.max(Math.abs(maxCumulative - minCumulative), 1);

  function barY(val: number): number {
    return chartHeight - padding - (val / maxBar) * (chartHeight - padding * 2);
  }
  function barH(val: number): number {
    return (val / maxBar) * (chartHeight - padding * 2);
  }
  function lineY(val: number): number {
    const norm = (val - minCumulative) / cumulativeRange;
    return chartHeight - padding - norm * (chartHeight - padding * 2);
  }

  const curvePath = rows
    .map((r, i) => {
      const cx = i * barGroupWidth + barGroupWidth / 2;
      const cy = lineY(r.cumulativeBalance);
      return `${i === 0 ? 'M' : 'L'} ${cx} ${cy}`;
    })
    .join(' ');

  const totalInflow = rows.reduce((s, r) => s + r.inflow, 0);
  const totalOutflow = rows.reduce((s, r) => s + r.outflow, 0);
  const endBalance = rows[rows.length - 1].cumulativeBalance;

  const labelEvery = 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
        <DollarSign size={16} color={colors.textTertiary} />
        <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
          13-Week Cash Flow
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Retainage:</span>
          <div style={{ display: 'flex', borderRadius: borderRadius.sm, overflow: 'hidden', border: `1px solid ${colors.borderSubtle}` }}>
            {RETAINAGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setRetainageRate(opt.value)}
                style={{
                  padding: `2px ${spacing['2']}`,
                  fontSize: typography.fontSize.caption,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: retainageRate === opt.value ? colors.primaryOrange : 'transparent',
                  color: retainageRate === opt.value ? '#fff' : colors.textTertiary,
                  fontFamily: typography.fontFamily,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: spacing['3'], marginBottom: spacing['2'] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: colors.primaryOrange }} />
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Inflow</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: colors.borderDefault ?? '#CBD5E1' }} />
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Outflow</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
          <div style={{ width: 12, height: 2, backgroundColor: '#4EC896' }} />
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Cumulative</span>
        </div>
      </div>

      {/* Chart */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight + 18}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map(frac => (
            <line
              key={frac}
              x1={0} y1={barY(maxBar * frac)}
              x2={chartWidth} y2={barY(maxBar * frac)}
              stroke={colors.borderSubtle}
              strokeWidth="0.3"
            />
          ))}

          {/* Bars per week */}
          {rows.map((row, i) => {
            const groupX = i * barGroupWidth;
            const centerX = groupX + barGroupWidth / 2;
            const inflowX = centerX - barWidth - 1;
            const outflowX = centerX + 1;
            const isHovered = hovered === i;

            return (
              <g
                key={row.weekStart}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Hover bg */}
                {isHovered && (
                  <rect
                    x={groupX}
                    y={0}
                    width={barGroupWidth}
                    height={chartHeight}
                    fill={`${colors.primaryOrange}08`}
                  />
                )}
                {/* Inflow bar */}
                <rect
                  x={inflowX}
                  y={barY(row.inflow)}
                  width={barWidth}
                  height={barH(row.inflow)}
                  fill={colors.primaryOrange}
                  opacity={isHovered ? 1 : 0.85}
                  rx={0.5}
                />
                {/* Outflow bar */}
                <rect
                  x={outflowX}
                  y={barY(row.outflow)}
                  width={barWidth}
                  height={barH(row.outflow)}
                  fill="#94A3B8"
                  opacity={isHovered ? 1 : 0.7}
                  rx={0.5}
                />
                {/* X label every other week */}
                {i % labelEvery === 0 && (
                  <text
                    x={centerX}
                    y={chartHeight + 13}
                    textAnchor="middle"
                    fill={colors.textTertiary}
                    fontSize="5"
                    fontFamily={typography.fontFamily}
                  >
                    {formatWeekLabel(row.weekStart)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Cumulative line */}
          <path
            d={curvePath}
            fill="none"
            stroke="#4EC896"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Cumulative dots */}
          {rows.map((row, i) => (
            hovered === i ? (
              <circle
                key={row.weekStart}
                cx={i * barGroupWidth + barGroupWidth / 2}
                cy={lineY(row.cumulativeBalance)}
                r={2}
                fill="#4EC896"
                stroke={colors.surfaceRaised ?? '#fff'}
                strokeWidth="0.8"
              />
            ) : null
          ))}
        </svg>

        {/* Hover tooltip */}
        {hovered !== null && (
          <div
            style={{
              position: 'absolute',
              left: `${((hovered + 0.5) / rows.length) * 100}%`,
              top: 0,
              transform: 'translateX(-50%)',
              padding: `${spacing['1']} ${spacing['2']}`,
              backgroundColor: colors.surfaceRaised ?? '#fff',
              borderRadius: borderRadius.sm,
              boxShadow: shadows.cardHover,
              whiteSpace: 'nowrap',
              fontSize: typography.fontSize.caption,
              pointerEvents: 'none',
              zIndex: 5,
              border: `1px solid ${colors.borderSubtle}`,
            }}
          >
            <div style={{ fontWeight: typography.fontWeight.semibold, marginBottom: 2 }}>
              {formatWeekLabel(rows[hovered].weekStart)}
            </div>
            <div style={{ color: colors.primaryOrange }}>In: {formatDollars(rows[hovered].inflow)}</div>
            <div style={{ color: '#94A3B8' }}>Out: {formatDollars(rows[hovered].outflow)}</div>
            <div style={{ color: '#4EC896' }}>Net balance: {formatDollars(rows[hovered].cumulativeBalance)}</div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: spacing['4'], marginTop: spacing['2'], paddingTop: spacing['2'], borderTop: `1px solid ${colors.borderSubtle}` }}>
        <div>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>13-Wk Inflow</span>
          <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange, margin: 0 }}>
            {formatDollars(totalInflow)}
          </p>
        </div>
        <div>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>13-Wk Outflow</span>
          <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
            {formatDollars(totalOutflow)}
          </p>
        </div>
        <div>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Projected Balance</span>
          <p style={{
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.semibold,
            color: endBalance >= 0 ? '#4EC896' : '#EF4444',
            margin: 0,
          }}>
            {formatDollars(endBalance)}
          </p>
        </div>
      </div>
    </div>
  );
});
