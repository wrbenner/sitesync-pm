import React from 'react';
import { WifiOff, RefreshCw, Cloud, Check } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { useOfflineStore } from '../../services/offlineQueue';

export const OfflineBanner: React.FC = () => {
  const { status, queue, simulateOffline, simulateOnline } = useOfflineStore();

  if (status === 'online' && queue.length === 0) return null;

  const configs = {
    offline: {
      bg: 'rgba(201, 59, 59, 0.06)',
      border: colors.statusCritical,
      icon: <WifiOff size={14} />,
      text: `You are offline. ${queue.length} change${queue.length !== 1 ? 's' : ''} pending sync.`,
      iconColor: colors.statusCritical,
    },
    syncing: {
      bg: 'rgba(58, 123, 200, 0.06)',
      border: colors.statusInfo,
      icon: <RefreshCw size={14} style={{ animation: 'pulse 1s linear infinite' }} />,
      text: `Syncing ${queue.length} item${queue.length !== 1 ? 's' : ''}...`,
      iconColor: colors.statusInfo,
    },
    online: {
      bg: 'rgba(45, 138, 110, 0.06)',
      border: colors.statusActive,
      icon: <Check size={14} />,
      text: 'All changes synced.',
      iconColor: colors.statusActive,
    },
  };

  const config = configs[status];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['3'],
        padding: `${spacing['2']} ${spacing['4']}`,
        backgroundColor: config.bg,
        borderBottom: `1px solid ${config.border}20`,
        animation: 'slideInUp 200ms ease-out',
      }}
    >
      <span style={{ color: config.iconColor, display: 'flex' }}>{config.icon}</span>
      <span style={{ flex: 1, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
        {config.text}
      </span>

      {status === 'offline' && (
        <button
          onClick={simulateOnline}
          style={{
            display: 'flex', alignItems: 'center', gap: spacing['1'],
            padding: `${spacing['1']} ${spacing['3']}`,
            backgroundColor: colors.statusInfo, color: 'white', border: 'none',
            borderRadius: borderRadius.base, fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily,
            cursor: 'pointer',
          }}
        >
          <Cloud size={12} /> Retry Sync
        </button>
      )}

      {/* Dev controls */}
      {status === 'online' && queue.length === 0 && (
        <button
          onClick={simulateOffline}
          style={{
            padding: `${spacing['1']} ${spacing['2']}`,
            backgroundColor: 'transparent', border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.sm, fontSize: '10px', color: colors.textTertiary,
            fontFamily: typography.fontFamily, cursor: 'pointer',
          }}
        >
          Simulate Offline
        </button>
      )}
    </div>
  );
};

// Compact sync indicator for TopBar
export const SyncStatusDot: React.FC = () => {
  const { status, queue } = useOfflineStore();

  if (status === 'online' && queue.length === 0) return null;

  const dotColor = status === 'offline' ? colors.statusCritical : status === 'syncing' ? colors.statusInfo : colors.statusActive;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%', backgroundColor: dotColor,
        animation: status === 'syncing' ? 'pulse 1s infinite' : status === 'offline' ? 'pulse 2s infinite' : 'none',
      }} />
      {queue.length > 0 && (
        <span style={{
          fontSize: '10px', fontWeight: typography.fontWeight.semibold, color: dotColor,
          backgroundColor: `${dotColor}14`, padding: '0 4px', borderRadius: borderRadius.full,
          minWidth: '16px', textAlign: 'center',
        }}>
          {queue.length}
        </span>
      )}
    </div>
  );
};
