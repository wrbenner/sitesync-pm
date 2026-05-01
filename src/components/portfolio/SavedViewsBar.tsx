/**
 * SavedViewsBar — small horizontal pill row of saved portfolio
 * filters. Hairline-bordered, no boxed cards.
 */

import React from 'react';
import { colors, typography } from '../../styles/theme';

export interface SavedView {
  id: string;
  label: string;
}

interface SavedViewsBarProps {
  views: SavedView[];
  activeId?: string;
  onSelect?: (id: string) => void;
}

export const SavedViewsBar: React.FC<SavedViewsBarProps> = ({
  views,
  activeId,
  onSelect,
}) => {
  if (views.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        padding: '12px 0',
        borderBottom: '1px solid var(--hairline)',
        overflowX: 'auto',
      }}
    >
      {views.map((v) => {
        const active = v.id === activeId;
        return (
          <button
            key={v.id}
            onClick={() => onSelect?.(v.id)}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 0',
              cursor: 'pointer',
              fontFamily: typography.fontFamily.sans,
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              color: active ? colors.primaryOrange : colors.textSecondary,
              borderBottom: active
                ? `1px solid ${colors.primaryOrange}`
                : '1px solid transparent',
              minHeight: 56, // industrial touch target
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
};
