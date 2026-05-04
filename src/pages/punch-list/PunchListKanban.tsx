import React, { useMemo } from 'react'
import {
  Clock, AlertTriangle, Camera, MapPin,
  Play, Eye, CheckCircle2,
} from 'lucide-react'
import { colors, typography } from '../../styles/theme'
import { KanbanBoard } from '../../components/shared/KanbanBoard'
import type { KanbanColumn } from '../../components/shared/KanbanBoard'
import type { PunchItem } from './types'
import { getDaysRemaining, STATUS_COLORS } from './types'

interface PunchListKanbanProps {
  items: PunchItem[]
  onSelectItem: (id: number) => void
  onMoveItem?: (itemId: string | number, fromColumn: string, toColumn: string) => void
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: colors.statusCritical,
  high: '#EF4444',
  medium: colors.statusPending,
  low: colors.statusActive,
}

const _COLUMN_ICONS: Record<string, typeof Play> = {
  open: AlertTriangle,
  in_progress: Play,
  sub_complete: Eye,
  verified: CheckCircle2,
}

export const PunchListKanban: React.FC<PunchListKanbanProps> = ({ items, onSelectItem, onMoveItem }) => {
  const columns: KanbanColumn<PunchItem>[] = useMemo(() => [
    {
      id: 'open',
      label: 'Open',
      color: STATUS_COLORS.open,
      items: items.filter(p => p.verification_status === 'open'),
    },
    {
      id: 'in_progress',
      label: 'In Progress',
      color: STATUS_COLORS.in_progress,
      items: items.filter(p => p.verification_status === 'in_progress'),
    },
    {
      id: 'sub_complete',
      label: 'Pending Verify',
      color: STATUS_COLORS.sub_complete,
      items: items.filter(p => p.verification_status === 'sub_complete'),
    },
    {
      id: 'verified',
      label: 'Closed',
      color: STATUS_COLORS.verified,
      items: items.filter(p => p.verification_status === 'verified'),
    },
  ], [items])

  return (
    <KanbanBoard
      columns={columns}
      getKey={(item) => item.id}
      onMoveItem={onMoveItem}
      renderCard={(item) => {
        const daysLeft = item.dueDate ? getDaysRemaining(item.dueDate) : null
        const isOverdue = daysLeft !== null && daysLeft <= 0 && item.verification_status !== 'verified'
        const priorityColor = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium
        const isRejected = item.rejection_reason && item.verification_status === 'open'

        return (
          <div
            style={{
              padding: 14, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}
            onClick={() => onSelectItem(item.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectItem(item.id); } }}
            role="button"
            tabIndex={0}
            aria-label={`View ${item.itemNumber}: ${item.description}`}
          >
            {/* Top row: number + priority + photo indicator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: colors.primaryOrange,
                  fontFamily: typography.fontFamilyMono,
                }}>
                  {item.itemNumber}
                </span>
                {/* Priority indicator */}
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  backgroundColor: priorityColor,
                }} title={`${item.priority} priority`} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {item.hasPhoto && <Camera size={11} style={{ color: colors.textTertiary }} />}
                {isOverdue && (
                  <span style={{
                    fontSize: 9, fontWeight: 800,
                    color: colors.statusCritical,
                    backgroundColor: colors.statusCriticalSubtle,
                    padding: '1px 5px', borderRadius: 4,
                  }}>
                    OVERDUE
                  </span>
                )}
              </div>
            </div>

            {/* Photo thumbnail (if available) */}
            {item.before_photo_url && (
              <img
                src={item.before_photo_url}
                alt=""
                loading="lazy"
                style={{
                  width: '100%', height: 80, objectFit: 'cover',
                  borderRadius: 8, display: 'block',
                  border: `1px solid ${colors.borderSubtle}`,
                }}
              />
            )}

            {/* Description */}
            <div style={{
              fontSize: 13, fontWeight: 600,
              color: colors.textPrimary,
              lineHeight: 1.35,
              overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}>
              {item.description}
            </div>

            {/* Location */}
            {item.area && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, color: colors.textTertiary,
              }}>
                <MapPin size={9} style={{ flexShrink: 0 }} />
                <span style={{
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {item.area}
                </span>
              </div>
            )}

            {/* Footer: assignee + due date */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              paddingTop: 4,
              borderTop: `1px solid ${colors.borderSubtle}`,
              marginTop: 2,
            }}>
              {item.assigned ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    backgroundColor: colors.orangeSubtle,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 700, color: colors.primaryOrange,
                  }}>
                    {item.assigned.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <span style={{
                    fontSize: 11, color: colors.textSecondary,
                    maxWidth: 80, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.assigned}
                  </span>
                </div>
              ) : <span />}

              {item.dueDate && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  fontSize: 11,
                  color: isOverdue ? colors.statusCritical : colors.textTertiary,
                  fontWeight: isOverdue ? 600 : 400,
                }}>
                  {isOverdue ? <AlertTriangle size={9} /> : <Clock size={9} />}
                  {new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>

            {/* Rejection badge */}
            {isRejected && (
              <div style={{
                fontSize: 10, fontWeight: 700,
                color: colors.statusCritical,
                backgroundColor: colors.statusCriticalSubtle,
                padding: '3px 8px', borderRadius: 6,
                textAlign: 'center',
                border: `1px solid ${colors.statusCritical}20`,
              }}>
                Rejected — needs rework
              </div>
            )}
          </div>
        )
      }}
    />
  )
}
