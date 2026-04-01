import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Check, X, ArrowLeft, ArrowRight, GitMerge, Layers } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, zIndex, transitions } from '../../styles/theme';
import {
  getConflicts,
  resolveMutationConflict,
  type PendingMutation,
} from '../../lib/offlineDb';
import { buildMergedRecord } from '../../lib/conflictResolver';
import { syncManager } from '../../lib/syncManager';

interface ConflictResolutionModalProps {
  open: boolean;
  onClose: () => void;
}

type FieldChoice = 'local' | 'server';

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({ open, onClose }) => {
  const [conflicts, setConflicts] = useState<PendingMutation[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolving, setResolving] = useState(false);
  // Per-field resolution choices for the current conflict
  const [fieldChoices, setFieldChoices] = useState<Record<string, FieldChoice>>({});

  useEffect(() => {
    if (open) {
      getConflicts().then(setConflicts);
    }
  }, [open]);

  const current = conflicts[currentIndex];

  // Reset field choices whenever the displayed conflict changes
  useEffect(() => {
    if (!current) return;
    const conflictingFields = current.conflict_conflicting_fields ?? [];
    const initial: Record<string, FieldChoice> = {};
    for (const f of conflictingFields) {
      initial[f] = 'local'; // default: prefer your own changes
    }
    setFieldChoices(initial);
  }, [currentIndex, current?.id]);

  const advanceOrClose = useCallback(
    (resolved: PendingMutation[]) => {
      if (resolved.length === 0) {
        onClose();
        syncManager.sync();
      } else {
        setCurrentIndex((i) => Math.min(i, resolved.length - 1));
      }
    },
    [onClose]
  );

  const removeCurrentAndAdvance = useCallback(
    (id: number) => {
      const remaining = conflicts.filter((c) => c.id !== id);
      setConflicts(remaining);
      advanceOrClose(remaining);
    },
    [conflicts, advanceOrClose]
  );

  const handleKeepServer = async () => {
    if (!current?.id) return;
    setResolving(true);
    await resolveMutationConflict(current.id, 'keep_server');
    await syncManager.refreshCounts();
    removeCurrentAndAdvance(current.id);
    setResolving(false);
  };

  const handleKeepLocal = async () => {
    if (!current?.id) return;
    setResolving(true);
    await resolveMutationConflict(current.id, 'keep_local');
    await syncManager.refreshCounts();
    removeCurrentAndAdvance(current.id);
    setResolving(false);
  };

  const handleMerge = async () => {
    if (!current?.id) return;
    setResolving(true);

    const base = current.conflict_base_data ?? {};
    const local = current.data;
    const server = current.conflict_server_data ?? {};
    const merged = buildMergedRecord(base, local, server, fieldChoices);

    await resolveMutationConflict(current.id, 'use_merged', merged);
    await syncManager.refreshCounts();
    removeCurrentAndAdvance(current.id);
    setResolving(false);
  };

  if (!open || conflicts.length === 0) return null;
  if (!current) return null;

  const localData = current.data;
  const serverData = current.conflict_server_data ?? {};
  const baseData = current.conflict_base_data ?? {};
  const conflictingFields = new Set(current.conflict_conflicting_fields ?? []);

  // All fields that differ between local and server (for display)
  const allKeys = [...new Set([...Object.keys(localData), ...Object.keys(serverData)])].filter(
    (k) => k !== 'id' && k !== 'created_at' && k !== 'updated_at'
  );
  const diffKeys = allKeys.filter(
    (k) => JSON.stringify(localData[k]) !== JSON.stringify(serverData[k])
  );

  // Fields that were auto-merged (differ but not in conflictingFields)
  const autoMergedKeys = diffKeys.filter((k) => !conflictingFields.has(k));
  const trueConflictKeys = diffKeys.filter((k) => conflictingFields.has(k));

  const hasConflictingFields = trueConflictKeys.length > 0;

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
          width: '720px',
          maxWidth: '92vw',
          maxHeight: '85vh',
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
              {' '}&mdash; <strong style={{ color: colors.textSecondary }}>{current.table}</strong>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ padding: spacing['1'], background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: spacing['5'], flex: 1, overflow: 'auto' }}>
          <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing['4'] }}>
            This record was edited on the server while you were offline. Review each field and choose which version to keep.
          </div>

          {/* True conflicts: per-field toggle */}
          {trueConflictKeys.length > 0 && (
            <>
              <SectionHeading
                icon={<AlertTriangle size={13} color={colors.statusPending} />}
                label="Fields needing your decision"
                color={colors.statusPending}
              />
              <div style={{
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: borderRadius.md,
                overflow: 'hidden',
                marginBottom: spacing['4'],
              }}>
                <ColumnHeaders localLabel="Your changes" serverLabel="Changes from server" showToggle />
                {trueConflictKeys.map((key, i) => (
                  <ConflictRow
                    key={key}
                    fieldName={key}
                    localValue={localData[key]}
                    serverValue={serverData[key]}
                    baseValue={baseData[key]}
                    choice={fieldChoices[key] ?? 'local'}
                    onChoose={(choice) => setFieldChoices((prev) => ({ ...prev, [key]: choice }))}
                    isLast={i === trueConflictKeys.length - 1}
                    showToggle
                  />
                ))}
              </div>
            </>
          )}

          {/* Auto-merged: informational only */}
          {autoMergedKeys.length > 0 && (
            <>
              <SectionHeading
                icon={<GitMerge size={13} color={colors.statusSuccess} />}
                label="Auto-merged (no action needed)"
                color={colors.statusSuccess}
              />
              <div style={{
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: borderRadius.md,
                overflow: 'hidden',
                marginBottom: spacing['4'],
                opacity: 0.8,
              }}>
                <ColumnHeaders localLabel="Your changes" serverLabel="Server version" showToggle={false} />
                {autoMergedKeys.map((key, i) => {
                  // Determine which side changed to show the correct "winner"
                  const localChanged = JSON.stringify(localData[key]) !== JSON.stringify(baseData[key]);
                  return (
                    <ConflictRow
                      key={key}
                      fieldName={key}
                      localValue={localData[key]}
                      serverValue={serverData[key]}
                      baseValue={baseData[key]}
                      choice={localChanged ? 'local' : 'server'}
                      onChoose={() => {}}
                      isLast={i === autoMergedKeys.length - 1}
                      showToggle={false}
                      autoMerged
                    />
                  );
                })}
              </div>
            </>
          )}

          {diffKeys.length === 0 && (
            <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, textAlign: 'center', padding: spacing['6'] }}>
              No field differences found. This conflict can be safely dismissed.
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${spacing['3']} ${spacing['5']}`,
            borderTop: `1px solid ${colors.borderSubtle}`,
            backgroundColor: colors.surfaceInset,
            gap: spacing['3'],
            flexWrap: 'wrap',
          }}
        >
          {/* Pagination */}
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
          <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap', marginLeft: 'auto' }}>
            <button
              onClick={handleKeepServer}
              disabled={resolving}
              style={secondaryBtnStyle(resolving)}
            >
              <Layers size={14} /> Accept All Theirs
            </button>
            <button
              onClick={handleKeepLocal}
              disabled={resolving}
              style={secondaryBtnStyle(resolving)}
            >
              <Check size={14} /> Accept All Mine
            </button>
            {hasConflictingFields && (
              <button
                onClick={handleMerge}
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
                <GitMerge size={14} /> Merge
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Sub-components ───────────────────────────────────────

interface SectionHeadingProps {
  icon: React.ReactNode;
  label: string;
  color: string;
}

const SectionHeading: React.FC<SectionHeadingProps> = ({ icon, label, color }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: spacing['1.5'],
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.semibold,
    color,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: 'uppercase' as const,
    marginBottom: spacing['2'],
  }}>
    {icon}
    {label}
  </div>
);

interface ColumnHeadersProps {
  localLabel: string;
  serverLabel: string;
  showToggle: boolean;
}

const ColumnHeaders: React.FC<ColumnHeadersProps> = ({ localLabel, serverLabel, showToggle }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: showToggle ? '130px 1fr 1fr 72px' : '130px 1fr 1fr',
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
      {localLabel}
    </div>
    <div style={{ padding: `${spacing['2']} ${spacing['3']}`, borderLeft: `1px solid ${colors.borderDefault}` }}>
      {serverLabel}
    </div>
    {showToggle && (
      <div style={{ padding: `${spacing['2']} ${spacing['3']}`, borderLeft: `1px solid ${colors.borderDefault}`, textAlign: 'center' }}>
        Keep
      </div>
    )}
  </div>
);

interface ConflictRowProps {
  fieldName: string;
  localValue: unknown;
  serverValue: unknown;
  baseValue: unknown;
  choice: FieldChoice;
  onChoose: (choice: FieldChoice) => void;
  isLast: boolean;
  showToggle: boolean;
  autoMerged?: boolean;
}

const ConflictRow: React.FC<ConflictRowProps> = ({
  fieldName,
  localValue,
  serverValue,
  choice,
  onChoose,
  isLast,
  showToggle,
  autoMerged,
}) => {
  const localChosen = choice === 'local';
  const serverChosen = choice === 'server';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: showToggle ? '130px 1fr 1fr 72px' : '130px 1fr 1fr',
        borderBottom: isLast ? 'none' : `1px solid ${colors.borderSubtle}`,
        fontSize: typography.fontSize.sm,
      }}
    >
      {/* Field name */}
      <div style={{
        padding: `${spacing['2']} ${spacing['3']}`,
        color: colors.textSecondary,
        fontWeight: typography.fontWeight.medium,
        wordBreak: 'break-word',
        display: 'flex',
        alignItems: 'flex-start',
      }}>
        {fieldName}
      </div>

      {/* Local value */}
      <div
        onClick={() => showToggle && onChoose('local')}
        style={{
          padding: `${spacing['2']} ${spacing['3']}`,
          borderLeft: `1px solid ${colors.borderDefault}`,
          backgroundColor: localChosen && showToggle ? colors.statusInfoExtraSubtle : 'transparent',
          color: colors.textPrimary,
          wordBreak: 'break-word',
          cursor: showToggle ? 'pointer' : 'default',
          outline: localChosen && showToggle ? `2px solid ${colors.primaryBlue ?? '#3B82F6'}` : 'none',
          outlineOffset: '-2px',
          transition: transitions.quick,
        }}
      >
        {formatValue(localValue)}
        {autoMerged && choice === 'local' && (
          <span style={{ marginLeft: spacing['1.5'], fontSize: typography.fontSize.caption, color: colors.statusSuccess, fontWeight: typography.fontWeight.semibold }}>
            (yours wins)
          </span>
        )}
      </div>

      {/* Server value */}
      <div
        onClick={() => showToggle && onChoose('server')}
        style={{
          padding: `${spacing['2']} ${spacing['3']}`,
          borderLeft: `1px solid ${colors.borderDefault}`,
          backgroundColor: serverChosen && showToggle ? colors.statusActiveExtraSubtle : 'transparent',
          color: colors.textPrimary,
          wordBreak: 'break-word',
          cursor: showToggle ? 'pointer' : 'default',
          outline: serverChosen && showToggle ? `2px solid ${colors.primaryOrange}` : 'none',
          outlineOffset: '-2px',
          transition: transitions.quick,
        }}
      >
        {formatValue(serverValue)}
        {autoMerged && choice === 'server' && (
          <span style={{ marginLeft: spacing['1.5'], fontSize: typography.fontSize.caption, color: colors.statusSuccess, fontWeight: typography.fontWeight.semibold }}>
            (server wins)
          </span>
        )}
      </div>

      {/* Toggle pill */}
      {showToggle && (
        <div style={{
          borderLeft: `1px solid ${colors.borderDefault}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing['2'],
        }}>
          <TogglePill choice={choice} onChoose={onChoose} />
        </div>
      )}
    </div>
  );
};

interface TogglePillProps {
  choice: FieldChoice;
  onChoose: (choice: FieldChoice) => void;
}

const TogglePill: React.FC<TogglePillProps> = ({ choice, onChoose }) => {
  const pillBase: React.CSSProperties = {
    display: 'inline-flex',
    padding: `2px ${spacing['1.5']}`,
    borderRadius: borderRadius.full,
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily,
    cursor: 'pointer',
    border: 'none',
    transition: transitions.quick,
    lineHeight: 1.4,
  };

  return (
    <div style={{ display: 'flex', gap: '3px' }}>
      <button
        onClick={() => onChoose('local')}
        style={{
          ...pillBase,
          backgroundColor: choice === 'local' ? '#3B82F6' : colors.surfaceInset,
          color: choice === 'local' ? colors.white : colors.textTertiary,
        }}
      >
        Mine
      </button>
      <button
        onClick={() => onChoose('server')}
        style={{
          ...pillBase,
          backgroundColor: choice === 'server' ? colors.primaryOrange : colors.surfaceInset,
          color: choice === 'server' ? colors.white : colors.textTertiary,
        }}
      >
        Theirs
      </button>
    </div>
  );
};

// ── Style helpers ────────────────────────────────────────

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

function secondaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
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
    cursor: disabled ? 'wait' : 'pointer',
    transition: transitions.quick,
  };
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '(empty)';
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  return String(val);
}
