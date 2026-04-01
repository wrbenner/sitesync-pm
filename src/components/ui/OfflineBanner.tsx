import React, { useState, useEffect, useRef } from 'react';
import { WifiOff, RefreshCw, Check, AlertTriangle, Cloud, Clock, ChevronDown, ChevronUp, X } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import { getPendingMutations, retryMutation, type PendingMutation } from '../../lib/offlineDb';

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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const prevHadActivity = useRef(false);

  const isSyncing = syncState === 'syncing';
  const isCaching = syncState === 'caching';
  const hasConflicts = conflictCount > 0;
  const hasPending = pendingChanges > 0;
  const hasActivity = hasPending || hasConflicts || isSyncing || isCaching;

  // Show green checkmark for 3 seconds after sync clears
  useEffect(() => {
    if (prevHadActivity.current && isOnline && !hasActivity) {
      setJustSynced(true);
      const timer = setTimeout(() => setJustSynced(false), 3000);
      prevHadActivity.current = false;
      return () => clearTimeout(timer);
    }
    if (hasActivity) prevHadActivity.current = true;
  }, [isOnline, hasActivity]);

  // Don't show banner when online, idle, with nothing pending and no just-synced flash
  if (isOnline && !isSyncing && !isCaching && !hasPending && !hasConflicts && !justSynced) return null;

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
      bg: colors.warningBannerBg,
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

        {/* View queued items */}
        {(hasPending || hasConflicts) && !isSyncing && (
          <button
            onClick={() => setSheetOpen(true)}
            style={{
              fontSize: typography.fontSize.caption,
              color: config.iconColor,
              fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: `0 ${spacing['1']}`,
              whiteSpace: 'nowrap',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
            }}
          >
            View
          </button>
        )}

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
              color: colors.white,
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

      <QueuedItemsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSyncNow={sync}
      />
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
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.semibold,
            color: dotColor,
            backgroundColor: `${dotColor}14`,
            padding: `0 ${spacing['1']}`,
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

// ── Queued Items Sheet ───────────────────────────────────

const TABLE_LABELS: Record<string, string> = {
  field_captures: 'Field capture',
  rfis: 'RFI',
  submittals: 'Submittal',
  tasks: 'Task',
  punch_items: 'Punch item',
  daily_logs: 'Daily log',
  drawings: 'Drawing',
  crews: 'Crew',
  budget_items: 'Budget item',
  change_orders: 'Change order',
  meetings: 'Meeting',
  directory_contacts: 'Contact',
  files: 'File',
  schedule_phases: 'Schedule phase',
  project_members: 'Project member',
  projects: 'Project',
};

const OP_LABELS: Record<string, string> = {
  insert: 'created',
  update: 'updated',
  delete: 'deleted',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Queued',
  syncing: 'Syncing',
  failed: 'Failed',
  conflict: 'Conflict',
};

const STATUS_COLORS: Record<string, string> = {
  pending: colors.statusPending,
  syncing: colors.statusInfo,
  failed: colors.statusCritical,
  conflict: colors.statusPending,
};

function formatMutationLabel(m: PendingMutation): string {
  const table = TABLE_LABELS[m.table] ?? m.table;
  const op = OP_LABELS[m.operation] ?? m.operation;
  return `${table} ${op}`;
}

function formatMutationTime(created_at: string): string {
  const seconds = Math.floor((Date.now() - new Date(created_at).getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

const QueuedItemsSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  onSyncNow: () => void;
}> = ({ open, onClose, onSyncNow }) => {
  const [mutations, setMutations] = useState<PendingMutation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getPendingMutations().then((m) => {
        setMutations(m);
        setLoading(false);
      });
    }
  }, [open]);

  const handleRetry = async (id: number) => {
    await retryMutation(id);
    setMutations((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: 'pending' as const, retryCount: 0 } : m))
    );
    onSyncNow();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          zIndex: 1000,
        }}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Queued changes"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0,
          backgroundColor: colors.surfaceRaised,
          borderRadius: `${borderRadius.xl} ${borderRadius.xl} 0 0`,
          boxShadow: shadows.elevated,
          zIndex: 1001,
          maxHeight: '70vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: `${spacing['2']} 0` }}>
          <div style={{
            width: 36, height: 4,
            borderRadius: borderRadius.full,
            backgroundColor: colors.borderSubtle,
          }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${spacing['1']} ${spacing['4']} ${spacing['3']}`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
        }}>
          <span style={{
            fontSize: typography.fontSize.title,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
          }}>
            Queued Changes
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              borderRadius: borderRadius.full,
              color: colors.textSecondary,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{
              padding: spacing['6'], textAlign: 'center',
              color: colors.textTertiary, fontSize: typography.fontSize.sm,
            }}>
              Loading...
            </div>
          ) : mutations.length === 0 ? (
            <div style={{
              padding: spacing['6'], textAlign: 'center',
              color: colors.textTertiary, fontSize: typography.fontSize.sm,
            }}>
              No queued changes
            </div>
          ) : (
            mutations.map((m) => {
              const statusColor = STATUS_COLORS[m.status] ?? colors.textTertiary;
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: spacing['3'],
                    padding: `${spacing['3']} ${spacing['4']}`,
                    borderBottom: `1px solid ${colors.borderSubtle}`,
                  }}
                >
                  {/* Status dot */}
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    backgroundColor: statusColor, flexShrink: 0,
                  }} />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.medium,
                      color: colors.textPrimary,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {formatMutationLabel(m)}
                    </div>
                    <div style={{
                      fontSize: typography.fontSize.caption,
                      color: colors.textTertiary,
                      marginTop: 2,
                    }}>
                      {formatMutationTime(m.created_at)}
                      {' · '}
                      <span style={{ color: statusColor }}>
                        {STATUS_LABELS[m.status] ?? m.status}
                        {m.status === 'failed' ? ` (attempt ${m.retryCount})` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Retry button for permanently failed items */}
                  {m.status === 'failed' && m.id != null && (
                    <button
                      onClick={() => handleRetry(m.id!)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: spacing['1'],
                        padding: `${spacing['1']} ${spacing['3']}`,
                        backgroundColor: colors.primaryOrange,
                        color: colors.white,
                        border: 'none', borderRadius: borderRadius.base,
                        fontSize: typography.fontSize.caption,
                        fontWeight: typography.fontWeight.semibold,
                        fontFamily: typography.fontFamily,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <RefreshCw size={11} /> Retry
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};
