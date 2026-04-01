import React from 'react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
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
        width: 72,
        height: 72,
        borderRadius: borderRadius.full,
        backgroundColor: '#F3F4F6',
        marginBottom: spacing.xl,
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
    <h3
      style={{
        fontSize: typography.fontSize.title,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
        margin: 0,
        marginBottom: spacing.sm,
      }}
    >
      {title}
    </h3>
    <p
      style={{
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.normal,
        color: colors.textSecondary,
        margin: 0,
        maxWidth: '360px',
        lineHeight: 1.6,
        marginBottom: action ? spacing.xl : 0,
      }}
    >
      {description}
    </p>
    {action && (
      <button
        onClick={action.onClick}
        style={{
          padding: `${spacing.sm} ${spacing.xl}`,
          backgroundColor: colors.primaryOrange,
          color: '#FFFFFF',
          border: 'none',
          borderRadius: borderRadius.base,
          fontSize: typography.fontSize.base,
          fontWeight: typography.fontWeight.medium,
          fontFamily: typography.fontFamily,
          cursor: 'pointer',
        }}
      >
        {action.label}
      </button>
    )}
  </div>
);

export default EmptyState;
