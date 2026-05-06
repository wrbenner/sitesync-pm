// ── MentionAutocomplete ────────────────────────────────────────────────────
// Dropdown popover with a ranked list of mention candidates. Pure
// presentational — owner controls open/close state, position, and
// selection callback. Uses the deterministic ranker in
// src/lib/mentions/autocomplete.ts.

import React from 'react';
import { colors, typography, spacing } from '../../styles/theme';
import type { MentionCandidate } from '../../lib/mentions/autocomplete';

interface MentionAutocompleteProps {
  open: boolean;
  /** CSS positioning relative to the input. Pass { top, left }. */
  position: { top: number; left: number };
  candidates: ReadonlyArray<MentionCandidate>;
  /** Currently-highlighted index (keyboard nav). */
  activeIndex: number;
  onSelect: (c: MentionCandidate) => void;
  onHover?: (index: number) => void;
}

export const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
  open,
  position,
  candidates,
  activeIndex,
  onSelect,
  onHover,
}) => {
  if (!open || candidates.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Mention candidates"
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        background: colors.surfacePage,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        padding: spacing['1'],
        minWidth: 260,
        maxWidth: 320,
        maxHeight: 280,
        overflowY: 'auto',
        zIndex: 1200,
      }}
    >
      {candidates.map((c, i) => {
        const active = i === activeIndex;
        return (
          <div
            key={c.contact.id}
            role="option"
            aria-selected={active}
            onClick={() => onSelect(c)}
            onMouseEnter={() => onHover?.(i)}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'baseline',
              padding: '6px 8px',
              borderRadius: 4,
              background: active ? colors.surfaceHover : 'transparent',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.semibold,
                color: c.contact.former_member ? colors.textTertiary : colors.textPrimary,
                whiteSpace: 'nowrap',
              }}
            >
              {c.label}
            </span>
            {c.detail && (
              <span
                style={{
                  fontSize: typography.fontSize.label,
                  color: colors.textSecondary,
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.detail}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MentionAutocomplete;
