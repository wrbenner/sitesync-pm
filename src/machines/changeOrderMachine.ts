import { setup } from 'xstate'

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
    pco: { label: 'Potential Change Order', shortLabel: 'PCO', color: '#8C8580', bg: 'rgba(140,133,128,0.08)' },
    cor: { label: 'Change Order Request', shortLabel: 'COR', color: '#C4850C', bg: 'rgba(196,133,12,0.08)' },
    co: { label: 'Change Order', shortLabel: 'CO', color: '#3A7BC8', bg: 'rgba(58,123,200,0.08)' },
  }
  return config[type] || config.co
}

// ── Status Display ───────────────────────────────────────

export function getCOStatusConfig(status: ChangeOrderState) {
  const config: Record<ChangeOrderState, { label: string; color: string; bg: string }> = {
    draft: { label: 'Draft', color: '#8C8580', bg: 'rgba(140,133,128,0.08)' },
    pending_review: { label: 'Under Review', color: '#C4850C', bg: 'rgba(196,133,12,0.08)' },
    approved: { label: 'Approved', color: '#2D8A6E', bg: 'rgba(45,138,110,0.08)' },
    rejected: { label: 'Rejected', color: '#C93B3B', bg: 'rgba(201,59,59,0.08)' },
    void: { label: 'Void', color: '#8C8580', bg: 'rgba(140,133,128,0.04)' },
  }
  return config[status] || config.draft
}

// ── Reason Code Display ──────────────────────────────────

export function getReasonCodeConfig(code: ReasonCode) {
  const config: Record<ReasonCode, { label: string; color: string }> = {
    owner_change: { label: 'Owner Change', color: '#3A7BC8' },
    design_error: { label: 'Design Error', color: '#C93B3B' },
    field_condition: { label: 'Field Condition', color: '#C4850C' },
    regulatory: { label: 'Regulatory', color: '#7C5DC7' },
    value_engineering: { label: 'Value Engineering', color: '#2D8A6E' },
    unforeseen: { label: 'Unforeseen', color: '#8C8580' },
  }
  return config[code] || { label: code, color: '#8C8580' }
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
