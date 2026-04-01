import { setup, assign, fromPromise } from 'xstate'
import { colors } from '../styles/theme'
import type { DailyLogPayload } from '../types/api'

export type DailyLogState = 'draft' | 'submitted' | 'approved' | 'rejected'

// Actor implementations for production. Inject via machine.provide({ actors: dailyLogActors }).
// The machine's setup() uses no-op placeholders so tests run without real API calls.
export function createDailyLogActors(
  submitFn: (projectId: string, id: string, signatureUrl?: string) => Promise<unknown>,
  createFn: (projectId: string, payload: DailyLogPayload) => Promise<unknown>
) {
  return {
    submitLog: fromPromise(({ input }: { input: { projectId: string; dailyLogId: string; signatureUrl?: string } }) =>
      input.dailyLogId ? submitFn(input.projectId, input.dailyLogId, input.signatureUrl) : Promise.resolve(null)
    ),
    createLog: fromPromise(({ input }: { input: { projectId: string; payload: DailyLogPayload } }) =>
      input.projectId ? createFn(input.projectId, input.payload) : Promise.resolve(null)
    ),
  }
}

export const dailyLogMachine = setup({
  types: {
    context: {} as {
      dailyLogId: string
      projectId: string
      error: string | null
      is_submitted: boolean
      submitted_at: string | null
      version: number
    },
    events: {} as
      | { type: 'SAVE_DRAFT' }
      | { type: 'SUBMIT'; signatureUrl?: string }
      | { type: 'APPROVE'; signatureUrl?: string; userId: string }
      | { type: 'REJECT'; comments: string; userId: string },
  },
  // No-op placeholders. Override in production:
  //   dailyLogMachine.provide({ actors: createDailyLogActors(submitDailyLog, createDailyLog) })
  actors: {
    submitLog: fromPromise<unknown, { projectId: string; dailyLogId: string; signatureUrl?: string }>(
      () => Promise.resolve(null)
    ),
    createLog: fromPromise<unknown, { projectId: string; payload: DailyLogPayload }>(
      () => Promise.resolve(null)
    ),
  },
}).createMachine({
  id: 'dailyLog',
  initial: 'draft',
  context: { dailyLogId: '', projectId: '', error: null, is_submitted: false, submitted_at: null, version: 1 },
  states: {
    draft: {
      on: {
        SAVE_DRAFT: { target: 'draft' },
        SUBMIT: {
          target: 'submitted',
          actions: assign({
            is_submitted: () => true,
            submitted_at: () => new Date().toISOString(),
          }),
        },
      },
    },
    submitted: {
      // No SAVE_DRAFT or edit transitions: submitted logs are immutable.
      // To modify a submitted log, call forkLogVersion() to create a new draft version.
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
        SUBMIT: {
          target: 'submitted',
          actions: assign({
            is_submitted: () => true,
            submitted_at: () => new Date().toISOString(),
          }),
        },
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

// ── Immutability Helpers ─────────────────────────────────

// Returns true only for logs that can still be edited in place.
export function canEditLog(log: { status?: string | null; is_submitted?: boolean | null }): boolean {
  const s = log.status ?? 'draft'
  if (log.is_submitted) return false
  return s === 'draft' || s === 'rejected'
}

// Builds a new-version insert payload from an existing submitted log.
// Caller is responsible for persisting the result via the createDailyLog mutation.
export function forkLogVersion<T extends {
  id?: string
  version?: number | null
  is_submitted?: boolean | null
  submitted_at?: string | null
  status?: string | null
  approved?: boolean | null
  approved_at?: string | null
  approved_by?: string | null
  manager_signature_url?: string | null
  superintendent_signature_url?: string | null
}>(original: T): Omit<T, 'id'> & { version: number; is_submitted: false; submitted_at: null; status: 'draft' } {
  const { id: _id, ...rest } = original as Record<string, unknown>
  void _id
  return {
    ...(rest as Omit<T, 'id'>),
    version: ((original.version ?? 1) as number) + 1,
    is_submitted: false,
    submitted_at: null,
    status: 'draft',
    approved: null,
    approved_at: null,
    approved_by: null,
    manager_signature_url: null,
    superintendent_signature_url: null,
  }
}

export const QUICK_ADD_PRESETS = [
  { label: 'Concrete Pour', type: 'work_performed', description: 'Concrete pour completed' },
  { label: 'Inspection Passed', type: 'inspection', description: 'Inspection passed', inspection_result: 'passed' },
  { label: 'Rain Delay', type: 'delay', description: 'Rain delay', delay_cause: 'weather' },
  { label: 'Material Delivery', type: 'material_received', description: 'Material delivery received' },
  { label: 'Safety Meeting', type: 'incident', description: 'Toolbox talk conducted' },
  { label: 'Equipment Down', type: 'equipment', description: 'Equipment breakdown' },
] as const
