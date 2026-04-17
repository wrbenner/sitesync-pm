import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { PageContainer, Card, Btn } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

interface SyncBannerProps {
  isOnline: boolean;
  pendingCount: number;
}

export const SyncBanner: React.FC<SyncBannerProps> = ({ isOnline, pendingCount }) => {
  if (isOnline && pendingCount === 0) return null;
  return (
    <div
      aria-live="assertive"
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['2'],
        padding: spacing['3'],
        marginBottom: spacing['4'],
        backgroundColor: colors.statusPendingSubtle,
        border: `1px solid ${colors.statusPending}`,
        borderRadius: borderRadius.md,
      }}
    >
      <AlertTriangle size={16} color="#B45309" style={{ flexShrink: 0 }} />
      <span style={{ fontSize: typography.fontSize.sm, color: colors.statusPending, fontWeight: typography.fontWeight.medium }}>
        {pendingCount > 0
          ? `${pendingCount} photo${pendingCount !== 1 ? 's' : ''} pending upload`
          : 'You are offline. Photos will sync when you reconnect.'}
      </span>
    </div>
  );
};

interface ErrorStateProps {
  error: unknown;
  onRetry: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => (
  <PageContainer title="Field Capture" subtitle="Unable to load">
    <Card padding={spacing['6']}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['4'], padding: spacing['6'], textAlign: 'center' }}>
        <AlertTriangle size={40} color={colors.statusCritical} />
        <div>
          <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>
            Failed to load field captures
          </p>
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>
            {(error as Error)?.message || 'Unable to fetch captures from the field'}
          </p>
        </div>
        <Btn variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={onRetry}>
          Retry
        </Btn>
      </div>
    </Card>
  </PageContainer>
);

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = React.useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  React.useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return isOnline;
}
