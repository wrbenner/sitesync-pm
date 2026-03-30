import { useEffect, useCallback } from 'react'
import { subscribeToProject, subscribeToNotifications, subscribeToPresence, updatePresencePage, requestNotificationPermission } from '../lib/realtime'
import type { PresenceUser } from '../lib/realtime'
import { usePresenceStore } from '../stores/presenceStore'

export function useRealtimeSubscription(projectId: string | undefined, userId: string | undefined) {
  // Subscribe to project-scoped realtime updates
  useEffect(() => {
    if (!projectId) return
    const unsubscribe = subscribeToProject(projectId, userId)
    return () => unsubscribe()
  }, [projectId, userId])

  // Subscribe to user-scoped notifications
  useEffect(() => {
    if (!userId) return
    const unsubscribe = subscribeToNotifications(userId)
    requestNotificationPermission()
    return () => unsubscribe()
  }, [userId])
}

export function usePresence(
  projectId: string | undefined,
  userId: string | undefined,
  userName: string,
  userInitials: string,
  currentPage: string,
) {
  const setOnlineUsers = usePresenceStore(s => s.setOnlineUsers)

  const handlePresenceChange = useCallback((users: PresenceUser[]) => {
    setOnlineUsers(users)
  }, [setOnlineUsers])

  // Subscribe to presence
  useEffect(() => {
    if (!projectId || !userId) return
    const unsubscribe = subscribeToPresence(projectId, userId, userName, userInitials, currentPage, handlePresenceChange)
    return () => unsubscribe()
  }, [projectId, userId, userName, userInitials]) // Don't include currentPage to avoid reconnect

  // Update presence page without reconnecting
  useEffect(() => {
    updatePresencePage(currentPage)
  }, [currentPage])
}
