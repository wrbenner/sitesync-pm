import React from 'react'
import { MessageSquare, Paperclip } from 'lucide-react'
import { Card } from '../Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { useApprovalStatus, type ApprovalEntityType, type ApprovalStep } from '../../hooks/useApprovalWorkflow'
import { ApprovalStatusBar } from './ApprovalStatusBar'

interface Props {
  entityType: ApprovalEntityType
  entityId: string
}

export const ApprovalPanel: React.FC<Props> = ({ entityType, entityId }) => {
  const { data, isLoading } = useApprovalStatus(entityType, entityId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      <ApprovalStatusBar entityType={entityType} entityId={entityId} />

      <Card>
        <h3 style={{ margin: 0, marginBottom: spacing['3'], fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold }}>
          History
        </h3>
        {isLoading && <div style={{ color: colors.textTertiary }}>Loading…</div>}
        {!data?.actions?.length && !isLoading && (
          <div style={{ color: colors.textTertiary, fontSize: typography.fontSize.body }}>
            No actions taken yet.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          {(data?.actions ?? []).map((a) => {
            const steps = (data?.template?.steps as ApprovalStep[]) ?? []
            const step = steps[a.step_order - 1]
            return (
              <div key={a.id} style={{ padding: spacing['3'], background: colors.surfaceInset, borderRadius: borderRadius.base }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
                  <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary }}>
                    Step {a.step_order}
                  </span>
                  <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                    {step?.role ?? 'Reviewer'}
                  </span>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                    {a.action ?? 'pending'}
                  </span>
                  {a.acted_at && (
                    <span style={{ marginLeft: 'auto', fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                      {new Date(a.acted_at).toLocaleString()}
                    </span>
                  )}
                </div>
                {a.comments && (
                  <div style={{ display: 'flex', gap: spacing['2'], color: colors.textSecondary, fontSize: typography.fontSize.body }}>
                    <MessageSquare size={14} /> {a.comments}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: spacing['4'], fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
          <Paperclip size={12} /> Attachments can be added to each step action.
        </div>
      </Card>
    </div>
  )
}

export default ApprovalPanel
