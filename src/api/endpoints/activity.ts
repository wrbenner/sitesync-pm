import { supabase, transformSupabaseError } from '../client'
import { assertProjectAccess } from '../middleware/projectScope'
import { getCachedEntityLabel, setCachedEntityLabel } from '../../hooks/useProjectCache'
import type { ActivityFeedItem } from '../../types/entities'
import type { ActivityFeedRow, ActivityFeedRowWithProfile } from '../../types/api'

// Profile-fetch helper with explicit return shape so the joined Supabase v2
// SelectQueryError union is narrowed at one boundary, not at every call site.
type ProfileLite = { id: string; full_name: string | null; avatar_url: string | null }

async function fetchProfilesForActivity(userIds: string[]): Promise<Map<string, ProfileLite>> {
  if (userIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', userIds)
  if (error) {
    if (import.meta.env.DEV) console.warn('[ActivityFeed] profile lookup failed:', error.message)
    return new Map()
  }
  return new Map((data ?? []).map((p) => [p.id, p as ProfileLite]))
}

export const getActivityFeed = async (projectId: string): Promise<ActivityFeedItem[]> => {
  await assertProjectAccess(projectId)

  // Two queries instead of a joined select. Supabase v2's strict generics
  // turn `select('*, user:profiles(...)')` into a union with SelectQueryError
  // that breaks downstream `.eq('project_id', ...)` narrowing. The two-query
  // path is also more resilient: a missing FK relationship in one environment
  // doesn't break the feed.
  const { data: rowData, error: rowsError } = await supabase
    .from('activity_feed')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (rowsError) throw transformSupabaseError(rowsError)
  const rows = (rowData ?? []) as ActivityFeedRow[]

  // Resolve profiles in one batched query so each row gets actor name/avatar.
  const items = rows as ActivityFeedRowWithProfile[]
  const userIds = Array.from(new Set(
    items
      .map((r) => (r as { user_id?: string | null }).user_id ?? null)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
  ))
  const profilesById = await fetchProfilesForActivity(userIds)
  for (const r of items) {
    const uid = (r as { user_id?: string | null }).user_id
    if (!r.user && uid && profilesById.has(uid)) r.user = profilesById.get(uid)!
  }

  const labelMap = await batchFetchEntityLabels(items, projectId)
  return Promise.all(items.map((item) => enrichActivityItem(item, projectId, labelMap)))
}

async function batchFetchEntityLabels(
  items: ActivityFeedRowWithProfile[],
  projectId: string,
): Promise<Map<string, string>> {
  const labelMap = new Map<string, string>()

  // Group entity IDs by type, skipping anything already cached
  const grouped: Record<string, string[]> = {}
  for (const item of items) {
    const meta = (item.metadata ?? {}) as Record<string, unknown>
    const entityType = item.type ?? ''
    const entityId = (meta.entity_id as string) || ''
    if (!entityId || !entityType) continue
    const cacheKey = `${projectId}:${entityType}:${entityId}`
    const cached = getCachedEntityLabel(cacheKey)
    if (cached !== undefined) {
      labelMap.set(entityId, cached)
      continue
    }
    if (!grouped[entityType]) grouped[entityType] = []
    if (!grouped[entityType].includes(entityId)) grouped[entityType].push(entityId)
  }

  // Single-shape entity-label loader. Each registered loader specifies the
  // table to query, the columns it needs, the activity-feed entityType key,
  // and how to format the label from a row. This replaces nine near-identical
  // .then().catch() chains — collapsing to one awaited try/catch per loader
  // also fixes TS2339 ".catch on PromiseLike<void>" because PostgrestBuilder
  // exposes only .then(), not the full Promise interface.
  type LabelLoader = () => Promise<void>

  async function loadLabels<R extends { id: string }>(
    entityType: string,
    fetchRows: () => Promise<{ data: R[] | null; error: { message: string } | null }>,
    formatLabel: (row: R) => string,
  ): Promise<void> {
    try {
      const { data, error } = await fetchRows()
      if (error) {
        if (import.meta.env.DEV) console.warn(`[ActivityFeed] ${entityType} label fetch failed:`, error.message)
        return
      }
      for (const row of data ?? []) {
        const label = formatLabel(row)
        labelMap.set(row.id, label)
        setCachedEntityLabel(`${projectId}:${entityType}:${row.id}`, label)
      }
    } catch (err) {
      if (import.meta.env.DEV) console.warn(`[ActivityFeed] ${entityType} label fetch failed:`, err instanceof Error ? err.message : String(err))
    }
  }

  const loaders: LabelLoader[] = []

  if (grouped['rfi']?.length) {
    const ids = grouped['rfi']
    loaders.push(() => loadLabels(
      'rfi',
      () => supabase.from('rfis').select('id, number, title').eq('project_id', projectId).in('id', ids),
      (row) => `RFI-${String(row.number).padStart(3, '0')} ${row.title}`,
    ))
  }
  if (grouped['submittal']?.length) {
    const ids = grouped['submittal']
    loaders.push(() => loadLabels(
      'submittal',
      () => supabase.from('submittals').select('id, number, title').eq('project_id', projectId).in('id', ids),
      (row) => `SUB-${String(row.number).padStart(3, '0')} ${row.title}`,
    ))
  }
  if (grouped['punch_list_item']?.length) {
    const ids = grouped['punch_list_item']
    loaders.push(() => loadLabels(
      'punch_list_item',
      () => supabase.from('punch_items').select('id, title').eq('project_id', projectId).in('id', ids),
      (row) => row.title,
    ))
  }
  if (grouped['change_order']?.length) {
    const ids = grouped['change_order']
    loaders.push(() => loadLabels(
      'change_order',
      () => supabase.from('change_orders').select('id, number, title').eq('project_id', projectId).in('id', ids),
      (row) => `CO-${row.number} ${row.title}`,
    ))
  }
  if (grouped['punch_item']?.length) {
    const ids = grouped['punch_item']
    loaders.push(() => loadLabels(
      'punch_item',
      () => supabase.from('punch_items').select('id, title, location').eq('project_id', projectId).in('id', ids),
      (row) => row.location ? `${row.title} at ${row.location}` : row.title,
    ))
  }
  if (grouped['daily_log']?.length) {
    const ids = grouped['daily_log']
    loaders.push(() => loadLabels(
      'daily_log',
      () => supabase.from('daily_logs').select('id, log_date').eq('project_id', projectId).in('id', ids),
      (row) => `Daily Log ${row.log_date}`,
    ))
  }
  if (grouped['drawing']?.length) {
    const ids = grouped['drawing']
    loaders.push(() => loadLabels(
      'drawing',
      () => supabase.from('drawings').select('id, sheet_number, title').eq('project_id', projectId).in('id', ids),
      (row) => `${row.sheet_number} ${row.title}`,
    ))
  }
  if (grouped['meeting']?.length) {
    const ids = grouped['meeting']
    loaders.push(() => loadLabels(
      'meeting',
      () => supabase.from('meetings').select('id, title, date').eq('project_id', projectId).in('id', ids),
      (row) => row.date ? `${row.title} (${row.date})` : row.title,
    ))
  }
  if (grouped['task']?.length) {
    const ids = grouped['task']
    loaders.push(() => loadLabels(
      'task',
      () => supabase.from('tasks').select('id, title').eq('project_id', projectId).in('id', ids),
      (row) => row.title,
    ))
  }

  await Promise.allSettled(loaders.map((load) => load()))
  return labelMap
}

export async function enrichActivityItem(
  item: ActivityFeedRowWithProfile,
  projectId: string,
  prefetchedLabels?: Map<string, string>,
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
    if (prefetchedLabels?.has(entityId)) {
      entityLabel = prefetchedLabels.get(entityId)!
    } else {
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
        .select('number, title')
        .eq('id', entityId)
        .eq('project_id', projectId)
        .single()
      if (data) return `RFI-${String(data.number).padStart(3, '0')} ${data.title}`
    } catch {
      return ''
    }
  } else if (entityType === 'submittal') {
    try {
      const { data } = await supabase
        .from('submittals')
        .select('number, title')
        .eq('id', entityId)
        .eq('project_id', projectId)
        .single()
      if (data) return `SUB-${String(data.number).padStart(3, '0')} ${data.title}`
    } catch {
      return ''
    }
  } else if (entityType === 'change_order') {
    try {
      const { data } = await supabase
        .from('change_orders')
        .select('number, title')
        .eq('id', entityId)
        .eq('project_id', projectId)
        .single()
      if (data) return `CO-${String(data.number).padStart(3, '0')} ${data.title}`
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
