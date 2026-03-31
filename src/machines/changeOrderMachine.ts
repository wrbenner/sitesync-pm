import { setup } from 'xstate'
import { colors } from '../styles/theme'

export type ChangeOrderState = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'void'
export type ChangeOrderType = 'pco' | 'cor' | 'co'
export type ReasonCode = 'owner_change' | 'design_error' | 'field_condition' | 'regulatory' | 'value_engineering' | 'unforeseen'

export const changeOrderMachine = setup({
  types: {
    context: {} as {
      changeOrderId: string
      projectId: string
      amount: number
      type: ChangeOrderType
      error: string | null
    },
    events: {} as
      | { type: 'SUBMIT' }
      | { type: 'APPROVE'; userId: string }
      | { type: 'REJECT'; userId: string; comments?: string }
      | { type: 'VOID'; userId: string; reason: string }
      | { type: 'PROMOTE' }
      | { type: 'RETURN_TO_PCO'; revisionNotes: string },  // BUG #5 FIX
  },
}).createMachine({
  id: 'changeOrder',
  initial: 'draft',
  context: { changeOrderId: '', projectId: '', amount: 0, type: 'co', error: null },
  states: {
    draft: {
      on: {
        SUBMIT: { target: 'pending_review' },
      },
    },
    pending_review: {
      on: {
        APPROVE: { target: 'approved' },
        REJECT: { target: 'rejected' },
        VOID: { target: 'void' },
      },
    },
    approved: {
      on: {
        VOID: { target: 'void' },
      },
    },
    rejected: {
      on: {
        SUBMIT: { target: 'pending_review' },
        // BUG #5 FIX: COR rejection can return to PCO for revision
        RETURN_TO_PCO: { target: 'draft' },
      },
    },
    void: {
      type: 'final',
    },
  },
})

// ── Valid Transitions ────────────────────────────────────

export function getValidCOTransitions(status: ChangeOrderState, coType?: ChangeOrderType): string[] {
  const base: Record<ChangeOrderState, string[]> = {
    draft: ['Submit for Review'],
    pending_review: ['Approve', 'Reject', 'Void'],
    approved: ['Void'],
    rejected: ['Revise and Resubmit'],
    void: [],
  }

  const actions = [...(base[status] || [])]

  // Approved PCOs/CORs can promote to next stage
  if (status === 'approved' && coType === 'pco') actions.unshift('Promote to COR')
  if (status === 'approved' && coType === 'cor') actions.unshift('Promote to CO')

  // BUG #5 FIX: Rejected COR/CO can return to previous stage for revision
  if (status === 'rejected' && coType === 'cor') actions.push('Return to PCO')
  if (status === 'rejected' && coType === 'co') actions.push('Return to COR')

  return actions
}

// ── Next Status ──────────────────────────────────────────

export function getNextCOStatus(currentStatus: ChangeOrderState, action: string): ChangeOrderState | null {
  const map: Record<string, Record<string, ChangeOrderState>> = {
    draft: { 'Submit for Review': 'pending_review' },
    pending_review: { 'Approve': 'approved', 'Reject': 'rejected', 'Void': 'void' },
    approved: { 'Void': 'void' },
    rejected: {
      'Revise and Resubmit': 'pending_review',
      'Return to PCO': 'draft',  // BUG #5 FIX
      'Return to COR': 'draft',  // BUG #5 FIX
    },
  }
  return map[currentStatus]?.[action] || null
}

// ── CO Type Promotion ────────────────────────────────────

export function getNextCOType(currentType: ChangeOrderType): ChangeOrderType | null {
  const chain: Record<ChangeOrderType, ChangeOrderType | null> = {
    pco: 'cor',
    cor: 'co',
    co: null,
  }
  return chain[currentType]
}

// BUG #5 FIX: Get previous CO type for return/demotion
export function getPreviousCOType(currentType: ChangeOrderType): ChangeOrderType | null {
  const chain: Record<ChangeOrderType, ChangeOrderType | null> = {
    pco: null,
    cor: 'pco',
    co: 'cor',
  }
  return chain[currentType]
}

// ── CO Type Display ──────────────────────────────────────

export function getCOTypeConfig(type: ChangeOrderType) {
  const config: Record<ChangeOrderType, { label: string; shortLabel: string; color: string; bg: string }> = {
    pco: { label: 'Potential Change Order', shortLabel: 'PCO', color: colors.statusNeutral, bg: colors.statusNeutralSubtle },
    cor: { label: 'Change Order Request', shortLabel: 'COR', color: colors.statusPending, bg: colors.statusPendingSubtle },
    co: { label: 'Change Order', shortLabel: 'CO', color: colors.statusInfo, bg: colors.statusInfoSubtle },
  }
  return config[type] || config.co
}

// ── Status Display ───────────────────────────────────────

export function getCOStatusConfig(status: ChangeOrderState) {
  const config: Record<ChangeOrderState, { label: string; color: string; bg: string }> = {
    draft: { label: 'Draft', color: colors.statusNeutral, bg: colors.statusNeutralSubtle },
    pending_review: { label: 'Under Review', color: colors.statusPending, bg: colors.statusPendingSubtle },
    approved: { label: 'Approved', color: colors.statusActive, bg: colors.statusActiveSubtle },
    rejected: { label: 'Rejected', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
    void: { label: 'Void', color: colors.statusNeutral, bg: colors.statusNeutralSubtle },
  }
  return config[status] || config.draft
}

// ── Reason Code Display ──────────────────────────────────

export function getReasonCodeConfig(code: ReasonCode) {
  const config: Record<ReasonCode, { label: string; color: string }> = {
    owner_change: { label: 'Owner Change', color: colors.statusInfo },
    design_error: { label: 'Design Error', color: colors.statusCritical },
    field_condition: { label: 'Field Condition', color: colors.statusPending },
    regulatory: { label: 'Regulatory', color: colors.statusReview },
    value_engineering: { label: 'Value Engineering', color: colors.statusActive },
    unforeseen: { label: 'Unforeseen', color: colors.statusNeutral },
  }
  return config[code] || { label: code, color: colors.statusNeutral }
}

// ── Approval Chain ───────────────────────────────────────

export function getApprovalChain(type: ChangeOrderType): { role: string; action: string }[] {
  const chains: Record<ChangeOrderType, { role: string; action: string }[]> = {
    pco: [
      { role: 'Superintendent', action: 'Review' },
      { role: 'Project Manager', action: 'Finalize' },
    ],
    cor: [
      { role: 'Owner Representative', action: 'Review' },
      { role: 'Owner', action: 'Approve/Reject' },
    ],
    co: [
      { role: 'Both Parties', action: 'Sign' },
    ],
  }
  return chains[type] || []
}

// ── Format CO Number ─────────────────────────────────────

export function formatCONumber(type: ChangeOrderType, number: number): string {
  const prefix = type.toUpperCase()
  return `${prefix}-${String(number).padStart(3, '0')}`
}
