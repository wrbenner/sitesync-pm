import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { captureException, addBreadcrumb } from '../lib/errorTracking';
import Sentry from '../lib/sentry';

interface Props {
  children: React.ReactNode;
  /** Override the default error message shown to the user */
  message?: string;
  /** Called when the retry button is clicked. Defaults to window.location.reload(). */
  onRetry?: () => void;
  /** Custom fallback node. When provided, overrides the default error UI. */
  fallback?: React.ReactNode;
  /** Called after the error is captured, with the error and errorInfo. */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    captureException(error, {
      action: 'react_error_boundary',
      extra: { componentStack: errorInfo.componentStack || '' },
    });
    // Mirror the error directly to Sentry so consumers wiring <ErrorBoundary onError>
    // see the same event that ships to our monitoring backend.
    Sentry.captureException(error, {
      tags: { component: 'ErrorBoundary' },
      extra: { componentStack: errorInfo.componentStack || '' },
    });
    addBreadcrumb('Error boundary caught error', 'error', { message: error.message });
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback != null) {
        return <>{this.props.fallback}</>;
      }

      const errorMsg = this.state.error?.message ?? '';
      const isChunkError =
        errorMsg.includes('Loading chunk') ||
        errorMsg.includes('dynamically imported module') ||
        errorMsg.includes('Failed to fetch');

      if (isChunkError) {
        return (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100vh',
              padding: spacing.lg,
              backgroundColor: colors.surfaceFlat,
            }}
          >
            <div
              style={{
                backgroundColor: colors.white,
                borderRadius: borderRadius.lg,
                padding: spacing.lg,
                maxWidth: '480px',
                width: '100%',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: spacing.lg,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  backgroundColor: colors.surfaceInset,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RefreshCw size={28} color={colors.primaryOrange} />
              </div>
              <div>
                <h1
                  style={{
                    fontSize: typography.fontSize.heading,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.textPrimary,
                    margin: 0,
                    marginBottom: spacing['2'],
                  }}
                >
                  Page failed to load
                </h1>
                <p
                  style={{
                    fontSize: typography.fontSize.body,
                    color: colors.textSecondary,
                    margin: 0,
                  }}
                >
                  A new version may be available. Click below to reload.
                </p>
              </div>
              <button
                onClick={() => window.location.reload()}
                style={{
                  width: '100%',
                  padding: `${spacing['3']} ${spacing['6']}`,
                  backgroundColor: colors.primaryOrange,
                  color: colors.white,
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: typography.fontSize.body,
                  fontWeight: typography.fontWeight.medium,
                  fontFamily: typography.fontFamily,
                  cursor: 'pointer',
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        );
      }

      return (
        <div
          aria-live="assertive"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: spacing['8'],
            backgroundColor: colors.surfaceFlat,
          }}
        >
          <div
            style={{
              backgroundColor: colors.white,
              borderRadius: '12px',
              padding: '48px',
              maxWidth: '480px',
              width: '100%',
              margin: 'auto',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: spacing['6'],
            }}
          >
            <div
              style={{
                fontSize: '24px',
                fontWeight: typography.fontWeight.bold,
                color: colors.primaryOrange,
                letterSpacing: '-0.5px',
              }}
            >
              SiteSync PM
            </div>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                backgroundColor: colors.statusCriticalSubtle,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={32} color={colors.statusCritical} />
            </div>
            <div>
              <h1
                style={{
                  fontSize: typography.fontSize.heading,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary,
                  margin: 0,
                  marginBottom: spacing['2'],
                }}
              >
                Something went wrong
              </h1>
              <p
                style={{
                  fontSize: typography.fontSize.body,
                  color: colors.textSecondary,
                  margin: 0,
                }}
              >
                {this.props.message ?? 'An unexpected error occurred. Your data is safe.'}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['3'], width: '100%' }}>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  this.props.onRetry?.();
                }}
                style={{
                  width: '100%',
                  padding: `${spacing['3']} ${spacing['6']}`,
                  backgroundColor: colors.primaryOrange,
                  color: colors.white,
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: typography.fontSize.body,
                  fontWeight: typography.fontWeight.medium,
                  fontFamily: typography.fontFamily,
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  width: '100%',
                  padding: `${spacing['3']} ${spacing['6']}`,
                  backgroundColor: 'transparent',
                  color: colors.textSecondary,
                  border: `1px solid ${colors.borderLight}`,
                  borderRadius: '6px',
                  fontSize: typography.fontSize.body,
                  fontWeight: typography.fontWeight.medium,
                  fontFamily: typography.fontFamily,
                  cursor: 'pointer',
                }}
              >
                Reload Page
              </button>
              <a
                href="/"
                style={{
                  fontSize: typography.fontSize.body,
                  color: colors.textSecondary,
                  textDecoration: 'none',
                }}
              >
                Go to Dashboard
              </a>
            </div>
            {import.meta.env.DEV && this.state.error && (
              <pre
                tabIndex={0}
                role="region"
                aria-label="Error details and stack trace"
                style={{
                  fontSize: 12,
                  maxHeight: 240,
                  overflow: 'auto',
                  textAlign: 'left',
                  padding: 16,
                  width: '100%',
                  backgroundColor: colors.surfaceInset,
                  borderRadius: 6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: colors.textPrimary,
                }}
              >
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
