import { setup } from 'xstate'
import { colors } from '../styles/theme'

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
    draft: { label: 'Draft', color: colors.statusNeutral, bg: colors.statusNeutralSubtle },
    submitted: { label: 'Submitted', color: colors.statusInfo, bg: colors.statusInfoSubtle },
    approved: { label: 'Approved', color: colors.statusActive, bg: colors.statusActiveSubtle },
    rejected: { label: 'Returned', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
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
