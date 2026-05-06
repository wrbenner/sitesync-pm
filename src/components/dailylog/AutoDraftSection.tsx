// ── AutoDraftSection ───────────────────────────────────────────────────────
// One section of the AutoDraftPanel. Inline-editable bullets with cost-code
// pills + provenance tooltips. "Regenerate this section" button calls back
// to the parent which re-invokes draft-daily-log (or, in the standalone
// __demo__, mocks the response).
//
// Designed to be reusable across all 5 sections by accepting a generic
// "kind" string and an array of bullets — no per-section hardcoding.

import React, { useState } from 'react';
import { RefreshCw, Info } from 'lucide-react';
import { colors, spacing, typography } from '../../styles/theme';
import type {
  DraftedDailyLogBullet,
  DraftedDailyLogSectionId,
} from '../../types/dailyLogDraft';

export interface AutoDraftSectionProps {
  id: DraftedDailyLogSectionId;
  title: string;
  bullets: ReadonlyArray<DraftedDailyLogBullet>;
  /** Reason text from draft.partial_reasons[id] when this section is empty
   *  or under-populated. Rendered in italic when present. */
  reason?: string;
  /** Optional extra header content (e.g. weather summary line, manpower count). */
  headerExtra?: React.ReactNode;
  /** Called when the user changes a bullet's text inline. */
  onBulletChange: (index: number, newText: string) => void;
  /** Called when the user clicks Regenerate — caller re-invokes the edge fn. */
  onRegenerate?: () => void;
  /** True while a regeneration is in flight. */
  busy?: boolean;
  /** Locks all editing (used when the panel is read-only / approved). */
  readOnly?: boolean;
}

export const AutoDraftSection: React.FC<AutoDraftSectionProps> = ({
  id: _id,
  title,
  bullets,
  reason,
  headerExtra,
  onBulletChange,
  onRegenerate,
  busy,
  readOnly,
}) => {
  return (
    <section
      style={{
        marginTop: spacing['3'],
        padding: spacing['3'],
        background: colors.surfaceRaised,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing['2'],
        }}
      >
        <div
          style={{
            fontSize: typography.fontSize.label,
            fontWeight: typography.fontWeight.medium,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            color: colors.textSecondary,
          }}
        >
          {title}
        </div>
        {onRegenerate && !readOnly && (
          <button
            onClick={onRegenerate}
            disabled={busy}
            aria-label={`Regenerate ${title} section`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              border: `1px solid ${colors.border}`,
              borderRadius: 999,
              background: 'transparent',
              cursor: busy ? 'wait' : 'pointer',
              fontSize: typography.fontSize.label,
              fontWeight: typography.fontWeight.medium,
              color: colors.textSecondary,
              opacity: busy ? 0.5 : 1,
            }}
          >
            <RefreshCw
              size={11}
              style={{ animation: busy ? 'spin 1s linear infinite' : 'none' }}
            />
            Regenerate
          </button>
        )}
      </header>

      {headerExtra && <div style={{ marginBottom: spacing['2'] }}>{headerExtra}</div>}

      {bullets.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: typography.fontSize.sm,
            fontStyle: 'italic',
            color: colors.textSecondary,
          }}
        >
          {reason ?? 'No content for this section.'}
        </p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {bullets.map((b, i) => (
            <BulletEditor
              key={i}
              bullet={b}
              readOnly={readOnly}
              onChange={(text) => onBulletChange(i, text)}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

interface BulletEditorProps {
  bullet: DraftedDailyLogBullet;
  readOnly?: boolean;
  onChange: (text: string) => void;
}

const BulletEditor: React.FC<BulletEditorProps> = ({ bullet, readOnly, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bullet.text);

  const sourceLabel = bullet.sources
    .map((s) => `${s.kind}${s.ref ? `:${s.ref.slice(0, 6)}` : ''}`)
    .join(' · ');

  return (
    <li
      style={{
        display: 'flex',
        gap: 8,
        padding: '8px 0',
        borderTop: `1px solid ${colors.borderSubtle}`,
        alignItems: 'flex-start',
      }}
    >
      <span style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, marginTop: 2 }}>•</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing && !readOnly ? (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (draft !== bullet.text) onChange(draft);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setEditing(false);
                if (draft !== bullet.text) onChange(draft);
              } else if (e.key === 'Escape') {
                setEditing(false);
                setDraft(bullet.text);
              }
            }}
            autoFocus
            style={{
              width: '100%',
              padding: '4px 8px',
              border: `1px solid ${colors.primaryOrange}`,
              borderRadius: 4,
              fontFamily: typography.fontFamily,
              fontSize: typography.fontSize.sm,
              color: colors.textPrimary,
              background: colors.surfaceInset,
            }}
          />
        ) : (
          <span
            onClick={() => !readOnly && setEditing(true)}
            style={{
              cursor: readOnly ? 'default' : 'text',
              fontSize: typography.fontSize.sm,
              color: colors.textPrimary,
              lineHeight: 1.5,
              display: 'block',
            }}
          >
            {bullet.text}
          </span>
        )}
        <div
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            marginTop: 2,
            flexWrap: 'wrap',
          }}
        >
          {bullet.cost_code && (
            <span
              title={`Cost code (confidence ${Math.round((bullet.cost_code_confidence ?? 0) * 100)}%)`}
              style={{
                padding: '1px 6px',
                borderRadius: 999,
                background: colors.statusActiveSubtle,
                color: colors.statusActive,
                fontSize: 10,
                fontFamily: 'monospace',
                fontWeight: typography.fontWeight.semibold,
              }}
            >
              {bullet.cost_code}
            </span>
          )}
          <span
            title={sourceLabel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 10,
              color: colors.textTertiary,
              cursor: 'help',
            }}
          >
            <Info size={9} />
            {bullet.sources[0]?.kind ?? 'manual'}
          </span>
        </div>
      </div>
    </li>
  );
};

export default AutoDraftSection;
