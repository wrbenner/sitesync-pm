// ─────────────────────────────────────────────────────────────────────────────
// InboxClearState — what the Needs You panel renders when the user has zero
// open items. Not a void, not an editorial "Nothing waiting on you." moment.
// A confident project status panel that says: you're caught up; the project
// is still moving; here's what's next.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import { colors, typography, spacing } from '../../styles/theme'
import { useProjectId } from '../../hooks/useProjectId'
import { useScheduleActivities } from '../../hooks/useScheduleActivities'

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const DAY_MS = 86_400_000

export const InboxClearState: React.FC = () => {
  const navigate = useNavigate()
  const projectId = useProjectId()
  const { data: scheduleActs } = useScheduleActivities(projectId ?? '')

  // Next 7 days: activities active or starting in [today, today+7).
  const upcoming = useMemo(() => {
    const today = startOfDay(new Date()).getTime()
    const horizon = today + 7 * DAY_MS
    const out: Array<{ id: string; name: string; start: number; end: number; isCp: boolean }> = []
    for (const a of scheduleActs ?? []) {
      if (!a.start_date || !a.end_date) continue
      const start = startOfDay(new Date(a.start_date)).getTime()
      const end = startOfDay(new Date(a.end_date)).getTime()
      if (end < today) continue
      if (start > horizon) continue
      out.push({ id: a.id, name: a.name, start, end, isCp: !!a.is_critical_path })
    }
    return out.sort((a, b) => a.start - b.start).slice(0, 6)
  }, [scheduleActs])

  function whenLabel(start: number, end: number): string {
    const today = startOfDay(new Date()).getTime()
    if (start <= today && end >= today) return 'in progress'
    const days = Math.round((start - today) / DAY_MS)
    if (days === 1) return 'tomorrow'
    if (days <= 6) return `in ${days}d`
    return 'next week'
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: colors.surfaceRaised,
      }}
    >
      {/* Hero block */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[4],
          padding: `${spacing[8]} ${spacing[6]}`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            background: 'rgba(45, 138, 110, 0.10)',
            color: '#2D8A6E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <CheckCircle2 size={22} strokeWidth={1.75} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontFamily: typography.fontFamily,
              fontSize: '17px',
              fontWeight: 600,
              color: colors.ink,
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
            }}
          >
            Inbox clear.
          </h3>
          <span
            style={{
              fontFamily: typography.fontFamily,
              fontSize: '13px',
              color: colors.ink2,
              lineHeight: 1.4,
            }}
          >
            No items need you right now. The project is still moving — here's what's coming up.
          </span>
        </div>
      </div>

      {/* Next 7 days */}
      <div style={{ padding: `${spacing[5]} ${spacing[6]} ${spacing[6]}`, flex: 1, minHeight: 0 }}>
        <div
          style={{
            fontFamily: typography.fontFamily,
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: colors.ink3,
            marginBottom: spacing[3],
          }}
        >
          Next 7 days
        </div>
        {upcoming.length === 0 ? (
          <span style={{ fontFamily: typography.fontFamily, fontSize: '13px', color: colors.ink3 }}>
            Nothing scheduled in the next week.
          </span>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {upcoming.map((a) => (
              <li
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: spacing[3],
                  padding: `${spacing[2]} 0`,
                  borderBottom: `1px solid ${colors.borderSubtle}`,
                  fontFamily: typography.fontFamily,
                  fontSize: '13px',
                }}
              >
                <span
                  style={{
                    color: colors.ink,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: spacing[2],
                    minWidth: 0,
                  }}
                >
                  {a.isCp && (
                    <span
                      aria-label="critical path"
                      style={{
                        display: 'inline-block',
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: '#B8472E',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.name}
                  </span>
                </span>
                <span
                  style={{
                    color: colors.ink3,
                    fontSize: '12px',
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                  }}
                >
                  {whenLabel(a.start, a.end)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => navigate('/schedule')}
          style={{
            marginTop: spacing[4],
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: `${spacing[2]} 0`,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: typography.fontFamily,
            fontSize: '12px',
            fontWeight: 500,
            color: colors.primaryOrange,
          }}
        >
          Open schedule
          <ArrowRight size={12} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  )
}

export default InboxClearState
