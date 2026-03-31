import React, { useMemo } from 'react'
import { Clock, Users, Link2, AlertTriangle } from 'lucide-react'
import { Card, ProgressBar, Btn } from '../../Primitives'
import { PermissionGate } from '../../auth/PermissionGate'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'
import type { ScheduleCardBlock } from './types'

interface GenScheduleCardProps {
  block: ScheduleCardBlock
  onAction?: (action: string, data: Record<string, unknown>) => void
}

const STATUS_CONFIG: Record<ScheduleCardBlock['status'], { color: string; label: string }> = {
  on_track: { color: colors.statusActive, label: 'On Track' },
  at_risk: { color: colors.statusPending, label: 'At Risk' },
  late: { color: colors.statusCritical, label: 'Late' },
  complete: { color: colors.statusReview, label: 'Complete' },
}

export const GenScheduleCard: React.FC<GenScheduleCardProps> = React.memo(({ block, onAction }) => {
  const config = STATUS_CONFIG[block.status]

  const dateRange = useMemo(() => {
    const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${fmt(block.start_date)} \u2013 ${fmt(block.end_date)}`
  }, [block.start_date, block.end_date])

  return (
    <Card padding={spacing['4']}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing['3'] }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
            {block.task_name}
          </p>
          <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: spacing['1'] }}>
            {dateRange} \u00b7 {block.duration_days} days
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexShrink: 0 }}>
          {block.is_critical_path && (
            <span style={{
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
              color: colors.statusCritical, backgroundColor: `${colors.statusCritical}12`,
              padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.full,
            }}>
              Critical Path
            </span>
          )}
          <span style={{
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
            color: 'white', backgroundColor: config.color,
            padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.full,
          }}>
            {config.label}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div style={{ marginBottom: spacing['3'] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing['1'] }}>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Progress</span>
          <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{block.progress}%</span>
        </div>
        <ProgressBar value={block.progress} max={100} height={4} color={config.color} />
      </div>

      {/* Metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'], marginBottom: spacing['3'] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <Clock size={14} color={colors.textTertiary} />
          <div>
            <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>Float</p>
            <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: block.float_days > 0 ? colors.statusActive : colors.statusCritical, margin: 0 }}>
              {block.float_days} days
            </p>
          </div>
        </div>
        {block.crew && (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <Users size={14} color={colors.textTertiary} />
            <div>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>{block.crew.name}</p>
              <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>
                {block.crew.headcount} workers
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Trades */}
      {block.crew?.trades && block.crew.trades.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['1'], marginBottom: spacing['3'] }}>
          {block.crew.trades.map((trade) => (
            <span key={trade} style={{
              fontSize: typography.fontSize.caption, color: colors.textSecondary,
              backgroundColor: colors.surfaceInset, padding: `${spacing['1']} ${spacing['2']}`,
              borderRadius: borderRadius.sm,
            }}>
              {trade}
            </span>
          ))}
        </div>
      )}

      {/* Dependencies */}
      {block.dependencies && block.dependencies.length > 0 && (
        <div style={{ padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base, marginBottom: spacing['3'] }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
            <Link2 size={12} color={colors.textTertiary} />
            <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary }}>Dependencies</span>
          </div>
          {block.dependencies.map((dep) => (
            <p key={dep.task_id} style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, margin: 0, marginBottom: spacing['1'] }}>
              <span style={{ color: colors.textTertiary }}>{dep.type}</span> {dep.task_name}
            </p>
          ))}
        </div>
      )}

      {/* Variance alert */}
      {block.variance && (block.variance.schedule_days !== 0 || block.variance.cost_dollars !== 0) && (
        <div style={{
          display: 'flex', gap: spacing['2'], padding: spacing['3'],
          backgroundColor: `${colors.statusPending}08`, borderRadius: borderRadius.base,
          borderLeft: `3px solid ${colors.statusPending}`, marginBottom: spacing['3'],
        }}>
          <AlertTriangle size={14} color={colors.statusPending} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
            {block.variance.schedule_days !== 0 && (
              <p style={{ margin: 0 }}>Schedule: {block.variance.schedule_days > 0 ? '+' : ''}{block.variance.schedule_days} days</p>
            )}
            {block.variance.cost_dollars !== 0 && (
              <p style={{ margin: 0 }}>Cost: ${Math.abs(block.variance.cost_dollars).toLocaleString()} {block.variance.cost_dollars > 0 ? 'over' : 'under'}</p>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {block.notes && (
        <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginBottom: spacing['3'], lineHeight: typography.lineHeight.normal }}>
          {block.notes}
        </p>
      )}

      {/* Actions */}
      {onAction && (
        <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
          <Btn variant="secondary" size="sm" onClick={() => onAction('view_task', { task_id: block.task_id })}>
            View Task
          </Btn>
          <PermissionGate permission="schedule.edit">
            <Btn variant="primary" size="sm" onClick={() => onAction('edit_task', { task_id: block.task_id })}>
              Edit
            </Btn>
          </PermissionGate>
        </div>
      )}
    </Card>
  )
})

GenScheduleCard.displayName = 'GenScheduleCard'
