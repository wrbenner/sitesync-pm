import React, { useState } from 'react'
import { CheckCircle2, XCircle, Clock, RotateCcw, MessageSquare } from 'lucide-react'
import { Card, Btn, Modal } from '../Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import {
  useApprovalStatus,
  useStartApproval,
  useTakeApprovalAction,
  type ApprovalEntityType,
  type ApprovalStepAction,
  type ApprovalStep,
} from '../../hooks/useApprovalWorkflow'
import { toast } from 'sonner'

interface Props {
  entityType: ApprovalEntityType
  entityId: string
}

export const ApprovalStatusBar: React.FC<Props> = ({ entityType, entityId }) => {
  const { data, isLoading } = useApprovalStatus(entityType, entityId)
  const startApproval = useStartApproval()
  const takeAction = useTakeApprovalAction()
  const [activeStep, setActiveStep] = useState<number | null>(null)
  const [actionModal, setActionModal] = useState<'approved' | 'rejected' | 'returned' | null>(null)
  const [comments, setComments] = useState('')

  if (isLoading) {
    return <div style={{ height: 60, background: colors.surfaceInset, borderRadius: borderRadius.base }} />
  }

  if (!data?.instance) {
    return (
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing['3'] }}>
          <div>
            <div style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium }}>
              No approval workflow started
            </div>
            <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              Start the configured approval chain for this {entityType.replace('_', ' ')}
            </div>
          </div>
          <Btn
            variant="primary"
            onClick={() =>
              startApproval.mutate(
                { entityType, entityId },
                {
                  onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to start approval'),
                  onSuccess: () => toast.success('Approval started'),
                },
              )
            }
          >
            Start Approval
          </Btn>
        </div>
      </Card>
    )
  }

  const instance = data.instance
  const template = data.template
  const actions = data.actions
  const steps: ApprovalStep[] = (template?.steps as ApprovalStep[]) ?? []
  const total = steps.length || 1
  const status = instance.status
  const current = instance.current_step

  const actionsByStep = actions.reduce<Record<number, ApprovalStepAction[]>>((acc, a) => {
    const k = a.step_order
    if (!acc[k]) acc[k] = []
    acc[k].push(a)
    return acc
  }, {})

  const submit = () => {
    if (!actionModal) return
    takeAction.mutate(
      {
        instanceId: instance.id,
        stepOrder: current,
        action: actionModal,
        comments,
        totalSteps: total,
        entityType,
        entityId,
      },
      {
        onSuccess: () => {
          toast.success(`Step ${current} ${actionModal}`)
          setActionModal(null)
          setComments('')
        },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Action failed'),
      },
    )
  }

  return (
    <>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
          <div style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold }}>
            Approval Workflow
          </div>
          <StatusTag status={status} />
        </div>

        <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, overflowX: 'auto' }}>
          {steps.map((step, i) => {
            const stepNum = i + 1
            const stepActions = actionsByStep[stepNum] ?? []
            const last = stepActions[stepActions.length - 1]
            const isCurrent = stepNum === current && status === 'in_progress'
            const derived: 'pending' | 'approved' | 'rejected' | 'returned' | 'acknowledged' =
              last?.action ?? (stepNum < current ? 'approved' : 'pending')

            return (
              <button
                key={stepNum}
                onClick={() => setActiveStep(stepNum)}
                style={{
                  flex: 1,
                  minWidth: 140,
                  background: isCurrent ? colors.surfaceSelected : colors.surfaceInset,
                  border: isCurrent ? `1px solid ${colors.primaryOrange}` : '1px solid transparent',
                  borderRadius: borderRadius.base,
                  padding: spacing['3'],
                  marginRight: i === steps.length - 1 ? 0 : spacing['2'],
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: spacing['1'],
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                  <StepIcon state={derived} />
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                    Step {stepNum}
                  </span>
                </div>
                <div style={{ fontSize: typography.fontSize.body, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
                  {step.role}
                </div>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                  {step.action_required}
                </div>
              </button>
            )
          })}
        </div>

        {status === 'in_progress' && (
          <div style={{ display: 'flex', gap: spacing['2'], marginTop: spacing['4'] }}>
            <Btn variant="primary" onClick={() => setActionModal('approved')}>Approve</Btn>
            <Btn variant="ghost" onClick={() => setActionModal('rejected')}>Reject</Btn>
            <Btn variant="ghost" onClick={() => setActionModal('returned')}>Return</Btn>
          </div>
        )}
      </Card>

      <Modal
        open={activeStep !== null}
        onClose={() => setActiveStep(null)}
        title={activeStep ? `Step ${activeStep} — ${steps[activeStep - 1]?.role ?? ''}` : ''}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          {(activeStep !== null ? actionsByStep[activeStep] ?? [] : []).map((a) => (
            <div key={a.id} style={{ padding: spacing['3'], background: colors.surfaceInset, borderRadius: borderRadius.base }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
                <StepIcon state={a.action ?? 'pending'} />
                <span style={{ fontWeight: typography.fontWeight.medium }}>{a.action ?? 'pending'}</span>
                {a.acted_at && (
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                    {new Date(a.acted_at).toLocaleString()}
                  </span>
                )}
              </div>
              {a.comments && (
                <div style={{ display: 'flex', gap: spacing['2'], fontSize: typography.fontSize.body, color: colors.textSecondary }}>
                  <MessageSquare size={14} />
                  {a.comments}
                </div>
              )}
            </div>
          ))}
          {!actionsByStep[activeStep ?? 0]?.length && (
            <div style={{ fontSize: typography.fontSize.body, color: colors.textTertiary }}>No actions taken yet.</div>
          )}
        </div>
      </Modal>

      <Modal
        open={actionModal !== null}
        onClose={() => setActionModal(null)}
        title={actionModal ? `${actionModal[0].toUpperCase()}${actionModal.slice(1)} step ${current}` : ''}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          <textarea
            rows={4}
            placeholder="Comments (optional)"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            style={{
              width: '100%',
              padding: spacing['3'],
              fontSize: typography.fontSize.body,
              borderRadius: borderRadius.base,
              border: `1px solid ${colors.borderLight}`,
              background: colors.surfaceInset,
              color: colors.textPrimary,
              resize: 'vertical',
              fontFamily: typography.fontFamily,
            }}
          />
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setActionModal(null)}>Cancel</Btn>
            <Btn variant="primary" onClick={submit}>Submit</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}

const StatusTag: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    in_progress: { color: '#3B82F6', bg: '#3B82F622', label: 'In Progress' },
    approved: { color: '#10B981', bg: '#10B98122', label: 'Approved' },
    rejected: { color: '#EF4444', bg: '#EF444422', label: 'Rejected' },
    cancelled: { color: '#64748B', bg: '#64748B22', label: 'Cancelled' },
  }
  const s = map[status] ?? map.in_progress
  return (
    <span
      style={{
        fontSize: typography.fontSize.caption,
        fontWeight: typography.fontWeight.semibold,
        padding: `${spacing['1']} ${spacing['2']}`,
        borderRadius: borderRadius.full,
        background: s.bg,
        color: s.color,
      }}
    >
      {s.label}
    </span>
  )
}

const StepIcon: React.FC<{ state: string }> = ({ state }) => {
  if (state === 'approved' || state === 'acknowledged') return <CheckCircle2 size={16} color="#10B981" />
  if (state === 'rejected') return <XCircle size={16} color="#EF4444" />
  if (state === 'returned') return <RotateCcw size={16} color="#F59E0B" />
  return <Clock size={16} color={colors.textTertiary} />
}

export default ApprovalStatusBar
