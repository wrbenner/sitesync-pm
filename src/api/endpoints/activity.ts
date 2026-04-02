import { supabase, transformSupabaseError } from '../client'
import { assertProjectAccess } from '../middleware/projectScope'
import { getCachedEntityLabel, setCachedEntityLabel } from '../../hooks/useProjectCache'
import type { ActivityFeedItem } from '../../types/entities'
import type { ActivityFeedRowWithProfile } from '../../types/api'

export const getActivityFeed = async (projectId: string): Promise<ActivityFeedItem[]> => {
  await assertProjectAccess(projectId)
  const { data, error } = await supabase
    .from('activity_feed')
    .select('*, user:profiles(id, full_name, avatar_url)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw transformSupabaseError(error)
  return Promise.all((data || []).map((item) => enrichActivityItem(item as ActivityFeedRowWithProfile, projectId)))
}

export async function enrichActivityItem(
  item: ActivityFeedRowWithProfile,
  projectId: string,
): Promise<ActivityFeedItem> {
  const meta = (item.metadata ?? {}) as Record<string, unknown>
  const entityType = item.type ?? ''
  const entityId = (meta.entity_id as string) || ''
  const verb = (meta.action as string) || entityType || 'updated'

  const profile = item.user
  const actorName = profile?.full_name || (meta.user_name as string) || 'Unknown User'
  const actorAvatar = profile?.avatar_url ?? null

  let entityLabel = item.title || ''
  if (entityId) {
    const cacheKey = `${projectId}:${entityType}:${entityId}`
    const cached = getCachedEntityLabel(cacheKey)
    if (cached !== undefined) {
      entityLabel = cached
    } else {
      const fetched = await fetchEntityLabel(entityType, entityId, projectId)
      entityLabel = fetched || item.title || ''
      setCachedEntityLabel(cacheKey, entityLabel)
    }
  }

  return {
    id: item.id,
    actorName,
    actorAvatar,
    verb,
    entityType,
    entityLabel,
    entityId,
    projectId: item.project_id,
    createdAt: item.created_at ?? new Date().toISOString(),
    metadata: { ...meta, body: item.body },
  }
}

async function fetchEntityLabel(entityType: string, entityId: string, projectId: string): Promise<string> {
  if (!entityId) return ''
  if (entityType === 'rfi') {
    try {
      const { data } = await supabase
        .from('rfis')
        .select('rfi_number, subject')
        .eq('id', entityId)
        .eq('project_id', projectId)
        .single()
      if (data) return `RFI-${String(data.rfi_number).padStart(3, '0')} ${data.subject}`
    } catch {
      return ''
    }
  } else if (entityType === 'submittal') {
    try {
      const { data } = await supabase
        .from('submittals')
        .select('submittal_number, title')
        .eq('id', entityId)
        .eq('project_id', projectId)
        .single()
      if (data) return `SUB-${String(data.submittal_number).padStart(3, '0')} ${data.title}`
    } catch {
      return ''
    }
  } else if (entityType === 'change_order') {
    try {
      const { data } = await supabase
        .from('change_orders')
        .select('co_number, title')
        .eq('id', entityId)
        .eq('project_id', projectId)
        .single()
      if (data) return `CO-${String(data.co_number).padStart(3, '0')} ${data.title}`
    } catch {
      return ''
    }
  } else if (entityType === 'punch_item') {
    try {
      const { data } = await supabase
        .from('punch_items')
        .select('title')
        .eq('id', entityId)
        .eq('project_id', projectId)
        .single()
      if (data) return data.title
    } catch {
      return ''
    }
  } else if (entityType === 'daily_log') {
    try {
      const { data } = await supabase
        .from('daily_logs')
        .select('log_date')
        .eq('id', entityId)
        .eq('project_id', projectId)
        .single()
      if (data) return `Daily Log for ${data.log_date}`
    } catch {
      return ''
    }
  } else if (entityType === 'drawing') {
    try {
      const { data } = await supabase
        .from('drawings')
        .select('sheet_number, title')
        .eq('id', entityId)
        .eq('project_id', projectId)
        .single()
      if (data) return `${data.sheet_number} ${data.title}`
    } catch {
      return ''
    }
  } else if (entityType === 'meeting') {
    try {
      const { data } = await supabase
        .from('meetings')
        .select('title')
        .eq('id', entityId)
        .eq('project_id', projectId)
        .single()
      if (data) return data.title
    } catch {
      return ''
    }
  } else if (entityType === 'task') {
    try {
      const { data } = await supabase
        .from('tasks')
        .select('title')
        .eq('id', entityId)
        .eq('project_id', projectId)
        .single()
      if (data) return data.title
    } catch {
      return ''
    }
  } else {
    return entityId
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
