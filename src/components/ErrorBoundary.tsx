import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { colors, spacing, typography } from '../styles/theme';
import { captureException, addBreadcrumb } from '../lib/errorTracking';

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
    addBreadcrumb('Error boundary caught error', 'error', { message: error.message });
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback != null) {
        return <>{this.props.fallback}</>;
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
            backgroundColor: colors.bgLight,
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
              SiteSync AI
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
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
