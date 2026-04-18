import { supabase } from './supabase'

function deriveVerb(action: string): string {
  if (action.startsWith('create')) return 'created'
  if (action.startsWith('update')) return 'updated'
  if (action.startsWith('delete')) return 'deleted'
  const verbMap: Record<string, string> = {
    status_change: 'updated',
    approve: 'approved',
    reject: 'rejected',
    submit: 'submitted',
    close: 'closed',
  }
  return verbMap[action] ?? action.replace(/_/g, ' ')
}

export async function logActivityEntry({
  projectId,
  entityType,
  entityTitle,
  action,
  entityId,
}: {
  projectId: string
  entityType: string
  entityTitle: string
  action: string
  entityId?: string
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('activity_feed').insert({
    project_id: projectId,
    user_id: user?.id ?? null,
    type: entityType,
    title: entityTitle || entityType,
    metadata: { entity_id: entityId ?? null, action: deriveVerb(action) },
  })
  if (error && import.meta.env.DEV) {
    console.error('[ActivityLogger] Failed to write activity log:', error)
  }
}
