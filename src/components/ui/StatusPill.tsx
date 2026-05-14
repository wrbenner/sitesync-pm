/**
 * Canonical StatusPill — the dot + label pattern.
 *
 * Per `specs/homepage-redesign/DESIGN-RESET.md`:
 *   "Status pills | colored dot + label, consistent palette across pages"
 *
 * This is the single shared status pill for the entire product. Every page that
 * needs a status indicator (RFI Status, Punch Status, Schedule activity status,
 * Daily Log status, Submittal status, etc.) should import from here, not
 * reinvent the visual.
 *
 * Two visual modes, both dot-prefixed:
 *   - `subtle`  (default) — no background, just a colored dot + ink label.
 *                            Used inside data tables (RFI/Punch/Submittals).
 *   - `tinted`            — soft tinted background + same colored text.
 *                            Used as standalone chips in page headers
 *                            (Schedule "No activities", Daily Log "Not started").
 *
 * Tone palette + status-string resolver live in `./statusTone` so this file
 * exports only components (react-refresh requirement).
 */

import React from 'react'
import { TONES, type StatusTone } from './statusTone'

export interface StatusPillProps {
  /** What it says. */
  label: string
  /** Color tone. Defaults to `neutral`. */
  tone?: StatusTone
  /** Visual mode. `subtle` = no background, `tinted` = soft fill. Defaults to `subtle`. */
  variant?: 'subtle' | 'tinted'
  /** Extra className passthrough (avoid overriding internal style). */
  className?: string
  /** Accessibility label override. */
  ariaLabel?: string
}

export const StatusPill: React.FC<StatusPillProps> = ({
  label,
  tone = 'neutral',
  variant = 'subtle',
  className,
  ariaLabel,
}) => {
  const t = TONES[tone]
  const isTinted = variant === 'tinted'

  return (
    <span
      role="status"
      aria-label={ariaLabel ?? `${label} status`}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: isTinted ? '3px 9px' : 0,
        borderRadius: 9999,
        backgroundColor: isTinted ? t.bg : 'transparent',
        color: isTinted ? t.text : 'var(--color-textSecondary, #5C5550)',
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.01em',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: t.dot,
          flexShrink: 0,
        }}
      />
      <span>{label}</span>
    </span>
  )
}

export default StatusPill
