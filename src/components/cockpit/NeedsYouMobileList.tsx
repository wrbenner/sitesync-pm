// ─────────────────────────────────────────────────────────────────────────────
// NeedsYouMobileList — phone variant of NeedsYouTable.
// ─────────────────────────────────────────────────────────────────────────────
// 8-column tables don't read at 390px. This is the same data, urgency-banded
// the same way, but rendered as tappable rows with two-line layout:
//
//   ⚠ RFI #247 — Electrical conduit routing
//     Martinez Eng. · 3d overdue · $42K · Iris draft ›
//
// Same urgency banding, same role-filtered items, same click-to-navigate.
// No keyboard nav (mobile doesn't need it).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react'
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
} from 'lucide-react'
import { colors, typography, spacing } from '../../styles/theme'
import type { StreamItem, StreamItemType, Urgency } from '../../types/stream'

interface NeedsYouMobileListProps {
  items: StreamItem[]
  onRowClick: (item: StreamItem) => void
  onIrisClick: (item: StreamItem) => void
  resolveName?: (value: string | null | undefined) => string | null
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

function formatDollars(n: number | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n === 0) return null
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

function ageDays(createdAt: string, now: Date): number {
  const t = Date.parse(createdAt)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000))
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function dueRelative(due: string | null, now: Date): string | null {
  if (!due) return null
  const t = Date.parse(due)
  if (!Number.isFinite(t)) return null
  const days = Math.round(
    (startOfDay(new Date(t)).getTime() - startOfDay(now).getTime()) / 86_400_000,
  )
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days > 0) return `+${days}d`
  return `${-days}d overdue`
}

export const NeedsYouMobileList: React.FC<NeedsYouMobileListProps> = ({
  items,
  onRowClick,
  onIrisClick,
  resolveName,
}) => {
  const now = useMemo(() => new Date(), [])
  const grouped = useMemo(() => {
    const buckets: Record<Urgency, StreamItem[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    }
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
        Inbox clear.
      </div>
    )
  }

  return (
    <div>
      {URGENCY_ORDER.map((urgency) => {
        const rows = grouped[urgency]
        if (rows.length === 0) return null
        return (
          <React.Fragment key={urgency}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing[2],
                padding: `${spacing[2]} ${spacing[4]}`,
                background: colors.surfaceInset,
                borderTop: `1px solid ${colors.borderSubtle}`,
                borderBottom: `1px solid ${colors.borderSubtle}`,
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
                  marginLeft: 'auto',
                }}
              >
                {rows.length}
              </span>
            </div>
            {rows.map((item) => (
              <MobileRow
                key={item.id}
                item={item}
                now={now}
                resolveName={resolveName}
                onClick={() => onRowClick(item)}
                onIris={() => onIrisClick(item)}
              />
            ))}
          </React.Fragment>
        )
      })}
    </div>
  )
}

function MobileRow({
  item,
  now,
  resolveName,
  onClick,
  onIris,
}: {
  item: StreamItem
  now: Date
  resolveName?: (value: string | null | undefined) => string | null
  onClick: () => void
  onIris: () => void
}) {
  const Icon = TYPE_ICON[item.type] ?? ListTodo
  const irisAvailable = !!item.irisEnhancement?.draftAvailable
  const due = dueRelative(item.dueDate, now)
  const dollars = formatDollars(item.costImpact)
  const age = ageDays(item.createdAt, now)
  const meta: string[] = []
  const who = resolveName
    ? resolveName(item.assignedTo ?? item.party)
    : (item.assignedTo ?? item.party)
  if (who) meta.push(who)
  if (due) meta.push(due)
  if (dollars) meta.push(dollars)
  if (age > 0 && !due) meta.push(`${age}d`)

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        gap: spacing[3],
        width: '100%',
        padding: `${spacing[3]} ${spacing[4]}`,
        background: colors.surfaceRaised,
        border: 'none',
        borderBottom: `1px solid ${colors.borderSubtle}`,
        textAlign: 'left',
        cursor: 'pointer',
        minHeight: 56,
        alignItems: 'flex-start',
      }}
    >
      <span style={{ marginTop: 2, flexShrink: 0 }}>
        <Icon size={14} color={colors.ink3} strokeWidth={1.75} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
        <span
          style={{
            fontFamily: typography.fontFamily,
            fontSize: '14px',
            fontWeight: 500,
            color: colors.ink,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.3,
          }}
        >
          {item.title}
        </span>
        <span
          style={{
            fontFamily: typography.fontFamily,
            fontSize: '12px',
            color: item.overdue ? '#C93B3B' : colors.ink3,
            fontWeight: item.overdue ? 500 : 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.4,
          }}
        >
          {meta.join(' · ')}
        </span>
      </span>
      {irisAvailable && (
        <span
          onClick={(e) => {
            e.stopPropagation()
            onIris()
          }}
          role="button"
          tabIndex={0}
          aria-label="Open Iris draft"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 7px',
            background: 'rgba(79, 70, 229, 0.08)',
            border: '1px solid rgba(79, 70, 229, 0.20)',
            borderRadius: 999,
            fontFamily: typography.fontFamily,
            fontSize: '11px',
            fontWeight: 500,
            color: '#4F46E5',
            flexShrink: 0,
            lineHeight: 1.2,
            marginTop: 2,
          }}
        >
          <Sparkles size={10} strokeWidth={2.25} aria-hidden />
          Draft
        </span>
      )}
    </button>
  )
}

export default NeedsYouMobileList
