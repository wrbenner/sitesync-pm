// Phase 4 — Reviewer plate side panel (Ball-in-Court view).
//
// Opens on reviewer-name click in the BIC group header. Shows the reviewer's
// full plate across the project: counts by status, oldest item, avg days in
// court, and a clickable list with quick-link to detail. Uses the shared
// SidePanel chrome (right-rail, 400px, ADR-004).

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Clock, AlertTriangle } from 'lucide-react'
import { SidePanel } from '../../shared/SidePanel'
import type { ReviewerStats } from '../../../hooks/useBallInCourtGroups'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  surface: '#FCFCFA',
  surfaceInset: '#F5F5F1',
  active: '#2D8A6E',
  critical: '#C93B3B',
  pending: '#C4850C',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface ReviewerSidePanelProps {
  open: boolean
  onClose: () => void
  reviewer: ReviewerStats | null
}

export const ReviewerSidePanel: React.FC<ReviewerSidePanelProps> = ({ open, onClose, reviewer }) => {
  const navigate = useNavigate()

  if (!reviewer) return null

  // Status counts
  const byStatus = new Map<string, number>()
  for (const r of reviewer.rows) {
    const s = String(r.status ?? 'unknown').toLowerCase()
    byStatus.set(s, (byStatus.get(s) ?? 0) + 1)
  }
  const sortedStatuses = Array.from(byStatus.entries()).sort((a, b) => b[1] - a[1])

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={reviewer.reviewerName}
      subtitle={reviewer.reviewerRole ?? 'Project reviewer'}
    >
      {/* Top stats */}
      <section
        aria-label="Reviewer summary"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <Stat label="Total on plate" value={reviewer.totalCount} />
        <Stat
          label="Overdue"
          value={reviewer.overdueCount}
          tone={reviewer.overdueCount > 0 ? 'critical' : 'default'}
          icon={reviewer.overdueCount > 0 ? <AlertTriangle size={11} /> : undefined}
        />
        <Stat
          label="Avg days in court"
          value={reviewer.avgDaysInCourt > 0 ? reviewer.avgDaysInCourt.toFixed(1) : '—'}
          icon={<Clock size={11} />}
        />
        <Stat
          label="Oldest"
          value={
            reviewer.oldestSubmittal
              ? `${(reviewer.oldestSubmittal.days_in_court as number | null) ?? 0}d`
              : '—'
          }
        />
      </section>

      {/* Status breakdown */}
      {sortedStatuses.length > 0 && (
        <section style={{ marginBottom: 16 }}>
          <h3 style={sectionHeading}>By status</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {sortedStatuses.map(([status, count]) => (
              <span
                key={status}
                style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 3,
                  backgroundColor: C.surfaceInset,
                  color: C.ink2,
                  fontWeight: 500,
                }}
              >
                {status}: {count}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Items list */}
      <section>
        <h3 style={sectionHeading}>Items ({reviewer.rows.length})</h3>
        <ul role="list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {reviewer.rows.map((row) => {
            const days = (row.days_in_court as number | null) ?? null
            const isOverdueRow = days != null && days > 7
            return (
              <li
                key={String(row.id)}
                style={{
                  padding: '8px 0',
                  borderBottom: `1px solid ${C.borderSubtle}`,
                }}
              >
                <button
                  type="button"
                  onClick={() => { onClose(); navigate(`/submittals/${row.id}`) }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: C.ink,
                    fontFamily: FONT,
                    fontSize: 12,
                  }}
                >
                  <span
                    style={{
                      flex: '0 0 auto',
                      width: 60,
                      color: C.ink3,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {String(row.number ?? '')}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontWeight: 500,
                    }}
                  >
                    {String(row.title ?? '')}
                  </span>
                  {days != null && (
                    <span
                      style={{
                        fontSize: 10,
                        color: isOverdueRow ? C.critical : C.ink3,
                        fontVariantNumeric: 'tabular-nums',
                        flex: '0 0 auto',
                      }}
                    >
                      {days}d
                    </span>
                  )}
                  <ChevronRight size={12} color={C.ink3} />
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </SidePanel>
  )
}

const sectionHeading: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: 11,
  fontWeight: 600,
  color: C.ink3,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

interface StatProps {
  label: string
  value: number | string
  tone?: 'default' | 'critical'
  icon?: React.ReactNode
}

const Stat: React.FC<StatProps> = ({ label, value, tone = 'default', icon }) => (
  <div
    style={{
      padding: '8px 10px',
      backgroundColor: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 4,
    }}
  >
    <div style={{ fontSize: 10, color: C.ink3, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {label}
    </div>
    <div
      style={{
        marginTop: 2,
        fontSize: 18,
        fontWeight: 600,
        color: tone === 'critical' ? C.critical : C.ink,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {icon}
      {value}
    </div>
  </div>
)

export default ReviewerSidePanel
