// Edit lock API: pessimistic locking for collaborative editing.
// Upserts a row in edit_locks (entity_type, entity_id, locked_by_user_id, locked_at, expires_at).

import { supabase, transformSupabaseError } from '../client'

// 2-minute lock duration. The frontend MUST call renewEditLock on a 60-second
// setInterval while the user is actively editing, otherwise the lock will expire.
const LOCK_DURATION_MS = 2 * 60 * 1000 // 2 minutes

export interface EditLockAcquired {
  locked: false
}

export interface EditLockBlocked {
  locked: true
  lockedBy: {
    userId: string
    name: string | null
  }
}

export type AcquireEditLockResult = EditLockAcquired | EditLockBlocked

/**
 * Delete all lock rows where expires_at < now(). Returns the number of rows deleted.
 * Called opportunistically on every acquireEditLock and from a 5-minute cron edge function.
 */
export async function cleanupExpiredLocks(): Promise<number> {
  const { data, error } = await supabase
    .from('edit_locks')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('entity_id')

  if (error) throw transformSupabaseError(error)

  return Array.isArray(data) ? data.length : 0
}

// Role hierarchy: higher index = more permissions.
const ROLE_HIERARCHY = ['viewer', 'collaborator', 'foreman', 'project_manager', 'admin', 'owner']

/**
 * Force-release a lock regardless of who holds it. Only allowed for users with
 * project_manager or higher role on the entity's project. Returns true on success.
 *
 * entityType must match one of the mapped table names used for project lookup.
 */
export async function forceReleaseLock(
  entityType: string,
  entityId: string,
  requestingUserId: string,
): Promise<boolean> {
  // Resolve project_id from the entity row. Map entityType to its table name.
  const entityTableMap: Record<string, string> = {
    rfi: 'rfis',
    submittal: 'submittals',
    daily_log: 'daily_logs',
    punch_list_item: 'punch_list_items',
    meeting: 'meetings',
    file: 'files',
    drawing: 'drawings',
    budget_item: 'budget_items',
    schedule_task: 'schedule_tasks',
  }
  const tableName = entityTableMap[entityType]
  if (!tableName) throw new Error(`Unknown entityType for lock release: ${entityType}`)

  const { data: entity, error: entityError } = await supabase
    .from(tableName)
    .select('project_id')
    .eq('id', entityId)
    .maybeSingle()

  if (entityError) throw transformSupabaseError(entityError)
  if (!entity) throw new Error(`Entity not found: ${entityType}/${entityId}`)

  // Verify requesting user has project_manager or higher role.
  const { data: membership, error: memberError } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', entity.project_id)
    .eq('user_id', requestingUserId)
    .maybeSingle()

  if (memberError) throw transformSupabaseError(memberError)

  const userRoleIndex = membership ? ROLE_HIERARCHY.indexOf(membership.role) : -1
  const minRoleIndex = ROLE_HIERARCHY.indexOf('project_manager')
  if (userRoleIndex < minRoleIndex) {
    throw new Error('Insufficient permissions: project_manager or higher required to force release a lock')
  }

  const { error: deleteError } = await supabase
    .from('edit_locks')
    .delete()
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)

  if (deleteError) throw transformSupabaseError(deleteError)

  return true
}

/**
 * Return all active (non-expired) locks for a project, joined with the lock holder's
 * profile name. Powers the admin "Current Locks" panel.
 */
export async function getActiveLocks(
  projectId: string,
): Promise<Array<{
  entityType: string
  entityId: string
  lockedBy: string
  lockedByName: string | null
  expiresAt: string
}>> {
  const { data, error } = await supabase
    .from('edit_locks')
    .select(`
      entity_type,
      entity_id,
      locked_by_user_id,
      expires_at,
      profiles!edit_locks_locked_by_user_id_fkey (full_name)
    `)
    .eq('project_id', projectId)
    .gt('expires_at', new Date().toISOString())

  if (error) throw transformSupabaseError(error)

  return (data ?? []).map((row) => ({
    entityType: row.entity_type,
    entityId: row.entity_id,
    lockedBy: row.locked_by_user_id,
    lockedByName: (row.profiles as { full_name: string | null } | null)?.full_name ?? null,
    expiresAt: row.expires_at,
  }))
}

/**
 * Attempt to acquire an exclusive edit lock for (entityType, entityId).
 *
 * - If no lock exists, or the existing lock is expired, or it belongs to userId:
 *   upsert the lock and return { locked: false }.
 * - If a non-expired lock is held by a different user:
 *   return { locked: true, lockedBy }.
 */
export async function acquireEditLock(
  entityType: string,
  entityId: string,
  userId: string,
): Promise<AcquireEditLockResult> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + LOCK_DURATION_MS)

  // Opportunistically remove stale locks before checking for conflicts.
  await cleanupExpiredLocks()

  // Check for an existing lock on this entity
  const { data: existing, error: fetchError } = await supabase
    .from('edit_locks')
    .select('locked_by_user_id, expires_at')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle()

  if (fetchError) throw transformSupabaseError(fetchError)

  if (existing) {
    const isExpired = new Date(existing.expires_at) <= now
    const ownedByUs = existing.locked_by_user_id === userId

    if (!isExpired && !ownedByUs) {
      // Active lock held by someone else: fetch their display name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', existing.locked_by_user_id)
        .maybeSingle()

      return {
        locked: true,
        lockedBy: {
          userId: existing.locked_by_user_id,
          name: profile?.full_name ?? null,
        },
      }
    }
  }

  // Safe to upsert: no lock, expired lock, or we already own it
  const { error: upsertError } = await supabase
    .from('edit_locks')
    .upsert(
      {
        entity_type: entityType,
        entity_id: entityId,
        locked_by_user_id: userId,
        locked_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      // onConflict matches the unique constraint defined in supabase/migrations/*_create_edit_locks.sql
      { onConflict: 'entity_type,entity_id' },
    )

  if (upsertError) throw transformSupabaseError(upsertError)

  return { locked: false }
}

/**
 * Extend the lock expiry by another LOCK_DURATION_MS. Call every 60 seconds
 * while the user is actively editing to prevent auto-expiry.
 *
 * Returns true if the lock was renewed (userId holds it), false if it was
 * lost (expired or taken by another user).
 */
export async function renewEditLock(
  entityType: string,
  entityId: string,
  userId: string,
): Promise<boolean> {
  const expiresAt = new Date(Date.now() + LOCK_DURATION_MS)

  const { data, error } = await supabase
    .from('edit_locks')
    .update({ expires_at: expiresAt.toISOString() })
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('locked_by_user_id', userId)
    .select('entity_id')

  if (error) throw transformSupabaseError(error)

  return Array.isArray(data) && data.length > 0
}

/**
 * Release the lock. Call on unmount or when the user saves/cancels.
 * Only deletes the row if userId still holds the lock.
 */
export async function releaseEditLock(
  entityType: string,
  entityId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('edit_locks')
    .delete()
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('locked_by_user_id', userId)

  if (error) throw transformSupabaseError(error)
}
