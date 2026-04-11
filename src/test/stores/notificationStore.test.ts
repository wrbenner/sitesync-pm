import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock supabase before importing the store
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
}
vi.mock('../../lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
  },
}))
vi.mock('../../lib/queryClient', () => ({
  queryClient: { invalidateQueries: vi.fn() },
}))

import { useNotificationStore } from '../../stores/notificationStore'
import type { Notification } from '../../stores/notificationStore'

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 'n-1',
    type: 'warning',
    title: 'Steel Delivery Delay',
    message: 'Phoenix supplier delayed 2 weeks.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    read: false,
    actionRoute: 'tasks',
  },
  {
    id: 'n-2',
    type: 'info',
    title: 'RFI-004 Response Received',
    message: 'Structural engineer responded.',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    read: false,
    actionRoute: 'rfis',
  },
  {
    id: 'n-3',
    type: 'success',
    title: 'SUB-001 Approved',
    message: 'Shop Drawings approved.',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
    read: true,
    actionRoute: 'submittals',
  },
]

function resetStore() {
  useNotificationStore.setState({
    notifications: [...INITIAL_NOTIFICATIONS],
    unreadCount: 2,
    _realtimeChannel: null,
  })
}

describe('notificationStore', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have 3 seeded notifications', () => {
      expect(useNotificationStore.getState().notifications).toHaveLength(3)
    })

    it('should have unreadCount of 2', () => {
      expect(useNotificationStore.getState().unreadCount).toBe(2)
    })
  })

  describe('addNotification', () => {
    it('should add notification to the front of the list', () => {
      useNotificationStore.getState().addNotification({
        type: 'error',
        title: 'Safety incident reported',
      })
      const notifications = useNotificationStore.getState().notifications
      expect(notifications[0].title).toBe('Safety incident reported')
    })

    it('should generate id for new notification', () => {
      useNotificationStore.getState().addNotification({ type: 'info', title: 'New item' })
      const first = useNotificationStore.getState().notifications[0]
      expect(first.id).toMatch(/^n-/)
    })

    it('should mark new notification as unread', () => {
      useNotificationStore.getState().addNotification({ type: 'info', title: 'New item' })
      expect(useNotificationStore.getState().notifications[0].read).toBe(false)
    })

    it('should increment unreadCount', () => {
      useNotificationStore.getState().addNotification({ type: 'info', title: 'Alert' })
      expect(useNotificationStore.getState().unreadCount).toBe(3)
    })

    it('should set timestamp to now', () => {
      const before = Date.now()
      useNotificationStore.getState().addNotification({ type: 'success', title: 'Done' })
      const after = Date.now()
      const ts = useNotificationStore.getState().notifications[0].timestamp.getTime()
      expect(ts).toBeGreaterThanOrEqual(before)
      expect(ts).toBeLessThanOrEqual(after)
    })

    it('should total 4 notifications after adding one', () => {
      useNotificationStore.getState().addNotification({ type: 'warning', title: 'Budget alert' })
      expect(useNotificationStore.getState().notifications).toHaveLength(4)
    })
  })

  describe('markRead', () => {
    it('should mark a specific notification as read', () => {
      useNotificationStore.getState().markRead('n-1')
      const n = useNotificationStore.getState().notifications.find(n => n.id === 'n-1')
      expect(n?.read).toBe(true)
    })

    it('should decrease unreadCount when marking unread as read', () => {
      useNotificationStore.getState().markRead('n-1')
      expect(useNotificationStore.getState().unreadCount).toBe(1)
    })

    it('should not change unreadCount when marking already-read notification', () => {
      useNotificationStore.getState().markRead('n-3') // already read
      expect(useNotificationStore.getState().unreadCount).toBe(2)
    })

    it('should not affect other notifications', () => {
      useNotificationStore.getState().markRead('n-1')
      const n2 = useNotificationStore.getState().notifications.find(n => n.id === 'n-2')
      expect(n2?.read).toBe(false)
    })

    it('should handle unknown id gracefully', () => {
      useNotificationStore.getState().markRead('nonexistent-id')
      expect(useNotificationStore.getState().unreadCount).toBe(2)
    })
  })

  describe('markAllRead', () => {
    it('should mark all notifications as read', () => {
      useNotificationStore.getState().markAllRead()
      const allRead = useNotificationStore.getState().notifications.every(n => n.read)
      expect(allRead).toBe(true)
    })

    it('should set unreadCount to 0', () => {
      useNotificationStore.getState().markAllRead()
      expect(useNotificationStore.getState().unreadCount).toBe(0)
    })

    it('should preserve notification count', () => {
      useNotificationStore.getState().markAllRead()
      expect(useNotificationStore.getState().notifications).toHaveLength(3)
    })
  })

  describe('dismiss', () => {
    it('should remove notification by id', () => {
      useNotificationStore.getState().dismiss('n-2')
      expect(useNotificationStore.getState().notifications.find(n => n.id === 'n-2')).toBeUndefined()
    })

    it('should decrease total count', () => {
      useNotificationStore.getState().dismiss('n-1')
      expect(useNotificationStore.getState().notifications).toHaveLength(2)
    })

    it('should update unreadCount when dismissing unread', () => {
      useNotificationStore.getState().dismiss('n-1') // unread
      expect(useNotificationStore.getState().unreadCount).toBe(1)
    })

    it('should not change unreadCount when dismissing read notification', () => {
      useNotificationStore.getState().dismiss('n-3') // read
      expect(useNotificationStore.getState().unreadCount).toBe(2)
    })

    it('should handle unknown id gracefully', () => {
      useNotificationStore.getState().dismiss('does-not-exist')
      expect(useNotificationStore.getState().notifications).toHaveLength(3)
    })

    it('should dismiss all notifications one by one', () => {
      useNotificationStore.getState().dismiss('n-1')
      useNotificationStore.getState().dismiss('n-2')
      useNotificationStore.getState().dismiss('n-3')
      expect(useNotificationStore.getState().notifications).toHaveLength(0)
      expect(useNotificationStore.getState().unreadCount).toBe(0)
    })
  })

  describe('unreadCount accuracy', () => {
    it('should reflect correct count after mixed operations', () => {
      useNotificationStore.getState().addNotification({ type: 'info', title: 'New A' })
      useNotificationStore.getState().addNotification({ type: 'info', title: 'New B' })
      useNotificationStore.getState().markRead('n-1')
      // Was 2 unread + 2 new = 4, then -1 for markRead = 3
      expect(useNotificationStore.getState().unreadCount).toBe(3)
    })
  })
})
