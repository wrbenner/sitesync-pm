/**
 * KpiTile — single high-signal number with eyebrow label.
 * Used on the portfolio dashboard for total active value, rfis open,
 * incidents YTD, etc. Inline-styled to match the SiteSync atoms.
 */

import React from 'react';
import { Eyebrow } from '../atoms';
import { colors, typography } from '../../styles/theme';

interface KpiTileProps {
  label: string;
  value: string;
  hint?: string;
  emphasis?: 'normal' | 'attention';
}

export const KpiTile: React.FC<KpiTileProps> = ({
  label,
  value,
  hint,
  emphasis = 'normal',
}) => {
  return (
    <div
      style={{
        padding: '24px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <Eyebrow>{label}</Eyebrow>
      <div
        style={{
          fontFamily: typography.fontFamily,
          fontSize: 36,
          lineHeight: 1.05,
          color: emphasis === 'attention' ? colors.primaryOrange : colors.textPrimary,
          fontWeight: 400,
        }}
      >
        {value}
      </div>
      {hint && (
        <div
          style={{
            fontFamily: typography.fontFamily,
            fontSize: 12,
            color: colors.textTertiary,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
};
