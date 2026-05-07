// Phase 2 — 11 column definitions for the dense Items view.
// Per SUBMITTALS_PAGE_REBUILD_PLAN_2026-05-06.md Phase 2.
//
// Columns (left → right):
//   1. Spec §       — CSI section + spec deep-link tooltip
//   2. #            — submittal number (CSI-aligned via formatSubmittalNumber)
//   3. Rev          — rev_number
//   4. Title        — title
//   5. Type         — kind (legacy `type` fallback)
//   6. Status       — colored StatusPill (9-state aware)
//   7. Sub          — responsible sub name
//   8. Submit By    — submit_by_date (overdue red)
//   9. BIC          — current_reviewer_name + days_in_court (em-dash for closed/draft/void)
//  10. Days         — days_in_court (numeric)
//  11. 📎           — attachment count icon
//
// Each column declares min/default/max widths in px; SubmittalsItemsView
// collapses the right-edge columns into an overflow indicator below 1280px.

import React from 'react'
import { Link } from 'react-router-dom'
import { Paperclip, AlertTriangle } from 'lucide-react'
import StatusPill from './StatusPill'
import { formatSubmittalNumber } from './SubmittalNumberDisplay'
import type { SubmittalListRow } from '../../hooks/useSubmittalsList'

export interface ColumnDef {
  id: string
  header: string
  defaultWidth: number
  minWidth: number
  maxWidth: number
  /** True when this column should drop into the overflow indicator < 1280px. */
  collapsible: boolean
  cell: (row: SubmittalListRow, ctx: ColumnContext) => React.ReactNode
  headerCell?: () => React.ReactNode
  numeric?: boolean
}

export interface ColumnContext {
  numberingFormat: string
  isOverdue: (date: string | null | undefined) => boolean
}

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  ink4: '#C4BDB4',
  critical: '#C93B3B',
  brandOrange: '#F47820',
  surfaceInset: '#F5F5F1',
}

const FONT_MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace'

function fmtShortDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function attachmentCount(row: SubmittalListRow): number {
  const att = (row as { attachments?: unknown }).attachments
  if (Array.isArray(att)) return att.length
  if (typeof att === 'object' && att !== null) {
    const arr = (att as { items?: unknown[] }).items
    if (Array.isArray(arr)) return arr.length
  }
  return 0
}

// BIC em-dash logic: em-dash ONLY for draft/closed/void. For other states
// always show reviewer name + days, falling back gracefully if MV row is
// stale (MV refresh runs every 5 min via pg_cron per ADR-003).
const BIC_EMPTY_STATES = new Set(['draft', 'closed', 'void'])
function bicValue(row: SubmittalListRow): { name: string | null; days: number | null; emDash: boolean } {
  const status = String(row.status ?? '').toLowerCase()
  if (BIC_EMPTY_STATES.has(status)) return { name: null, days: null, emDash: true }
  const name =
    (row.current_reviewer_name as string | null) ??
    ((row as { current_reviewer?: string | null }).current_reviewer ?? null)
  const days = (row.days_in_court as number | null) ?? null
  return { name: name || null, days, emDash: !name && days === null }
}

export function buildColumns(): ColumnDef[] {
  return [
    {
      id: 'spec_section',
      header: 'Spec §',
      defaultWidth: 110,
      minWidth: 84,
      maxWidth: 200,
      collapsible: false,
      cell: (row) => {
        const section = (row.csi_section as string | null) ?? ((row as { spec_section?: string | null }).spec_section ?? null)
        if (!section) return <span style={{ color: C.ink4 }}>—</span>
        return (
          <Link
            to={`/spec/${encodeURIComponent(section)}`}
            title={`Open ${section} in spec viewer`}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 12,
              fontWeight: 600,
              color: C.ink,
              textDecoration: 'none',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {section}
          </Link>
        )
      },
    },
    {
      id: 'number',
      header: '#',
      defaultWidth: 110,
      minWidth: 80,
      maxWidth: 160,
      collapsible: false,
      cell: (row, ctx) => {
        const text = formatSubmittalNumber({
          number: row.number,
          csiSection: (row.csi_section as string | null) ?? null,
          csiDivision: (row.csi_division as string | null) ?? null,
          format: ctx.numberingFormat,
        })
        return <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.ink2 }}>{text || '—'}</span>
      },
    },
    {
      id: 'rev',
      header: 'Rev',
      defaultWidth: 56,
      minWidth: 44,
      maxWidth: 80,
      collapsible: false,
      numeric: true,
      cell: (row) => {
        const r = (row.rev_number as number | null) ?? null
        return (
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.ink2, fontVariantNumeric: 'tabular-nums' }}>
            R{r ?? 0}
          </span>
        )
      },
    },
    {
      id: 'title',
      header: 'Title',
      defaultWidth: 280,
      minWidth: 160,
      maxWidth: 600,
      collapsible: false,
      cell: (row) => (
        <span
          title={(row.title as string) ?? ''}
          style={{
            fontSize: 13,
            color: C.ink,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
          }}
        >
          {(row.title as string) || <span style={{ color: C.ink4 }}>(untitled)</span>}
        </span>
      ),
    },
    {
      id: 'kind',
      header: 'Type',
      defaultWidth: 130,
      minWidth: 90,
      maxWidth: 200,
      collapsible: true,
      cell: (row) => {
        const kind = (row.kind as string | null) ?? ((row as { type?: string | null }).type ?? null)
        if (!kind) return <span style={{ color: C.ink4 }}>—</span>
        const label = kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        return (
          <span
            style={{
              fontSize: 11,
              padding: '2px 6px',
              borderRadius: 4,
              backgroundColor: C.surfaceInset,
              color: C.ink2,
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
        )
      },
    },
    {
      id: 'status',
      header: 'Status',
      defaultWidth: 140,
      minWidth: 100,
      maxWidth: 200,
      collapsible: false,
      cell: (row) => <StatusPill status={(row.status as string | null) ?? null} />,
    },
    {
      id: 'sub',
      header: 'Sub',
      defaultWidth: 160,
      minWidth: 100,
      maxWidth: 280,
      collapsible: true,
      cell: (row) => {
        const sub =
          (row.sub_name as string | null) ??
          ((row as { subcontractor?: string | null }).subcontractor ?? null)
        if (!sub) return <span style={{ color: C.ink4 }}>—</span>
        return (
          <span
            title={sub}
            style={{
              fontSize: 12,
              color: C.ink2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
            }}
          >
            {sub}
          </span>
        )
      },
    },
    {
      id: 'submit_by',
      header: 'Submit By',
      defaultWidth: 110,
      minWidth: 86,
      maxWidth: 160,
      collapsible: true,
      cell: (row, ctx) => {
        const date = (row.submit_by_date as string | null) ?? ((row as { due_date?: string | null }).due_date ?? null)
        if (!date) return <span style={{ color: C.ink4 }}>—</span>
        const overdue = ctx.isOverdue(date)
        return (
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              fontVariantNumeric: 'tabular-nums',
              color: overdue ? C.critical : C.ink2,
              fontWeight: overdue ? 600 : 400,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {overdue && <AlertTriangle size={11} />}
            {fmtShortDate(date)}
          </span>
        )
      },
    },
    {
      id: 'bic',
      header: 'BIC',
      defaultWidth: 160,
      minWidth: 110,
      maxWidth: 280,
      collapsible: true,
      cell: (row) => {
        const v = bicValue(row)
        if (v.emDash) return <span style={{ color: C.ink4 }}>—</span>
        return (
          <span
            title={v.name ?? ''}
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              gap: 1,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: C.ink,
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {v.name ?? <span style={{ color: C.ink4 }}>—</span>}
            </span>
            {v.days !== null && v.days >= 0 && (
              <span style={{ fontSize: 10, color: C.ink3, fontVariantNumeric: 'tabular-nums' }}>
                {v.days}d in court
              </span>
            )}
          </span>
        )
      },
    },
    {
      id: 'days_in_court',
      header: 'Days',
      defaultWidth: 64,
      minWidth: 48,
      maxWidth: 96,
      collapsible: true,
      numeric: true,
      cell: (row) => {
        const days = (row.days_in_court as number | null) ?? null
        if (days === null || days < 0) return <span style={{ color: C.ink4 }}>—</span>
        const tone = days >= 14 ? C.critical : days >= 7 ? C.brandOrange : C.ink2
        return (
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontVariantNumeric: 'tabular-nums', color: tone }}>
            {days}d
          </span>
        )
      },
    },
    {
      id: 'attachments',
      header: '📎',
      defaultWidth: 56,
      minWidth: 40,
      maxWidth: 80,
      collapsible: true,
      numeric: true,
      headerCell: () => (
        <span title="Attachments" aria-label="Attachments" style={{ display: 'inline-flex' }}>
          <Paperclip size={12} />
        </span>
      ),
      cell: (row) => {
        const n = attachmentCount(row)
        if (n === 0) return <span style={{ color: C.ink4, fontSize: 11 }}>—</span>
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 11,
              color: C.ink2,
              fontVariantNumeric: 'tabular-nums',
            }}
            aria-label={`${n} attachment${n === 1 ? '' : 's'}`}
          >
            <Paperclip size={11} />
            {n}
          </span>
        )
      },
    },
  ]
}

export type { SubmittalListRow }
