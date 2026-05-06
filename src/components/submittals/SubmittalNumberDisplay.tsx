// CSI-aligned numbering display per Phase 1 of
// SUBMITTALS_PAGE_REBUILD_PLAN_2026-05-06.md.
//
// Database `submittals.number` is unchanged — display only. The format
// template comes from `submittal_settings.numbering_format` (default
// '{spec_section}-{seq}'). Tokens supported:
//   {spec_section} → submittals.csi_section (or fallback to spec_section)
//   {seq}          → submittals.number left-padded if numeric
//   {division}     → submittals.csi_division
//
// This component is purely presentational. It does not fetch settings —
// the parent passes the format string. A `useSubmittalSettings()` hook
// can be added later (Phase 8 / settings UI work); for now Phase 1 wires
// the component with the default template.

import React from 'react'

export interface SubmittalNumberDisplayProps {
  /** Raw `submittals.number` (could be numeric or text like "0231-A"). */
  number: string | number | null | undefined
  /** CSI section (e.g. "08 41 13") if available. */
  csiSection?: string | null
  /** CSI division (e.g. "08") if available. */
  csiDivision?: string | null
  /** Project's numbering format template. Defaults to '{spec_section}-{seq}'. */
  format?: string
  /** Optional revision number — appended as " R{n}" when > 0. */
  revNumber?: number | null
  className?: string
  style?: React.CSSProperties
}

const DEFAULT_FORMAT = '{spec_section}-{seq}'

export function formatSubmittalNumber({
  number,
  csiSection,
  csiDivision,
  format = DEFAULT_FORMAT,
  revNumber,
}: Omit<SubmittalNumberDisplayProps, 'className' | 'style'>): string {
  const seq =
    number === null || number === undefined
      ? ''
      : typeof number === 'number'
        ? String(number).padStart(3, '0')
        : String(number)

  // If we have no CSI alignment data at all, fall back to the legacy SUB-NNN
  // shape so existing rows render legibly.
  if (!csiSection && !csiDivision && format === DEFAULT_FORMAT) {
    if (!seq) return ''
    return /^\d+$/.test(seq) ? `SUB-${seq}` : seq
  }

  const rendered = format
    .replace('{spec_section}', csiSection ?? csiDivision ?? '')
    .replace('{seq}', seq)
    .replace('{division}', csiDivision ?? '')
    .replace(/^[-_\s]+|[-_\s]+$/g, '') // trim stray separators when tokens are empty
    .replace(/\s+/g, ' ')

  if (revNumber && revNumber > 0) {
    return `${rendered} R${revNumber}`
  }
  return rendered || seq || ''
}

export const SubmittalNumberDisplay: React.FC<SubmittalNumberDisplayProps> = ({
  number,
  csiSection,
  csiDivision,
  format,
  revNumber,
  className,
  style,
}) => {
  const text = formatSubmittalNumber({ number, csiSection, csiDivision, format, revNumber })
  return (
    <span className={className} style={style} aria-label={`Submittal number ${text}`}>
      {text}
    </span>
  )
}

export default SubmittalNumberDisplay
