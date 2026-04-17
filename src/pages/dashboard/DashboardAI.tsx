import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, AlertCircle, Circle, Sparkles,
} from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, focusRing } from '../../styles/theme';
import { duration, easing, easingArray } from '../../styles/animations';
import type { AIInsight } from '../../types/ai';
import type { ProjectMetrics } from './types';

// ── Severity palette ────────────────────────────────────

const SEVERITY_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  critical: { bg: colors.statusCriticalSubtle, border: colors.statusCritical, icon: colors.statusCritical },
  warning: { bg: colors.statusPendingSubtle, border: colors.statusPending, icon: colors.statusPending },
  info: { bg: colors.statusInfoSubtle, border: colors.statusInfo, icon: colors.statusInfo },
};

// ── Insight Row ─────────────────────────────────────────

const InsightRow: React.FC<{ insight: AIInsight; onClick?: () => void }> = React.memo(({ insight, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const sev = SEVERITY_COLORS[insight.severity] || SEVERITY_COLORS.info;
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      onMouseEnter={onClick ? () => setHovered(true) : undefined}
      onMouseLeave={onClick ? () => setHovered(false) : undefined}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: spacing['3'],
        padding: `${spacing['3']} ${spacing['4']}`,
        borderLeft: `3px solid ${sev.border}`,
        backgroundColor: sev.bg,
        borderRadius: borderRadius.base,
        cursor: onClick ? 'pointer' : 'default',
        transition: `transform ${duration.fast}ms ${easing.standard}, box-shadow ${duration.fast}ms ${easing.standard}`,
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        boxShadow: hovered ? shadows.cardHover : 'none',
        outline: focused ? focusRing.outline : 'none',
        outlineOffset: focusRing.outlineOffset,
      }}
    >
      <AlertCircle size={16} color={sev.icon} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0,
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
          lineHeight: typography.lineHeight.tight,
        }}>
          {insight.title}
        </p>
        <p style={{
          margin: 0,
          marginTop: spacing['1'],
          fontSize: typography.fontSize.caption,
          color: colors.textSecondary,
          lineHeight: typography.lineHeight.normal,
        }}>
          {insight.description}
        </p>
        {insight.affectedEntities && insight.affectedEntities.length > 0 && (
          <div style={{ display: 'flex', gap: spacing['1'], marginTop: spacing['2'], flexWrap: 'wrap' }}>
            {insight.affectedEntities.slice(0, 3).map((entity) => (
              <span
                key={entity.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: spacing['1'],
                  padding: `1px ${spacing['2']}`,
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.textSecondary,
                  backgroundColor: colors.surfaceInset,
                  borderRadius: borderRadius.full,
                  whiteSpace: 'nowrap',
                }}
              >
                <Circle size={6} fill={sev.border} color={sev.border} />
                {entity.name}
              </span>
            ))}
          </div>
        )}
        {insight.suggestedAction && (
          <p style={{
            margin: 0,
            marginTop: spacing['1'],
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.medium,
            color: sev.icon,
          }}>
            {insight.suggestedAction}
          </p>
        )}
      </div>
      {onClick && <ArrowRight size={14} color={colors.textTertiary} style={{ flexShrink: 0, marginTop: 2 }} />}
    </div>
  );
});
InsightRow.displayName = 'InsightRow';

// ── AI Insights Banner ──────────────────────────────────

export const AIInsightsBanner: React.FC<{ insights: AIInsight[]; navigate: (path: string) => void }> = React.memo(({ insights, navigate }) => {
  // Show real insights first; if none, show onboarding placeholders so the banner is never empty
  const realInsights = insights
    .filter((i) => !i.dismissed && !i.isPlaceholder)
    .sort((a, b) => {
      const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      return (sevOrder[a.severity] ?? 2) - (sevOrder[b.severity] ?? 2);
    })
    .slice(0, 3);

  const topInsights = realInsights.length > 0
    ? realInsights
    : insights.filter((i) => !i.dismissed).slice(0, 3);

  if (topInsights.length === 0) return null;

  const getNavigationPath = (insight: AIInsight): string | undefined => {
    const typeRoutes: Record<string, string> = {
      schedule_risk: '/schedule',
      budget_risk: '/budget',
    };
    if (typeRoutes[insight.type]) return typeRoutes[insight.type];
    const entity = insight.affectedEntities?.[0];
    if (!entity) return undefined;
    const entityRoutes: Record<string, string> = {
      rfi: '/rfis', schedule_phase: '/schedule', budget_item: '/budget',
      punch_item: '/punch-list', submittal: '/submittals', change_order: '/change-orders',
    };
    return entityRoutes[entity.type];
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.smooth / 1000, ease: easingArray.apple }}
      style={{
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.xl,
        boxShadow: shadows.card,
        marginBottom: spacing['5'],
        border: `1px solid ${colors.borderSubtle}`,
        overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['2'],
        padding: `${spacing['3']} ${spacing['4']}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
      }}>
        <div style={{
          width: 24,
          height: 24,
          borderRadius: borderRadius.full,
          background: `linear-gradient(135deg, ${colors.primaryOrange} 0%, ${colors.orangeLight} 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Sparkles size={12} color={colors.white} />
        </div>
        <p style={{
          margin: 0,
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
          flex: 1,
        }}>
          AI Project Intelligence
        </p>
        <span style={{
          fontSize: typography.fontSize.caption,
          color: colors.textTertiary,
        }}>
          {topInsights.length} active {topInsights.length === 1 ? 'alert' : 'alerts'}
        </span>
      </div>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing['2'],
        padding: spacing['3'],
      }}>
        {topInsights.map((insight) => {
          const path = getNavigationPath(insight);
          return (
            <InsightRow
              key={insight.id}
              insight={insight}
              onClick={path ? () => navigate(path) : undefined}
            />
          );
        })}
      </div>
    </motion.div>
  );
});
AIInsightsBanner.displayName = 'AIInsightsBanner';

// ── Deterministic Insights Fallback (metrics only, no AI) ──────

export const DeterministicInsightsBanner: React.FC<{
  metrics: ProjectMetrics;
  navigate: (path: string) => void;
}> = ({ metrics, navigate }) => {
  const insights: AIInsight[] = [];
  const now = new Date().toISOString();

  if ((metrics.rfis_overdue ?? 0) > 0) {
    insights.push({
      id: 'det-rfi',
      type: 'risk',
      severity: (metrics.rfis_overdue ?? 0) > 5 ? 'critical' : 'warning',
      title: `${metrics.rfis_overdue} overdue RFI${(metrics.rfis_overdue ?? 0) === 1 ? '' : 's'} need response`,
      description: 'Overdue RFIs can block field work and push the schedule. Review and respond to prevent downstream delays.',
      affectedEntities: [],
      suggestedAction: 'Open RFIs to review overdue items',
      confidence: 0.9,
      source: 'computed',
      createdAt: now,
      dismissed: false,
    });
  }

  if ((metrics.punch_open ?? 0) > 0) {
    insights.push({
      id: 'det-punch',
      type: 'action_needed',
      severity: (metrics.punch_open ?? 0) > 10 ? 'critical' : (metrics.punch_open ?? 0) > 5 ? 'warning' : 'info',
      title: `${metrics.punch_open} open punch list item${(metrics.punch_open ?? 0) === 1 ? '' : 's'} require resolution`,
      description: 'Open punch items must be cleared before substantial completion and closeout.',
      affectedEntities: [],
      suggestedAction: 'Open Punch List to review open items',
      confidence: 0.85,
      source: 'computed',
      createdAt: now,
      dismissed: false,
    });
  }

  const budgetPct = (metrics.budget_total ?? 0) > 0
    ? Math.round(((metrics.budget_spent ?? 0) / (metrics.budget_total ?? 1)) * 100)
    : 0;
  if (budgetPct > 85) {
    insights.push({
      id: 'det-budget',
      type: 'budget_risk',
      severity: budgetPct > 95 ? 'critical' : 'warning',
      title: `Budget is ${budgetPct}% utilized`,
      description: `$${Math.round((metrics.budget_spent ?? 0) / 1000).toLocaleString()}K spent of $${Math.round((metrics.budget_total ?? 0) / 1000).toLocaleString()}K total. Monitor closely and review change order exposure.`,
      affectedEntities: [],
      suggestedAction: 'Open Budget to review cost variance',
      confidence: 0.85,
      source: 'computed',
      createdAt: now,
      dismissed: false,
    });
  }

  if ((metrics.schedule_variance_days ?? 0) < 0) {
    const days = Math.abs(metrics.schedule_variance_days ?? 0);
    insights.push({
      id: 'det-schedule',
      type: 'schedule_risk',
      severity: days > 14 ? 'critical' : days > 7 ? 'warning' : 'info',
      title: `Schedule is ${days} day${days === 1 ? '' : 's'} behind`,
      description: 'Schedule delays cascade into downstream trades. Review the critical path and consider acceleration strategies.',
      affectedEntities: [],
      suggestedAction: 'Open Schedule to review impacted phases',
      confidence: 0.85,
      source: 'computed',
      createdAt: now,
      dismissed: false,
    });
  }

  if (insights.length === 0) return null;

  return <AIInsightsBanner insights={insights} navigate={navigate} />;
};
