import React, { useState, useEffect } from 'react';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';

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
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIsMobile(window.innerWidth < 768), 150);
    };
    window.addEventListener('resize', handleResize);
    return () => { clearTimeout(timer); window.removeEventListener('resize', handleResize); };
  }, []);

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
    <div
      role="img"
      aria-label="Contract value waterfall chart showing original contract, approved changes, pending changes, and revised contract total"
      style={{ overflowX: isMobile ? 'visible' : 'auto', minWidth: isMobile ? 0 : 280 }}
    >
      <div style={{ width: '100%', padding: `${spacing['4']} 0`, minHeight: isMobile ? 320 : undefined }}>
        {isMobile ? (
          /* Mobile: horizontal bars stacked vertically */
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            {bars.map(bar => {
              const barWidthPct = maxVal > 0 ? (Math.abs(bar.value) / maxVal) * 100 : 0;
              const offsetPct = maxVal > 0 ? (bar.cumStart / maxVal) * 100 : 0;
              const isCO = bar.label === 'Approved COs' || bar.label === 'Pending COs';
              const isHovered = hoveredBar === bar.label;
              return (
                <div key={bar.label} style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], minHeight: 56 }}>
                  {/* Label */}
                  <div style={{ width: 90, flexShrink: 0 }}>
                    <span style={{
                      fontSize: typography.fontSize.sm,
                      color: bar.isTotal ? colors.textSecondary : colors.textTertiary,
                      fontWeight: bar.isTotal ? typography.fontWeight.semibold : typography.fontWeight.normal,
                    }}>
                      {bar.label}
                    </span>
                  </div>
                  {/* Bar track */}
                  <div style={{ flex: 1, position: 'relative', height: 44, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.sm }}>
                    <div
                      aria-label={`${bar.label}: ${fmt(bar.value)}`}
                      onMouseEnter={() => setHoveredBar(bar.label)}
                      onMouseLeave={() => setHoveredBar(null)}
                      onClick={() => setHoveredBar(hoveredBar === bar.label ? null : bar.label)}
                      style={{
                        position: 'absolute',
                        left: `${offsetPct}%`,
                        width: `${barWidthPct}%`,
                        height: '100%',
                        backgroundColor: bar.isTotal ? bar.color : `${bar.color}CC`,
                        borderRadius: borderRadius.sm,
                        transition: 'width 0.3s ease',
                        cursor: isCO ? 'pointer' : 'default',
                      }}
                    />
                    {/* Mobile tooltip */}
                    {isHovered && (
                      <div style={{
                        position: 'absolute',
                        top: -44,
                        left: `${offsetPct + barWidthPct / 2}%`,
                        transform: 'translateX(-50%)',
                        backgroundColor: '#ffffff',
                        boxShadow: shadows.dropdown,
                        borderRadius: borderRadius.md,
                        padding: spacing['2'],
                        fontSize: typography.fontSize.xs,
                        zIndex: 10,
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                      }}>
                        <div style={{ color: bar.color }}>{bar.value >= 0 ? '+' : ''}{fmt(bar.value)}</div>
                        {!bar.isTotal && (
                          <div style={{ color: colors.textTertiary }}>
                            {((Math.abs(bar.value) / originalContract) * 100).toFixed(1)}% of original
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Value label to the right */}
                  <div style={{ width: 56, flexShrink: 0, textAlign: 'right' }}>
                    <span style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: bar.isTotal ? colors.textPrimary : bar.color }}>
                      {bar.value >= 0 ? '+' : ''}{fmt(bar.value)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
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

                const isCO = bar.label === 'Approved COs' || bar.label === 'Pending COs';
                const isHovered = hoveredBar === bar.label;

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
                    {/* Tooltip */}
                    {isHovered && (
                      <div style={{
                        position: 'absolute',
                        bottom: bottomOffset + barHeight + 8,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#ffffff',
                        boxShadow: shadows.dropdown,
                        borderRadius: borderRadius.md,
                        padding: spacing['2'],
                        fontSize: typography.fontSize.sm,
                        zIndex: 10,
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                      }}>
                        <div style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: 2 }}>{bar.label}</div>
                        <div style={{ color: bar.color }}>{bar.value >= 0 ? '+' : ''}{fmt(bar.value)}</div>
                        {!bar.isTotal && (
                          <div style={{ color: colors.textTertiary, marginTop: 2 }}>
                            {((Math.abs(bar.value) / originalContract) * 100).toFixed(1)}% of original
                          </div>
                        )}
                      </div>
                    )}
                    {/* Bar */}
                    <div
                      aria-label={`${bar.label}: ${fmt(bar.value)}`}
                      onMouseEnter={() => setHoveredBar(bar.label)}
                      onMouseLeave={() => setHoveredBar(null)}
                      style={{
                        position: 'absolute', bottom: bottomOffset,
                        width: '100%', height: barHeight,
                        backgroundColor: bar.isTotal ? bar.color : `${bar.color}CC`,
                        borderRadius: `${borderRadius.sm} ${borderRadius.sm} 0 0`,
                        transition: 'height 0.3s ease',
                        cursor: isCO ? 'pointer' : 'default',
                      }}
                    />
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
          </>
        )}

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
