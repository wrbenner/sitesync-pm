import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';
import { useProjectId } from '../../hooks/useProjectId';
import { useEarnedValueData } from '../../hooks/queries/ai-insights';
import { compactDollars } from './types';

// ── Mini Gauge ─────────────────────────────────────────

interface GaugeProps {
  label: string;
  value: number;
  format: 'ratio' | 'dollars' | 'percent';
  thresholds: { good: number; warning: number };
  inverse?: boolean; // true if lower is better (e.g., EAC — lower = on budget)
}

const MiniGauge: React.FC<GaugeProps> = ({ label, value, format, thresholds, inverse }) => {
  const displayValue = useMemo(() => {
    if (format === 'ratio') return value.toFixed(2);
    if (format === 'dollars') return compactDollars(Math.abs(value));
    if (format === 'percent') return `${Math.round(value)}%`;
    return String(value);
  }, [value, format]);

  const status = useMemo(() => {
    if (inverse) {
      // Lower is better: value <= good = green, <= warning = yellow, else red
      if (value <= thresholds.good) return 'good';
      if (value <= thresholds.warning) return 'warning';
      return 'critical';
    }
    // Higher is better: value >= good = green, >= warning = yellow, else red
    if (value >= thresholds.good) return 'good';
    if (value >= thresholds.warning) return 'warning';
    return 'critical';
  }, [value, thresholds, inverse]);

  const statusColor = status === 'good' ? colors.statusActive : status === 'warning' ? colors.statusPending : colors.statusCritical;

  const TrendIcon = value > 1.0 && format === 'ratio'
    ? TrendingUp
    : value < 1.0 && format === 'ratio'
      ? TrendingDown
      : Minus;

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{
        margin: 0,
        fontSize: typography.fontSize.caption,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
        fontWeight: typography.fontWeight.medium,
        marginBottom: spacing['2'],
      }}>
        {label}
      </p>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing['1'],
      }}>
        <span style={{
          fontSize: typography.fontSize.large,
          fontWeight: typography.fontWeight.bold,
          color: statusColor,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: typography.letterSpacing.tighter,
        }}>
          {format === 'dollars' && value < 0 ? '-' : ''}{displayValue}
        </span>
        {format === 'ratio' && (
          <TrendIcon size={14} color={statusColor} style={{ flexShrink: 0 }} />
        )}
      </div>
    </div>
  );
};

// ── Earned Value Strip ─────────────────────────────────

export const DashboardEarnedValue: React.FC = React.memo(() => {
  const projectId = useProjectId();
  const { data: ev } = useEarnedValueData(projectId);

  if (!ev || ev.BAC === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.08 }}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: spacing['4'],
        padding: `${spacing['4']} ${spacing['5']}`,
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.xl,
        border: `1px solid ${colors.borderSubtle}`,
        boxShadow: shadows.card,
        marginBottom: spacing['6'],
      }}
    >
      <MiniGauge
        label="CPI"
        value={ev.CPI}
        format="ratio"
        thresholds={{ good: 0.95, warning: 0.85 }}
      />
      <MiniGauge
        label="SPI"
        value={ev.SPI}
        format="ratio"
        thresholds={{ good: 0.95, warning: 0.85 }}
      />
      <MiniGauge
        label="EAC"
        value={ev.EAC}
        format="dollars"
        thresholds={{ good: ev.BAC * 1.05, warning: ev.BAC * 1.15 }}
        inverse
      />
      <MiniGauge
        label="Variance"
        value={ev.CV}
        format="dollars"
        thresholds={{ good: 0, warning: -ev.BAC * 0.05 }}
      />
    </motion.div>
  );
});
DashboardEarnedValue.displayName = 'DashboardEarnedValue';
