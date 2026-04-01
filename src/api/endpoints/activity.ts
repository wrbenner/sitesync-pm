import { supabase, transformSupabaseError } from '../client'
import { assertProjectAccess } from '../middleware/projectScope'
import { getCachedEntityLabel, setCachedEntityLabel } from '../../hooks/useProjectCache'
import type { ActivityFeedItem } from '../../types/entities'

export const getActivityFeed = async (projectId: string): Promise<ActivityFeedItem[]> => {
  await assertProjectAccess(projectId)
  const { data, error } = await supabase
    .from('activity_feed')
    .select('*, user:profiles(id, full_name, avatar_url)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw transformSupabaseError(error)
  return Promise.all((data || []).map((item) => enrichActivityItem(item as Record<string, unknown>, projectId)))
}

export async function enrichActivityItem(
  item: Record<string, unknown>,
  projectId: string,
): Promise<ActivityFeedItem> {
  const meta = (item.metadata ?? {}) as Record<string, unknown>
  const entityType = (item.type as string) || ''
  const entityId = (meta.entity_id as string) || ''
  const verb = (meta.action as string) || entityType || 'updated'

  const profile = item.user as { id: string; full_name: string | null; avatar_url: string | null } | null
  const actorName = profile?.full_name || (meta.user_name as string) || 'Unknown User'
  const actorAvatar = profile?.avatar_url ?? null

  let entityLabel = (item.title as string) || ''
  if (entityId) {
    const cacheKey = `${projectId}:${entityType}:${entityId}`
    const cached = getCachedEntityLabel(cacheKey)
    if (cached !== undefined) {
      entityLabel = cached
    } else {
      const fetched = await fetchEntityLabel(entityType, entityId)
      entityLabel = fetched || (item.title as string) || ''
      setCachedEntityLabel(cacheKey, entityLabel)
    }
  }

  return {
    id: item.id as string,
    actorName,
    actorAvatar,
    verb,
    entityType,
    entityLabel,
    entityId,
    projectId: item.project_id as string,
    createdAt: (item.created_at as string) ?? new Date().toISOString(),
    metadata: { ...meta, body: item.body },
  }
}

async function fetchEntityLabel(entityType: string, entityId: string): Promise<string> {
  if (!entityId) return ''
  try {
    if (entityType === 'rfi') {
      const { data } = await supabase.from('rfis').select('rfi_number, subject').eq('id', entityId).single()
      if (data) return `RFI-${String(data.rfi_number).padStart(3, '0')} ${data.subject}`
    } else if (entityType === 'submittal') {
      const { data } = await supabase.from('submittals').select('submittal_number, title').eq('id', entityId).single()
      if (data) return `SUB-${String(data.submittal_number).padStart(3, '0')} ${data.title}`
    } else if (entityType === 'change_order') {
      const { data } = await supabase.from('change_orders').select('co_number, description').eq('id', entityId).single()
      if (data) return `CO-${String(data.co_number).padStart(3, '0')} ${data.description}`
    }
  } catch {
    // fall through
  }
  return ''
}

export async function insertActivity(
  projectId: string,
  payload: { type: string; title: string; body?: string; metadata?: Record<string, unknown> },
): Promise<string> {
  await assertProjectAccess(projectId)
  const { data, error } = await supabase
    .from('activity_feed')
    .insert({ project_id: projectId, ...payload })
    .select('id')
    .single()
  if (error) throw transformSupabaseError(error)
  return data.id
}

export async function notifyMentionedUsers(
  mentionedUserIds: string[],
  activityId: string,
  projectId: string,
): Promise<void> {
  if (mentionedUserIds.length === 0) return
  const rows = mentionedUserIds.map((userId) => ({
    user_id: userId,
    project_id: projectId,
    entity_type: 'activity',
    entity_id: activityId,
    type: 'mention',
    title: 'You were mentioned in a comment',
    read: false,
  }))
  const { error } = await supabase.from('notifications').insert(rows)
  if (error) throw transformSupabaseError(error)
}
