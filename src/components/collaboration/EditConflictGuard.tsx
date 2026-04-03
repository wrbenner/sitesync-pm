import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, RefreshCw, Lock } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { supabase } from '../../lib/supabase';
import { EntityPresence } from './PresenceBar';
import { usePresenceStore } from '../../stores/presenceStore';
import { useUiStore } from '../../stores';
import { Btn } from '../Primitives';
import {
  acquireEditLock,
  renewEditLock,
  releaseEditLock,
  type AcquireEditLockResult,
} from '../../api/endpoints/editLocks';

// ── Optimistic Lock Check ──────────────────────────────────

interface UseOptimisticLockReturn {
  checkConflict: () => Promise<boolean>;
  conflictDetected: boolean;
  serverUpdatedAt: string | null;
  dismissConflict: () => void;
  checkFailed: boolean;
  isChecking: boolean;
}

export function useOptimisticLock(
  table: string,
  entityId: string | undefined,
  lastKnownUpdatedAt: string | undefined,
): UseOptimisticLockReturn {
  const [conflictDetected, setConflictDetected] = useState(false);
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const retryCountRef = useRef(0);

  // Reset conflict state when the entity changes to avoid stale state from a previous entity
  useEffect(() => {
    setConflictDetected(false);
    setServerUpdatedAt(null);
    setCheckFailed(false);
  }, [entityId]);

  const checkConflict = useCallback(async () => {
    if (!table || !entityId || !lastKnownUpdatedAt) return false;

    // Reset checkFailed on each call to allow manual retry by consuming component
    setCheckFailed(false);
    retryCountRef.current = 0;
    setIsChecking(true);

    try {
      const runQuery = () =>
        (supabase.from(table as any) as any)
          .select('updated_at')
          .eq('id', entityId)
          .single();

      let { data, error } = await runQuery();

      if (error || !data) {
        const retryDelays = [500, 1500];
        while (retryCountRef.current < 2 && (error || !data)) {
          const delay = retryDelays[retryCountRef.current];
          retryCountRef.current += 1;
          await new Promise<void>((resolve) => setTimeout(resolve, delay));
          ({ data, error } = await runQuery());
        }

        if (error || !data) {
          console.warn(`[useOptimisticLock] Conflict check failed for table "${table}":`, error?.message ?? 'No data returned');
          useUiStore.getState().addToast({
            type: 'warning',
            title: 'Conflict check failed',
            message: 'Could not verify if others have edited this item. Your changes may overwrite recent updates.',
          });
          setCheckFailed(true);
          return true;
        }
      }

      setCheckFailed(false);
      const serverTime = data.updated_at;
      if (serverTime && serverTime !== lastKnownUpdatedAt) {
        setConflictDetected(true);
        setServerUpdatedAt(serverTime);
        setIsChecking(false);
        return true;
      }
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [table, entityId, lastKnownUpdatedAt]);

  const dismissConflict = useCallback(() => {
    setConflictDetected(false);
    setServerUpdatedAt(null);
  }, []);

  return { checkConflict, conflictDetected, serverUpdatedAt, dismissConflict, checkFailed, isChecking };
}

// ── Conflict Warning Banner ────────────────────────────────

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
}

interface ConflictBannerProps {
  entityId: string;
  serverUpdatedAt?: string | null;
  onReload?: () => void;
  onDismiss: () => void;
}

export const ConflictBanner: React.FC<ConflictBannerProps> = ({ serverUpdatedAt, onReload, onDismiss }) => (
  <div
    role="alert"
    aria-live="assertive"
    style={{
      display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: spacing['2'],
      padding: `${spacing['3']} ${spacing['4']}`,
      backgroundColor: colors.statusCriticalSubtle,
      borderRadius: borderRadius.md,
      borderLeft: `3px solid ${colors.statusCritical}`,
      marginBottom: spacing['3'],
    }}
  >
    <AlertTriangle size={16} color={colors.statusCritical} style={{ flexShrink: 0, marginTop: 2 }} />
    <div style={{ flex: '1 1 auto', minWidth: 200 }}>
      <p style={{
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
        margin: 0,
      }}>
        Conflict detected
      </p>
      <p style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, margin: `${spacing['1']} 0 0` }}>
        {serverUpdatedAt
          ? `This item was updated by another user ${formatRelativeTime(serverUpdatedAt)}. Your unsaved changes may conflict.`
          : 'This item was updated by another user. Your unsaved changes may conflict.'}
      </p>
    </div>
    <div style={{ display: 'flex', gap: spacing['2'], flex: '0 0 auto' }}>
      <Btn
        variant="primary"
        size="sm"
        icon={<RefreshCw size={13} />}
        onClick={() => onReload ? onReload() : window.location.reload()}
        style={{ padding: '10px 16px', minHeight: 44 }}
      >
        Reload Latest
      </Btn>
      <Btn variant="secondary" size="sm" onClick={onDismiss} style={{ padding: '10px 16px', minHeight: 44 }}>
        Keep My Edits
      </Btn>
    </div>
  </div>
);

// ── Co-editing Warning ─────────────────────────────────────

interface CoEditingWarningProps {
  entityId: string;
}

export const CoEditingWarning: React.FC<CoEditingWarningProps> = ({ entityId }) => {
  const viewers = usePresenceStore(s => s.getUsersViewingEntity(entityId));

  if (viewers.length === 0) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: spacing['2'],
      padding: `${spacing['2']} ${spacing['3']}`,
      backgroundColor: colors.statusInfoSubtle,
      borderRadius: borderRadius.md,
      borderLeft: `3px solid ${colors.statusInfo}`,
      marginBottom: spacing['3'],
    }}>
      <AlertTriangle size={14} color={colors.statusInfo} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
        {viewers.map(v => v.name).join(', ')} {viewers.length === 1 ? 'is' : 'are'} also viewing this item
      </span>
      <EntityPresence entityId={entityId} />
    </div>
  );
};

// ── Edit Lock Guard ────────────────────────────────────────
// Acquires a pessimistic lock on mount, renews every 60 seconds,
// releases on unmount, and subscribes to realtime so all sessions
// see lock state changes instantly.

export interface EditConflictGuardProps {
  entityType: string;
  entityId: string;
  userId: string;
  children: React.ReactNode;
}

export const EditConflictGuard: React.FC<EditConflictGuardProps> = ({
  entityType,
  entityId,
  userId,
  children,
}) => {
  const [lockResult, setLockResult] = useState<AcquireEditLockResult | null>(null);
  const renewRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tryAcquire = () =>
      acquireEditLock(entityType, entityId, userId)
        .then((result) => { if (!cancelled) setLockResult(result); })
        .catch(console.error);

    tryAcquire();

    // Renew every 60 s to keep the lock alive
    renewRef.current = setInterval(() => {
      renewEditLock(entityType, entityId, userId).catch(console.error);
    }, 60_000);

    // Realtime: re-evaluate lock whenever this entity's lock row changes
    const channel = supabase
      .channel(`edit_locks:${entityType}:${entityId}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'edit_locks',
          filter: `entity_id=eq.${entityId}`,
        },
        () => { tryAcquire(); },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (renewRef.current) clearInterval(renewRef.current);
      releaseEditLock(entityType, entityId, userId).catch(console.error);
      supabase.removeChannel(channel);
    };
  // Stable identity: only run on mount / when ids change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId, userId]);

  const announceAlert = useUiStore(s => s.announceAlert);
  const prevLockedRef = useRef(false);

  useEffect(() => {
    const isNowLockedByOther = lockResult?.locked === true;
    // Only announce the transition from unlocked -> locked to avoid repeated alerts
    if (isNowLockedByOther && !prevLockedRef.current) {
      const lockedByName = (lockResult as { locked: true; lockedBy: { name: string | null } }).lockedBy.name;
      announceAlert(
        lockedByName
          ? `${lockedByName} is currently editing this item`
          : 'This item is being edited by someone else',
      );
    }
    prevLockedRef.current = isNowLockedByOther;
  }, [lockResult, announceAlert]);

  const handleRequestAccess = useCallback(() => {
    // Re-attempt acquisition: signals intent to take over an expired or released lock
    acquireEditLock(entityType, entityId, userId)
      .then(setLockResult)
      .catch(console.error);
  }, [entityType, entityId, userId]);

  const isLockedByOther = lockResult?.locked === true;

  return (
    <div>
      {isLockedByOther && (
        <LockBanner
          lockedByName={(lockResult as { locked: true; lockedBy: { name: string | null } }).lockedBy.name}
          onRequestAccess={handleRequestAccess}
        />
      )}
      {children}
    </div>
  );
};

// ── Lock Banner ────────────────────────────────────────────
// Shown to the second user while another session holds the lock.

interface LockBannerProps {
  lockedByName: string | null;
  onRequestAccess: () => void;
}

const LockBanner: React.FC<LockBannerProps> = ({ lockedByName, onRequestAccess }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: spacing['3'],
    padding: `${spacing['3']} ${spacing['4']}`,
    backgroundColor: colors.statusCriticalSubtle,
    borderRadius: borderRadius.md,
    borderLeft: `3px solid ${colors.statusCritical}`,
    marginBottom: spacing['3'],
  }}>
    <Lock size={16} color={colors.statusCritical} style={{ flexShrink: 0 }} />
    <div style={{ flex: 1 }}>
      <p style={{
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
        margin: 0,
      }}>
        {lockedByName
          ? `${lockedByName} is currently editing this item`
          : 'This item is being edited by someone else'}
      </p>
      <p style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, margin: `${spacing['1']} 0 0` }}>
        Wait for them to finish or request access. The lock expires automatically after 5 minutes of inactivity.
      </p>
    </div>
    <Btn variant="secondary" size="sm" onClick={onRequestAccess}>
      Request Access
    </Btn>
  </div>
);
