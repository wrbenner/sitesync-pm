import React, { useState } from 'react';
import { WifiOff, RefreshCw, Check, AlertTriangle, Cloud, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';

export const OfflineBanner: React.FC = () => {
  const {
    isOnline,
    syncState,
    pendingChanges,
    conflictCount,
    lastSynced,
    syncProgress,
    cacheProgress,
    sync,
  } = useOfflineStatus();
  const [expanded, setExpanded] = useState(false);

  const isSyncing = syncState === 'syncing';
  const isCaching = syncState === 'caching';
  const hasConflicts = conflictCount > 0;
  const hasPending = pendingChanges > 0;

  // Don't show banner when online, idle, with nothing pending
  if (isOnline && !isSyncing && !isCaching && !hasPending && !hasConflicts) return null;

  // Determine banner state
  let config: { bg: string; border: string; icon: React.ReactNode; text: string; iconColor: string };

  if (!isOnline) {
    const label = pendingChanges === 1 ? '1 change' : `${pendingChanges} changes`;
    config = {
      bg: colors.statusCriticalSubtle,
      border: colors.statusCritical,
      icon: <WifiOff size={14} />,
      text: hasPending ? `Offline. ${label} pending sync.` : 'You are offline. Changes will sync when connected.',
      iconColor: colors.statusCritical,
    };
  } else if (hasConflicts) {
    config = {
      bg: 'rgba(196, 133, 12, 0.06)',
      border: colors.statusPending,
      icon: <AlertTriangle size={14} />,
      text: `${conflictCount} sync conflict${conflictCount !== 1 ? 's' : ''} need resolution.`,
      iconColor: colors.statusPending,
    };
  } else if (isSyncing) {
    const progress = syncProgress;
    const progressText = progress ? ` (${progress.completed}/${progress.total})` : '';
    config = {
      bg: colors.statusInfoSubtle,
      border: colors.statusInfo,
      icon: <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />,
      text: `Syncing${progressText}...`,
      iconColor: colors.statusInfo,
    };
  } else if (isCaching) {
    const progress = cacheProgress;
    const progressText = progress ? ` ${progress.currentTable} (${progress.completed}/${progress.total})` : '';
    config = {
      bg: colors.statusInfoSubtle,
      border: colors.statusInfo,
      icon: <Cloud size={14} style={{ animation: 'spin 1s linear infinite' }} />,
      text: `Caching project data${progressText}...`,
      iconColor: colors.statusInfo,
    };
  } else if (hasPending) {
    config = {
      bg: colors.statusPendingSubtle,
      border: colors.statusPending,
      icon: <Clock size={14} />,
      text: `${pendingChanges} change${pendingChanges !== 1 ? 's' : ''} pending sync.`,
      iconColor: colors.statusPending,
    };
  } else {
    config = {
      bg: colors.statusActiveSubtle,
      border: colors.statusActive,
      icon: <Check size={14} />,
      text: 'All changes synced.',
      iconColor: colors.statusActive,
    };
  }

  const lastSyncedLabel = lastSynced
    ? `Last synced ${formatTimeAgo(lastSynced)}`
    : 'Never synced';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        borderBottom: `1px solid ${config.border}20`,
        backgroundColor: config.bg,
        transition: transitions.quick,
      }}
    >
      {/* Main row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['3'],
          padding: `${spacing['2']} ${spacing['4']}`,
          minHeight: '36px',
        }}
      >
        <span style={{ color: config.iconColor, display: 'flex', flexShrink: 0 }}>{config.icon}</span>
        <span style={{ flex: 1, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: typography.lineHeight.normal }}>
          {config.text}
        </span>

        {/* Last synced timestamp */}
        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, whiteSpace: 'nowrap' }}>
          {lastSyncedLabel}
        </span>

        {/* Sync Now button (visible when pending and online) */}
        {isOnline && hasPending && !isSyncing && (
          <button
            onClick={() => sync()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['1'],
              padding: `${spacing['1']} ${spacing['3']}`,
              backgroundColor: colors.primaryOrange,
              color: 'white',
              border: 'none',
              borderRadius: borderRadius.base,
              fontSize: typography.fontSize.caption,
              fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: transitions.quick,
            }}
          >
            <RefreshCw size={11} /> Sync Now
          </button>
        )}

        {/* Expand/collapse for details */}
        {(hasPending || hasConflicts) && (
          <button
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'Collapse sync details' : 'Expand sync details'}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: spacing['1'],
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: colors.textTertiary,
            }}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* Progress bar (during sync/cache) */}
      {(isSyncing || isCaching) && (
        <div style={{ height: 2, backgroundColor: `${config.border}20`, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              backgroundColor: config.iconColor,
              width: getProgressPercent(isSyncing ? syncProgress : cacheProgress),
              transition: 'width 300ms ease-out',
            }}
          />
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            padding: `${spacing['2']} ${spacing['4']} ${spacing['3']}`,
            borderTop: `1px solid ${config.border}10`,
            fontSize: typography.fontSize.caption,
            color: colors.textTertiary,
          }}
        >
          {hasPending && (
            <div style={{ marginBottom: spacing['1'] }}>
              {pendingChanges} pending mutation{pendingChanges !== 1 ? 's' : ''} in queue
            </div>
          )}
          {hasConflicts && (
            <div style={{ color: colors.statusPending }}>
              {conflictCount} conflict{conflictCount !== 1 ? 's' : ''} require manual resolution
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Compact sync indicator for TopBar ────────────────────

export const SyncStatusDot: React.FC = () => {
  const { isOnline, syncState, pendingChanges, conflictCount } = useOfflineStatus();
  const totalIssues = pendingChanges + conflictCount;

  if (isOnline && syncState === 'idle' && totalIssues === 0) return null;

  const dotColor = !isOnline
    ? colors.statusCritical
    : syncState === 'syncing'
      ? colors.statusInfo
      : conflictCount > 0
        ? colors.statusPending
        : pendingChanges > 0
          ? colors.statusPending
          : colors.statusActive;

  const isAnimated = !isOnline || syncState === 'syncing';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: dotColor,
          animation: isAnimated ? 'pulse 2s infinite' : 'none',
        }}
      />
      {totalIssues > 0 && (
        <span
          style={{
            fontSize: '10px',
            fontWeight: typography.fontWeight.semibold,
            color: dotColor,
            backgroundColor: `${dotColor}14`,
            padding: '0 4px',
            borderRadius: borderRadius.full,
            minWidth: '16px',
            textAlign: 'center',
          }}
        >
          {totalIssues}
        </span>
      )}
    </div>
  );
};

// ── SyncStatusIndicator (per-item) ───────────────────────

export type ItemSyncStatus = 'synced' | 'pending' | 'conflict';

export const SyncStatusIndicator: React.FC<{ status: ItemSyncStatus; size?: number }> = ({
  status,
  size = 12,
}) => {
  const config = {
    synced: { color: colors.statusActive, icon: Check, label: 'Synced' },
    pending: { color: colors.statusPending, icon: Clock, label: 'Pending sync' },
    conflict: { color: colors.statusCritical, icon: AlertTriangle, label: 'Sync conflict' },
  }[status];

  const Icon = config.icon;

  return (
    <span
      title={config.label}
      aria-label={config.label}
      style={{ display: 'inline-flex', color: config.color }}
    >
      <Icon size={size} />
    </span>
  );
};

// ── Helpers ──────────────────────────────────────────────

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

function getProgressPercent(
  progress: { total: number; completed: number } | null
): string {
  if (!progress || progress.total === 0) return '0%';
  return `${Math.round((progress.completed / progress.total) * 100)}%`;
}
