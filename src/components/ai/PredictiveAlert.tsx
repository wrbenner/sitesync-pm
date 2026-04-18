import React from 'react';
import { AlertTriangle, Sparkles, X, Clock, ChevronRight, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import type { PredictiveAlertData } from '../../data/aiAnnotations';
import type { AIInsight } from '../../types/database';
import { useAIAnnotationStore } from '../../stores';
import { useProjectId } from '../../hooks/useProjectId';
import { useAIInsights } from '../../hooks/queries';
import { supabase } from '../../lib/supabase';

interface PredictiveAlertBannerProps {
  alert: PredictiveAlertData;
  onAction?: () => void;
}

const severityStyles: Record<string, { bg: string; border: string; icon: string }> = {
  critical: { bg: colors.statusCriticalSubtle, border: colors.statusCritical, icon: colors.statusCritical },
  warning: { bg: colors.statusPendingSubtle, border: colors.statusPending, icon: colors.statusPending },
  info: { bg: colors.statusInfoSubtle, border: colors.statusInfo, icon: colors.statusInfo },
  positive: { bg: colors.statusActiveSubtle, border: colors.statusActive, icon: colors.statusActive },
};

export const PredictiveAlertBanner: React.FC<PredictiveAlertBannerProps> = ({ alert, onAction }) => {
  const { dismissedAlerts, dismissAlert, snoozeAlert } = useAIAnnotationStore();
  const [showReasoning, setShowReasoning] = React.useState(false);

  if (dismissedAlerts.has(alert.id)) return null;

  const style = severityStyles[alert.severity] || severityStyles.info;

  return (
    <div
      style={{
        backgroundColor: style.bg,
        borderLeft: `3px solid ${style.border}`,
        borderRadius: borderRadius.md,
        padding: `${spacing['3']} ${spacing['4']}`,
        marginBottom: spacing['4'],
        animation: 'slideInUp 200ms ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'] }}>
        <AlertTriangle size={16} color={style.icon} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{alert.title}</span>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.statusReview, fontWeight: typography.fontWeight.medium }}>{alert.confidence}% confidence</span>
          </div>
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, lineHeight: typography.lineHeight.normal }}>{alert.description}</p>

          {showReasoning && (
            <div style={{ marginTop: spacing['3'], padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.overlayBlackThin, borderRadius: borderRadius.base }}>
              <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, margin: 0, marginBottom: spacing['1'], textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>AI Reasoning</p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, lineHeight: typography.lineHeight.relaxed }}>{alert.description}</p>
              <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, margin: 0, marginTop: spacing['2'], marginBottom: spacing['1'], textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Impact</p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, lineHeight: typography.lineHeight.relaxed }}>{alert.description}</p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: spacing['2'], marginTop: spacing['2'], flexWrap: 'wrap' }}>
            <button
              onClick={onAction}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['1'],
                padding: `${spacing['1']} ${spacing['3']}`,
                backgroundColor: style.border, color: colors.white, border: 'none',
                borderRadius: borderRadius.base, fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily,
                cursor: 'pointer', transition: `opacity ${transitions.instant}`,
              }}
            >
              {alert.actionLabel} <ChevronRight size={12} />
            </button>
            <button
              onClick={() => setShowReasoning(!showReasoning)}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['1'],
                padding: `${spacing['1']} ${spacing['2']}`,
                backgroundColor: 'transparent', color: colors.textTertiary, border: 'none',
                borderRadius: borderRadius.base, fontSize: typography.fontSize.caption,
                fontFamily: typography.fontFamily, cursor: 'pointer',
              }}
            >
              <HelpCircle size={12} /> {showReasoning ? 'Hide' : 'Why?'}
            </button>
            <button
              onClick={() => snoozeAlert(alert.id, 4 * 60 * 60 * 1000)}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['1'],
                padding: `${spacing['1']} ${spacing['2']}`,
                backgroundColor: 'transparent', color: colors.textTertiary, border: 'none',
                borderRadius: borderRadius.base, fontSize: typography.fontSize.caption,
                fontFamily: typography.fontFamily, cursor: 'pointer',
              }}
            >
              <Clock size={12} /> Snooze
            </button>
          </div>
        </div>

        <button
          onClick={() => dismissAlert(alert.id)}
          style={{
            width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.sm,
            cursor: 'pointer', color: colors.textTertiary, flexShrink: 0,
            transition: `color ${transitions.instant}`,
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

// ── Database Insight Banner ──────────────────────────────

const DatabaseInsightBanner: React.FC<{ insight: AIInsight }> = ({ insight }) => {
  const [dismissed, setDismissed] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  if (dismissed) return null;

  const style = severityStyles[insight.severity ?? 'info'] || severityStyles.info;

  return (
    <div
      style={{
        backgroundColor: style.bg,
        borderLeft: `3px solid ${style.border}`,
        borderRadius: borderRadius.md,
        padding: `${spacing['3']} ${spacing['4']}`,
        animation: 'slideInUp 200ms ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'] }}>
        <Sparkles size={16} color={style.icon} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            {insight.message}
          </span>

          {insight.expanded_content && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '2px',
                  marginLeft: spacing['2'],
                  backgroundColor: 'transparent', color: colors.textTertiary, border: 'none',
                  fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily,
                  cursor: 'pointer', padding: 0,
                }}
              >
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {expanded ? 'Less' : 'More'}
              </button>
              {expanded && (
                <div style={{ marginTop: spacing['2'], padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.overlayBlackThin, borderRadius: borderRadius.base }}>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, lineHeight: typography.lineHeight.relaxed }}>{insight.expanded_content}</p>
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: spacing['2'], marginTop: spacing['2'], flexWrap: 'wrap' }}>
            {insight.action_label && insight.action_link && (
              <button
                onClick={() => { window.location.hash = insight.action_link!; }}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['1'],
                  padding: `${spacing['1']} ${spacing['3']}`,
                  backgroundColor: style.border, color: colors.white, border: 'none',
                  borderRadius: borderRadius.base, fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily,
                  cursor: 'pointer', transition: `opacity ${transitions.instant}`,
                }}
              >
                {insight.action_label} <ChevronRight size={12} />
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => setDismissed(true)}
          style={{
            width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.sm,
            cursor: 'pointer', color: colors.textTertiary, flexShrink: 0,
            transition: `color ${transitions.instant}`,
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

// ── Page Insight Banners (fetches from database) ─────────

export const PageInsightBanners: React.FC<{ page: string }> = ({ page }) => {
  const projectId = useProjectId();
  const { data: insights } = useAIInsights(projectId, page);
  const queryClient = useQueryClient();
  // Unique per mount — deterministic channel names collide when the same
  // hook is used by >1 component (see usePermissions for context).
  const instanceId = React.useId();

  React.useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`ai_insights_${projectId}_${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_insights', filter: `project_id=eq.${projectId}` },
        () => { queryClient.invalidateQueries({ queryKey: ['ai_insights', projectId] }); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ai_insights', filter: `project_id=eq.${projectId}` },
        () => { queryClient.invalidateQueries({ queryKey: ['ai_insights', projectId] }); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId, queryClient, instanceId]);

  if (!insights || insights.length === 0) return null;

  // Show highest severity first
  const sorted = [...insights].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return (order[a.severity as keyof typeof order] ?? 2) - (order[b.severity as keyof typeof order] ?? 2);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginBottom: spacing['4'] }}>
      {sorted.slice(0, 2).map((insight) => (
        <DatabaseInsightBanner key={insight.id} insight={insight} />
      ))}
    </div>
  );
};
