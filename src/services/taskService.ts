import { supabase } from '../lib/supabase';
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
  const { data } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();
  return data?.role ?? null;
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
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('status, project_id')
      .eq('id', taskId)
      .single();

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

    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId);

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _status, ...safeUpdates } = updates;

    const { error } = await supabase
      .from('tasks')
      .update({ ...safeUpdates, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) return fail(dbError(error.message, { taskId }));
    return { data: null, error: null };
  },
};

export { getValidTaskTransitions };
