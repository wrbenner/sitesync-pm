import { supabase } from '../lib/supabase';
import { fromTable, asRow } from '../lib/db/queries'
import type { TaskState } from '../machines/taskMachine';
import {
  type Result,
  dbError,
  fail,
  notFoundError,
  permissionError,
  validationError,
} from './errors';

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

async function resolveProjectRole(
  projectId: string,
  userId: string | null,
): Promise<string | null> {
  if (!userId) return null;
  const { data } = await fromTable('project_members')
    .select('role')
    .eq('project_id' as never, projectId)
    .eq('user_id' as never, userId)
    .single();
  return asRow<{ role: string | null }>(data)?.role ?? null;
}

/**
 * Transition map for tasks, derived from taskMachine.
 *
 *   todo         → in_progress / done      (non-viewer)
 *   in_progress  → in_review / done        (non-viewer)
 *   in_review    → done / in_progress      (gc/owner/admin — approve or send back)
 *   done         → todo                    (gc/owner/admin — reopen)
 */
function getValidTaskTransitions(
  status: TaskState,
  role: string,
): TaskState[] {
  const isReviewer = ['project_manager', 'superintendent', 'admin', 'owner'].includes(role);
  const nonViewer = role !== 'viewer';

  switch (status) {
    case 'todo':
      return nonViewer ? ['in_progress', 'done'] : [];
    case 'in_progress':
      return nonViewer ? ['in_review', 'done'] : [];
    case 'in_review':
      return isReviewer ? ['done', 'in_progress'] : [];
    case 'done':
      return isReviewer ? ['todo'] : [];
    default:
      return [];
  }
}

export const taskService = {
  async transitionStatus(
    taskId: string,
    newStatus: TaskState,
  ): Promise<Result> {
    const { data: taskData, error: fetchError } = await fromTable('tasks')
      .select('status, project_id')
      .eq('id' as never, taskId)
      .single();
    const task = asRow<{ status: string | null; project_id: string }>(taskData)

    if (fetchError || !task) {
      return fail(notFoundError('Task', taskId));
    }

    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(task.project_id, userId);
    if (!role) {
      return fail(permissionError('User is not a member of this project'));
    }

    const currentStatus = (task.status ?? 'todo') as TaskState;
    const valid = getValidTaskTransitions(currentStatus, role);
    if (!valid.includes(newStatus)) {
      return fail(
        validationError(
          `Invalid task transition: ${currentStatus} → ${newStatus} (role: ${role}). Valid: ${valid.join(', ') || '(none)'}`,
          { currentStatus, newStatus, role, valid },
        ),
      );
    }

    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === 'done') updates.percent_complete = 100;

    const { error } = await fromTable('tasks')
      .update(updates as never)
      .eq('id' as never, taskId);

    if (error) return fail(dbError(error.message, { taskId, newStatus }));
    return { data: null, error: null };
  },

  /**
   * Update task fields (non-status). Strips status to prevent bypass.
   */
  async updateTask(
    taskId: string,
    updates: Record<string, unknown>,
  ): Promise<Result> {

    const { status: _status, ...safeUpdates } = updates;

    // Capture the pre-update end_date so the schedule-slip chain can compute
    // a meaningful baseline diff after the write completes. Cheap — single
    // row by primary key.
    let baselineEndDate: string | null = null;
    let projectId: string | null = null;
    if ('end_date' in safeUpdates) {
      // Generated Database types lag behind live schema; localized any cast.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data: prior } = await sb
        .from('tasks')
        .select('end_date, project_id')
        .eq('id' as never, taskId)
        .maybeSingle();
      baselineEndDate = (prior?.end_date as string | null) ?? null;
      projectId = (prior?.project_id as string | null) ?? null;
    }

    const { error } = await fromTable('tasks')
      .update({ ...safeUpdates, updated_at: new Date().toISOString() } as never)
      .eq('id' as never, taskId);

    if (error) return fail(dbError(error.message, { taskId }));

    // Cross-feature: if end_date changed and the slip is material, draft a
    // change order. Fire-and-forget — never blocks the task update.
    const newEndDate = safeUpdates.end_date as string | null | undefined;
    if (newEndDate && baselineEndDate && projectId && newEndDate !== baselineEndDate) {
      void import('../lib/crossFeatureWorkflows')
        .then(({ runScheduleSlipChain }) =>
          runScheduleSlipChain({
            taskId,
            projectId: projectId!,
            baselineEndDate,
            newEndDate,
            estimatedHoursDelta: typeof safeUpdates.estimated_hours === 'number'
              ? safeUpdates.estimated_hours as number
              : undefined,
          }),
        )
        .then((result) => {
          if (result.error) console.warn('[schedule_slip chain]', result.error);
          else if (result.created) console.info('[schedule_slip chain] created', result.created);
          else if (result.skipped) console.debug('[schedule_slip chain] skipped:', result.skipped.reason);
        })
        .catch((err) => console.warn('[schedule_slip chain] dispatch failed:', err));
    }

    return { data: null, error: null };
  },
};

export { getValidTaskTransitions };
