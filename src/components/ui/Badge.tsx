/**
 * Badge — manifesto-tone chips for non-status labels.
 *
 * For status indicators (RFI status, submittal status, etc.), use
 * <StatusPill> instead. This component is for labels, tags, counts,
 * categories, and brand callouts — the places where you reach for
 * a colored chip.
 *
 * Tones map to the manifesto palette:
 *   - rust       editorial accent, errors in long-form reading views
 *   - moss       human / crew / active-on-site signals
 *   - parchment  warm-neutral labels (default for tags / categories)
 *   - ink        high-contrast dark labels (counts, current selection)
 *   - brand      orange CTA-adjacent emphasis (use sparingly — one per surface)
 *   - mono       neutral mono-text label (mono caption, kbd-style)
 */

import React from 'react';
import { colors, typography, borderRadius, chipPadding } from '../../styles/theme';

export type BadgeTone = 'rust' | 'moss' | 'parchment' | 'ink' | 'brand' | 'mono';
export type BadgeSize = 'sm' | 'md' | 'lg';
export type BadgeVariant = 'soft' | 'outline' | 'solid';

export interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  size?: BadgeSize;
  variant?: BadgeVariant;
  /** Optional leading element — typically a small icon. */
  leading?: React.ReactNode;
  /** Optional trailing element — typically a count or remove button. */
  trailing?: React.ReactNode;
  /** Use uppercase Inter caps treatment (eyebrow-style). */
  uppercase?: boolean;
  className?: string;
  ariaLabel?: string;
}

interface ToneStyles {
  bg: string;
  fg: string;
  border: string;
  solidBg: string;
  solidFg: string;
}

const TONES: Record<BadgeTone, ToneStyles> = {
  rust: {
    bg: 'rgba(184, 71, 46, 0.08)',
    fg: colors.rust,
    border: 'rgba(184, 71, 46, 0.25)',
    solidBg: colors.rust,
    solidFg: colors.white,
  },
  moss: {
    bg: 'rgba(74, 93, 58, 0.10)',
    fg: colors.moss,
    border: 'rgba(74, 93, 58, 0.28)',
    solidBg: colors.moss,
    solidFg: colors.white,
  },
  parchment: {
    bg: 'rgba(26, 22, 19, 0.04)',
    fg: colors.ink2,
    border: 'rgba(26, 22, 19, 0.10)',
    solidBg: colors.ink2,
    solidFg: colors.white,
  },
  ink: {
    bg: 'rgba(26, 22, 19, 0.08)',
    fg: colors.ink,
    border: 'rgba(26, 22, 19, 0.15)',
    solidBg: colors.ink,
    solidFg: colors.white,
  },
  brand: {
    bg: colors.orangeSubtle,
    fg: colors.orangeText,
    border: 'rgba(244, 120, 32, 0.30)',
    solidBg: colors.primaryOrange,
    solidFg: colors.white,
  },
  mono: {
    bg: 'rgba(26, 22, 19, 0.04)',
    fg: colors.ink3,
    border: 'rgba(26, 22, 19, 0.10)',
    solidBg: colors.ink3,
    solidFg: colors.white,
  },
};

const SIZES: Record<BadgeSize, { padding: string; fontSize: string; gap: number }> = {
  sm: { padding: chipPadding.sm, fontSize: '10.5px', gap: 4 },
  md: { padding: chipPadding.md, fontSize: '11.5px', gap: 5 },
  lg: { padding: chipPadding.lg, fontSize: '12.5px', gap: 6 },
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  tone = 'parchment',
  size = 'md',
  variant = 'soft',
  leading,
  trailing,
  uppercase = false,
  className,
  ariaLabel,
}) => {
  const t = TONES[tone];
  const s = SIZES[size];

  let bg: string;
  let fg: string;
  let border: string;
  switch (variant) {
    case 'solid':
      bg = t.solidBg;
      fg = t.solidFg;
      border = 'transparent';
      break;
    case 'outline':
      bg = 'transparent';
      fg = t.fg;
      border = t.border;
      break;
    case 'soft':
    default:
      bg = t.bg;
      fg = t.fg;
      border = 'transparent';
      break;
  }

  const isMono = tone === 'mono';

  return (
    <span
      className={className}
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        padding: s.padding,
        borderRadius: borderRadius.full,
        backgroundColor: bg,
        color: fg,
        border: variant === 'outline' ? `1px solid ${border}` : `1px solid transparent`,
        fontFamily: isMono ? typography.fontFamilyMono : typography.fontFamily,
        fontSize: s.fontSize,
        fontWeight: uppercase ? 500 : 500,
        textTransform: uppercase ? 'uppercase' : 'none',
        letterSpacing: uppercase ? '0.10em' : '0.005em',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
      }}
    >
      {leading}
      <span>{children}</span>
      {trailing}
    </span>
  );
};

export default Badge;
