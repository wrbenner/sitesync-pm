/**
 * ErrorState — canonical error surface for any async failure.
 *
 * Mirrors EmptyState's shape so swapping between empty/error/loaded
 * states inside <PageState> doesn't shift the layout. Always renders
 * a retry CTA when onRetry is provided; falls back to a static message
 * when the caller has no recovery action.
 *
 * The rust accent (not orange) signals "something went wrong" without
 * stealing the orange surveyor's mark, which is reserved for
 * primary attention and brand signature placements.
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { colors, spacing, typography, borderRadius, buttonPadding } from '../../styles/theme';

export interface ErrorStateProps {
  /** Headline. Defaults to "Something went wrong." */
  title?: string;
  /** Body copy. Defaults to a generic retry-friendly message. */
  description?: string;
  /** Raw error object — used only for the optional [Details] disclosure. */
  error?: unknown;
  /** Retry callback. When omitted, no CTA is rendered. */
  onRetry?: () => void;
  /** Optional secondary action (e.g., "Contact support"). */
  secondaryAction?: { label: string; onClick: () => void };
}

function extractMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const msg = (error as { message: unknown }).message;
    if (typeof msg === 'string') return msg;
  }
  return undefined;
}

const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong.',
  description = 'We couldn’t load this just now. The data is still safe — please try again.',
  error,
  onRetry,
  secondaryAction,
}) => {
  const detail = extractMessage(error);
  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${spacing['16']} ${spacing['6']}`,
        textAlign: 'center',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 64,
          height: 64,
          borderRadius: borderRadius.full,
          backgroundColor: 'rgba(184, 71, 46, 0.08)',
          marginBottom: spacing['5'],
          flexShrink: 0,
        }}
      >
        <AlertCircle size={32} color={colors.rust} strokeWidth={1.5} />
      </div>
      <h3
        style={{
          fontFamily: typography.fontFamilySerif,
          fontSize: '24px',
          fontWeight: 400,
          color: colors.ink,
          letterSpacing: '-0.018em',
          lineHeight: 1.2,
          margin: 0,
          marginBottom: spacing['2'],
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: typography.fontFamily,
          fontSize: typography.fontSize.body,
          fontWeight: typography.fontWeight.normal,
          color: colors.textSecondary,
          margin: 0,
          maxWidth: 380,
          lineHeight: 1.6,
          marginBottom: onRetry || secondaryAction ? spacing['5'] : 0,
        }}
      >
        {description}
      </p>
      {(onRetry || secondaryAction) && (
        <div style={{ display: 'flex', gap: spacing['3'], alignItems: 'center' }}>
          {onRetry && (
            <button
              onClick={onRetry}
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
              Try again
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              style={{
                padding: buttonPadding.md,
                backgroundColor: 'transparent',
                color: colors.textSecondary,
                border: `1px solid ${colors.borderDefault}`,
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
      {detail && (
        <details
          style={{
            marginTop: spacing['5'],
            fontFamily: typography.fontFamilyMono,
            fontSize: typography.fontSize.caption,
            color: colors.textTertiary,
            maxWidth: 520,
          }}
        >
          <summary style={{ cursor: 'pointer', userSelect: 'none' }}>Details</summary>
          <pre
            style={{
              marginTop: spacing['2'],
              padding: spacing['3'],
              backgroundColor: colors.surfaceInset,
              borderRadius: borderRadius.sm,
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 200,
              overflow: 'auto',
            }}
          >
            {detail}
          </pre>
        </details>
      )}
    </div>
  );
};

export default ErrorState;
