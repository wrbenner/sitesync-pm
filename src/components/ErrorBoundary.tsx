import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { colors, spacing, typography } from '../styles/theme';
import { captureException, addBreadcrumb } from '../lib/errorTracking';

interface Props {
  children: React.ReactNode;
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
  }

  render() {
    if (this.state.hasError) {
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
              An unexpected error occurred. Try refreshing the page.
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
              window.location.reload();
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
