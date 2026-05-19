/**
 * PullQuote — oversized editorial callout with rust quotation glyphs.
 *
 * The disruptor signature. Use to elevate:
 *   - The most urgent RFI / submittal / safety event on /day
 *   - Iris-generated insights in /ai headline area
 *   - Key dashboard call-outs (one per page, max)
 *
 * Composition:
 *   ┌─ rule ─────────────────────────────────────────
 *   │ "
 *   │  This drywall scope changed three times in
 *   │  two weeks — pull the latest before pricing.
 *   │                                           "
 *   │  — Iris  ·  2:14 PM
 *   └────────────────────────────────────────────────
 */

import React from 'react';
import { colors, typography, spacing } from '../../styles/theme';

export interface PullQuoteProps {
  children: React.ReactNode;
  /** Who said it — rendered as a small attribution line below the quote. */
  source?: React.ReactNode;
  /** Additional attribution metadata (timestamp, citation). */
  meta?: React.ReactNode;
  /** Where to place the left rule. Defaults to 'rust'. */
  ruleTone?: 'rust' | 'ink' | 'brand' | 'none';
  /** Visual emphasis. 'soft' uses parchment background, 'plain' uses no background. */
  variant?: 'soft' | 'plain';
  /** Quote glyph style. */
  quoteGlyph?: 'curly' | 'guillemet' | 'none';
  /** Width cap. Defaults 640. */
  maxWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

const RULE_COLOR_MAP = {
  rust: colors.rust,
  ink: colors.ink,
  brand: colors.primaryOrange,
  none: 'transparent',
} as const;

export const PullQuote: React.FC<PullQuoteProps> = ({
  children,
  source,
  meta,
  ruleTone = 'rust',
  variant = 'plain',
  quoteGlyph = 'curly',
  maxWidth = 640,
  className,
  style,
}) => {
  const openGlyph = quoteGlyph === 'curly' ? '“' : quoteGlyph === 'guillemet' ? '«' : '';
  const closeGlyph = quoteGlyph === 'curly' ? '”' : quoteGlyph === 'guillemet' ? '»' : '';
  const ruleColor = RULE_COLOR_MAP[ruleTone];

  return (
    <figure
      className={className}
      style={{
        margin: 0,
        padding: variant === 'soft' ? `${spacing['5']} ${spacing['6']}` : `${spacing['2']} 0 ${spacing['2']} ${spacing['5']}`,
        borderLeft: ruleTone === 'none' ? 'none' : `2px solid ${ruleColor}`,
        backgroundColor: variant === 'soft' ? colors.parchment2 : 'transparent',
        maxWidth,
        ...style,
      }}
    >
      <blockquote
        style={{
          margin: 0,
          fontFamily: typography.fontFamilySerif,
          fontSize: '22px',
          lineHeight: 1.35,
          letterSpacing: '-0.012em',
          color: colors.ink,
          fontStyle: 'normal',
        }}
      >
        {openGlyph && (
          <span
            aria-hidden="true"
            style={{
              color: colors.rust,
              fontSize: '32px',
              lineHeight: 0,
              marginRight: 2,
              verticalAlign: -2,
            }}
          >
            {openGlyph}
          </span>
        )}
        {children}
        {closeGlyph && (
          <span
            aria-hidden="true"
            style={{
              color: colors.rust,
              fontSize: '32px',
              lineHeight: 0,
              marginLeft: 2,
              verticalAlign: -8,
            }}
          >
            {closeGlyph}
          </span>
        )}
      </blockquote>
      {(source || meta) && (
        <figcaption
          style={{
            marginTop: spacing['3'],
            fontFamily: typography.fontFamily,
            fontSize: '11px',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            color: colors.ink3,
            display: 'flex',
            alignItems: 'center',
            gap: spacing['2'],
            flexWrap: 'wrap',
          }}
        >
          {source && (
            <span>
              <span aria-hidden="true" style={{ marginRight: 6 }}>—</span>
              {source}
            </span>
          )}
          {meta && (
            <>
              <span aria-hidden="true" style={{ color: colors.ink4 }}>·</span>
              <span style={{ color: colors.ink4 }}>{meta}</span>
            </>
          )}
        </figcaption>
      )}
    </figure>
  );
};

export default PullQuote;
