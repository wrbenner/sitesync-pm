// Phase 6 — Overview tab — General Information card.
//
// Per spec Part 2.4 + plan Pillar B: a left-aligned card that surfaces the
// core submittal metadata in a 2-column key/value grid. Empty values render
// as em-dash (—) to maintain spatial consistency.

import React from 'react'
import { ExternalLink } from 'lucide-react'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  brandOrange: '#F47820',
  surface: '#FCFCFA',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface GeneralInfoCardProps {
  submittal: Record<string, unknown>
  /** Optional click target for the spec section link — opens the spec book
   *  to the linked section + paragraph + page. */
  onOpenSpec?: () => void
}

export const GeneralInfoCard: React.FC<GeneralInfoCardProps> = ({ submittal, onOpenSpec }) => {
  const s = submittal
  const csiSection = (s.csi_section as string | null) ?? (s.spec_section as string | null) ?? null
  const paragraph = (s.spec_section_paragraph as string | null) ?? null
  const specLabel = csiSection
    ? paragraph ? `${csiSection} ${paragraph}` : csiSection
    : null

  return (
    <section
      aria-label="General information"
      style={{
        backgroundColor: '#fff',
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: '14px 18px',
        fontFamily: FONT,
      }}
    >
      <h3
        style={{
          margin: '0 0 10px',
          fontSize: 11,
          fontWeight: 600,
          color: C.ink3,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        General Information
      </h3>
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: '120px 1fr',
          rowGap: 8,
          columnGap: 12,
          margin: 0,
        }}
      >
        <Row label="Title" value={(s.title as string) ?? null} bold />
        <Row label="Number" value={(s.number as string | null) ?? null} mono />
        <Row label="Revision" value={s.rev_number != null ? `R${s.rev_number}` : null} mono />
        <Row label="Kind" value={formatKind(s.kind as string | null)} />
        <Row
          label="Spec section"
          value={
            specLabel ? (
              <button
                type="button"
                onClick={onOpenSpec}
                disabled={!onOpenSpec}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  padding: 0,
                  color: onOpenSpec ? C.brandOrange : C.ink,
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  cursor: onOpenSpec ? 'pointer' : 'default',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {specLabel}
                {onOpenSpec && <ExternalLink size={11} />}
              </button>
            ) : null
          }
        />
        <Row label="Sub" value={(s.sub_name as string | null) ?? (s.subcontractor as string | null) ?? null} />
        <Row label="Submit by" value={formatDate(s.submit_by_date as string | null)} />
        <Row label="Required on site" value={formatDate(s.required_on_site_date as string | null)} />
        <Row label="Lead time" value={s.lead_time_weeks != null ? `${s.lead_time_weeks} weeks` : null} />
        <Row label="Critical path" value={s.is_critical_path ? 'Yes' : null} />
        <Row label="Federal" value={s.is_federal ? 'Yes' : null} />
        <Row label="Private" value={s.is_private ? 'Yes (PM/admin only)' : null} />
      </dl>
    </section>
  )
}

interface RowProps {
  label: string
  value: React.ReactNode
  bold?: boolean
  mono?: boolean
}

const Row: React.FC<RowProps> = ({ label, value, bold, mono }) => (
  <>
    <dt
      style={{
        fontSize: 11,
        color: C.ink3,
        fontWeight: 500,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        alignSelf: 'baseline',
      }}
    >
      {label}
    </dt>
    <dd
      style={{
        margin: 0,
        fontSize: 13,
        color: C.ink,
        fontWeight: bold ? 600 : 400,
        fontFamily: mono
          ? '"JetBrains Mono", SFMono-Regular, Menlo, monospace'
          : 'inherit',
        fontVariantNumeric: 'tabular-nums',
        wordBreak: 'break-word',
      }}
    >
      {value || <span style={{ color: C.ink3 }}>—</span>}
    </dd>
  </>
)

function formatKind(kind: string | null): string | null {
  if (!kind) return null
  return kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default GeneralInfoCard
