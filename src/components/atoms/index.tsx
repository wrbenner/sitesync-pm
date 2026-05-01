/**
 * SiteSync — The Nine: Atom Components
 *
 * The manifesto defines four visual marks that recur on every page:
 *   1. The orange dot   — the surveyor's mark, once per page
 *   2. The hairline     — the only divider, never a box
 *   3. The eyebrow/caps — Inter uppercase, quiet chrome
 *   4. Italic Garamond  — the verbs, the words a decision turns on
 *
 * Plus structural atoms:
 *   5. Sliver           — the top bar (project name · page context)
 *   6. Kicker           — section label (I · The diagnosis)
 *   7. PageQuestion     — the one question every page answers
 *   8. Horizon          — the timeline bar with a Now dot
 *
 * These atoms are the design system in code. Every page in The Nine
 * is a composition of these placed inside one of four shapes:
 * sundial, stream, book, or place.
 */

import React from 'react';
import { colors, typography, spacing } from '../../styles/theme';

// ── 1. Orange Dot ──────────────────────────────────────────
// The surveyor's mark. At most once per page, on the one thing
// that needs attention now. If you can't say where it goes,
// the page has no point of view.

interface OrangeDotProps {
  size?: number;
  haloSpread?: number;
  style?: React.CSSProperties;
  label?: string;
}

export const OrangeDot: React.FC<OrangeDotProps> = ({
  size = 9,
  haloSpread = 4,
  style,
  label,
}) => (
  <span
    role={label ? 'status' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    style={{
      display: 'inline-block',
      width: size,
      height: size,
      borderRadius: '50%',
      backgroundColor: 'var(--color-primary)',
      boxShadow: `0 0 0 ${haloSpread}px var(--color-primary-light)`,
      flexShrink: 0,
      ...style,
    }}
  />
);

// ── 2. Hairline ────────────────────────────────────────────
// The only divider. Never a box. 1px, warm ink at low opacity.

interface HairlineProps {
  weight?: 1 | 2 | 3;
  spacing?: 'tight' | 'normal' | 'wide';
  style?: React.CSSProperties;
}

const hairlineMap = {
  1: 'var(--hairline)',
  2: 'var(--hairline-2)',
  3: 'var(--hairline-3)',
};

const hairlineSpacingMap = {
  tight: { margin: '16px 0' },
  normal: { margin: '32px 0' },
  wide: { margin: '56px 0' },
};

export const Hairline: React.FC<HairlineProps> = ({
  weight = 1,
  spacing = 'normal',
  style,
}) => (
  <hr
    style={{
      border: 0,
      borderTop: `1px solid ${hairlineMap[weight]}`,
      ...hairlineSpacingMap[spacing],
      ...style,
    }}
  />
);

// ── 3. Eyebrow ─────────────────────────────────────────────
// Inter caps. Stamps, slivers, time. Quiet.
// Used for metadata, timestamps, status labels.

interface EyebrowProps {
  children: React.ReactNode;
  color?: 'default' | 'orange' | 'muted';
  style?: React.CSSProperties;
}

const eyebrowColorMap = {
  default: colors.ink3,
  orange: colors.primaryOrange,
  muted: colors.ink4,
};

export const Eyebrow: React.FC<EyebrowProps> = ({
  children,
  color = 'default',
  style,
}) => (
  <span
    style={{
      fontFamily: typography.fontFamily,
      fontSize: '11px',
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '0.18em',
      color: eyebrowColorMap[color],
      ...style,
    }}
  >
    {children}
  </span>
);

// ── 4. Kicker ──────────────────────────────────────────────
// Section label: "I · The diagnosis" or "IV · The nine"
// Wider letter-spacing than eyebrow, used as section openers.

interface KickerProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const Kicker: React.FC<KickerProps> = ({ children, style }) => (
  <div
    style={{
      fontFamily: typography.fontFamily,
      fontSize: '11px',
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '0.22em',
      color: colors.ink3,
      marginBottom: '18px',
      ...style,
    }}
  >
    {children}
  </div>
);

// ── 5. Sliver ──────────────────────────────────────────────
// The top bar atom. Project name on the left, context on the right.
// Same atom as the platform — matches the manifesto's proof page.

interface SliverProps {
  left: React.ReactNode;
  right?: React.ReactNode;
  style?: React.CSSProperties;
}

export const Sliver: React.FC<SliverProps> = ({ left, right, style }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontFamily: typography.fontFamily,
      fontSize: '11px',
      fontWeight: 400,
      textTransform: 'uppercase',
      letterSpacing: '0.22em',
      color: colors.ink2,
      marginBottom: spacing['20'],
      ...style,
    }}
  >
    <div>{left}</div>
    {right && (
      <div style={{ color: colors.ink3, letterSpacing: '0.14em' }}>
        {right}
      </div>
    )}
  </div>
);

// ── 6. PageQuestion ────────────────────────────────────────
// Every page is a question. This is the question, in italic Garamond.
// "Pull Thursday's pour to Tuesday?"
// "What do I need to do next?"

interface PageQuestionProps {
  children: React.ReactNode;
  size?: 'display' | 'large' | 'medium';
  style?: React.CSSProperties;
}

const questionSizeMap = {
  display: { fontSize: '48px', lineHeight: 1.08, letterSpacing: '-0.022em' },
  large: { fontSize: '36px', lineHeight: 1.12, letterSpacing: '-0.02em' },
  medium: { fontSize: '28px', lineHeight: 1.16, letterSpacing: '-0.018em' },
};

export const PageQuestion: React.FC<PageQuestionProps> = ({
  children,
  size = 'large',
  style,
}) => (
  <h2
    style={{
      fontFamily: typography.fontFamilySerif,
      fontWeight: 400,
      color: colors.ink,
      margin: 0,
      textWrap: 'balance',
      ...questionSizeMap[size],
      ...style,
    }}
  >
    {children}
  </h2>
);

// ── 7. ProseBlock ──────────────────────────────────────────
// Body text in Garamond. For descriptions, explanations, context.
// Italic for the verbs — the words a decision turns on.

interface ProseBlockProps {
  children: React.ReactNode;
  italic?: boolean;
  muted?: boolean;
  style?: React.CSSProperties;
}

export const ProseBlock: React.FC<ProseBlockProps> = ({
  children,
  italic = false,
  muted = false,
  style,
}) => (
  <p
    style={{
      fontFamily: typography.fontFamilySerif,
      fontSize: '17px',
      lineHeight: 1.6,
      letterSpacing: '-0.005em',
      color: muted ? colors.ink2 : colors.ink,
      fontStyle: italic ? 'italic' : 'normal',
      margin: '0 0 18px',
      maxWidth: 720,
      ...style,
    }}
  >
    {children}
  </p>
);

// ── 8. Horizon ─────────────────────────────────────────────
// The timeline bar — a single axis from start to end of day.
// The orange dot sits at Now. Events are ticks along the line.
// This is the sundial's backbone.

interface HorizonEvent {
  position: number;  // 0–100 percentage along the line
  label: string;
  time?: string;
  past?: boolean;
}

interface HorizonProps {
  leftLabel: string;
  rightLabel: string;
  nowPosition: number;  // 0–100
  nowLabel?: string;
  events?: HorizonEvent[];
  style?: React.CSSProperties;
}

export const Horizon: React.FC<HorizonProps> = ({
  leftLabel,
  rightLabel,
  nowPosition,
  nowLabel,
  events = [],
  style,
}) => (
  <div
    style={{
      position: 'relative',
      height: 90,
      borderTop: '1px solid var(--hairline)',
      paddingTop: 36,
      ...style,
    }}
  >
    {/* Main line */}
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 70,
        height: 1,
        background: 'var(--hairline)',
      }}
    />
    {/* End caps */}
    <div style={{ position: 'absolute', top: 65, left: 0, width: 1, height: 11, background: 'var(--hairline)' }} />
    <div style={{ position: 'absolute', top: 65, right: 0, width: 1, height: 11, background: 'var(--hairline)' }} />
    {/* Bound labels */}
    <div
      style={{
        position: 'absolute',
        top: 80,
        left: 0,
        ...typography.eyebrow,
        fontSize: '9px',
        letterSpacing: '0.14em',
        color: colors.ink4,
      }}
    >
      {leftLabel}
    </div>
    <div
      style={{
        position: 'absolute',
        top: 80,
        right: 0,
        ...typography.eyebrow,
        fontSize: '9px',
        letterSpacing: '0.14em',
        color: colors.ink4,
      }}
    >
      {rightLabel}
    </div>
    {/* Events */}
    {events.map((evt, i) => (
      <div
        key={i}
        style={{
          position: 'absolute',
          top: 36,
          left: `${evt.position}%`,
          transform: 'translateX(-50%)',
          textAlign: 'center',
        }}
      >
        {evt.time && (
          <div
            style={{
              ...typography.eyebrow,
              fontSize: '8.5px',
              letterSpacing: '0.12em',
              color: colors.ink4,
              whiteSpace: 'nowrap',
            }}
          >
            {evt.time}
          </div>
        )}
        <div
          style={{
            fontFamily: typography.fontFamilySerif,
            fontSize: '12px',
            color: evt.past ? colors.ink3 : colors.ink,
            opacity: evt.past ? 0.5 : 1,
            whiteSpace: 'nowrap',
            marginTop: 2,
          }}
        >
          {evt.label}
        </div>
        <div
          style={{
            width: 1,
            height: 11,
            background: evt.past ? 'var(--hairline)' : colors.ink,
            opacity: evt.past ? 0.35 : 1,
            margin: '2px auto 0',
          }}
        />
      </div>
    ))}
    {/* Now line + dot — vertical mark connecting axis to label, capped by the dot */}
    <div
      style={{
        position: 'absolute',
        top: 50,
        left: `${nowPosition}%`,
        height: 36,
        width: 1,
        background: 'var(--color-primary)',
        opacity: 0.32,
      }}
    />
    <OrangeDot
      label="Now"
      style={{
        position: 'absolute',
        top: 65,
        left: `${nowPosition}%`,
        marginLeft: -4.5,
      }}
    />
    {nowLabel && (
      <div
        style={{
          position: 'absolute',
          top: 82,
          left: `${nowPosition}%`,
          transform: 'translateX(-50%)',
          ...typography.eyebrow,
          fontSize: '9px',
          letterSpacing: '0.16em',
          color: 'var(--color-primary)',
          whiteSpace: 'nowrap',
        }}
      >
        {nowLabel}
      </div>
    )}
  </div>
);

// ── 9. SectionHeading ──────────────────────────────────────
// Garamond heading with optional <em> styling for italic verbs.

interface SectionHeadingProps {
  children: React.ReactNode;
  level?: 2 | 3;
  style?: React.CSSProperties;
}

const headingSizeMap = {
  2: { fontSize: '32px', lineHeight: 1.12, letterSpacing: '-0.022em', marginBottom: '24px' },
  3: { fontSize: '24px', lineHeight: 1.25, letterSpacing: '-0.01em', marginBottom: '12px' },
};

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  children,
  level = 2,
  style,
}) => {
  const Tag = `h${level}` as const;
  return (
    <Tag
      style={{
        fontFamily: typography.fontFamilySerif,
        fontWeight: 400,
        color: colors.ink,
        margin: 0,
        ...headingSizeMap[level],
        ...style,
      }}
    >
      {children}
    </Tag>
  );
};
