import { transformSupabaseError } from '../errors'
import { assertProjectAccess } from '../middleware/projectScope'
import { fromTable, selectScoped, inIds } from '../../lib/db/queries'
import { getCachedEntityLabel, setCachedEntityLabel } from '../../hooks/useProjectCache'
import type { ActivityFeedItem } from '../../types/entities'
import type { ActivityFeedRow, ActivityFeedRowWithProfile } from '../../types/api'

// Profile-fetch helper with explicit return shape so the joined Supabase v2
// SelectQueryError union is narrowed at one boundary, not at every call site.
type ProfileLite = { id: string; full_name: string | null; avatar_url: string | null }

async function fetchProfilesForActivity(userIds: string[]): Promise<Map<string, ProfileLite>> {
  if (userIds.length === 0) return new Map()
  const { data, error } = await fromTable('profiles')
    .select('id, full_name, avatar_url')
    .in('id' as never, inIds(userIds))
  if (error) {
    if (import.meta.env.DEV) console.warn('[ActivityFeed] profile lookup failed:', error.message)
    return new Map()
  }
  return new Map((data ?? []).map((p) => {
    const profile = p as ProfileLite
    return [profile.id, profile]
  }))
}

export const getActivityFeed = async (projectId: string): Promise<ActivityFeedItem[]> => {
  await assertProjectAccess(projectId)

  // Two queries instead of a joined select. Supabase v2's strict generics
  // turn `select('*, user:profiles(...)')` into a union with SelectQueryError
  // that breaks downstream `.eq('project_id' as never, ...)` narrowing. The two-query
  // path is also more resilient: a missing FK relationship in one environment
  // doesn't break the feed.
  const { data: rowData, error: rowsError } = await selectScoped('activity_feed', projectId, '*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (rowsError) throw transformSupabaseError(rowsError)
  const rows = (rowData ?? []) as unknown as ActivityFeedRow[]

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
    const meta = (item.metadata ?? {}) as unknown as Record<string, unknown>
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

  // Helper accepts the bare PostgrestBuilder thenable. We can't pin its
  // exact generic shape (Supabase v2's strict generics make composing them
  // through a function-pointer signature impossible without resolving the
  // full conditional-type chain at the boundary), so we accept any awaitable
  // and narrow the resolved object inside.
  async function loadLabels(
    entityType: string,
    fetchRows: () => PromiseLike<unknown>,
    formatLabel: (row: Record<string, unknown>) => string,
  ): Promise<void> {
    try {
      const result = (await fetchRows()) as { data: Array<Record<string, unknown>> | null; error: { message: string } | null }
      const { data, error } = result
      if (error) {
        if (import.meta.env.DEV) console.warn(`[ActivityFeed] ${entityType} label fetch failed:`, error.message)
        return
      }
      for (const row of data ?? []) {
        const id = row.id
        if (typeof id !== 'string') continue
        const label = formatLabel(row)
        labelMap.set(id, label)
        setCachedEntityLabel(`${projectId}:${entityType}:${id}`, label)
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
      () => selectScoped('rfis', projectId, 'id, number, title').in('id' as never, inIds(ids)),
      (row) => `RFI-${String(row.number).padStart(3, '0')} ${row.title}`,
    ))
  }
  if (grouped['submittal']?.length) {
    const ids = grouped['submittal']
    loaders.push(() => loadLabels(
      'submittal',
      () => selectScoped('submittals', projectId, 'id, number, title').in('id' as never, inIds(ids)),
      (row) => `SUB-${String(row.number).padStart(3, '0')} ${row.title}`,
    ))
  }
  if (grouped['punch_list_item']?.length) {
    const ids = grouped['punch_list_item']
    loaders.push(() => loadLabels(
      'punch_list_item',
      () => selectScoped('punch_items', projectId, 'id, title').in('id' as never, inIds(ids)),
      (row) => String(row.title),
    ))
  }
  if (grouped['change_order']?.length) {
    const ids = grouped['change_order']
    loaders.push(() => loadLabels(
      'change_order',
      () => selectScoped('change_orders', projectId, 'id, number, title').in('id' as never, inIds(ids)),
      (row) => `CO-${row.number} ${row.title}`,
    ))
  }
  if (grouped['punch_item']?.length) {
    const ids = grouped['punch_item']
    loaders.push(() => loadLabels(
      'punch_item',
      () => selectScoped('punch_items', projectId, 'id, title, location').in('id' as never, inIds(ids)),
      (row) => row.location ? `${row.title} at ${row.location}` : String(row.title),
    ))
  }
  if (grouped['daily_log']?.length) {
    const ids = grouped['daily_log']
    loaders.push(() => loadLabels(
      'daily_log',
      () => selectScoped('daily_logs', projectId, 'id, log_date').in('id' as never, inIds(ids)),
      (row) => `Daily Log ${row.log_date}`,
    ))
  }
  if (grouped['drawing']?.length) {
    const ids = grouped['drawing']
    loaders.push(() => loadLabels(
      'drawing',
      () => selectScoped('drawings', projectId, 'id, sheet_number, title').in('id' as never, inIds(ids)),
      (row) => `${row.sheet_number} ${row.title}`,
    ))
  }
  if (grouped['meeting']?.length) {
    const ids = grouped['meeting']
    loaders.push(() => loadLabels(
      'meeting',
      () => selectScoped('meetings', projectId, 'id, title, date').in('id' as never, inIds(ids)),
      (row) => row.date ? `${row.title} (${row.date})` : String(row.title),
    ))
  }
  if (grouped['task']?.length) {
    const ids = grouped['task']
    loaders.push(() => loadLabels(
      'task',
      () => selectScoped('tasks', projectId, 'id, title').in('id' as never, inIds(ids)),
      (row) => String(row.title),
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
  const meta = (item.metadata ?? {}) as unknown as Record<string, unknown>
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

// Single-entity label dispatcher. Replaces 8 nearly-identical try/catch
// blocks. Each registry entry maps entityType to (table, columns, format).
type EntityLabelSpec = {
  table: 'rfis' | 'submittals' | 'change_orders' | 'punch_items' | 'daily_logs' | 'drawings' | 'meetings' | 'tasks'
  columns: string
  format: (row: Record<string, unknown>) => string
}

const ENTITY_LABEL_REGISTRY: Record<string, EntityLabelSpec> = {
  rfi: {
    table: 'rfis',
    columns: 'number, title',
    format: (r) => `RFI-${String(r.number).padStart(3, '0')} ${r.title}`,
  },
  submittal: {
    table: 'submittals',
    columns: 'number, title',
    format: (r) => `SUB-${String(r.number).padStart(3, '0')} ${r.title}`,
  },
  change_order: {
    table: 'change_orders',
    columns: 'number, title',
    format: (r) => `CO-${String(r.number).padStart(3, '0')} ${r.title}`,
  },
  punch_item: {
    table: 'punch_items',
    columns: 'title',
    format: (r) => String(r.title),
  },
  daily_log: {
    table: 'daily_logs',
    columns: 'log_date',
    format: (r) => `Daily Log for ${r.log_date}`,
  },
  drawing: {
    table: 'drawings',
    columns: 'sheet_number, title',
    format: (r) => `${r.sheet_number} ${r.title}`,
  },
  meeting: {
    table: 'meetings',
    columns: 'title',
    format: (r) => String(r.title),
  },
  task: {
    table: 'tasks',
    columns: 'title',
    format: (r) => String(r.title),
  },
}

async function fetchEntityLabel(entityType: string, entityId: string, projectId: string): Promise<string> {
  if (!entityId) return ''
  const spec = ENTITY_LABEL_REGISTRY[entityType]
  if (!spec) return entityId
  try {
    const { data } = await selectScoped(spec.table, projectId, spec.columns)
      .eq('id' as never, entityId)
      .single()
    if (data) return spec.format(data as unknown as Record<string, unknown>)
  } catch {
    return ''
  }
  return ''
}

export async function insertActivity(
  projectId: string,
  payload: { type: string; title: string; body?: string; metadata?: Record<string, unknown> },
): Promise<string> {
  await assertProjectAccess(projectId)
  const { data, error } = await fromTable('activity_feed')
    .insert({ project_id: projectId, ...payload } as never)
    .select('id')
    .single()
  if (error) throw transformSupabaseError(error)
  return (data as { id: string }).id
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
  const { error } = await fromTable('notifications').insert(rows as never)
  if (error) throw transformSupabaseError(error)
}
