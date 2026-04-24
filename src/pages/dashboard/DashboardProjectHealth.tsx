import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import type { ProjectMetrics } from '../../types/api';

// ────────────────────────────────────────────────────────────────
// Project Health — 0-100 unified score
// Breakdown: CPI sub × SPI sub × Safety sub × Punch resolution
// Each sub-score is 0-100; final is the geometric-ish mean (arithmetic for UX).
// ────────────────────────────────────────────────────────────────

interface Props {
  metrics: ProjectMetrics | undefined;
  onClick?: () => void;
}

interface SubScore {
  key: 'cpi' | 'spi' | 'safety' | 'punch';
  label: string;
  value: number; // 0-100
  context: string;
}

function computeSubScores(m: ProjectMetrics | undefined): SubScore[] {
  if (!m) return [];

  // CPI sub-score — budget health. 100 when under budget, penalize overage.
  let cpi = 100;
  let cpiCtx = 'No budget set';
  if (m.budget_total > 0) {
    const spent = Math.max(0, m.budget_spent);
    const pct = (spent / m.budget_total) * 100;
    if (pct <= 100) {
      cpi = Math.max(0, Math.round(100 - Math.max(0, pct - 80) * 2));
      cpiCtx = `${Math.round(pct)}% spent`;
    } else {
      cpi = Math.max(0, Math.round(100 - (pct - 100) * 2));
      cpiCtx = `${Math.round(pct - 100)}% over`;
    }
  }

  // SPI sub-score — schedule health derived from variance days.
  let spi = 100;
  let spiCtx = 'On track';
  const v = m.schedule_variance_days;
  if (v != null) {
    if (v >= 0) {
      spi = 100;
      spiCtx = v === 0 ? 'On track' : `${v}d ahead`;
    } else {
      const behind = Math.abs(v);
      spi = Math.max(0, 100 - behind * 2);
      spiCtx = `${behind}d behind`;
    }
  }

  // Safety sub-score — lower incident count = higher score.
  const incidents = m.safety_incidents_this_month ?? 0;
  const safety = Math.max(0, 100 - incidents * 15);
  const safetyCtx = incidents === 0 ? 'No incidents' : `${incidents} incident${incidents === 1 ? '' : 's'}`;

  // Punch resolution sub-score.
  let punch = 100;
  let punchCtx = 'All clear';
  const total = m.punch_total ?? 0;
  const open = m.punch_open ?? 0;
  if (total > 0) {
    const resolved = total - open;
    punch = Math.round((resolved / total) * 100);
    punchCtx = `${resolved}/${total} resolved`;
  }

  return [
    { key: 'cpi', label: 'Cost', value: cpi, context: cpiCtx },
    { key: 'spi', label: 'Schedule', value: spi, context: spiCtx },
    { key: 'safety', label: 'Safety', value: safety, context: safetyCtx },
    { key: 'punch', label: 'Quality', value: punch, context: punchCtx },
  ];
}

function scoreColor(score: number): string {
  if (score >= 80) return colors.statusActive;
  if (score >= 60) return colors.statusPending;
  return colors.statusCritical;
}

export const DashboardProjectHealth: React.FC<Props> = ({ metrics, onClick }) => {
  const subs = useMemo(() => computeSubScores(metrics), [metrics]);
  const unified = useMemo(() => {
    if (subs.length === 0) return 0;
    return Math.round(subs.reduce((s, sub) => s + sub.value, 0) / subs.length);
  }, [subs]);

  const mainColor = scoreColor(unified);
  const healthLabel = unified >= 80 ? 'Healthy' : unified >= 60 ? 'Watch' : 'At risk';

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{
        width: '100%',
        padding: spacing['5'],
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.xl,
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
        fontFamily: typography.fontFamily,
        display: 'flex',
        alignItems: 'stretch',
        gap: spacing['6'],
        transition: 'transform 0.2s ease, border-color 0.15s ease',
      }}
      onMouseEnter={onClick ? (e) => { e.currentTarget.style.borderColor = 'var(--color-borderDefault)'; } : undefined}
      onMouseLeave={onClick ? (e) => { e.currentTarget.style.borderColor = 'var(--color-borderSubtle)'; } : undefined}
    >
      {/* Left: unified score */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: '0 0 auto', minWidth: 140 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
          <Activity size={12} color={colors.textTertiary} />
          <span style={{ fontSize: '11px', fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Project Health
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing['1'] }}>
          <motion.span
            key={unified}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{ fontSize: '40px', fontWeight: typography.fontWeight.bold, color: mainColor, lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}
          >
            {unified}
          </motion.span>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>/ 100</span>
        </div>
        <span style={{ fontSize: '11px', color: mainColor, fontWeight: typography.fontWeight.semibold, marginTop: spacing['1.5'], textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {healthLabel}
        </span>
      </div>

      {/* Right: breakdown bars */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], alignItems: 'center' }}>
        {subs.map((sub) => {
          const c = scoreColor(sub.value);
          return (
            <div key={sub.key} style={{ display: 'flex', flexDirection: 'column', gap: spacing['1.5'] }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing['2'] }}>
                <span style={{ fontSize: '10px', fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {sub.label}
                </span>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: c, fontVariantNumeric: 'tabular-nums' }}>
                  {sub.value}
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceInset, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${sub.value}%` }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                  style={{ height: '100%', backgroundColor: c, borderRadius: 2 }}
                />
              </div>
              <span style={{ fontSize: '10px', color: colors.textTertiary, lineHeight: 1.3 }}>
                {sub.context}
              </span>
            </div>
          );
        })}
      </div>
    </button>
  );
};

DashboardProjectHealth.displayName = 'DashboardProjectHealth';
