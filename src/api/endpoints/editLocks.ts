// Edit lock API: pessimistic locking for collaborative editing.
// Upserts a row in edit_locks (entity_type, entity_id, locked_by_user_id, locked_at, expires_at).

import { supabase, transformSupabaseError } from '../client'

const LOCK_DURATION_MS = 5 * 60 * 1000 // 5 minutes

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
 * Extend the lock expiry by another 5 minutes. Call every 60 seconds
 * while the user is actively editing to prevent auto-expiry.
 */
export async function renewEditLock(
  entityType: string,
  entityId: string,
  userId: string,
): Promise<void> {
  const expiresAt = new Date(Date.now() + LOCK_DURATION_MS)

  const { error } = await supabase
    .from('edit_locks')
    .update({ expires_at: expiresAt.toISOString() })
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('locked_by_user_id', userId)

  if (error) throw transformSupabaseError(error)
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
