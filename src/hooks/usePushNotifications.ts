// Push notification registration, handling, and deep linking
// Uses Capacitor PushNotifications when native, falls back to web Push API

import { useEffect, useCallback, useRef } from 'react'
import { fromTable } from '../lib/supabase'
import { useAuth } from './useAuth'
import { toast } from 'sonner'

// ── Notification Types ───────────────────────────────────


export type NotificationType = 'assigned' | 'overdue' | 'mentioned' | 'approval_needed' | 'status_changed' | 'comment'

interface PushData {
  type: NotificationType
  title: string
  body: string
  link?: string // e.g. "/rfis?id=abc123"
  entityType?: string
  entityId?: string
  projectId?: string
}

// ── Deep Link Routes ─────────────────────────────────────

const ENTITY_ROUTES: Record<string, string> = {
  rfi: '/rfis',
  submittal: '/submittals',
  task: '/tasks',
  punch_item: '/punch-list',
  daily_log: '/daily-log',
  change_order: '/change-orders',
  drawing: '/drawings',
  meeting: '/meetings',
}

function buildDeepLink(data: PushData): string {
  if (data.link) return data.link
  if (data.entityType) {
    const route = ENTITY_ROUTES[data.entityType]
    if (route) return `${route}?id=${data.entityId || ''}`
  }
  return '/activity'
}

// ── Hook ─────────────────────────────────────────────────

export function usePushNotifications() {
  const { user } = useAuth()
  const registeredRef = useRef(false)

  // Register for push notifications
  const register = useCallback(async () => {
    if (registeredRef.current) return
    registeredRef.current = true

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')

      // Request permission
      const permission = await PushNotifications.requestPermissions()
      if (permission.receive !== 'granted') {
        registeredRef.current = false
        return
      }

      // Register with APNS/FCM
      await PushNotifications.register()

      // Store device token on profiles so it persists across projects
      PushNotifications.addListener('registration', async (token) => {
        if (user?.id && token.value) {
          await fromTable('profiles').update({
            push_token: token.value,
            push_platform: getPlatform(),
            push_updated_at: new Date().toISOString(),
          } as never).eq('id', user.id)
        }
      })

      PushNotifications.addListener('registrationError', () => {
        registeredRef.current = false
      })

      // Handle notification received while app is foreground
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        const data = notification.data as PushData
        // Show in-app toast instead of system notification
        toast(notification.title || data.title, {
          description: notification.body || data.body,
          action: data.link ? {
            label: 'View',
            onClick: () => navigateToDeepLink(data),
          } : undefined,
          duration: 5000,
        })

        // Haptic feedback
        triggerHaptic()
      })

      // Handle notification tapped (app was in background/killed)
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action.notification.data as PushData
        navigateToDeepLink(data)
      })

    } catch {
      registeredRef.current = false
      // Not running as native app, try web Push API
      registerWebPush()
    }
  }, [user?.id])

  // Update badge count
  const setBadgeCount = useCallback(async (count: number) => {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      // Badge count is set by the server via APNS/FCM payload
      // But we can clear it when user opens the app
      if (count === 0) {
        await PushNotifications.removeAllDeliveredNotifications()
      }
    } catch {
      // Not native
    }
  }, [])

  // Clear badge on app focus
  useEffect(() => {
    const handleFocus = () => setBadgeCount(0)
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [setBadgeCount])

  // Auto-register on mount when user is authenticated
  useEffect(() => {
    if (user?.id) {
      register()
    }
  }, [user?.id, register])

  return { register, setBadgeCount }
}

// ── Web Push Fallback ────────────────────────────────────

function registerWebPush() {
  if (!('Notification' in window)) return
  if (Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

// ── Deep Link Navigation ─────────────────────────────────

function navigateToDeepLink(data: PushData) {
  const link = buildDeepLink(data)
  // Use HashRouter navigation
  window.location.hash = `#${link}`
}

// ── Helpers ──────────────────────────────────────────────

function getPlatform(): string {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'web'
}

async function triggerHaptic() {
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics')
    await Haptics.notification({ type: NotificationType.Success })
  } catch {
    // No haptics
  }
}
