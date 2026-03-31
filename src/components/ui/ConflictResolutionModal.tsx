import React, { useState, useEffect } from 'react';
import { AlertTriangle, Check, X, ArrowLeft, ArrowRight } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, zIndex, transitions } from '../../styles/theme';
import { getConflicts, resolveMutationConflict, type PendingMutation } from '../../lib/offlineDb';
import { syncManager } from '../../lib/syncManager';

interface ConflictResolutionModalProps {
  open: boolean;
  onClose: () => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({ open, onClose }) => {
  const [conflicts, setConflicts] = useState<PendingMutation[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (open) {
      getConflicts().then(setConflicts);
    }
  }, [open]);

  if (!open || conflicts.length === 0) return null;

  const current = conflicts[currentIndex];
  if (!current) return null;

  const localData = current.data;
  const serverData = current.conflict_server_data || {};

  // Find fields that differ
  const allKeys = [...new Set([...Object.keys(localData), ...Object.keys(serverData)])].filter(
    (k) => k !== 'id' && k !== 'created_at' && k !== 'updated_at'
  );
  const diffKeys = allKeys.filter((k) => JSON.stringify(localData[k]) !== JSON.stringify(serverData[k]));

  const handleResolve = async (resolution: 'keep_local' | 'keep_server') => {
    if (!current.id) return;
    setResolving(true);
    await resolveMutationConflict(current.id, resolution);
    await syncManager.refreshCounts();

    const remaining = conflicts.filter((c) => c.id !== current.id);
    setConflicts(remaining);

    if (remaining.length === 0) {
      onClose();
      // Trigger sync for any re-queued items
      syncManager.sync();
    } else {
      setCurrentIndex(Math.min(currentIndex, remaining.length - 1));
    }
    setResolving(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: zIndex.modal,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.overlayDark,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '600px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.xl,
          boxShadow: shadows.panel,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['3'],
            padding: `${spacing['4']} ${spacing['5']}`,
            borderBottom: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <AlertTriangle size={18} color={colors.statusPending} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Sync Conflict
            </div>
            <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, marginTop: spacing['0.5'] }}>
              {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} to resolve
              {conflicts.length > 1 && ` (${currentIndex + 1} of ${conflicts.length})`}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ padding: spacing['1'], background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Conflict info */}
        <div style={{ padding: spacing['5'], flex: 1, overflow: 'auto' }}>
          <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing['4'] }}>
            <strong>{current.table}</strong> was updated on the server while you were offline.
            Choose which version to keep.
          </div>

          {/* Comparison table */}
          <div style={{ border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, overflow: 'hidden' }}>
            {/* Header row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr 1fr',
                backgroundColor: colors.surfaceInset,
                borderBottom: `1px solid ${colors.borderDefault}`,
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textTertiary,
                letterSpacing: typography.letterSpacing.wider,
                textTransform: 'uppercase' as const,
              }}
            >
              <div style={{ padding: `${spacing['2']} ${spacing['3']}` }}>Field</div>
              <div style={{ padding: `${spacing['2']} ${spacing['3']}`, borderLeft: `1px solid ${colors.borderDefault}` }}>
                Your Version
              </div>
              <div style={{ padding: `${spacing['2']} ${spacing['3']}`, borderLeft: `1px solid ${colors.borderDefault}` }}>
                Server Version
              </div>
            </div>

            {/* Diff rows */}
            {diffKeys.map((key) => (
              <div
                key={key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr 1fr',
                  borderBottom: `1px solid ${colors.borderSubtle}`,
                  fontSize: typography.fontSize.sm,
                }}
              >
                <div
                  style={{
                    padding: `${spacing['2']} ${spacing['3']}`,
                    color: colors.textSecondary,
                    fontWeight: typography.fontWeight.medium,
                    wordBreak: 'break-word',
                  }}
                >
                  {key}
                </div>
                <div
                  style={{
                    padding: `${spacing['2']} ${spacing['3']}`,
                    borderLeft: `1px solid ${colors.borderDefault}`,
                    backgroundColor: colors.statusInfoExtraSubtle,
                    color: colors.textPrimary,
                    wordBreak: 'break-word',
                  }}
                >
                  {formatValue(localData[key])}
                </div>
                <div
                  style={{
                    padding: `${spacing['2']} ${spacing['3']}`,
                    borderLeft: `1px solid ${colors.borderDefault}`,
                    backgroundColor: colors.statusActiveExtraSubtle,
                    color: colors.textPrimary,
                    wordBreak: 'break-word',
                  }}
                >
                  {formatValue(serverData[key])}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${spacing['3']} ${spacing['5']}`,
            borderTop: `1px solid ${colors.borderSubtle}`,
            backgroundColor: colors.surfaceInset,
          }}
        >
          {/* Navigation */}
          <div style={{ display: 'flex', gap: spacing['2'] }}>
            {conflicts.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                  style={{ ...navBtnStyle, opacity: currentIndex === 0 ? 0.4 : 1 }}
                >
                  <ArrowLeft size={14} /> Prev
                </button>
                <button
                  onClick={() => setCurrentIndex(Math.min(conflicts.length - 1, currentIndex + 1))}
                  disabled={currentIndex === conflicts.length - 1}
                  style={{ ...navBtnStyle, opacity: currentIndex === conflicts.length - 1 ? 0.4 : 1 }}
                >
                  Next <ArrowRight size={14} />
                </button>
              </>
            )}
          </div>

          {/* Resolution buttons */}
          <div style={{ display: 'flex', gap: spacing['2'] }}>
            <button
              onClick={() => handleResolve('keep_server')}
              disabled={resolving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `${spacing['2']} ${spacing['4']}`,
                backgroundColor: 'transparent',
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: borderRadius.base,
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.medium,
                fontFamily: typography.fontFamily,
                color: colors.textSecondary,
                cursor: resolving ? 'wait' : 'pointer',
                transition: transitions.quick,
              }}
            >
              <Check size={14} /> Keep Server
            </button>
            <button
              onClick={() => handleResolve('keep_local')}
              disabled={resolving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `${spacing['2']} ${spacing['4']}`,
                backgroundColor: colors.primaryOrange,
                border: 'none',
                borderRadius: borderRadius.base,
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.semibold,
                fontFamily: typography.fontFamily,
                color: colors.white,
                cursor: resolving ? 'wait' : 'pointer',
                transition: transitions.quick,
              }}
            >
              <Check size={14} /> Keep Mine
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const navBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing['1'],
  padding: `${spacing['1']} ${spacing['2']}`,
  backgroundColor: 'transparent',
  border: `1px solid ${colors.borderDefault}`,
  borderRadius: borderRadius.sm,
  fontSize: typography.fontSize.caption,
  fontFamily: typography.fontFamily,
  color: colors.textTertiary,
  cursor: 'pointer',
};

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '(empty)';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}
