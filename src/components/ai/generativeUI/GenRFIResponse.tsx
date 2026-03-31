import React, { useMemo } from 'react'
import { FileText, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'
import { Card, Btn, PriorityTag } from '../../Primitives'
import { PermissionGate } from '../../auth/PermissionGate'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'
import type { RFIResponseBlock } from './types'

interface GenRFIResponseProps {
  block: RFIResponseBlock
  onAction?: (action: string, data: Record<string, unknown>) => void
}

const STATUS_CONFIG: Record<RFIResponseBlock['status'], { color: string; label: string; icon: React.ReactNode }> = {
  open: { color: colors.statusInfo, label: 'Open', icon: <AlertCircle size={12} /> },
  answered: { color: colors.statusPending, label: 'Answered', icon: <Clock size={12} /> },
  approved: { color: colors.statusActive, label: 'Approved', icon: <CheckCircle size={12} /> },
  rejected: { color: colors.statusCritical, label: 'Rejected', icon: <XCircle size={12} /> },
  on_hold: { color: colors.statusReview, label: 'On Hold', icon: <Clock size={12} /> },
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export const GenRFIResponse: React.FC<GenRFIResponseProps> = React.memo(({ block, onAction }) => {
  const cfg = STATUS_CONFIG[block.status]

  const daysColor = useMemo(() => {
    if (block.days_open > 14) return colors.statusCritical
    if (block.days_open > 7) return colors.statusPending
    return colors.textTertiary
  }, [block.days_open])

  return (
    <Card padding={spacing['4']}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing['3'] }}>
        <div>
          <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.bold, color: colors.orangeText, margin: 0 }}>
            RFI {block.rfi_number}
          </p>
          {block.trade && (
            <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: spacing['1'] }}>{block.trade}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: spacing['2'], alignItems: 'center' }}>
          <PriorityTag priority={block.priority} />
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
            color: cfg.color, backgroundColor: `${cfg.color}12`,
            padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.sm,
            border: `1px solid ${cfg.color}30`,
          }}>
            {cfg.icon} {cfg.label}
          </span>
        </div>
      </div>

      {/* Question */}
      <div style={{ marginBottom: spacing['3'], paddingBottom: spacing['3'], borderBottom: `1px solid ${colors.borderSubtle}` }}>
        <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, margin: 0, marginBottom: spacing['2'] }}>
          Question
        </p>
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0, lineHeight: typography.lineHeight.normal }}>
          {block.question}
        </p>
        <div style={{ display: 'flex', gap: spacing['3'], marginTop: spacing['2'], fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
          <span>Asked by {block.asked_by}</span>
          <span>{fmtDate(block.asked_date)}</span>
          <span style={{ color: daysColor, fontWeight: typography.fontWeight.semibold }}>{block.days_open} days open</span>
        </div>
      </div>

      {/* Response */}
      {block.response && (
        <div style={{ marginBottom: spacing['3'], paddingBottom: spacing['3'], borderBottom: `1px solid ${colors.borderSubtle}` }}>
          <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, margin: 0, marginBottom: spacing['2'] }}>
            Response
          </p>
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0, lineHeight: typography.lineHeight.normal }}>
            {block.response}
          </p>
          {block.responded_by && block.responded_date && (
            <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: spacing['2'] }}>
              {block.responded_by} \u00b7 {fmtDate(block.responded_date)}
            </p>
          )}
        </div>
      )}

      {/* Attachments */}
      {block.attachments && block.attachments.length > 0 && (
        <div style={{ marginBottom: spacing['3'] }}>
          <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, margin: 0, marginBottom: spacing['2'] }}>
            Attachments
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'] }}>
            {block.attachments.map((att) => (
              <div key={att.id} style={{
                display: 'flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.surfaceInset,
                borderRadius: borderRadius.base, fontSize: typography.fontSize.caption,
              }}>
                <FileText size={14} color={colors.primaryOrange} />
                <span style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.medium, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={att.name}>
                  {att.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {onAction && (
        <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
          <Btn variant="secondary" size="sm" onClick={() => onAction('view_rfi', { rfi_id: block.rfi_id })}>
            View Full RFI
          </Btn>
          {block.status === 'answered' && (
            <>
              <PermissionGate permission="rfis.respond">
                <Btn variant="ghost" size="sm" onClick={() => onAction('reject_rfi', { rfi_id: block.rfi_id })} style={{ color: colors.statusCritical }}>
                  Reject
                </Btn>
              </PermissionGate>
              <PermissionGate permission="rfis.respond">
                <Btn variant="primary" size="sm" onClick={() => onAction('approve_rfi', { rfi_id: block.rfi_id })}>
                  Approve
                </Btn>
              </PermissionGate>
            </>
          )}
        </div>
      )}
    </Card>
  )
})

GenRFIResponse.displayName = 'GenRFIResponse'
