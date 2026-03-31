import React, { useState, useMemo } from 'react';
import { DollarSign } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows } from '../../../styles/theme';
import { useProjectId } from '../../../hooks/useProjectId';
import { useBudgetItems } from '../../../hooks/queries';

interface DataPoint {
  month: string;
  planned: number;
  actual: number | null;
}

function buildCashFlowFromBudget(items: ReturnType<typeof useBudgetItems>['data']): { data: DataPoint[]; maxVal: number } {
  if (!items || items.length === 0) {
    return { data: [], maxVal: 50 };
  }

  // Build cumulative data points from budget divisions
  let cumulativePlanned = 0;
  let cumulativeActual = 0;
  const hasActual = items.some((item) => (item.actual_amount ?? 0) > 0);

  const points: DataPoint[] = items.map((item, i) => {
    cumulativePlanned += (item.original_amount ?? 0) / 1_000_000;
    cumulativeActual += (item.actual_amount ?? 0) / 1_000_000;
    const shortName = item.division.length > 6 ? item.division.slice(0, 6) : item.division;
    return {
      month: shortName,
      planned: Math.round(cumulativePlanned * 10) / 10,
      actual: hasActual ? Math.round(cumulativeActual * 10) / 10 : (i < items.length * 0.7 ? Math.round(cumulativeActual * 10) / 10 : null),
    };
  });

  const maxVal = Math.ceil((cumulativePlanned * 1.15) / 5) * 5 || 50;
  return { data: points, maxVal };
}

function yPos(val: number, height: number, max: number): number {
  return height - (val / max) * height;
}

export const CashFlowWidget: React.FC = React.memo(() => {
  const [hovered, setHovered] = useState<number | null>(null);
  const projectId = useProjectId();
  const { data: budgetItems } = useBudgetItems(projectId);

  const { data: cashFlowData, maxVal } = useMemo(() => buildCashFlowFromBudget(budgetItems), [budgetItems]);

  const chartWidth = 100; // percentage
  const chartHeight = 140;
  if (cashFlowData.length < 2) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <DollarSign size={24} color={colors.textTertiary} />
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, marginTop: spacing['2'] }}>Loading budget data...</p>
      </div>
    );
  }
  const stepX = chartWidth / (cashFlowData.length - 1);

  const plannedPath = cashFlowData
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${yPos(d.planned, chartHeight, maxVal)}`)
    .join(' ');

  const actualPoints = cashFlowData.filter((d) => d.actual !== null);
  const actualPath = actualPoints
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${cashFlowData.indexOf(d) * stepX} ${yPos(d.actual!, chartHeight, maxVal)}`)
    .join(' ');

  // Fill under actual
  const actualFill = actualPath + ` L ${cashFlowData.indexOf(actualPoints[actualPoints.length - 1]) * stepX} ${chartHeight} L 0 ${chartHeight} Z`;

  const totalPlanned = budgetItems ? budgetItems.reduce((s, b) => s + (b.original_amount ?? 0), 0) : 0;
  const totalActual = budgetItems ? budgetItems.reduce((s, b) => s + (b.actual_amount ?? 0), 0) : 0;
  const contingencyRemaining = `$${((totalPlanned - totalActual) / 1_000_000).toFixed(1)}M`;
  const burnRate = totalActual > 0 ? `$${(totalActual / 1_000_000 / 26).toFixed(1)}M/week` : '$0.0M/week';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
        <DollarSign size={16} color={colors.textTertiary} />
        <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
          Cash Flow
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: spacing['4'] }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            <div style={{ width: 8, height: 2, backgroundColor: colors.textTertiary, borderRadius: 1 }} />
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Planned</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            <div style={{ width: 8, height: 2, backgroundColor: colors.primaryOrange, borderRadius: 1 }} />
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Actual</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <svg
          viewBox={`-2 -5 ${chartWidth + 4} ${chartHeight + 26}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Grid lines */}
          {[0.2, 0.4, 0.6, 0.8].map((frac) => {
            const v = Math.round(maxVal * frac);
            return (
              <line key={v} x1={0} y1={yPos(v, chartHeight, maxVal)} x2={chartWidth} y2={yPos(v, chartHeight, maxVal)} stroke={colors.borderSubtle} strokeWidth="0.3" />
            );
          })}

          {/* Planned line (dashed) */}
          <path d={plannedPath} fill="none" stroke={colors.textTertiary} strokeWidth="0.8" strokeDasharray="2 2" opacity={0.5} />

          {/* Actual area fill */}
          <path d={actualFill} fill={`${colors.primaryOrange}12`} />

          {/* Actual line */}
          <path d={actualPath} fill="none" stroke={colors.primaryOrange} strokeWidth="1.2" strokeLinecap="round" />

          {/* Data points */}
          {cashFlowData.map((d, i) => (
            <React.Fragment key={i}>
              {d.actual !== null && (
                <circle
                  cx={i * stepX}
                  cy={yPos(d.actual, chartHeight, maxVal)}
                  r={hovered === i ? 2.5 : 1.5}
                  fill={colors.primaryOrange}
                  stroke={colors.surfaceRaised}
                  strokeWidth="0.8"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: 'pointer' }}
                />
              )}
            </React.Fragment>
          ))}

          {/* X labels */}
          {cashFlowData.filter((_, i) => i % 3 === 0).map((d) => {
            const idx = cashFlowData.indexOf(d);
            return (
              <text key={d.month} x={idx * stepX} y={chartHeight + 14} textAnchor="middle" fill={colors.textTertiary} fontSize="5" fontFamily={typography.fontFamily}>
                {d.month}
              </text>
            );
          })}
        </svg>

        {/* Hover tooltip */}
        {hovered !== null && cashFlowData[hovered].actual !== null && (
          <div
            style={{
              position: 'absolute',
              left: `${(hovered / (cashFlowData.length - 1)) * 100}%`,
              top: 0,
              transform: 'translateX(-50%)',
              padding: `${spacing['1']} ${spacing['2']}`,
              backgroundColor: colors.surfaceRaised,
              borderRadius: borderRadius.sm,
              boxShadow: shadows.cardHover,
              whiteSpace: 'nowrap',
              fontSize: typography.fontSize.caption,
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            <span style={{ fontWeight: typography.fontWeight.semibold }}>${cashFlowData[hovered].actual}M</span>
            <span style={{ color: colors.textTertiary }}> / ${cashFlowData[hovered].planned}M planned</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: spacing['4'], marginTop: spacing['2'], paddingTop: spacing['2'], borderTop: `1px solid ${colors.borderSubtle}` }}>
        <div>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Burn Rate</span>
          <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{burnRate}</p>
        </div>
        <div>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Contingency</span>
          <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusActive, margin: 0 }}>{contingencyRemaining}</p>
        </div>
      </div>
    </div>
  );
});
