import { supabase } from './supabase'

interface ActivityFeedEntry {
  projectId: string
  entityType: string
  entityId?: string
  entityTitle?: string
  action: string
}

export async function logActivityFeed(entry: ActivityFeedEntry): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const userName =
    (user?.user_metadata?.['full_name'] as string | undefined) ?? user?.email ?? 'Someone'

  const readableEntity = entry.entityType.replace(/_/g, ' ')
  const readableAction = entry.action.replace(/_/g, ' ')

  const { error } = await supabase.from('activity_feed').insert({
    project_id: entry.projectId,
    user_id: user?.id ?? null,
    type: entry.entityType,
    title: entry.entityTitle || readableEntity,
    body: `${userName} ${readableAction}`,
    metadata: {
      entity_id: entry.entityId ?? null,
      action: entry.action,
      user_name: userName,
    },
  })

  if (error && import.meta.env.DEV) {
    console.error('[ActivityFeed] Failed to write entry:', error)
  }
}
