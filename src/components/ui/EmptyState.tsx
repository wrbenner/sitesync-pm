/**
 * EmptyState — the "nothing yet" surface.
 *
 * Two variants:
 *
 *   variant="icon" (default, back-compat)
 *     The original Lucide-icon-in-orange-circle shape used across ~50 pages.
 *
 *   variant="editorial"
 *     The branded typographic shape — serif headline, OrangeDot signature,
 *     Eyebrow caption, no illustration. Use this for the hero empty states
 *     on demo pages where "this app has a voice" matters more than the
 *     icon cue.
 *
 * Both variants share the same action / secondaryAction button layout.
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { colors, spacing, typography, borderRadius, buttonPadding } from '../../styles/theme';
import { OrangeDot } from '../atoms';

export type EmptyStateVariant = 'icon' | 'editorial';

interface EmptyStateProps {
  icon?: LucideIcon;
  /** Optional Inter caps label rendered above the title in the editorial variant. */
  eyebrow?: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  variant?: EmptyStateVariant;
}

const Actions: React.FC<{
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}> = ({ action, secondaryAction }) => {
  if (!action && !secondaryAction) return null;
  return (
    <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center', marginTop: spacing.xl }}>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            padding: buttonPadding.md,
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
            padding: buttonPadding.md,
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
  );
};

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  eyebrow,
  title,
  description,
  action,
  secondaryAction,
  variant = 'icon',
}) => {
  if (variant === 'editorial') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${spacing['16']} ${spacing.xl}`,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['2'],
            marginBottom: spacing['4'],
          }}
        >
          {eyebrow && (
            <span
              style={{
                fontFamily: typography.fontFamily,
                fontSize: '11px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                color: colors.ink3,
              }}
            >
              {eyebrow}
            </span>
          )}
          <OrangeDot size={7} haloSpread={3} />
        </div>
        <h3
          style={{
            fontFamily: typography.fontFamilySerif,
            fontSize: '32px',
            fontWeight: 400,
            color: colors.ink,
            letterSpacing: '-0.022em',
            lineHeight: 1.15,
            margin: 0,
            marginBottom: spacing['3'],
            maxWidth: 520,
            textWrap: 'balance' as React.CSSProperties['textWrap'],
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontFamily: typography.fontFamilySerif,
            fontSize: '17px',
            lineHeight: 1.55,
            color: colors.ink2,
            margin: 0,
            maxWidth: 480,
            letterSpacing: '-0.005em',
          }}
        >
          {description}
        </p>
        <Actions action={action} secondaryAction={secondaryAction} />
      </div>
    );
  }

  // Default: original icon-circle treatment (back-compat).
  return (
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
      {Icon && (
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
      )}
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
        }}
      >
        {description}
      </p>
      <Actions action={action} secondaryAction={secondaryAction} />
    </div>
  );
};

export default EmptyState;
