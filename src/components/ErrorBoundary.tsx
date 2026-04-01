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
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            textAlign: 'center',
            gap: spacing['6'],
            padding: spacing['8'],
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: colors.statusCriticalSubtle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={36} color={colors.statusCritical} />
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
                maxWidth: '400px',
              }}
            >
              {this.props.message ?? 'An unexpected error occurred. Try refreshing the page.'}
            </p>
            {this.state.error && (
              <p
                style={{
                  fontSize: typography.fontSize.sm,
                  color: colors.textTertiary,
                  margin: 0,
                  marginTop: spacing['3'],
                  fontFamily: 'monospace',
                }}
              >
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onRetry) {
                this.props.onRetry();
              } else {
                window.location.reload();
              }
            }}
            style={{
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
      );
    }

    return this.props.children;
  }
}
