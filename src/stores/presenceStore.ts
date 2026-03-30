import { create } from 'zustand'
import type { PresenceUser } from '../lib/realtime'

interface PresenceState {
  onlineUsers: PresenceUser[]
  setOnlineUsers: (users: PresenceUser[]) => void
  getUsersOnPage: (page: string) => PresenceUser[]
  getUsersViewingEntity: (entityId: string) => PresenceUser[]
  getPageUserCounts: () => Map<string, number>
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUsers: [],

  setOnlineUsers: (users) => set({ onlineUsers: users }),

  getUsersOnPage: (page) => {
    return get().onlineUsers.filter(u => u.page === page)
  },

  getUsersViewingEntity: (entityId) => {
    return get().onlineUsers.filter(u => u.entityId === entityId)
  },

  getPageUserCounts: () => {
    const counts = new Map<string, number>()
    for (const user of get().onlineUsers) {
      counts.set(user.page, (counts.get(user.page) || 0) + 1)
    }
    return counts
  },
}))
