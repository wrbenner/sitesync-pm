import { supabase } from '../lib/supabase'
import type { EntityType, LinkedItem } from '../components/shared/LinkedEntities'

// ── Entity Links Service ─────────────────────────────────────────────────────
// Manages bidirectional links between entities (CO ↔ RFI ↔ Submittal ↔ Drawing etc.)
// Uses the entity_links join table with source/target pattern.
// Links are stored once but queried bidirectionally.

export interface EntityLink {
  id: string
  project_id: string
  source_type: EntityType
  source_id: string
  target_type: EntityType
  target_id: string
  created_by: string | null
  created_at: string
  note?: string | null
}

export interface CreateLinkPayload {
  project_id: string
  source_type: EntityType
  source_id: string
  target_type: EntityType
  target_id: string
  note?: string
}

/**
 * Fetch all entities linked to a given entity (bidirectional).
 * Returns LinkedItem[] ready for the LinkedEntities component.
 */
export async function getLinkedEntities(
  projectId: string,
  entityType: EntityType,
  entityId: string,
): Promise<LinkedItem[]> {
  // Query both directions: where this entity is source OR target
  const [asSourceRes, asTargetRes] = await Promise.all([
    supabase
      .from('entity_links')
      .select('*')
      .eq('project_id', projectId)
      .eq('source_type', entityType)
      .eq('source_id', entityId),
    supabase
      .from('entity_links')
      .select('*')
      .eq('project_id', projectId)
      .eq('target_type', entityType)
      .eq('target_id', entityId),
  ])

  // Collect the "other side" of each link
  const linkedRefs: Array<{ type: EntityType; id: string }> = []

  if (asSourceRes.data) {
    for (const row of asSourceRes.data) {
      linkedRefs.push({ type: row.target_type as EntityType, id: row.target_id as string })
    }
  }
  if (asTargetRes.data) {
    for (const row of asTargetRes.data) {
      linkedRefs.push({ type: row.source_type as EntityType, id: row.source_id as string })
    }
  }

  if (linkedRefs.length === 0) return []

  // Resolve each linked entity to get its display data
  const items: LinkedItem[] = []
  for (const ref of linkedRefs) {
    const item = await resolveEntity(ref.type, ref.id)
    if (item) items.push(item)
  }

  return items
}

/**
 * Create a bidirectional link between two entities.
 */
export async function createEntityLink(payload: CreateLinkPayload): Promise<EntityLink | null> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id ?? null

  // Check for existing link (either direction) to prevent duplicates
  const { data: existing } = await supabase
    .from('entity_links')
    .select('id')
    .eq('project_id', payload.project_id)
    .or(
      `and(source_type.eq.${payload.source_type},source_id.eq.${payload.source_id},target_type.eq.${payload.target_type},target_id.eq.${payload.target_id}),` +
      `and(source_type.eq.${payload.target_type},source_id.eq.${payload.target_id},target_type.eq.${payload.source_type},target_id.eq.${payload.source_id})`
    )
    .limit(1)

  if (existing && existing.length > 0) {
    // Link already exists — return it
    return existing[0] as unknown as EntityLink
  }

  const { data, error } = await supabase
    .from('entity_links')
    .insert({
      project_id: payload.project_id,
      source_type: payload.source_type,
      source_id: payload.source_id,
      target_type: payload.target_type,
      target_id: payload.target_id,
      created_by: userId,
      note: payload.note ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[EntityLinks] Failed to create link:', error.message)
    return null
  }
  return data as unknown as EntityLink
}

/**
 * Remove a link between two entities.
 */
export async function removeEntityLink(linkId: string): Promise<boolean> {
  const { error } = await supabase
    .from('entity_links')
    .delete()
    .eq('id', linkId)
  return !error
}

/**
 * Remove all links for a given entity (useful when deleting an entity).
 */
export async function removeAllLinksForEntity(
  projectId: string,
  entityType: EntityType,
  entityId: string,
): Promise<void> {
  await Promise.all([
    supabase
      .from('entity_links')
      .delete()
      .eq('project_id', projectId)
      .eq('source_type', entityType)
      .eq('source_id', entityId),
    supabase
      .from('entity_links')
      .delete()
      .eq('project_id', projectId)
      .eq('target_type', entityType)
      .eq('target_id', entityId),
  ])
}

// ── Resolution Helpers ──────────────────────────────────────────────────────

const TABLE_MAP: Record<EntityType, string> = {
  rfi: 'rfis',
  submittal: 'submittals',
  change_order: 'change_orders',
  punch_item: 'punch_list_items',
  daily_log: 'daily_logs',
  drawing: 'drawings',
  meeting: 'meetings',
  contract: 'contracts',
  pay_app: 'pay_applications',
  safety_incident: 'safety_incidents',
}

async function resolveEntity(type: EntityType, id: string): Promise<LinkedItem | null> {
  const table = TABLE_MAP[type]
  if (!table) return null

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null

  const row = data as Record<string, unknown>

  switch (type) {
    case 'rfi':
      return {
        type,
        id,
        number: (row.rfi_number as number) ?? (row.number as number) ?? '',
        title: (row.subject as string) ?? (row.title as string) ?? '',
        status: (row.status as string) ?? 'open',
        date: (row.created_at as string) ?? undefined,
      }
    case 'submittal':
      return {
        type,
        id,
        number: (row.submittal_number as string) ?? (row.number as number) ?? '',
        title: (row.title as string) ?? (row.description as string) ?? '',
        status: (row.status as string) ?? 'open',
        date: (row.submitted_date as string) ?? (row.created_at as string) ?? undefined,
      }
    case 'change_order':
      return {
        type,
        id,
        number: (row.number as number) ?? '',
        title: (row.title as string) ?? (row.description as string) ?? '',
        status: (row.status as string) ?? 'draft',
        date: (row.created_at as string) ?? undefined,
      }
    case 'drawing':
      return {
        type,
        id,
        number: (row.drawing_number as string) ?? (row.number as string) ?? '',
        title: (row.title as string) ?? (row.name as string) ?? '',
        status: (row.status as string) ?? (row.revision as string) ?? 'current',
        date: (row.issue_date as string) ?? (row.created_at as string) ?? undefined,
      }
    case 'punch_item':
      return {
        type,
        id,
        number: (row.number as number) ?? (row.item_number as number) ?? '',
        title: (row.description as string) ?? (row.title as string) ?? '',
        status: (row.status as string) ?? 'open',
        date: (row.created_at as string) ?? undefined,
      }
    case 'daily_log':
      return {
        type,
        id,
        number: (row.log_number as number) ?? '',
        title: (row.summary as string) ?? `Daily Log ${(row.date as string) ?? ''}`,
        status: (row.status as string) ?? 'submitted',
        date: (row.date as string) ?? (row.created_at as string) ?? undefined,
      }
    case 'meeting':
      return {
        type,
        id,
        number: (row.meeting_number as number) ?? '',
        title: (row.title as string) ?? (row.subject as string) ?? '',
        status: (row.status as string) ?? 'scheduled',
        date: (row.date as string) ?? (row.created_at as string) ?? undefined,
      }
    case 'contract':
      return {
        type,
        id,
        number: (row.contract_number as string) ?? '',
        title: (row.title as string) ?? (row.counterparty as string) ?? '',
        status: (row.status as string) ?? 'active',
        date: (row.start_date as string) ?? (row.created_at as string) ?? undefined,
      }
    case 'pay_app':
      return {
        type,
        id,
        number: (row.application_number as number) ?? '',
        title: `Pay App #${(row.application_number as number) ?? ''}`,
        status: (row.status as string) ?? 'draft',
        date: (row.period_to as string) ?? (row.created_at as string) ?? undefined,
      }
    case 'safety_incident':
      return {
        type,
        id,
        number: (row.incident_number as number) ?? '',
        title: (row.description as string) ?? (row.title as string) ?? '',
        status: (row.status as string) ?? 'reported',
        date: (row.incident_date as string) ?? (row.created_at as string) ?? undefined,
      }
    default:
      return null
  }
}
