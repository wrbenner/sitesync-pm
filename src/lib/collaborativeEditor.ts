import { supabase } from './supabase'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────

export interface CollaborativeSession {
  entityType: string  // 'daily_log', 'meeting_minutes', 'rfi'
  entityId: string
  activeEditors: Map<string, EditingUser>
  lockedFields: Map<string, string>  // fieldName -> userId
}

export interface EditingUser {
  userId: string
  displayName: string
  color: string
  focusedField?: string
  lastSeen: number
}

interface FieldUpdatePayload {
  userId: string
  displayName: string
  fieldName: string
  value: unknown
  timestamp: number
}

interface FieldLockPayload {
  userId: string
  displayName: string
  color: string
  fieldName: string
}

interface CursorPayload {
  userId: string
  displayName: string
  color: string
  fieldName: string | null
}

type RemoteEditCallback = (fieldName: string, value: unknown, userId: string) => void
type FieldLockChangeCallback = (
  fieldName: string,
  locked: boolean,
  userId: string | undefined,
  displayName: string | undefined,
  color: string | undefined,
) => void
type CursorChangeCallback = (userId: string, fieldName: string | null, color: string) => void

// ── Collaborative Editing Colors ──────────────────────────

const EDITOR_COLORS = [
  '#3A7BC8', // blue
  '#7C5DC7', // purple
  '#06B6D4', // cyan
  '#D97706', // amber
  '#E05252', // red
  '#4EC896', // teal
  '#F47820', // orange
  '#4F46E5', // indigo
]

function getEditorColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i)
  }
  return EDITOR_COLORS[Math.abs(hash) % EDITOR_COLORS.length]
}

// ── Session State ─────────────────────────────────────────

let currentSession: CollaborativeSession | null = null
let channel: ReturnType<typeof supabase.channel> | null = null
let currentUserId: string | null = null
let currentDisplayName: string | null = null

const remoteEditListeners = new Set<RemoteEditCallback>()
const fieldLockListeners = new Set<FieldLockChangeCallback>()
const cursorChangeListeners = new Set<CursorChangeCallback>()

// Stale lock timeout (30 seconds)
const STALE_LOCK_MS = 30_000

// ── Stale Lock Cleanup ────────────────────────────────────

function cleanupStaleEditors(): void {
  if (!currentSession) return
  const now = Date.now()
  const staleUserIds: string[] = []

  for (const [userId, editor] of currentSession.activeEditors) {
    if (now - editor.lastSeen > STALE_LOCK_MS) {
      staleUserIds.push(userId)
    }
  }

  for (const userId of staleUserIds) {
    currentSession.activeEditors.delete(userId)
    // Release any fields locked by this stale user
    for (const [fieldName, lockOwner] of currentSession.lockedFields) {
      if (lockOwner === userId) {
        currentSession.lockedFields.delete(fieldName)
        notifyFieldLockChange(fieldName, false, undefined, undefined, undefined)
      }
    }
  }
}

let staleCleanupInterval: ReturnType<typeof setInterval> | null = null

// ── Notification Helpers ──────────────────────────────────

function notifyFieldLockChange(
  fieldName: string,
  locked: boolean,
  userId: string | undefined,
  displayName: string | undefined,
  color: string | undefined,
): void {
  for (const listener of fieldLockListeners) {
    listener(fieldName, locked, userId, displayName, color)
  }
}

function notifyRemoteEdit(fieldName: string, value: unknown, userId: string): void {
  for (const listener of remoteEditListeners) {
    listener(fieldName, value, userId)
  }
}

function notifyCursorChange(userId: string, fieldName: string | null, color: string): void {
  for (const listener of cursorChangeListeners) {
    listener(userId, fieldName, color)
  }
}

// ── Channel Event Handlers ────────────────────────────────

function handleEditingStart(payload: FieldLockPayload): void {
  if (!currentSession || payload.userId === currentUserId) return

  const { userId, displayName, color, fieldName } = payload

  // Update or add the editing user
  currentSession.activeEditors.set(userId, {
    userId,
    displayName,
    color,
    focusedField: fieldName,
    lastSeen: Date.now(),
  })

  // Check if current user already has this field locked
  const existingLock = currentSession.lockedFields.get(fieldName)
  if (existingLock && existingLock === currentUserId) {
    // Conflict: another user is trying to edit a field we have locked.
    // We keep our lock — they will see it as locked.
    return
  }

  // Set the lock
  currentSession.lockedFields.set(fieldName, userId)
  notifyFieldLockChange(fieldName, true, userId, displayName, color)
}

function handleEditingStop(payload: FieldLockPayload): void {
  if (!currentSession || payload.userId === currentUserId) return

  const { userId, fieldName } = payload

  // Only release the lock if it belongs to this user
  const lockOwner = currentSession.lockedFields.get(fieldName)
  if (lockOwner === userId) {
    currentSession.lockedFields.delete(fieldName)
    notifyFieldLockChange(fieldName, false, undefined, undefined, undefined)
  }

  // Update the editor's focused field
  const editor = currentSession.activeEditors.get(userId)
  if (editor) {
    editor.focusedField = undefined
    editor.lastSeen = Date.now()
  }
}

function handleFieldUpdate(payload: FieldUpdatePayload): void {
  if (!currentSession || payload.userId === currentUserId) return

  const { userId, displayName, fieldName, value } = payload

  // OT-lite: field-level last-write-wins
  // If the current user is editing the same field, notify them with a toast
  const lockOwner = currentSession.lockedFields.get(fieldName)
  if (lockOwner === currentUserId) {
    toast.info(`${displayName} also edited "${fieldName}"`, {
      description: 'Their change was applied. Your edit may have been overwritten.',
      duration: 5000,
    })
  }

  notifyRemoteEdit(fieldName, value, userId)

  // Update last seen
  const editor = currentSession.activeEditors.get(userId)
  if (editor) {
    editor.lastSeen = Date.now()
  }
}

function handleCursorMove(payload: CursorPayload): void {
  if (!currentSession || payload.userId === currentUserId) return

  const { userId, displayName, color, fieldName } = payload

  // Update editor record
  const existing = currentSession.activeEditors.get(userId)
  if (existing) {
    existing.focusedField = fieldName ?? undefined
    existing.lastSeen = Date.now()
  } else {
    currentSession.activeEditors.set(userId, {
      userId,
      displayName,
      color,
      focusedField: fieldName ?? undefined,
      lastSeen: Date.now(),
    })
  }

  notifyCursorChange(userId, fieldName, color)
}

function handleUserLeave(payload: { userId: string }): void {
  if (!currentSession || payload.userId === currentUserId) return

  const { userId } = payload

  // Release all locks held by the departing user
  for (const [fieldName, lockOwner] of currentSession.lockedFields) {
    if (lockOwner === userId) {
      currentSession.lockedFields.delete(fieldName)
      notifyFieldLockChange(fieldName, false, undefined, undefined, undefined)
    }
  }

  currentSession.activeEditors.delete(userId)
}

// ── Public API ────────────────────────────────────────────

/**
 * Join a collaborative editing session for a specific entity.
 * Returns a cleanup function to leave the session.
 */
export function startCollaborativeSession(
  entityType: string,
  entityId: string,
  userId: string,
  displayName: string,
): () => void {
  // Clean up any existing session
  if (currentSession) {
    endCollaborativeSession()
  }

  currentUserId = userId
  currentDisplayName = displayName

  currentSession = {
    entityType,
    entityId,
    activeEditors: new Map(),
    lockedFields: new Map(),
  }

  const channelName = `collab_${entityType}_${entityId}`
  channel = supabase.channel(channelName)

  channel
    .on('broadcast', { event: 'editing_start' }, ({ payload }) => {
      handleEditingStart(payload as FieldLockPayload)
    })
    .on('broadcast', { event: 'editing_stop' }, ({ payload }) => {
      handleEditingStop(payload as FieldLockPayload)
    })
    .on('broadcast', { event: 'field_update' }, ({ payload }) => {
      handleFieldUpdate(payload as FieldUpdatePayload)
    })
    .on('broadcast', { event: 'cursor_move' }, ({ payload }) => {
      handleCursorMove(payload as CursorPayload)
    })
    .on('broadcast', { event: 'user_leave' }, ({ payload }) => {
      handleUserLeave(payload as { userId: string })
    })
    .subscribe()

  // Start stale lock cleanup
  staleCleanupInterval = setInterval(cleanupStaleEditors, 10_000)

  return () => endCollaborativeSession()
}

/**
 * Leave the current collaborative editing session.
 */
export function endCollaborativeSession(): void {
  if (channel && currentUserId) {
    // Notify others we're leaving
    channel.send({
      type: 'broadcast',
      event: 'user_leave',
      payload: { userId: currentUserId },
    }).catch(() => {})

    supabase.removeChannel(channel)
  }

  if (staleCleanupInterval) {
    clearInterval(staleCleanupInterval)
    staleCleanupInterval = null
  }

  channel = null
  currentSession = null
  currentUserId = null
  currentDisplayName = null
  remoteEditListeners.clear()
  fieldLockListeners.clear()
  cursorChangeListeners.clear()
}

/**
 * Claim an editing lock on a specific field.
 * Returns true if the lock was acquired, false if the field is already locked.
 */
export function lockField(fieldName: string): boolean {
  if (!currentSession || !channel || !currentUserId || !currentDisplayName) return false

  // Check if already locked by another user
  const existingLock = currentSession.lockedFields.get(fieldName)
  if (existingLock && existingLock !== currentUserId) {
    return false
  }

  const color = getEditorColor(currentUserId)

  // Set local lock
  currentSession.lockedFields.set(fieldName, currentUserId)

  // Broadcast to others
  channel.send({
    type: 'broadcast',
    event: 'editing_start',
    payload: {
      userId: currentUserId,
      displayName: currentDisplayName,
      color,
      fieldName,
    } satisfies FieldLockPayload,
  }).catch(() => {})

  // Also broadcast cursor position
  channel.send({
    type: 'broadcast',
    event: 'cursor_move',
    payload: {
      userId: currentUserId,
      displayName: currentDisplayName,
      color,
      fieldName,
    } satisfies CursorPayload,
  }).catch(() => {})

  return true
}

/**
 * Release the editing lock on a specific field.
 */
export function unlockField(fieldName: string): void {
  if (!currentSession || !channel || !currentUserId || !currentDisplayName) return

  // Only release if we own the lock
  const lockOwner = currentSession.lockedFields.get(fieldName)
  if (lockOwner !== currentUserId) return

  const color = getEditorColor(currentUserId)

  currentSession.lockedFields.delete(fieldName)

  channel.send({
    type: 'broadcast',
    event: 'editing_stop',
    payload: {
      userId: currentUserId,
      displayName: currentDisplayName,
      color,
      fieldName,
    } satisfies FieldLockPayload,
  }).catch(() => {})
}

/**
 * Broadcast a field value change to all other editors.
 * Implements OT-lite: field-level last-write-wins.
 */
export function broadcastFieldUpdate(fieldName: string, value: unknown): void {
  if (!channel || !currentUserId || !currentDisplayName) return

  channel.send({
    type: 'broadcast',
    event: 'field_update',
    payload: {
      userId: currentUserId,
      displayName: currentDisplayName,
      fieldName,
      value,
      timestamp: Date.now(),
    } satisfies FieldUpdatePayload,
  }).catch(() => {})
}

/**
 * Subscribe to incoming field edits from remote users.
 * Returns an unsubscribe function.
 */
export function onRemoteEdit(callback: RemoteEditCallback): () => void {
  remoteEditListeners.add(callback)
  return () => {
    remoteEditListeners.delete(callback)
  }
}

/**
 * Subscribe to field lock/unlock changes.
 * Returns an unsubscribe function.
 */
export function onFieldLockChange(callback: FieldLockChangeCallback): () => void {
  fieldLockListeners.add(callback)
  return () => {
    fieldLockListeners.delete(callback)
  }
}

/**
 * Subscribe to remote cursor position changes.
 * Returns an unsubscribe function.
 */
export function onCursorChange(callback: CursorChangeCallback): () => void {
  cursorChangeListeners.add(callback)
  return () => {
    cursorChangeListeners.delete(callback)
  }
}

/**
 * Get the current session state (for debugging or UI).
 */
export function getCollaborativeSession(): CollaborativeSession | null {
  return currentSession
}

/**
 * Check if a specific field is currently locked by another user.
 */
export function isFieldLocked(fieldName: string): { locked: boolean; userId?: string } {
  if (!currentSession) return { locked: false }

  const lockOwner = currentSession.lockedFields.get(fieldName)
  if (!lockOwner || lockOwner === currentUserId) return { locked: false }

  return { locked: true, userId: lockOwner }
}

/**
 * Get info about the user who has a field locked.
 */
export function getFieldLockOwner(fieldName: string): EditingUser | undefined {
  if (!currentSession) return undefined

  const lockOwner = currentSession.lockedFields.get(fieldName)
  if (!lockOwner || lockOwner === currentUserId) return undefined

  return currentSession.activeEditors.get(lockOwner)
}
