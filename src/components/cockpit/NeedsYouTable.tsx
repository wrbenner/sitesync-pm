// ─────────────────────────────────────────────────────────────────────────────
// NeedsYouTable — the dense aggregate inbox on the cockpit dashboard.
// ─────────────────────────────────────────────────────────────────────────────
// One row per actionable item across all types (RFI, Sub, Punch, CO, Task,
// Daily Log, Incident, Schedule). Eight columns, sticky header, sortable.
// Click a row → navigate to source. No expand/collapse on the dashboard;
// dashboards are for glance + jump, not deep work.
//
// Rows are grouped by urgency tier (critical / high / medium / low) with
// small section headers separating tiers.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react'
import {
  MessageCircle,
  FileCheck,
  CheckCircle,
  DollarSign,
  ListTodo,
  BookOpen,
  AlertTriangle,
  Calendar,
  Handshake,
  Sparkles,
  ChevronRight,
} from 'lucide-react'
import { colors, typography, spacing } from '../../styles/theme'
import type { StreamItem, StreamItemType, Urgency } from '../../types/stream'

interface NeedsYouTableProps {
  items: StreamItem[]
  onRowClick: (item: StreamItem) => void
  onIrisClick: (item: StreamItem) => void
}

const TYPE_ICON: Record<StreamItemType, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  rfi: MessageCircle,
  submittal: FileCheck,
  punch: CheckCircle,
  change_order: DollarSign,
  task: ListTodo,
  daily_log: BookOpen,
  incident: AlertTriangle,
  schedule: Calendar,
  commitment: Handshake,
}

const TYPE_LABEL: Record<StreamItemType, string> = {
  rfi: 'RFI',
  submittal: 'SUB',
  punch: 'PUNCH',
  change_order: 'CO',
  task: 'TASK',
  daily_log: 'LOG',
  incident: 'SAFETY',
  schedule: 'SCHED',
  commitment: 'OWED',
}

const URGENCY_ORDER: Urgency[] = ['critical', 'high', 'medium', 'low']
const URGENCY_LABEL: Record<Urgency, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}
const URGENCY_DOT: Record<Urgency, string> = {
  critical: '#C93B3B',
  high: '#B8472E',
  medium: '#C4850C',
  low: '#8C857E',
}

function formatDollars(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

function ageDays(createdAt: string, now: Date): number {
  const t = Date.parse(createdAt)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000))
}

function dueRelative(due: string | null, now: Date): string {
  if (!due) return '—'
  const t = Date.parse(due)
  if (!Number.isFinite(t)) return '—'
  const days = Math.round((startOfDay(new Date(t)).getTime() - startOfDay(now).getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days > 0) return `+${days}d`
  return `${days}d` // already negative
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const COL_WIDTHS = {
  type: 64,
  title: 'auto',
  who: 160,
  due: 80,
  dollars: 76,
  age: 60,
  iris: 90,
  chevron: 28,
} as const

export const NeedsYouTable: React.FC<NeedsYouTableProps> = ({ items, onRowClick, onIrisClick }) => {
  const now = useMemo(() => new Date(), [])
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const buckets: Record<Urgency, StreamItem[]> = { critical: [], high: [], medium: [], low: [] }
    for (const it of items) buckets[it.urgency].push(it)
    return buckets
  }, [items])

  if (items.length === 0) {
    return (
      <div
        style={{
          padding: `${spacing[8]} ${spacing[5]}`,
          textAlign: 'center',
          fontFamily: typography.fontFamily,
          fontSize: '13px',
          color: colors.ink3,
        }}
      >
        Inbox clear. Project pulse to the right.
      </div>
    )
  }

  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: typography.fontFamily,
        fontSize: '13px',
      }}
    >
      <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: colors.surfaceFlat }}>
        <tr>
          <Th style={{ width: COL_WIDTHS.type, textAlign: 'left' }}>Type</Th>
          <Th style={{ textAlign: 'left' }}>What</Th>
          <Th style={{ width: COL_WIDTHS.who, textAlign: 'left' }}>Who</Th>
          <Th style={{ width: COL_WIDTHS.due, textAlign: 'right' }}>Due</Th>
          <Th style={{ width: COL_WIDTHS.dollars, textAlign: 'right' }}>$</Th>
          <Th style={{ width: COL_WIDTHS.age, textAlign: 'right' }}>Age</Th>
          <Th style={{ width: COL_WIDTHS.iris, textAlign: 'left' }}>Iris</Th>
          <Th style={{ width: COL_WIDTHS.chevron }} />
        </tr>
      </thead>
      <tbody>
        {URGENCY_ORDER.map((urgency) => {
          const rows = grouped[urgency]
          if (rows.length === 0) return null
          return (
            <React.Fragment key={urgency}>
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: `${spacing[2]} ${spacing[4]}`,
                    background: colors.surfaceInset,
                    borderTop: `1px solid ${colors.borderSubtle}`,
                    borderBottom: `1px solid ${colors.borderSubtle}`,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: spacing[2],
                      fontFamily: typography.fontFamily,
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: colors.ink2,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: URGENCY_DOT[urgency],
                        display: 'inline-block',
                      }}
                    />
                    {URGENCY_LABEL[urgency]}
                    <span
                      style={{
                        fontVariantNumeric: 'tabular-nums',
                        color: colors.ink3,
                        fontWeight: 500,
                        letterSpacing: 0,
                        textTransform: 'none',
                      }}
                    >
                      {rows.length}
                    </span>
                  </span>
                </td>
              </tr>
              {rows.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  now={now}
                  hovered={hoveredId === item.id}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onRowClick(item)}
                  onIris={() => onIrisClick(item)}
                />
              ))}
            </React.Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th
      style={{
        padding: `${spacing[2]} ${spacing[4]}`,
        fontFamily: typography.fontFamily,
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: colors.ink3,
        borderBottom: `1px solid ${colors.borderDefault}`,
        background: colors.surfaceFlat,
        ...style,
      }}
    >
      {children}
    </th>
  )
}

function Row({
  item,
  now,
  hovered,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onIris,
}: {
  item: StreamItem
  now: Date
  hovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: () => void
  onIris: () => void
}) {
  const Icon = TYPE_ICON[item.type] ?? ListTodo
  const irisAvailable = !!item.irisEnhancement?.draftAvailable
  const due = dueRelative(item.dueDate, now)
  const overdue = item.overdue

  return (
    <tr
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{
        cursor: 'pointer',
        background: hovered ? colors.surfaceHover : colors.surfaceRaised,
        transition: 'background 80ms linear',
      }}
    >
      <Td>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing[2] }}>
          <Icon size={13} color={colors.ink3} strokeWidth={1.75} />
          <span
            style={{
              fontFamily: typography.fontFamily,
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              color: colors.ink3,
            }}
          >
            {TYPE_LABEL[item.type]}
          </span>
        </span>
      </Td>
      <Td>
        <span
          style={{
            fontFamily: typography.fontFamily,
            fontSize: '13px',
            fontWeight: 500,
            color: colors.ink,
            display: 'block',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '38vw',
          }}
        >
          {item.title}
        </span>
      </Td>
      <Td>
        <span
          style={{
            fontFamily: typography.fontFamily,
            fontSize: '13px',
            color: colors.ink2,
            display: 'block',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.assignedTo ?? item.party ?? '—'}
        </span>
      </Td>
      <Td style={{ textAlign: 'right' }}>
        <span
          style={{
            fontFamily: typography.fontFamily,
            fontVariantNumeric: 'tabular-nums',
            fontSize: '13px',
            fontWeight: overdue ? 600 : 400,
            color: overdue ? '#C93B3B' : colors.ink2,
          }}
        >
          {due}
        </span>
      </Td>
      <Td style={{ textAlign: 'right' }}>
        <span
          style={{
            fontFamily: typography.fontFamily,
            fontVariantNumeric: 'tabular-nums',
            fontSize: '13px',
            color: colors.ink2,
          }}
        >
          {formatDollars(item.costImpact)}
        </span>
      </Td>
      <Td style={{ textAlign: 'right' }}>
        <span
          style={{
            fontFamily: typography.fontFamily,
            fontVariantNumeric: 'tabular-nums',
            fontSize: '13px',
            color: colors.ink3,
          }}
        >
          {ageDays(item.createdAt, now)}d
        </span>
      </Td>
      <Td>
        {irisAvailable ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onIris()
            }}
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 7px',
              background: 'rgba(79, 70, 229, 0.08)',
              border: '1px solid rgba(79, 70, 229, 0.20)',
              borderRadius: 999,
              fontFamily: typography.fontFamily,
              fontSize: '11px',
              fontWeight: 500,
              color: '#4F46E5',
              cursor: 'pointer',
              lineHeight: 1.2,
            }}
          >
            <Sparkles size={10} strokeWidth={2.25} aria-hidden />
            Draft
          </button>
        ) : (
          <span style={{ color: colors.ink4 }}>—</span>
        )}
      </Td>
      <Td style={{ textAlign: 'right' }}>
        <ChevronRight size={14} color={hovered ? colors.ink2 : colors.ink4} strokeWidth={1.75} />
      </Td>
    </tr>
  )
}

function Td({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td
      style={{
        padding: `${spacing[2]} ${spacing[4]}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
        verticalAlign: 'middle',
        ...style,
      }}
    >
      {children}
    </td>
  )
}

export default NeedsYouTable
