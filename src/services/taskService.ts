import { supabase } from '../lib/supabase';
import type { TaskState } from '../machines/taskMachine';
import { getValidTaskStatusTransitions } from '../machines/taskMachine';
import {
  type Result,
  dbError,
  fail,
  notFoundError,
  permissionError,
} from './errors';
import { validateStatusTransition } from './shared/stateMachineValidator';

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
    const transitionError = validateStatusTransition('task', currentStatus, newStatus, role);
    if (transitionError) return fail(transitionError);

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

export { getValidTaskStatusTransitions as getValidTaskTransitions };
