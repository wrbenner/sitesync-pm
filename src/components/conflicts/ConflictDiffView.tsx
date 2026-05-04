// ── ConflictDiffView ───────────────────────────────────────────────────────
// Side-by-side per-field conflict resolver. The viewer's offline-queued
// mutation collided with a server change; we show every changed field
// with mine/theirs/manual lanes and let the user resolve each one.
//
// This is a sibling to the existing src/components/ui/ConflictResolution
// Modal — the spec calls out that we wrap the legacy modal with a new
// diff view rather than replacing it.
//
// Public API:
//   <ConflictDiffView
//     entityLabel="RFI #047"
//     fields={[{ field: 'description', mine: '…', theirs: '…' }, …]}
//     onResolve={(resolved) => …}
//     onCancel={() => …}
//   />

import React, { useMemo, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { colors, spacing, typography } from '../../styles/theme';
import { FieldResolutionRow, type ResolutionPick } from './FieldResolutionRow';

export interface ConflictField {
  field: string;
  label?: string;
  mine: string | null | undefined;
  theirs: string | null | undefined;
  baseline?: string | null;
  mineAuthor?: string;
  theirsAuthor?: string;
}

interface Props {
  entityLabel: string;
  fields: ReadonlyArray<ConflictField>;
  onResolve: (resolved: Record<string, string | null>) => void;
  onCancel: () => void;
  /** Optional audit-trail snippet rendered above the rows. */
  auditTrail?: ReadonlyArray<{ when: string; who: string; what: string }>;
}

interface RowState {
  pick: ResolutionPick;
  manualValue?: string;
}

export const ConflictDiffView: React.FC<Props> = ({
  entityLabel, fields, onResolve, onCancel, auditTrail,
}) => {
  // Default each row to "theirs" — the safer default (don't overwrite the
  // server). The viewer can flip individually.
  const [picks, setPicks] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    for (const f of fields) init[f.field] = { pick: 'theirs' };
    return init;
  });

  const conflictCount = useMemo(
    () => fields.filter((f) => (f.mine ?? '') !== (f.theirs ?? '')).length,
    [fields],
  );

  const allResolved = fields
    .filter((f) => (f.mine ?? '') !== (f.theirs ?? ''))
    .every((f) => {
      const r = picks[f.field];
      if (!r) return false;
      if (r.pick === 'manual') return (r.manualValue ?? '').length > 0;
      return true;
    });

  const submit = () => {
    const resolved: Record<string, string | null> = {};
    for (const f of fields) {
      const r = picks[f.field] ?? { pick: 'theirs' as const };
      const value =
        r.pick === 'mine' ? (f.mine ?? null)
        : r.pick === 'theirs' ? (f.theirs ?? null)
        : (r.manualValue ?? '');
      resolved[f.field] = value;
    }
    onResolve(resolved);
  };

  return (
    <div
      role="dialog"
      aria-label={`Resolve conflicts on ${entityLabel}`}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1300, padding: spacing['4'],
      }}
    >
      <div
        style={{
          width: 'min(1100px, 100%)', maxHeight: '90vh',
          background: colors.surfacePage,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          display: 'flex', flexDirection: 'column',
        }}
      >
        <header
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: spacing['3'],
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold }}>
              Resolve conflicts — {entityLabel}
            </h2>
            <p style={{ margin: 0, marginTop: 4, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
              {conflictCount} field{conflictCount === 1 ? '' : 's'} changed since you started editing. Pick a side per field, or merge manually.
            </p>
          </div>
          <button onClick={onCancel} aria-label="Cancel" style={iconBtn}>
            <X size={14} />
          </button>
        </header>

        {auditTrail && auditTrail.length > 0 && (
          <div
            style={{
              padding: spacing['2'],
              background: colors.surfaceInset,
              borderBottom: `1px solid ${colors.borderSubtle}`,
              fontSize: typography.fontSize.label,
              color: colors.textSecondary,
            }}
          >
            <strong>Recent changes:</strong>
            <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
              {auditTrail.slice(0, 5).map((a, i) => (
                <li key={i}>
                  {new Date(a.when).toLocaleString()} — {a.who}: {a.what}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ overflow: 'auto', flex: 1, padding: spacing['2'] }}>
          {fields.map((f) => (
            <FieldResolutionRow
              key={f.field}
              field={f.field}
              label={f.label}
              mine={f.mine}
              theirs={f.theirs}
              baseline={f.baseline}
              mineAuthor={f.mineAuthor}
              theirsAuthor={f.theirsAuthor}
              pick={picks[f.field]?.pick ?? 'theirs'}
              manualValue={picks[f.field]?.manualValue}
              onChange={(next) => setPicks((cur) => ({ ...cur, [f.field]: next }))}
            />
          ))}
        </div>

        <footer
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: spacing['3'],
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <span style={{ fontSize: typography.fontSize.label, color: colors.textSecondary }}>
            {allResolved ? 'All conflicts resolved.' : 'Pick a resolution for each conflicting field.'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onCancel} style={ghostBtn}>Cancel</button>
            <button
              onClick={submit}
              disabled={!allResolved}
              style={{ ...primaryBtn, opacity: allResolved ? 1 : 0.5, cursor: allResolved ? 'pointer' : 'not-allowed' }}
            >
              <CheckCircle2 size={12} /> Save resolution
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

const iconBtn: React.CSSProperties = { padding: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textSecondary };
const primaryBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 14px', border: 'none', borderRadius: 6, background: colors.primaryOrange, color: 'white', fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.sm };
const ghostBtn: React.CSSProperties = { padding: '6px 14px', border: `1px solid ${colors.border}`, borderRadius: 6, background: 'transparent', cursor: 'pointer', fontSize: typography.fontSize.sm };

export default ConflictDiffView;
