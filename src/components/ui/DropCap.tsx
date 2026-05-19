/**
 * DropCap — editorial 4-line drop cap.
 *
 * Use sparingly. Reserved for the lede paragraph of:
 *   - /day cockpit
 *   - /ai first response
 *   - /daily-log entry openings
 *
 * Renders the first character as an oversized rust-orange serif glyph
 * that the surrounding paragraph flows around. The rest of the paragraph
 * is the standard Garamond ProseBlock treatment.
 *
 * Usage:
 *   <DropCap>The weather cleared by 7am. Three crews showed.</DropCap>
 */

import React from 'react';
import { colors, typography } from '../../styles/theme';

export interface DropCapProps {
  children: string;
  /** Override the inferred first character (useful for stripping leading punctuation). */
  cap?: string;
  /** Cap color — defaults to rust. */
  capColor?: string;
  /** Cap font — defaults to serif. */
  capFont?: 'serif' | 'sans';
  /** Maximum prose width (px). Defaults 680. */
  maxWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const DropCap: React.FC<DropCapProps> = ({
  children,
  cap,
  capColor = colors.rust,
  capFont = 'serif',
  maxWidth = 680,
  className,
  style,
}) => {
  const text = children ?? '';
  const explicitCap = cap ?? text.charAt(0);
  const rest = cap ? text : text.slice(1);

  return (
    <p
      className={className}
      style={{
        fontFamily: typography.fontFamilySerif,
        fontSize: '17px',
        lineHeight: 1.6,
        letterSpacing: '-0.005em',
        color: colors.ink,
        margin: '0 0 18px',
        maxWidth,
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          float: 'left',
          fontFamily:
            capFont === 'serif' ? typography.fontFamilySerif : typography.fontFamily,
          fontSize: '64px',
          lineHeight: 0.86,
          fontWeight: 400,
          color: capColor,
          padding: '4px 8px 0 0',
          marginTop: 4,
          marginRight: 2,
          letterSpacing: '-0.04em',
        }}
      >
        {explicitCap}
      </span>
      {/* Screen-reader sees the full word; the visual split is decorative. */}
      <span style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
        {explicitCap}
      </span>
      {rest}
    </p>
  );
};

export default DropCap;
