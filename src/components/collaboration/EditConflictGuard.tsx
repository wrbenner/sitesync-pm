import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, RefreshCw, X, Lock } from 'lucide-react';
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
}

export function useOptimisticLock(
  table: string,
  entityId: string | undefined,
  lastKnownUpdatedAt: string | undefined,
): UseOptimisticLockReturn {
  const [conflictDetected, setConflictDetected] = useState(false);
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);

  const checkConflict = useCallback(async () => {
    if (!entityId || !lastKnownUpdatedAt) return false;

    const { data, error } = await (supabase.from(table as any) as any)
      .select('updated_at')
      .eq('id', entityId)
      .single();

    if (error || !data) {
      useUiStore.getState().addToast({
        type: 'error',
        title: 'Conflict check failed',
        message: 'Could not verify if someone else edited this item. Save blocked until verification succeeds. Please retry.',
      });
      setCheckFailed(true);
      return true;
    }

    setCheckFailed(false);
    const serverTime = data.updated_at;
    if (serverTime && serverTime !== lastKnownUpdatedAt) {
      setConflictDetected(true);
      setServerUpdatedAt(serverTime);
      return true;
    }
    return false;
  }, [table, entityId, lastKnownUpdatedAt]);

  const dismissConflict = useCallback(() => {
    setConflictDetected(false);
    setServerUpdatedAt(null);
  }, []);

  return { checkConflict, conflictDetected, serverUpdatedAt, dismissConflict, checkFailed };
}

// ── Conflict Warning Banner ────────────────────────────────

interface ConflictBannerProps {
  entityId: string;
  onRefresh: () => void;
  onDismiss: () => void;
}

export const ConflictBanner: React.FC<ConflictBannerProps> = ({ onRefresh, onDismiss }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: spacing['3'],
    padding: `${spacing['3']} ${spacing['4']}`,
    backgroundColor: colors.statusPendingSubtle,
    borderRadius: borderRadius.md,
    borderLeft: `3px solid ${colors.statusPending}`,
    marginBottom: spacing['3'],
  }}>
    <AlertTriangle size={16} color={colors.statusPending} style={{ flexShrink: 0 }} />
    <div style={{ flex: 1 }}>
      <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
        This item was updated by someone else
      </p>
      <p style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, margin: `${spacing['1']} 0 0` }}>
        Your changes may overwrite their edits. Refresh to see the latest version.
      </p>
    </div>
    <Btn variant="secondary" size="sm" icon={<RefreshCw size={13} />} onClick={onRefresh}>Refresh</Btn>
    <button onClick={onDismiss} style={{ padding: spacing['1'], backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: colors.textTertiary }}>
      <X size={14} />
    </button>
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
