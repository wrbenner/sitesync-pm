import React, { useState } from 'react';
import { DollarSign } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../../styles/theme';

interface DataPoint {
  month: string;
  planned: number;
  actual: number | null;
}

const cashFlowData: DataPoint[] = [
  { month: 'Jun 23', planned: 2.1, actual: 1.8 },
  { month: 'Sep 23', planned: 6.5, actual: 6.2 },
  { month: 'Dec 23', planned: 12.0, actual: 11.4 },
  { month: 'Mar 24', planned: 18.0, actual: 17.8 },
  { month: 'Jun 24', planned: 24.5, actual: 24.1 },
  { month: 'Sep 24', planned: 30.0, actual: 28.9 },
  { month: 'Dec 24', planned: 35.5, actual: 34.2 },
  { month: 'Mar 25', planned: 40.0, actual: 38.5 },
  { month: 'Jun 25', planned: 43.5, actual: null },
  { month: 'Sep 25', planned: 46.0, actual: null },
  { month: 'Dec 25', planned: 47.5, actual: null },
];

const maxVal = 50;

function yPos(val: number, height: number): number {
  return height - (val / maxVal) * height;
}

export const CashFlowWidget: React.FC = () => {
  const [hovered, setHovered] = useState<number | null>(null);

  const chartWidth = 100; // percentage
  const chartHeight = 140;
  const stepX = chartWidth / (cashFlowData.length - 1);

  const plannedPath = cashFlowData
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${yPos(d.planned, chartHeight)}`)
    .join(' ');

  const actualPoints = cashFlowData.filter((d) => d.actual !== null);
  const actualPath = actualPoints
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${cashFlowData.indexOf(d) * stepX} ${yPos(d.actual!, chartHeight)}`)
    .join(' ');

  // Fill under actual
  const actualFill = actualPath + ` L ${cashFlowData.indexOf(actualPoints[actualPoints.length - 1]) * stepX} ${chartHeight} L 0 ${chartHeight} Z`;

  const burnRate = '$1.2M/week';
  const contingencyRemaining = '$3.8M';

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
          {[10, 20, 30, 40].map((v) => (
            <line key={v} x1={0} y1={yPos(v, chartHeight)} x2={chartWidth} y2={yPos(v, chartHeight)} stroke={colors.borderSubtle} strokeWidth="0.3" />
          ))}

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
                  cy={yPos(d.actual, chartHeight)}
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
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
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
};
