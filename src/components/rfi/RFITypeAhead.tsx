// ── RFITypeAhead ────────────────────────────────────────────────────────
// Native HTML5 datalist-based typeahead for RFI Procore-parity fields.
// Used by the Cost Code + RFI Stage inputs on Create / Edit / Detail.
//
// Why HTML5 datalist (vs. a custom dropdown)?
//   • Zero JS state (browser handles filter + keyboard nav).
//   • Free a11y — screen-readers announce the suggestions list correctly.
//   • Free mobile keyboard hint (no jank vs. a faux dropdown).
//
// The component still allows free-typing (admins can introduce codes /
// stages on the fly) — picking from the suggestion list is a hint, not a
// constraint.

import React, { useId } from 'react'
import { colors, typography, borderRadius } from '../../styles/theme'

interface RFITypeAheadProps {
  value: string
  onChange: (value: string) => void
  options: ReadonlyArray<string>
  placeholder?: string
  ariaLabel?: string
  disabled?: boolean
  /** Optional max-length cap for the input. */
  maxLength?: number
  /** Optional input id for label association. */
  id?: string
}

export const RFITypeAhead: React.FC<RFITypeAheadProps> = ({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  disabled,
  maxLength,
  id,
}) => {
  const generatedId = useId()
  const listId = `${id ?? generatedId}-list`

  return (
    <>
      <input
        id={id ?? generatedId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        maxLength={maxLength}
        autoComplete="off"
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: typography.fontSize.sm,
          color: colors.textPrimary,
          backgroundColor: disabled ? colors.surfaceInset : colors.surfaceRaised,
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: borderRadius.base,
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />
      <datalist id={listId}>
        {options.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
    </>
  )
}

export default RFITypeAhead
