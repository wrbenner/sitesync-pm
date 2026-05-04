/**
 * Iris execute-action — the gate from drafted to executed.
 *
 * Only this function may turn a `drafted_actions` row into a real
 * mutation in the rest of the schema. Every executor here should:
 *   • be idempotent on retry (don't double-insert if executed twice)
 *   • write through the audited mutation path so the action shows up
 *     in `audit_log` with its drafted_actions.id as resource_ref
 *   • record what it created in `executed_resource_id` so the inbox
 *     card can deep-link to the produced RFI / pay app / etc.
 *
 * Failure handling: when an executor throws, we mark the row 'failed'
 * with the error message in execution_result. The user can retry from
 * the inbox; nothing leaks into production state.
 */


import { fromTable } from '../../lib/db/queries'
import type { DraftedAction, DraftedActionType } from '../../types/draftedActions'
import { executeDraftedRfi } from './executors/rfi'
import { executeDraftedDailyLog } from './executors/dailyLog'
import { executeDraftedPayApp } from './executors/payApp'
import { executeDraftedPunchItem } from './executors/punchItem'
import { executeDraftedSubmittalTransmittal } from './executors/submittalTransmittal'

export interface ExecuteActionInput {
  draftId: string
  decided_by: string
  decision_note?: string
}

export interface ExecuteActionResult {
  ok: boolean
  draft?: DraftedAction
  executed_resource_type?: string
  executed_resource_id?: string
  error?: string
}

/** Per-action-type executor registry. Add new handlers here. */
type Executor = (draft: DraftedAction) => Promise<{
  resource_type: string
  resource_id: string
  result?: Record<string, unknown>
}>

const executors: Partial<Record<DraftedActionType, Executor>> = {
  'rfi.draft': executeDraftedRfi,
  'daily_log.draft': executeDraftedDailyLog,
  'pay_app.draft': executeDraftedPayApp,
  'punch_item.draft': executeDraftedPunchItem,
  'submittal.transmittal_draft': executeDraftedSubmittalTransmittal,
  // schedule.resequence stays unwired until the dependency-graph rewriter
  // lands — resequencing phases is much more invasive than a simple insert
  // and needs the schedule editor's diff/apply path, not a one-shot executor.
}

/**
 * Approve and execute a drafted action in a single atomic flow:
 *   1. Lock the row by id + status='pending' (fail if someone else
 *      already decided)
 *   2. Mark status='approved' with decided_by/decided_at
 *   3. Run the executor
 *   4. On success → mark 'executed' with executed_resource_id
 *   5. On failure → mark 'failed' with execution_result.error
 */
export async function approveAndExecute(input: ExecuteActionInput): Promise<ExecuteActionResult> {
  // Step 1+2: claim the draft. The .eq('status' as never, 'pending') guards
  // against double-execute when two reviewers click approve at once.
  const claimResult = await fromTable('drafted_actions')
    .update({
      status: 'approved',
      decided_by: input.decided_by,
      decided_at: new Date().toISOString(),
      decision_note: input.decision_note ?? null,
    } as never)
    .eq('id' as never, input.draftId)
    .eq('status' as never, 'pending')
    .select('*')
    .single()

  if (claimResult.error || !claimResult.data) {
    return {
      ok: false,
      error: claimResult.error?.message ?? 'Draft was already decided by another user',
    }
  }

  const draft = claimResult.data as unknown as DraftedAction
  const executor = executors[draft.action_type]
  if (!executor) {
    await markFailed(draft.id, `No executor registered for action_type=${draft.action_type}`)
    return { ok: false, error: `No executor for ${draft.action_type}` }
  }

  try {
    const out = await executor(draft)
    await fromTable('drafted_actions')
      .update({
        status: 'executed',
        executed_at: new Date().toISOString(),
        executed_resource_type: out.resource_type,
        executed_resource_id: out.resource_id,
        execution_result: out.result ?? {},
      } as never)
      .eq('id' as never, draft.id)

    return {
      ok: true,
      draft,
      executed_resource_type: out.resource_type,
      executed_resource_id: out.resource_id,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Executor failed'
    await markFailed(draft.id, msg)
    return { ok: false, error: msg, draft }
  }
}

/** User explicitly rejected a draft. Keep the row for the audit trail. */
export async function rejectDraft(input: ExecuteActionInput): Promise<{ ok: boolean; error?: string }> {
  const { error } = await fromTable('drafted_actions')
    .update({
      status: 'rejected',
      decided_by: input.decided_by,
      decided_at: new Date().toISOString(),
      decision_note: input.decision_note ?? null,
    } as never)
    .eq('id' as never, input.draftId)
    .eq('status' as never, 'pending')

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

async function markFailed(draftId: string, errorMessage: string): Promise<void> {
  await fromTable('drafted_actions')
    .update({
      status: 'failed',
      execution_result: { error: errorMessage } as Record<string, unknown>,
    } as never)
    .eq('id' as never, draftId)
}
