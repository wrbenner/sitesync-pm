import React, { useMemo } from 'react'
import { AlertTriangle, AlertCircle, CheckCircle, Clock, MapPin, User } from 'lucide-react'
import { Btn } from '../../Primitives'
import { PermissionGate } from '../../auth/PermissionGate'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'
import type { SafetyAlertBlock } from './types'

interface GenSafetyAlertProps {
  block: SafetyAlertBlock
  onAction?: (action: string, data: Record<string, unknown>) => void
}

const SEVERITY_CONFIG = {
  critical: { color: colors.statusCritical, label: 'CRITICAL' },
  major: { color: colors.statusPending, label: 'MAJOR' },
  minor: { color: colors.statusReview, label: 'MINOR' },
} as const

const STATUS_ICON: Record<SafetyAlertBlock['status'], React.ReactNode> = {
  open: <AlertCircle size={12} color={colors.statusCritical} />,
  in_progress: <Clock size={12} color={colors.statusPending} />,
  resolved: <CheckCircle size={12} color={colors.statusActive} />,
}

export const GenSafetyAlert: React.FC<GenSafetyAlertProps> = React.memo(({ block, onAction }) => {
  const cfg = SEVERITY_CONFIG[block.severity]

  const formattedTime = useMemo(() => {
    return new Date(block.timestamp).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }, [block.timestamp])

  return (
    <div style={{
      backgroundColor: `${cfg.color}08`, border: `2px solid ${cfg.color}`,
      borderRadius: borderRadius.lg, padding: spacing['4'], marginBottom: spacing['3'],
    }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: spacing['3'], alignItems: 'flex-start', marginBottom: spacing['3'] }}>
        <AlertTriangle size={20} color={cfg.color} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
            <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.bold, color: colors.textPrimary, margin: 0 }}>
              {block.title}
            </p>
            <span style={{
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.bold,
              color: 'white', backgroundColor: cfg.color,
              padding: `1px ${spacing['2']}`, borderRadius: borderRadius.sm,
            }}>
              {cfg.label}
            </span>
          </div>
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, lineHeight: typography.lineHeight.normal }}>
            {block.description}
          </p>
        </div>
      </div>

      {/* Photo */}
      {block.photo_url && (
        <div style={{ marginBottom: spacing['3'] }}>
          <img loading="lazy"
            src={block.photo_url}
            alt={`Safety issue: ${block.title}`}
            style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: borderRadius.base, border: `1px solid ${cfg.color}40` }}
          />
        </div>
      )}

      {/* Metadata grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['3'], marginBottom: spacing['3'] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <MapPin size={14} color={colors.textTertiary} />
          <div>
            <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>Location</p>
            <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{block.location}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <User size={14} color={colors.textTertiary} />
          <div>
            <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>Reported By</p>
            <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{block.reported_by}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <Clock size={14} color={colors.textTertiary} />
          <div>
            <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>Time</p>
            <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{formattedTime}</p>
          </div>
        </div>
      </div>

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'], paddingBottom: spacing['3'], borderBottom: `1px solid ${cfg.color}30` }}>
        {STATUS_ICON[block.status]}
        <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
          Status: <strong>{block.status.replace('_', ' ').toUpperCase()}</strong>
        </span>
        {block.assigned_to && (
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: spacing['2'] }}>
            Assigned to {block.assigned_to}
          </span>
        )}
      </div>

      {/* Recommended Actions */}
      {block.recommended_actions.length > 0 && (
        <div style={{ marginBottom: spacing['3'] }}>
          <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>
            Recommended Actions
          </p>
          <ol style={{ margin: 0, paddingLeft: spacing['5'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
            {block.recommended_actions.map((action, i) => (
              <li key={i} style={{ marginBottom: spacing['1'], lineHeight: typography.lineHeight.normal }}>{action}</li>
            ))}
          </ol>
        </div>
      )}

      {/* OSHA Reference */}
      {block.osha_reference && (
        <div style={{
          backgroundColor: colors.surfaceRaised, padding: spacing['2'], borderRadius: borderRadius.base,
          fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: spacing['3'],
        }}>
          <strong>OSHA Reference:</strong> {block.osha_reference}
        </div>
      )}

      {/* Actions */}
      {onAction && (
        <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
          {block.status === 'open' && (
            <PermissionGate permission="safety.manage">
              <Btn variant="secondary" size="sm" onClick={() => onAction('acknowledge_safety_alert', { alert_id: block.alert_id })}>
                Acknowledge
              </Btn>
            </PermissionGate>
          )}
          <PermissionGate permission="safety.manage">
            <Btn variant="primary" size="sm" onClick={() => onAction('resolve_safety_alert', { alert_id: block.alert_id })}>
              Mark Resolved
            </Btn>
          </PermissionGate>
        </div>
      )}
    </div>
  )
})

GenSafetyAlert.displayName = 'GenSafetyAlert'
