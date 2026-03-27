import React from 'react';
import { AlertTriangle, X, Clock, ChevronRight, HelpCircle } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import type { PredictiveAlertData } from '../../data/aiAnnotations';
import { useAIAnnotationStore } from '../../stores';

interface PredictiveAlertBannerProps {
  alert: PredictiveAlertData;
  onAction?: () => void;
}

const severityStyles: Record<string, { bg: string; border: string; icon: string }> = {
  critical: { bg: 'rgba(201, 59, 59, 0.05)', border: colors.statusCritical, icon: colors.statusCritical },
  warning: { bg: 'rgba(196, 133, 12, 0.05)', border: colors.statusPending, icon: colors.statusPending },
  info: { bg: 'rgba(58, 123, 200, 0.05)', border: colors.statusInfo, icon: colors.statusInfo },
  positive: { bg: 'rgba(45, 138, 110, 0.05)', border: colors.statusActive, icon: colors.statusActive },
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
            <div style={{ marginTop: spacing['3'], padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: borderRadius.base }}>
              <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, margin: 0, marginBottom: spacing['1'], textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>AI Reasoning</p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, lineHeight: typography.lineHeight.relaxed }}>{alert.reasoning}</p>
              <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, margin: 0, marginTop: spacing['2'], marginBottom: spacing['1'], textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Impact</p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, lineHeight: typography.lineHeight.relaxed }}>{alert.impact}</p>
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
