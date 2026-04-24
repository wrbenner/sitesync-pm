import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../styles/theme';

// ────────────────────────────────────────────────────────────────
// PageErrorFallback — friendly page-level error UI rendered when
// a route-level <ErrorBoundary> catches. Shows Reload + Go Home.
// Passed in via <ErrorBoundary fallback={<PageErrorFallback />}>.
// ────────────────────────────────────────────────────────────────

interface Props {
  /** Optional override for the body message. */
  message?: string;
  /** Override for the Reload action. Defaults to window.location.reload(). */
  onReload?: () => void;
  /** Route to navigate to for the "Go Home" action. Defaults to "/". */
  homeHref?: string;
}

export const PageErrorFallback: React.FC<Props> = ({
  message = 'An unexpected error occurred while loading this page. Your data is safe.',
  onReload,
  homeHref = '/',
}) => (
  <div
    role="alert"
    aria-live="assertive"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '70vh',
      padding: spacing['8'],
      backgroundColor: colors.surfacePage,
    }}
  >
    <div
      style={{
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.xl,
        padding: spacing['8'],
        maxWidth: 440,
        width: '100%',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: spacing['5'],
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          backgroundColor: colors.statusCriticalSubtle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AlertTriangle size={28} color={colors.statusCritical} aria-hidden="true" />
      </div>
      <div>
        <h2
          style={{
            margin: 0,
            marginBottom: spacing['2'],
            fontSize: typography.fontSize.heading,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
            letterSpacing: '-0.02em',
          }}
        >
          Something went wrong on this page
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: typography.fontSize.body,
            color: colors.textSecondary,
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
      </div>
      <div style={{ display: 'flex', gap: spacing['2'], width: '100%' }}>
        <button
          onClick={onReload ?? (() => window.location.reload())}
          style={{
            flex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing['2'],
            padding: `${spacing['3']} ${spacing['4']}`,
            backgroundColor: colors.primaryOrange,
            color: colors.white,
            border: 'none',
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.body,
            fontWeight: typography.fontWeight.semibold,
            fontFamily: typography.fontFamily,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Reload
        </button>
        <a
          href={homeHref}
          style={{
            flex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing['2'],
            padding: `${spacing['3']} ${spacing['4']}`,
            backgroundColor: 'transparent',
            color: colors.textPrimary,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.body,
            fontWeight: typography.fontWeight.semibold,
            fontFamily: typography.fontFamily,
            textDecoration: 'none',
          }}
        >
          <Home size={16} aria-hidden="true" />
          Go Home
        </a>
      </div>
    </div>
  </div>
);

PageErrorFallback.displayName = 'PageErrorFallback';
