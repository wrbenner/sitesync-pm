import { supabase } from './supabase'

function actionToVerb(action: string): string {
  if (action.startsWith('create')) return 'created'
  if (action.startsWith('update') || action === 'status_change') return 'updated'
  if (action.startsWith('delete')) return 'deleted'
  if (action.startsWith('approve')) return 'approved'
  if (action.startsWith('reject')) return 'rejected'
  if (action.startsWith('submit')) return 'submitted'
  if (action.startsWith('close')) return 'closed'
  return action
}

export async function insertActivityEvent(
  projectId: string,
  entityType: string,
  entityId: string | undefined,
  entityTitle: string | undefined,
  action: string,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('activity_feed').insert({
    project_id: projectId,
    user_id: user?.id ?? null,
    type: entityType,
    title: entityTitle || entityType,
    metadata: { entity_id: entityId, action: actionToVerb(action) },
  })
  if (error && import.meta.env.DEV) {
    console.warn('[ActivityFeed] Failed to insert activity event:', error.message)
  }
}
