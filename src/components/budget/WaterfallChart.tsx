import React from 'react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

interface WaterfallChartProps {
  originalContract: number;
  approvedCOs: number;
  pendingCOs: number;
  rejectedCOs?: number;
}

const fmt = (n: number): string => {
  if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};

export const WaterfallChart: React.FC<WaterfallChartProps> = ({
  originalContract, approvedCOs, pendingCOs,
}) => {
  const revisedContract = originalContract + approvedCOs;
  const maxVal = Math.max(originalContract, revisedContract, originalContract + approvedCOs + pendingCOs) * 1.1;

  const bars: { label: string; value: number; cumStart: number; color: string; isTotal?: boolean }[] = [
    { label: 'Original Contract', value: originalContract, cumStart: 0, color: colors.statusInfo, isTotal: true },
    { label: 'Approved COs', value: approvedCOs, cumStart: originalContract, color: colors.statusActive },
    { label: 'Pending COs', value: pendingCOs, cumStart: originalContract + approvedCOs, color: colors.statusPending },
    { label: 'Revised Contract', value: revisedContract, cumStart: 0, color: colors.primaryOrange, isTotal: true },
  ];

  const chartHeight = 200;
  const barGap = 12;

  return (
    <div style={{ overflowX: 'auto', minWidth: 280 }}>
      <div style={{ width: '100%', padding: `${spacing['4']} 0` }}>
        {/* Value labels row */}
        <div style={{ display: 'flex', gap: barGap, marginBottom: spacing['2'] }}>
          {bars.map(bar => (
            <div key={bar.label} style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center' }}>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: bar.isTotal ? colors.textPrimary : bar.color }}>
                {bar.value >= 0 ? '+' : ''}{fmt(bar.value)}
              </span>
            </div>
          ))}
        </div>

        {/* Chart area */}
        <div style={{ position: 'relative', height: chartHeight, display: 'flex', gap: barGap }}>
          {bars.map(bar => {
            const barHeight = maxVal > 0 ? (Math.abs(bar.value) / maxVal) * chartHeight : 0;
            const bottomOffset = maxVal > 0 ? (bar.cumStart / maxVal) * chartHeight : 0;

            return (
              <div key={bar.label} style={{ flex: '1 1 0', minWidth: 0, position: 'relative', height: '100%' }}>
                {/* Connector line (for non-totals) */}
                {!bar.isTotal && (
                  <div style={{
                    position: 'absolute', bottom: bottomOffset + barHeight,
                    left: `-${barGap}px`, width: `${barGap}px`,
                    height: 1, backgroundColor: colors.borderDefault,
                    borderTop: `1px dashed ${colors.textTertiary}`,
                  }} />
                )}
                {/* Bar */}
                <div style={{
                  position: 'absolute', bottom: bottomOffset,
                  width: '100%', height: barHeight,
                  backgroundColor: bar.isTotal ? bar.color : `${bar.color}CC`,
                  borderRadius: `${borderRadius.sm} ${borderRadius.sm} 0 0`,
                  transition: 'height 0.3s ease',
                }} />
              </div>
            );
          })}
        </div>

        {/* X-axis labels */}
        <div style={{ display: 'flex', gap: barGap, marginTop: spacing['2'], borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: spacing['2'] }}>
          {bars.map(bar => (
            <div key={bar.label} style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center' }}>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontWeight: bar.isTotal ? typography.fontWeight.semibold : typography.fontWeight.normal }}>
                {bar.label}
              </span>
            </div>
          ))}
        </div>

        {/* Summary line */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing['4'], padding: `${spacing['3']} ${spacing['4']}`, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md }}>
          <div>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Original</span>
            <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: `${spacing['1']} 0 0` }}>{fmt(originalContract)}</p>
          </div>
          <div style={{ fontSize: typography.fontSize.subtitle, color: colors.textTertiary }}>→</div>
          <div>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.statusActive, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Approved COs</span>
            <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.statusActive, margin: `${spacing['1']} 0 0` }}>+{fmt(approvedCOs)}</p>
          </div>
          <div style={{ fontSize: typography.fontSize.subtitle, color: colors.textTertiary }}>→</div>
          <div>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.statusPending, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Pending COs</span>
            <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.statusPending, margin: `${spacing['1']} 0 0` }}>+{fmt(pendingCOs)}</p>
          </div>
          <div style={{ fontSize: typography.fontSize.subtitle, color: colors.textTertiary }}>→</div>
          <div>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.orangeText, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Revised Contract</span>
            <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.orangeText, margin: `${spacing['1']} 0 0` }}>{fmt(revisedContract)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
