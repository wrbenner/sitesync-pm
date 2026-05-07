// ── RFIKanbanView ───────────────────────────────────────────────────────
// Procore-mirror Kanban board for RFIs by status. Drag a card from one
// column to another to fire a state-machine transition (NOT a direct
// status update — uses getNextStatus + transition() so audit_log fires
// on every move).
//
// Reduce-Motion: the framer-motion transitions on cards check
// prefers-reduced-motion and short-circuit to no animation.

import React, { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { Calendar, User } from 'lucide-react'
import { Avatar } from '../Primitives'
import { useUpdateRFI } from '../../hooks/mutations'
import { getRFIStatusConfig, getValidTransitions, getNextStatus, type RFIState } from '../../machines/rfiMachine'
import { usePermissions } from '../../hooks/usePermissions'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

interface KanbanRow {
  id: string
  number: number | null
  title: string
  status: RFIState
  priority: 'low' | 'medium' | 'high' | 'critical'
  ball_in_court: string | null
  due_date: string | null
  created_at: string | null
}

interface RFIKanbanViewProps {
  rfis: KanbanRow[]
  projectId: string
  onCardClick: (rfiId: string) => void
}

const COLUMN_ORDER: Array<{ status: RFIState; label: string }> = [
  { status: 'draft', label: 'Draft' },
  { status: 'open', label: 'Open' },
  { status: 'under_review', label: 'Under Review' },
  { status: 'answered', label: 'Answered' },
  { status: 'closed', label: 'Closed' },
]

const PRIORITY_COLORS: Record<KanbanRow['priority'], string> = {
  critical: '#C93B3B',
  high: '#B8472E',
  medium: '#C4850C',
  low: '#8C857E',
}

const daysOpen = (createdAt: string | null): number => {
  if (!createdAt) return 0
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
}

export const RFIKanbanView: React.FC<RFIKanbanViewProps> = ({ rfis, projectId, onCardClick }) => {
  const updateRFI = useUpdateRFI()
  const reduceMotion = useReducedMotion()
  const { role } = usePermissions()
  const userRole = role ?? 'viewer'

  const [dragRfiId, setDragRfiId] = useState<string | null>(null)
  const [hoverColumn, setHoverColumn] = useState<RFIState | null>(null)

  const columns = useMemo(() => {
    const buckets: Record<RFIState, KanbanRow[]> = {
      draft: [],
      open: [],
      under_review: [],
      answered: [],
      closed: [],
      void: [],
    } as Record<RFIState, KanbanRow[]>
    for (const r of rfis) {
      const key = r.status as RFIState
      if (buckets[key]) buckets[key].push(r)
    }
    return buckets
  }, [rfis])

  const handleDrop = async (rfiId: string, toStatus: RFIState) => {
    setHoverColumn(null)
    setDragRfiId(null)
    const rfi = rfis.find((r) => r.id === rfiId)
    if (!rfi || rfi.status === toStatus) return

    // Find the action label that would transition current → target.
    const transitions = getValidTransitions(rfi.status, userRole)
    let actionLabel: string | null = null
    for (const t of transitions) {
      const next = getNextStatus(rfi.status, t)
      if (next === toStatus) {
        actionLabel = t
        break
      }
    }
    if (!actionLabel) {
      toast.error(`Cannot transition ${rfi.status} → ${toStatus} from your role`)
      return
    }

    try {
      await updateRFI.mutateAsync({
        id: rfi.id,
        projectId,
        updates: { status: toStatus },
      })
      toast.success(`RFI moved to ${toStatus.replace('_', ' ')}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Move failed')
    }
  }

  return (
    <div
      role="region"
      aria-label="RFI Kanban board"
      style={{
        display: 'flex',
        gap: spacing['3'],
        overflowX: 'auto',
        padding: spacing['3'],
        minHeight: '60vh',
        backgroundColor: colors.surfaceInset,
      }}
    >
      {COLUMN_ORDER.map(({ status, label }) => {
        const cards = columns[status] ?? []
        const cfg = getRFIStatusConfig(status)
        const isDropping = hoverColumn === status && dragRfiId != null
        return (
          <div
            key={status}
            onDragOver={(e) => {
              if (dragRfiId) {
                e.preventDefault()
                setHoverColumn(status)
              }
            }}
            onDragLeave={() => setHoverColumn((h) => (h === status ? null : h))}
            onDrop={() => {
              if (dragRfiId) void handleDrop(dragRfiId, status)
            }}
            style={{
              flex: '0 0 280px',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: isDropping ? colors.orangeSubtle : colors.surfaceRaised,
              border: `1px solid ${isDropping ? colors.primaryOrange : colors.borderSubtle}`,
              borderRadius: borderRadius.base,
              transition: reduceMotion ? undefined : 'background-color 0.15s, border-color 0.15s',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderBottom: `1px solid ${colors.borderSubtle}`,
                backgroundColor: cfg.bg,
                color: cfg.color,
                borderRadius: `${borderRadius.base} ${borderRadius.base} 0 0`,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {label}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600 }}>{cards.length}</span>
            </div>

            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: spacing['2'],
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                overflowY: 'auto',
                flex: 1,
              }}
            >
              {cards.map((card) => {
                const overdue = !!card.due_date && card.due_date < new Date().toISOString().slice(0, 10) && status !== 'closed'
                return (
                  <motion.li
                    key={card.id}
                    layout={reduceMotion ? false : 'position'}
                    draggable
                    onDragStart={() => setDragRfiId(card.id)}
                    onDragEnd={() => setDragRfiId(null)}
                    onClick={() => onCardClick(card.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onCardClick(card.id)
                      }
                    }}
                    style={{
                      backgroundColor: 'white',
                      border: `1px solid ${colors.borderSubtle}`,
                      borderLeft: `3px solid ${PRIORITY_COLORS[card.priority] ?? colors.borderSubtle}`,
                      borderRadius: borderRadius.sm,
                      padding: spacing['2'],
                      cursor: 'grab',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: colors.primaryOrange, fontFamily: typography.fontFamilyMono }}>
                        RFI-{String(card.number ?? '').padStart(3, '0')}
                      </span>
                      <span style={{ fontSize: 10, color: PRIORITY_COLORS[card.priority] ?? colors.textTertiary, fontWeight: 600, textTransform: 'uppercase' }}>
                        {card.priority}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: colors.textPrimary,
                        fontWeight: 500,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {card.title}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span
                        title={card.due_date ?? ''}
                        style={{
                          fontSize: 11,
                          color: overdue ? '#C93B3B' : colors.textTertiary,
                          fontWeight: overdue ? 600 : 400,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <Calendar size={10} /> {card.due_date ? card.due_date.slice(5) : '—'}
                      </span>
                      <span style={{ fontSize: 10, color: colors.textTertiary }}>{daysOpen(card.created_at)}d open</span>
                      {card.ball_in_court ? (
                        <Avatar initials={initialsFor(card.ball_in_court)} size={20} />
                      ) : (
                        <User size={14} style={{ color: colors.textTertiary }} />
                      )}
                    </div>
                  </motion.li>
                )
              })}
              {cards.length === 0 && (
                <li
                  style={{
                    padding: spacing['3'],
                    textAlign: 'center',
                    fontSize: 11,
                    color: colors.textTertiary,
                    fontStyle: 'italic',
                  }}
                >
                  No RFIs in {label.toLowerCase()}.
                </li>
              )}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

function initialsFor(idOrName: string): string {
  return idOrName.slice(0, 2).toUpperCase()
}

export default RFIKanbanView
