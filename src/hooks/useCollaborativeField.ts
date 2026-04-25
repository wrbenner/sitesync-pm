import { useState, useEffect, useCallback, useRef } from 'react'
import {
  lockField,
  unlockField,
  onFieldLockChange,
  onRemoteEdit,
  onCursorChange,
  isFieldLocked,
  getFieldLockOwner,
} from '../lib/collaborativeEditor'

interface UseCollaborativeFieldResult {
  /** Whether another user currently holds the editing lock on this field */
  isLocked: boolean
  /** Display name of the user who has the lock */
  lockedBy?: string
  /** The color assigned to the locking user (for UI indicators) */
  remoteCursorColor?: string
  /** Latest value pushed by a remote user for this field */
  remoteValue?: unknown
  /** Claim the editing lock on this field (call on focus) */
  startEditing: () => void
  /** Release the editing lock on this field (call on blur) */
  stopEditing: () => void
}

/**
 * React hook that integrates a single form field with the collaborative editing
 * engine. Provides lock state, remote value updates, and cursor color for the
 * CollaborativeFieldIndicator wrapper.
 *
 * Usage:
 * ```tsx
 * const { isLocked, lockedBy, remoteCursorColor, remoteValue, startEditing, stopEditing } =
 *   useCollaborativeField('description')
 *
 * <CollaborativeFieldIndicator isLocked={isLocked} lockedBy={lockedBy} color={remoteCursorColor}>
 *   <input
 *     onFocus={startEditing}
 *     onBlur={stopEditing}
 *     value={remoteValue ?? localValue}
 *   />
 * </CollaborativeFieldIndicator>
 * ```
 */
export function useCollaborativeField(fieldName: string): UseCollaborativeFieldResult {
  const [isLocked, setIsLocked] = useState(false)
  const [lockedBy, setLockedBy] = useState<string | undefined>(undefined)
  const [remoteCursorColor, setRemoteCursorColor] = useState<string | undefined>(undefined)
  const [remoteValue, setRemoteValue] = useState<unknown>(undefined)
  const isEditingRef = useRef(false)

  // Sync initial lock state
  useEffect(() => {
    const lockState = isFieldLocked(fieldName)
    if (lockState.locked && lockState.userId) {
      setIsLocked(true)
      const owner = getFieldLockOwner(fieldName)
      setLockedBy(owner?.displayName)
      setRemoteCursorColor(owner?.color)
    }
  }, [fieldName])

  // Subscribe to lock changes for this field
  useEffect(() => {
    const unsubLock = onFieldLockChange((changedField, locked, _userId, displayName, color) => {
      if (changedField !== fieldName) return
      setIsLocked(locked)
      setLockedBy(locked ? displayName : undefined)
      setRemoteCursorColor(locked ? color : undefined)
    })

    return unsubLock
  }, [fieldName])

  // Subscribe to remote edits for this field
  useEffect(() => {
    const unsubEdit = onRemoteEdit((changedField, value, _userId) => {
      if (changedField !== fieldName) return
      setRemoteValue(value)
    })

    return unsubEdit
  }, [fieldName])

  // Subscribe to cursor changes that might affect our field's color
  useEffect(() => {
    const unsubCursor = onCursorChange((_userId, cursorField, color) => {
      if (cursorField === fieldName) {
        setRemoteCursorColor(color)
      }
    })

    return unsubCursor
  }, [fieldName])

  const startEditing = useCallback(() => {
    if (isEditingRef.current) return
    const acquired = lockField(fieldName)
    if (!acquired) {
      // Field is locked by another user — state will be set via the listener
      return
    }
    isEditingRef.current = true
  }, [fieldName])

  const stopEditing = useCallback(() => {
    if (!isEditingRef.current) return
    unlockField(fieldName)
    isEditingRef.current = false
  }, [fieldName])

  // Clean up lock on unmount
  useEffect(() => {
    return () => {
      if (isEditingRef.current) {
        unlockField(fieldName)
        isEditingRef.current = false
      }
    }
  }, [fieldName])

  return {
    isLocked,
    lockedBy,
    remoteCursorColor,
    remoteValue,
    startEditing,
    stopEditing,
  }
}
