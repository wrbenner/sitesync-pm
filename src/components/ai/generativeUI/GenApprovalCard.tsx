import React, { useState } from 'react'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'
import { Btn } from '../../Primitives'
import { PermissionGate } from '../../auth/PermissionGate'
import { toast } from 'sonner'
import type { ApprovalCardBlock } from './types'
import type { Permission } from '../../../hooks/usePermissions'

interface Props {
  block: ApprovalCardBlock
  onAction?: (action: string, data: Record<string, unknown>) => void
}

export const GenApprovalCard: React.FC<Props> = React.memo(({ block, onAction }) => {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [loading, setLoading] = useState(false)

  const handleAction = async (action: string, newStatus: 'approved' | 'rejected') => {
    setLoading(true)
    try {
      onAction?.(action, { entity_type: block.entity_type, entity_id: block.entity_id })
      setStatus(newStatus)
      toast.success(`${block.title} ${newStatus}`)
    } catch {
      toast.error(`Failed to ${newStatus === 'approved' ? 'approve' : 'reject'}`)
    } finally {
      setLoading(false)
    }
  }

  const borderColor = status === 'approved' ? colors.statusActive
    : status === 'rejected' ? colors.statusCritical
    : colors.primaryOrange

  return (
    <div style={{
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.lg,
      border: `1px solid ${colors.borderSubtle}`,
      borderLeft: `3px solid ${borderColor}`,
      overflow: 'hidden',
      fontFamily: typography.fontFamily,
    }}>
      <div style={{ padding: spacing['4'] }}>
        <div style={{
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
          marginBottom: spacing['1'],
        }}>
          {block.title}
        </div>
        {block.subtitle && (
          <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: spacing['3'] }}>
            {block.subtitle}
          </div>
        )}

        {/* Fields grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: `${spacing['2']} ${spacing['4']}`,
          marginBottom: spacing['3'],
        }}>
          {block.fields.map((field, i) => (
            <div key={i}>
              <div style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: typography.letterSpacing.wider,
                color: colors.textTertiary,
                fontWeight: typography.fontWeight.medium,
                marginBottom: spacing['0.5'],
              }}>
                {field.label}
              </div>
              <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                {field.value || '\u2014'}
              </div>
            </div>
          ))}
        </div>

        {/* Status indicator for completed actions */}
        {status !== 'pending' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['2'],
            padding: `${spacing['2']} ${spacing['3']}`,
            backgroundColor: status === 'approved' ? colors.statusActiveSubtle : colors.statusCriticalSubtle,
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
            color: status === 'approved' ? colors.statusActive : colors.statusCritical,
          }}>
            {status === 'approved' ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {status === 'approved' ? 'Approved' : 'Rejected'}
          </div>
        )}

        {/* Action buttons */}
        {status === 'pending' && (
          <div style={{
            display: 'flex',
            gap: spacing['2'],
            paddingTop: spacing['3'],
            borderTop: `1px solid ${colors.borderSubtle}`,
          }}>
            <PermissionGate permission={(block.approve_permission || 'rfis.edit') as Permission}>
              <Btn
                variant="primary"
                size="sm"
                icon={loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={14} />}
                onClick={() => handleAction(block.approve_action, 'approved')}
              >
                Approve
              </Btn>
            </PermissionGate>
            {block.reject_action && (
              <PermissionGate permission={(block.approve_permission || 'rfis.edit') as Permission}>
                <Btn
                  variant="danger"
                  size="sm"
                  icon={<XCircle size={14} />}
                  onClick={() => handleAction(block.reject_action!, 'rejected')}
                >
                  Reject
                </Btn>
              </PermissionGate>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
