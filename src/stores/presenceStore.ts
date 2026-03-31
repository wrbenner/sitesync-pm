import { create } from 'zustand'
import type { PresenceUser } from '../lib/realtime'

// Extended presence user with editing state
export interface PresenceUserWithAction extends PresenceUser {
  action?: 'viewing' | 'editing'
  editingEntityType?: string
  editingEntityId?: string
  editingSince?: number
}

interface PresenceState {
  onlineUsers: PresenceUserWithAction[]
  setOnlineUsers: (users: PresenceUserWithAction[]) => void
  getUsersOnPage: (page: string) => PresenceUserWithAction[]
  getUsersViewingEntity: (entityId: string) => PresenceUserWithAction[]
  getUsersEditingEntity: (entityId: string) => PresenceUserWithAction[]
  getPageUserCounts: () => Map<string, number>
  isEntityBeingEdited: (entityId: string) => boolean
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

  getUsersEditingEntity: (entityId) => {
    return get().onlineUsers.filter(u =>
      u.editingEntityId === entityId && u.action === 'editing'
    )
  },

  getPageUserCounts: () => {
    const counts = new Map<string, number>()
    for (const user of get().onlineUsers) {
      counts.set(user.page, (counts.get(user.page) || 0) + 1)
    }
    return counts
  },

  isEntityBeingEdited: (entityId) => {
    return get().onlineUsers.some(u =>
      u.editingEntityId === entityId && u.action === 'editing'
    )
  },
}))
