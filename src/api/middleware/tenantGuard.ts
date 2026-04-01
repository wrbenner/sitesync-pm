import { ensureProjectAccess, PermissionError } from '../../lib/rls';

export { PermissionError };

/**
 * Wrap a data function with a project membership check.
 * ensureProjectAccess runs first: if the user is not a member of projectId
 * a PermissionError is thrown and fn is never called.
 *
 * Usage:
 *   const rfis = await withProjectAccess(projectId, () =>
 *     supabase.from('rfis').select('*').eq('project_id', projectId)
 *   );
 */
export async function withProjectAccess<T>(
  projectId: string,
  fn: () => Promise<T>,
): Promise<T> {
  await ensureProjectAccess(projectId);
  return fn();
}
