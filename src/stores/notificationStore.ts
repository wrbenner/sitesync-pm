import { create } from 'zustand';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  timestamp: Date;
  read: boolean;
  actionRoute?: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;

  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [
    {
      id: 'n-1',
      type: 'warning',
      title: 'Steel Delivery Delay',
      message: 'Phoenix supplier delayed 2 weeks. Review recovery options.',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      read: false,
      actionRoute: 'tasks',
    },
    {
      id: 'n-2',
      type: 'info',
      title: 'RFI-004 Response Received',
      message: 'Structural engineer responded to curtain wall interface detail.',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      read: false,
      actionRoute: 'rfis',
    },
    {
      id: 'n-3',
      type: 'success',
      title: 'SUB-001 Approved',
      message: 'Structural Steel Shop Drawings approved by architect.',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
      read: true,
      actionRoute: 'submittals',
    },
  ],
  unreadCount: 2,

  addNotification: (n) =>
    set((s) => {
      const notification: Notification = {
        ...n,
        id: `n-${Date.now()}`,
        timestamp: new Date(),
        read: false,
      };
      return {
        notifications: [notification, ...s.notifications],
        unreadCount: s.unreadCount + 1,
      };
    }),

  markRead: (id) =>
    set((s) => {
      const updated = s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      };
    }),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  dismiss: (id) =>
    set((s) => {
      const filtered = s.notifications.filter((n) => n.id !== id);
      return {
        notifications: filtered,
        unreadCount: filtered.filter((n) => !n.read).length,
      };
    }),
}));
