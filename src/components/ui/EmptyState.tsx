import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action, secondaryAction }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: `${spacing['3xl']} ${spacing.xl}`,
      textAlign: 'center',
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 80,
        height: 80,
        borderRadius: borderRadius.full,
        backgroundColor: colors.orangeSubtle,
        marginBottom: spacing.xl,
        flexShrink: 0,
      }}
    >
      <Icon size={48} color={colors.primaryOrange} strokeWidth={1.5} />
    </div>
    <h3
      style={{
        fontSize: typography.fontSize['2xl'],
        fontWeight: 600,
        color: colors.textPrimary,
        margin: 0,
        marginBottom: spacing.sm,
      }}
    >
      {title}
    </h3>
    <p
      style={{
        fontSize: typography.fontSize.body,
        fontWeight: typography.fontWeight.normal,
        color: colors.textSecondary,
        margin: 0,
        maxWidth: '360px',
        lineHeight: 1.6,
        marginBottom: action || secondaryAction ? spacing.xl : 0,
      }}
    >
      {description}
    </p>
    {(action || secondaryAction) && (
      <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center' }}>
        {action && (
          <button
            onClick={action.onClick}
            style={{
              padding: `${spacing.sm} ${spacing.xl}`,
              backgroundColor: colors.primaryOrange,
              color: colors.white,
              border: 'none',
              borderRadius: borderRadius.base,
              fontSize: typography.fontSize.body,
              fontWeight: typography.fontWeight.medium,
              fontFamily: typography.fontFamily,
              cursor: 'pointer',
            }}
          >
            {action.label}
          </button>
        )}
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            style={{
              padding: `${spacing.sm} ${spacing.xl}`,
              backgroundColor: 'transparent',
              color: colors.textSecondary,
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.base,
              fontSize: typography.fontSize.body,
              fontWeight: typography.fontWeight.medium,
              fontFamily: typography.fontFamily,
              cursor: 'pointer',
            }}
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    )}
  </div>
);

export default EmptyState;
