// ── RFICalendarView ─────────────────────────────────────────────────────
// Month-grid view of RFIs by due_date. Click a date to filter the list to
// that day; click a card to open detail.
//
// Color toggle: Status (default) or Priority. The chosen `colorBy` is
// persisted on the saved view's `color_by` column.

import React, { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { getRFIStatusConfig, type RFIState } from '../../machines/rfiMachine'

interface CalRow {
  id: string
  number: number | null
  title: string
  status: RFIState
  priority: 'low' | 'medium' | 'high' | 'critical'
  due_date: string | null
}

interface RFICalendarViewProps {
  rfis: CalRow[]
  colorBy: 'status' | 'priority'
  onColorByChange: (mode: 'status' | 'priority') => void
  onDayClick: (isoDate: string) => void
  onCardClick: (rfiId: string) => void
}

const PRIORITY_COLORS: Record<CalRow['priority'], { bg: string; fg: string }> = {
  critical: { bg: '#FEE2E2', fg: '#7C2D12' },
  high: { bg: '#FEF2F2', fg: '#DC2626' },
  medium: { bg: '#FFFBEB', fg: '#D97706' },
  low: { bg: '#F3F4F6', fg: '#6B7280' },
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function buildMonthGrid(viewMonth: Date): Date[] {
  // Anchor on Sunday of the week containing the 1st.
  const first = startOfMonth(viewMonth)
  const grid: Date[] = []
  const dayOfWeek = first.getDay()
  const start = new Date(first)
  start.setDate(first.getDate() - dayOfWeek)
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    grid.push(d)
  }
  return grid
}

function isoOf(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export const RFICalendarView: React.FC<RFICalendarViewProps> = ({
  rfis,
  colorBy,
  onColorByChange,
  onDayClick,
  onCardClick,
}) => {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()))

  const byDate = useMemo(() => {
    const map: Record<string, CalRow[]> = {}
    for (const r of rfis) {
      if (!r.due_date) continue
      ;(map[r.due_date] ??= []).push(r)
    }
    return map
  }, [rfis])

  const grid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth])
  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const colorOf = (r: CalRow): { bg: string; fg: string } => {
    if (colorBy === 'priority') return PRIORITY_COLORS[r.priority] ?? PRIORITY_COLORS.medium
    const cfg = getRFIStatusConfig(r.status)
    return { bg: cfg.bg, fg: cfg.color }
  }

  return (
    <div
      role="region"
      aria-label="RFI calendar"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.surfaceRaised }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['2'],
          padding: spacing['3'],
          borderBottom: `1px solid ${colors.borderSubtle}`,
          backgroundColor: colors.surfaceInset,
        }}
      >
        <button
          type="button"
          onClick={() => setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          style={iconBtn}
          aria-label="Previous month"
        >
          <ChevronLeft size={14} />
        </button>
        <h2 style={{ flex: 1, margin: 0, fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>
          {monthLabel}
        </h2>
        <button
          type="button"
          onClick={() => setViewMonth(startOfMonth(new Date()))}
          style={{ ...iconBtn, padding: '4px 10px', width: 'auto' }}
        >
          <CalendarIcon size={12} /> Today
        </button>
        <button
          type="button"
          onClick={() => setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          style={iconBtn}
          aria-label="Next month"
        >
          <ChevronRight size={14} />
        </button>
        <span aria-hidden="true" style={{ width: 1, height: 16, backgroundColor: colors.borderSubtle, margin: `0 ${spacing['2']}` }} />
        <ToggleSegment
          value={colorBy}
          onChange={onColorByChange}
          options={[
            { value: 'status', label: 'Status' },
            { value: 'priority', label: 'Priority' },
          ]}
        />
      </div>

      {/* Day-of-week header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          padding: '6px 0',
          backgroundColor: colors.surfacePage,
          borderBottom: `1px solid ${colors.borderSubtle}`,
        }}
      >
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <span
            key={d}
            style={{
              fontSize: 10,
              textAlign: 'center',
              color: colors.textTertiary,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {d}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gridAutoRows: 'minmax(96px, 1fr)',
        }}
      >
        {grid.map((d, i) => {
          const iso = isoOf(d)
          const inMonth = d.getMonth() === viewMonth.getMonth()
          const isToday = iso === isoOf(new Date())
          const cards = byDate[iso] ?? []
          return (
            <div
              key={i}
              style={{
                border: `1px solid ${colors.borderSubtle}`,
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                backgroundColor: inMonth ? colors.surfaceRaised : colors.surfaceInset,
                opacity: inMonth ? 1 : 0.5,
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => onDayClick(iso)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 2,
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? colors.primaryOrange : colors.textSecondary,
                  cursor: 'pointer',
                }}
              >
                {d.getDate()}
              </button>
              {cards.slice(0, 3).map((c) => {
                const tone = colorOf(c)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onCardClick(c.id)}
                    title={`RFI-${String(c.number ?? '').padStart(3, '0')}: ${c.title}`}
                    style={{
                      display: 'block',
                      textAlign: 'left',
                      backgroundColor: tone.bg,
                      color: tone.fg,
                      border: 'none',
                      borderRadius: borderRadius.sm,
                      padding: '2px 6px',
                      fontSize: 11,
                      fontWeight: 500,
                      cursor: 'pointer',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.number != null ? `#${c.number} ` : ''}{c.title}
                  </button>
                )
              })}
              {cards.length > 3 && (
                <button
                  type="button"
                  onClick={() => onDayClick(iso)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: 10,
                    color: colors.textTertiary,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  +{cards.length - 3} more
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  width: 28,
  height: 28,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.sm,
  background: 'transparent',
  color: colors.textSecondary,
  cursor: 'pointer',
  fontSize: typography.fontSize.caption,
}

interface ToggleSegmentProps<T extends string> {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
}

function ToggleSegment<T extends string>({ value, onChange, options }: ToggleSegmentProps<T>) {
  return (
    <div style={{ display: 'inline-flex', border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.sm, overflow: 'hidden' }}>
      {options.map((o) => {
        const on = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              backgroundColor: on ? colors.primaryOrange : 'transparent',
              color: on ? 'white' : colors.textSecondary,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export default RFICalendarView
