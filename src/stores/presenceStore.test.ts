import { describe, it, expect, beforeEach } from 'vitest'
import { usePresenceStore, type PresenceUserWithAction } from './presenceStore'

function user(overrides: Partial<PresenceUserWithAction> = {}): PresenceUserWithAction {
  return {
    userId: 'u-' + Math.random().toString(36).slice(2, 7),
    name: 'Alice',
    displayName: 'Alice A',
    initials: 'AA',
    color: '#000',
    page: 'dashboard',
    lastSeen: Date.now(),
    ...overrides,
  }
}

beforeEach(() => {
  usePresenceStore.setState({ onlineUsers: [], isInitialized: false })
})

describe('presenceStore — basic state', () => {
  it('starts with no online users and not initialized', () => {
    const s = usePresenceStore.getState()
    expect(s.onlineUsers).toEqual([])
    expect(s.isInitialized).toBe(false)
  })

  it('setOnlineUsers replaces the list and marks initialized', () => {
    usePresenceStore.getState().setOnlineUsers([user(), user()])
    const s = usePresenceStore.getState()
    expect(s.onlineUsers).toHaveLength(2)
    expect(s.isInitialized).toBe(true)
  })

  it('setInitialized toggles the flag without touching users', () => {
    usePresenceStore.getState().setOnlineUsers([user()])
    usePresenceStore.getState().setInitialized(false)
    expect(usePresenceStore.getState().isInitialized).toBe(false)
    expect(usePresenceStore.getState().onlineUsers).toHaveLength(1)
  })
})

describe('presenceStore — getUsersOnPage', () => {
  it('returns only users on the given page', () => {
    usePresenceStore.getState().setOnlineUsers([
      user({ userId: 'a', page: 'dashboard' }),
      user({ userId: 'b', page: 'rfis' }),
      user({ userId: 'c', page: 'dashboard' }),
    ])
    const r = usePresenceStore.getState().getUsersOnPage('dashboard')
    expect(r.map((u) => u.userId).sort()).toEqual(['a', 'c'])
  })

  it('returns empty array for an unvisited page', () => {
    usePresenceStore.getState().setOnlineUsers([user({ page: 'dashboard' })])
    expect(usePresenceStore.getState().getUsersOnPage('unknown')).toEqual([])
  })
})

describe('presenceStore — getUsersViewingEntity', () => {
  it('matches by entityId', () => {
    usePresenceStore.getState().setOnlineUsers([
      user({ userId: 'a', entityId: 'rfi-1' }),
      user({ userId: 'b', entityId: 'rfi-2' }),
      user({ userId: 'c', entityId: 'rfi-1' }),
    ])
    const r = usePresenceStore.getState().getUsersViewingEntity('rfi-1')
    expect(r.map((u) => u.userId).sort()).toEqual(['a', 'c'])
  })

  it('returns empty array when no one views that entity', () => {
    usePresenceStore.getState().setOnlineUsers([user({ entityId: 'rfi-1' })])
    expect(usePresenceStore.getState().getUsersViewingEntity('rfi-99')).toEqual([])
  })
})

describe('presenceStore — getUsersEditingEntity', () => {
  it('matches users whose action=editing AND editingEntityId equals the id', () => {
    usePresenceStore.getState().setOnlineUsers([
      user({ userId: 'a', action: 'editing', editingEntityId: 'rfi-1' }),
      user({ userId: 'b', action: 'viewing', editingEntityId: 'rfi-1' }),  // viewing only
      user({ userId: 'c', action: 'editing', editingEntityId: 'rfi-2' }),  // different entity
      user({ userId: 'd', action: 'editing', editingEntityId: 'rfi-1' }),
    ])
    const r = usePresenceStore.getState().getUsersEditingEntity('rfi-1')
    expect(r.map((u) => u.userId).sort()).toEqual(['a', 'd'])
  })
})

describe('presenceStore — getPageUserCounts', () => {
  it('counts users per page in a Map', () => {
    usePresenceStore.getState().setOnlineUsers([
      user({ page: 'dashboard' }),
      user({ page: 'dashboard' }),
      user({ page: 'rfis' }),
      user({ page: 'submittals' }),
    ])
    const counts = usePresenceStore.getState().getPageUserCounts()
    expect(counts.get('dashboard')).toBe(2)
    expect(counts.get('rfis')).toBe(1)
    expect(counts.get('submittals')).toBe(1)
  })

  it('returns an empty Map when no users', () => {
    const r = usePresenceStore.getState().getPageUserCounts()
    expect(r.size).toBe(0)
  })
})

describe('presenceStore — isEntityBeingEdited', () => {
  it('true when at least one user is editing the entity', () => {
    usePresenceStore.getState().setOnlineUsers([
      user({ action: 'editing', editingEntityId: 'rfi-1' }),
    ])
    expect(usePresenceStore.getState().isEntityBeingEdited('rfi-1')).toBe(true)
  })

  it('false when only viewers are present', () => {
    usePresenceStore.getState().setOnlineUsers([
      user({ action: 'viewing', editingEntityId: 'rfi-1' }),
    ])
    expect(usePresenceStore.getState().isEntityBeingEdited('rfi-1')).toBe(false)
  })

  it('false when nobody is on the entity', () => {
    expect(usePresenceStore.getState().isEntityBeingEdited('rfi-1')).toBe(false)
  })
})
