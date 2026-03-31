import React from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';

interface AIActionCardProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  severity?: 'critical' | 'warning' | 'info';
}

const severityBorders: Record<string, string> = {
  critical: colors.statusCritical,
  warning: colors.statusPending,
  info: colors.statusInfo,
};

export const AIActionCard: React.FC<AIActionCardProps> = ({ title, description, actionLabel, onAction, severity = 'info' }) => {
  return (
    <div
      style={{
        backgroundColor: `${colors.primaryOrange}06`,
        border: `1px solid ${colors.primaryOrange}20`,
        borderLeft: `3px solid ${severityBorders[severity] || colors.primaryOrange}`,
        borderRadius: borderRadius.md,
        padding: `${spacing['3']} ${spacing['4']}`,
        marginTop: spacing['2'],
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
        <Sparkles size={12} color={colors.primaryOrange} />
        <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.orangeText, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Suggested Action</span>
      </div>
      <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>{title}</p>
      <p style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, margin: 0, marginTop: spacing['1'], lineHeight: typography.lineHeight.normal }}>{description}</p>
      <button
        onClick={onAction}
        style={{
          display: 'flex', alignItems: 'center', gap: spacing['1'],
          marginTop: spacing['2'], padding: `${spacing['1']} ${spacing['3']}`,
          backgroundColor: colors.primaryOrange, color: 'white', border: 'none',
          borderRadius: borderRadius.base, fontSize: typography.fontSize.caption,
          fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily,
          cursor: 'pointer', transition: `opacity ${transitions.instant}`,
        }}
      >
        {actionLabel} <ChevronRight size={12} />
      </button>
    </div>
  );
};
