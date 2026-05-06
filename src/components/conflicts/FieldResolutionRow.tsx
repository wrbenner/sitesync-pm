// ── FieldResolutionRow ─────────────────────────────────────────────────────
// Single-field row inside ConflictDiffView. Shows mine / theirs side-by-
// side and the user picks one (or types a manual merge in a third lane).

import React, { useState } from 'react';
import { colors, spacing, typography } from '../../styles/theme';

export type ResolutionPick = 'mine' | 'theirs' | 'manual';

interface Props {
  field: string;
  /** Display label (defaults to field). */
  label?: string;
  /** The viewer's local value at queue time. */
  mine: string | null | undefined;
  /** The server's value when the conflict was detected. */
  theirs: string | null | undefined;
  /** Optional baseline value (the version the viewer started from). */
  baseline?: string | null;
  /** Optional change-author hints rendered above each side. */
  mineAuthor?: string;
  theirsAuthor?: string;
  /** Currently selected resolution. */
  pick: ResolutionPick;
  /** Manual merge value (only relevant when pick === 'manual'). */
  manualValue?: string;
  onChange: (next: { pick: ResolutionPick; manualValue?: string }) => void;
}

export const FieldResolutionRow: React.FC<Props> = ({
  field, label, mine, theirs, baseline, mineAuthor, theirsAuthor,
  pick, manualValue, onChange,
}) => {
  const [draftManual, setDraftManual] = useState(manualValue ?? mine ?? theirs ?? '');

  const same = (mine ?? '') === (theirs ?? '');
  if (same) {
    return (
      <div style={{ ...row, opacity: 0.55 }}>
        <div style={fieldLabel}>{label ?? field}</div>
        <div style={{ ...lane, gridColumn: '2 / span 3', color: colors.textSecondary, fontStyle: 'italic' }}>
          No conflict on this field.
        </div>
      </div>
    );
  }

  return (
    <div style={row}>
      <div style={fieldLabel}>{label ?? field}</div>

      <Lane
        title={`Mine${mineAuthor ? ` (${mineAuthor})` : ''}`}
        value={mine}
        active={pick === 'mine'}
        onClick={() => onChange({ pick: 'mine' })}
      />
      <Lane
        title={`Theirs${theirsAuthor ? ` (${theirsAuthor})` : ''}`}
        value={theirs}
        active={pick === 'theirs'}
        onClick={() => onChange({ pick: 'theirs' })}
      />

      <div style={{ ...lane, borderColor: pick === 'manual' ? colors.primaryOrange : colors.border, background: pick === 'manual' ? 'rgba(244,120,32,0.04)' : 'transparent' }}>
        <button
          type="button"
          onClick={() => onChange({ pick: 'manual', manualValue: draftManual })}
          style={{
            ...laneTitle,
            color: pick === 'manual' ? colors.primaryOrange : colors.textSecondary,
            background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
          }}
        >
          Merge manually
        </button>
        <textarea
          value={draftManual}
          onChange={(e) => {
            setDraftManual(e.target.value);
            if (pick === 'manual') onChange({ pick: 'manual', manualValue: e.target.value });
          }}
          rows={3}
          style={{
            width: '100%',
            padding: '6px 8px',
            border: `1px solid ${colors.border}`,
            borderRadius: 4,
            fontFamily: typography.fontFamily,
            fontSize: typography.fontSize.sm,
            resize: 'vertical',
          }}
        />
      </div>

      {baseline != null && (
        <div style={{ gridColumn: '1 / -1', fontSize: typography.fontSize.label, color: colors.textTertiary, fontStyle: 'italic' }}>
          Baseline (when you started editing): {String(baseline).slice(0, 120)}{String(baseline).length > 120 ? '…' : ''}
        </div>
      )}
    </div>
  );
};

const Lane: React.FC<{ title: string; value: string | null | undefined; active: boolean; onClick: () => void }> = ({ title, value, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      ...lane,
      cursor: 'pointer',
      borderColor: active ? colors.primaryOrange : colors.border,
      background: active ? 'rgba(244,120,32,0.04)' : 'transparent',
      textAlign: 'left',
      font: 'inherit',
    }}
  >
    <div style={{ ...laneTitle, color: active ? colors.primaryOrange : colors.textSecondary }}>{title}</div>
    <pre style={pre}>{value == null || value === '' ? <em style={{ color: colors.textTertiary }}>(empty)</em> : value}</pre>
  </button>
);

const row: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '120px 1fr 1fr 1fr',
  gap: 8,
  padding: spacing['2'],
  borderBottom: `1px solid ${colors.borderSubtle}`,
  alignItems: 'flex-start',
};
const fieldLabel: React.CSSProperties = {
  fontSize: typography.fontSize.label,
  fontWeight: typography.fontWeight.semibold,
  color: colors.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  paddingTop: 6,
};
const lane: React.CSSProperties = {
  padding: 6,
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
};
const laneTitle: React.CSSProperties = {
  display: 'block',
  fontSize: typography.fontSize.label,
  fontWeight: typography.fontWeight.semibold,
  marginBottom: 4,
};
const pre: React.CSSProperties = {
  margin: 0,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontSize: typography.fontSize.sm,
  fontFamily: typography.fontFamily,
  color: colors.textPrimary,
};

export default FieldResolutionRow;
