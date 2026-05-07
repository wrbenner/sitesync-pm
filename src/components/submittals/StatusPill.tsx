// Phase 2 — colored status pill covering the canonical 9-state set per
// SUBMITTALS_MODULE_BUILD_SPEC_2026-05-06.md Part 4 plus legacy values.
// Procore renders status as plain text — we keep the coloring advantage
// per visual-audit (existing strength to preserve).

import React from 'react'
import type { SubmittalStatus } from '../../types/submittal'

interface StatusStyle {
  bg: string
  text: string
  label: string
}

const TONES = {
  green:  { bg: 'rgba(45, 138, 110, 0.10)',  text: '#2D8A6E' },
  red:    { bg: 'rgba(201, 59, 59, 0.10)',   text: '#C93B3B' },
  amber:  { bg: 'rgba(196, 133, 12, 0.12)',  text: '#C4850C' },
  blue:   { bg: 'rgba(79, 70, 229, 0.10)',   text: '#4F46E5' },
  gray:   { bg: 'rgba(26, 22, 19, 0.05)',    text: '#5C5550' },
  inkSub: { bg: 'rgba(140, 133, 126, 0.12)', text: '#8C857E' },
} as const

const STYLES: Record<string, StatusStyle> = {
  // Canonical 9-state set
  draft:            { ...TONES.gray,   label: 'Draft' },
  sub_uploading:    { ...TONES.amber,  label: 'Sub Uploading' },
  gc_review:        { ...TONES.blue,   label: 'GC Review' },
  preflight:        { ...TONES.blue,   label: 'Pre-flight' },
  sent_to_reviewer: { ...TONES.blue,   label: 'Sent to Reviewer' },
  in_review:        { ...TONES.blue,   label: 'In Review' },
  returned:         { ...TONES.amber,  label: 'Returned' },
  distribute:       { ...TONES.green,  label: 'Distribute' },
  closed:           { ...TONES.inkSub, label: 'Closed' },
  void:             { ...TONES.inkSub, label: 'Void' },
  // Legacy values still in DB rows
  pending:           { ...TONES.gray,   label: 'Pending' },
  submitted:         { ...TONES.amber,  label: 'Submitted' },
  under_review:      { ...TONES.blue,   label: 'Under Review' },
  review_in_progress:{ ...TONES.blue,   label: 'Under Review' },
  architect_review:  { ...TONES.blue,   label: 'Architect Review' },
  approved:          { ...TONES.green,  label: 'Approved' },
  approved_as_noted: { ...TONES.green,  label: 'Approved as Noted' },
  rejected:          { ...TONES.red,    label: 'Rejected' },
  resubmit:          { ...TONES.amber,  label: 'Resubmit' },
  revise_resubmit:   { ...TONES.amber,  label: 'Resubmit' },
}

const FALLBACK: StatusStyle = { ...TONES.gray, label: '' }

export interface StatusPillProps {
  status: SubmittalStatus | string | null | undefined
  className?: string
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, className }) => {
  const key = (status ?? '').toString()
  const style = STYLES[key] ?? { ...FALLBACK, label: key || '—' }
  return (
    <span
      className={className}
      title={style.label}
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 500,
        backgroundColor: style.bg,
        color: style.text,
        whiteSpace: 'nowrap',
        letterSpacing: '0.01em',
      }}
    >
      {style.label}
    </span>
  )
}

export default StatusPill
