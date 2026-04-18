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
  const items = (data || []) as ActivityFeedRowWithProfile[]
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

  const fetches: Promise<void>[] = []

  if (grouped['rfi']?.length) {
    fetches.push(
      supabase
        .from('rfis')
        .select('id, rfi_number, subject')
        .eq('project_id', projectId)
        .in('id', grouped['rfi'])
        .then(({ data }) => {
          for (const row of data ?? []) {
            const label = `RFI-${String(row.rfi_number).padStart(3, '0')} ${row.subject}`
            labelMap.set(row.id, label)
            setCachedEntityLabel(`${projectId}:rfi:${row.id}`, label)
          }
        })
        .catch((err: unknown) => { if (import.meta.env.DEV) console.warn('[ActivityFeed] Failed to fetch entity labels for type:', err instanceof Error ? err.message : String(err)) }),
    )
  }

  if (grouped['submittal']?.length) {
    fetches.push(
      supabase
        .from('submittals')
        .select('id, submittal_number, title')
        .eq('project_id', projectId)
        .in('id', grouped['submittal'])
        .then(({ data }) => {
          for (const row of data ?? []) {
            const label = `SUB-${String(row.submittal_number).padStart(3, '0')} ${row.title}`
            labelMap.set(row.id, label)
            setCachedEntityLabel(`${projectId}:submittal:${row.id}`, label)
          }
        })
        .catch((err: unknown) => { if (import.meta.env.DEV) console.warn('[ActivityFeed] Failed to fetch entity labels for type:', err instanceof Error ? err.message : String(err)) }),
    )
  }

  if (grouped['punch_list_item']?.length) {
    fetches.push(
      supabase
        .from('punch_list_items')
        .select('id, title')
        .eq('project_id', projectId)
        .in('id', grouped['punch_list_item'])
        .then(({ data }) => {
          for (const row of data ?? []) {
            const label = row.title
            labelMap.set(row.id, label)
            setCachedEntityLabel(`${projectId}:punch_list_item:${row.id}`, label)
          }
        })
        .catch((err: unknown) => { if (import.meta.env.DEV) console.warn('[ActivityFeed] punch_list_item label fetch failed:', err instanceof Error ? err.message : String(err)) }),
    )
  }

  if (grouped['change_order']?.length) {
    fetches.push(
      supabase
        .from('change_orders')
        .select('id, number, title')
        .eq('project_id', projectId)
        .in('id', grouped['change_order'])
        .then(({ data }) => {
          for (const row of data ?? []) {
            const label = `CO-${row.number} ${row.title}`
            labelMap.set(row.id, label)
            setCachedEntityLabel(`${projectId}:change_order:${row.id}`, label)
          }
        })
        .catch((err: unknown) => { if (import.meta.env.DEV) console.warn('[ActivityFeed] Failed to fetch entity labels for type:', err instanceof Error ? err.message : String(err)) }),
    )
  }

  if (grouped['punch_item']?.length) {
    fetches.push(
      supabase
        .from('punch_items')
        .select('id, title, location')
        .eq('project_id', projectId)
        .in('id', grouped['punch_item'])
        .then(({ data }) => {
          for (const row of data ?? []) {
            const label = row.location ? `${row.title} at ${row.location}` : row.title
            labelMap.set(row.id, label)
            setCachedEntityLabel(`${projectId}:punch_item:${row.id}`, label)
          }
        })
        .catch((err: unknown) => { if (import.meta.env.DEV) console.warn('[ActivityFeed] Failed to fetch entity labels for type:', err instanceof Error ? err.message : String(err)) }),
    )
  }

  if (grouped['daily_log']?.length) {
    fetches.push(
      supabase
        .from('daily_logs')
        .select('id, log_date')
        .eq('project_id', projectId)
        .in('id', grouped['daily_log'])
        .then(({ data }) => {
          for (const row of data ?? []) {
            const label = `Daily Log ${row.log_date}`
            labelMap.set(row.id, label)
            setCachedEntityLabel(`${projectId}:daily_log:${row.id}`, label)
          }
        })
        .catch((err: unknown) => { if (import.meta.env.DEV) console.warn('[ActivityFeed] Failed to fetch entity labels for type:', err instanceof Error ? err.message : String(err)) }),
    )
  }

  if (grouped['drawing']?.length) {
    fetches.push(
      supabase
        .from('drawings')
        .select('id, sheet_number, title')
        .eq('project_id', projectId)
        .in('id', grouped['drawing'])
        .then(({ data }) => {
          for (const row of data ?? []) {
            const label = `${row.sheet_number} ${row.title}`
            labelMap.set(row.id, label)
            setCachedEntityLabel(`${projectId}:drawing:${row.id}`, label)
          }
        })
        .catch((err: unknown) => { if (import.meta.env.DEV) console.warn('[ActivityFeed] Failed to fetch entity labels for type:', err instanceof Error ? err.message : String(err)) }),
    )
  }

  if (grouped['meeting']?.length) {
    fetches.push(
      supabase
        .from('meetings')
        .select('id, title, date')
        .eq('project_id', projectId)
        .in('id', grouped['meeting'])
        .then(({ data }) => {
          for (const row of data ?? []) {
            const label = row.date ? `${row.title} (${row.date})` : row.title
            labelMap.set(row.id, label)
            setCachedEntityLabel(`${projectId}:meeting:${row.id}`, label)
          }
        })
        .catch((err: unknown) => { if (import.meta.env.DEV) console.warn('[ActivityFeed] Failed to fetch entity labels for type:', err instanceof Error ? err.message : String(err)) }),
    )
  }

  if (grouped['task']?.length) {
    fetches.push(
      supabase
        .from('tasks')
        .select('id, title')
        .eq('project_id', projectId)
        .in('id', grouped['task'])
        .then(({ data }) => {
          for (const row of data ?? []) {
            labelMap.set(row.id, row.title)
            setCachedEntityLabel(`${projectId}:task:${row.id}`, row.title)
          }
        })
        .catch((err: unknown) => { if (import.meta.env.DEV) console.warn('[ActivityFeed] Failed to fetch entity labels for type:', err instanceof Error ? err.message : String(err)) }),
    )
  }

  if (grouped['incident']?.length) {
    fetches.push(
      supabase
        .from('incidents')
        .select('id, incident_number, type')
        .eq('project_id', projectId)
        .in('id', grouped['incident'])
        .then(({ data }) => {
          for (const row of data ?? []) {
            const label = `Incident #${row.incident_number}${row.type ? ` - ${row.type}` : ''}`
            labelMap.set(row.id, label)
            setCachedEntityLabel(`${projectId}:incident:${row.id}`, label)
          }
        })
        .catch((err: unknown) => { if (import.meta.env.DEV) console.warn('[ActivityFeed] Failed to fetch entity labels for type:', err instanceof Error ? err.message : String(err)) }),
    )
  }

  await Promise.allSettled(fetches)
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
  } else if (entityType === 'incident') {
    try {
      const { data } = await supabase
        .from('incidents')
        .select('incident_number, type')
        .eq('id', entityId)
        .eq('project_id', projectId)
        .single()
      if (data) return `Incident #${data.incident_number}${data.type ? ` - ${data.type}` : ''}`
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
  const { data: authData } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('activity_feed')
    .insert({ project_id: projectId, user_id: authData?.user?.id ?? null, ...payload })
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
