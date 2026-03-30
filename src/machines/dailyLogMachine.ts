import { setup } from 'xstate'

export type DailyLogState = 'draft' | 'submitted' | 'approved' | 'rejected'

export const dailyLogMachine = setup({
  types: {
    context: {} as {
      dailyLogId: string
      projectId: string
      error: string | null
    },
    events: {} as
      | { type: 'SAVE_DRAFT' }
      | { type: 'SUBMIT'; signatureUrl?: string }
      | { type: 'APPROVE'; signatureUrl?: string; userId: string }
      | { type: 'REJECT'; comments: string; userId: string },
  },
}).createMachine({
  id: 'dailyLog',
  initial: 'draft',
  context: { dailyLogId: '', projectId: '', error: null },
  states: {
    draft: {
      on: {
        SAVE_DRAFT: { target: 'draft' },
        SUBMIT: { target: 'submitted' },
      },
    },
    submitted: {
      on: {
        APPROVE: { target: 'approved' },
        REJECT: { target: 'rejected' },
      },
    },
    approved: {
      type: 'final',
    },
    rejected: {
      // BUG #2 FIX: Goes to draft for editing, not directly back to submitted
      on: {
        SAVE_DRAFT: { target: 'draft' },
        SUBMIT: { target: 'submitted' },
      },
    },
  },
})

// ── Valid Transitions ────────────────────────────────────

export function getValidDailyLogTransitions(status: DailyLogState): string[] {
  const transitions: Record<DailyLogState, string[]> = {
    draft: ['Save Draft', 'Submit for Approval'],
    submitted: ['Approve', 'Reject'],
    approved: [],
    // BUG #2 FIX: Rejection goes to edit (draft), not directly to resubmit
    rejected: ['Edit Draft', 'Resubmit'],
  }
  return transitions[status] || []
}

// ── Next Status ──────────────────────────────────────────

export function getNextDailyLogStatus(currentStatus: DailyLogState, action: string): DailyLogState | null {
  const map: Record<string, Record<string, DailyLogState>> = {
    draft: { 'Save Draft': 'draft', 'Submit for Approval': 'submitted' },
    submitted: { 'Approve': 'approved', 'Reject': 'rejected' },
    rejected: {
      // BUG #2 FIX: 'Edit Draft' goes to draft (not submitted).
      // 'Resubmit' also goes to draft first — user must save before resubmitting.
      'Edit Draft': 'draft',
      'Resubmit': 'draft',
      // Legacy compat
      'Edit and Resubmit': 'draft',
    },
  }
  return map[currentStatus]?.[action] || null
}

// ── Status Display ───────────────────────────────────────

export function getDailyLogStatusConfig(status: DailyLogState) {
  const config: Record<DailyLogState, { label: string; color: string; bg: string }> = {
    draft: { label: 'Draft', color: '#8C8580', bg: 'rgba(140,133,128,0.08)' },
    submitted: { label: 'Submitted', color: '#3A7BC8', bg: 'rgba(58,123,200,0.08)' },
    approved: { label: 'Approved', color: '#2D8A6E', bg: 'rgba(45,138,110,0.08)' },
    rejected: { label: 'Returned', color: '#C93B3B', bg: 'rgba(201,59,59,0.08)' },
  }
  return config[status] || config.draft
}

// ── Entry Types ──────────────────────────────────────────

export const ENTRY_TYPES = [
  { value: 'manpower', label: 'Manpower', icon: 'Users' },
  { value: 'work_performed', label: 'Work Performed', icon: 'Wrench' },
  { value: 'material_received', label: 'Materials Received', icon: 'Package' },
  { value: 'equipment', label: 'Equipment', icon: 'Truck' },
  { value: 'visitor', label: 'Visitors', icon: 'UserPlus' },
  { value: 'delay', label: 'Delays', icon: 'Clock' },
  { value: 'inspection', label: 'Inspections', icon: 'ClipboardCheck' },
  { value: 'incident', label: 'Safety', icon: 'Shield' },
  { value: 'note', label: 'Notes', icon: 'FileText' },
] as const

export const QUICK_ADD_PRESETS = [
  { label: 'Concrete Pour', type: 'work_performed', description: 'Concrete pour completed' },
  { label: 'Inspection Passed', type: 'inspection', description: 'Inspection passed', inspection_result: 'passed' },
  { label: 'Rain Delay', type: 'delay', description: 'Rain delay', delay_cause: 'weather' },
  { label: 'Material Delivery', type: 'material_received', description: 'Material delivery received' },
  { label: 'Safety Meeting', type: 'incident', description: 'Toolbox talk conducted' },
  { label: 'Equipment Down', type: 'equipment', description: 'Equipment breakdown' },
] as const
