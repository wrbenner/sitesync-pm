import React, { useState, useCallback } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { supabase } from '../../lib/supabase';
import { EntityPresence } from './PresenceBar';
import { usePresenceStore } from '../../stores/presenceStore';
import { Btn } from '../Primitives';

// ── Optimistic Lock Check ──────────────────────────────────

interface UseOptimisticLockReturn {
  checkConflict: () => Promise<boolean>;
  conflictDetected: boolean;
  serverUpdatedAt: string | null;
  dismissConflict: () => void;
}

export function useOptimisticLock(
  table: string,
  entityId: string | undefined,
  lastKnownUpdatedAt: string | undefined,
): UseOptimisticLockReturn {
  const [conflictDetected, setConflictDetected] = useState(false);
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null);

  const checkConflict = useCallback(async () => {
    if (!entityId || !lastKnownUpdatedAt) return false;

    const { data, error } = await (supabase.from(table as any) as any)
      .select('updated_at')
      .eq('id', entityId)
      .single();

    if (error || !data) return false;

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

  return { checkConflict, conflictDetected, serverUpdatedAt, dismissConflict };
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
      backgroundColor: `${colors.statusInfo}08`,
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
