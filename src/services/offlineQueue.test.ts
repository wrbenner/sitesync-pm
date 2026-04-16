import { describe, it, expect, vi, beforeEach } from 'vitest'

type AnyCallback = (s: Record<string, unknown>) => void

const { mockSubscribe, mockSync, syncState } = vi.hoisted(() => {
  const syncState: { callback: AnyCallback | null } = { callback: null }
  const mockSync = vi.fn().mockResolvedValue({ synced: 0, failed: 0, conflicts: 0 })
  const mockSubscribe = vi.fn((cb: AnyCallback) => {
    syncState.callback = cb
    return () => {}
  })
  return { mockSubscribe, mockSync, syncState }
})

vi.mock('../lib/syncManager', () => ({
  syncManager: {
    subscribe: mockSubscribe,
    sync: mockSync,
  },
}))

import { useOfflineStore } from './offlineQueue'

function getState() {
  return useOfflineStore.getState()
}

function resetStore() {
  getState().clearQueue()
  getState().setStatus('online')
}

describe('useOfflineStore — initial state', () => {
  it('starts with online status and empty queue', () => {
    const state = getState()
    expect(state.status).toBe('online')
    expect(state.queue).toEqual([])
    expect(state.pendingCount).toBe(0)
    expect(state.conflictCount).toBe(0)
  })

  it('subscribes to syncManager on initialization', () => {
    expect(mockSubscribe).toHaveBeenCalled()
  })
})

describe('useOfflineStore.addToQueue', () => {
  beforeEach(resetStore)

  it('adds a mutation with generated id, timestamp, and retryCount of 0', () => {
    getState().addToQueue({ type: 'create', entityType: 'punch_item', data: { title: 'Crack' } })

    const { queue } = getState()
    expect(queue).toHaveLength(1)
    expect(queue[0].id).toMatch(/^q-/)
    expect(queue[0].retryCount).toBe(0)
    expect(queue[0].timestamp).toBeInstanceOf(Date)
    expect(queue[0].type).toBe('create')
    expect(queue[0].entityType).toBe('punch_item')
  })

  it('adds multiple mutations preserving order', () => {
    getState().addToQueue({ type: 'create', entityType: 'daily_log', data: {} })
    getState().addToQueue({ type: 'update', entityType: 'punch_item', entityId: 'pi-1', data: { status: 'resolved' } })

    expect(getState().queue).toHaveLength(2)
    expect(getState().queue[0].type).toBe('create')
    expect(getState().queue[1].type).toBe('update')
  })
})

describe('useOfflineStore.removeFromQueue', () => {
  beforeEach(resetStore)

  it('removes the mutation with the given id', () => {
    getState().addToQueue({ type: 'create', entityType: 'field_capture', data: {} })
    const id = getState().queue[0].id

    getState().removeFromQueue(id)

    expect(getState().queue).toHaveLength(0)
  })

  it('leaves other mutations intact', () => {
    getState().addToQueue({ type: 'create', entityType: 'daily_log', data: {} })
    getState().addToQueue({ type: 'update', entityType: 'punch_item', data: {} })
    const firstId = getState().queue[0].id

    getState().removeFromQueue(firstId)

    expect(getState().queue).toHaveLength(1)
    expect(getState().queue[0].type).toBe('update')
  })

  it('is a no-op when id does not exist', () => {
    getState().addToQueue({ type: 'create', entityType: 'daily_log', data: {} })
    getState().removeFromQueue('q-nonexistent')

    expect(getState().queue).toHaveLength(1)
  })
})

describe('useOfflineStore.clearQueue', () => {
  beforeEach(resetStore)

  it('empties the queue', () => {
    getState().addToQueue({ type: 'create', entityType: 'punch_item', data: {} })
    getState().addToQueue({ type: 'create', entityType: 'daily_log', data: {} })

    getState().clearQueue()

    expect(getState().queue).toEqual([])
  })
})

describe('useOfflineStore.setStatus', () => {
  beforeEach(resetStore)

  it('updates status to offline', () => {
    getState().setStatus('offline')
    expect(getState().status).toBe('offline')
  })

  it('updates status to syncing', () => {
    getState().setStatus('syncing')
    expect(getState().status).toBe('syncing')
  })

  it('updates status back to online', () => {
    getState().setStatus('offline')
    getState().setStatus('online')
    expect(getState().status).toBe('online')
  })
})

describe('useOfflineStore.simulateOffline', () => {
  beforeEach(resetStore)

  it('sets status to offline and enqueues sample mutations', () => {
    getState().simulateOffline()

    expect(getState().status).toBe('offline')
    expect(getState().queue.length).toBeGreaterThanOrEqual(3)
  })

  it('enqueues mutations of expected types', () => {
    getState().simulateOffline()

    const types = getState().queue.map((m) => m.entityType)
    expect(types).toContain('field_capture')
    expect(types).toContain('punch_item')
    expect(types).toContain('daily_log_note')
  })
})

describe('useOfflineStore.simulateSync', () => {
  beforeEach(resetStore)

  it('calls syncManager.sync', async () => {
    await getState().simulateSync()
    expect(mockSync).toHaveBeenCalled()
  })
})

describe('syncManager subscription — mapStatus', () => {
  beforeEach(resetStore)

  it('maps offline connection to offline status', () => {
    syncState.callback?.({
      connection: 'offline',
      syncState: 'idle',
      pendingCount: 0,
      conflictCount: 0,
      lastSynced: null,
      syncProgress: null,
      cacheProgress: null,
    })

    expect(getState().status).toBe('offline')
  })

  it('maps online+syncing to syncing status', () => {
    syncState.callback?.({
      connection: 'online',
      syncState: 'syncing',
      pendingCount: 2,
      conflictCount: 0,
      lastSynced: null,
      syncProgress: null,
      cacheProgress: null,
    })

    expect(getState().status).toBe('syncing')
  })

  it('maps online+caching to syncing status', () => {
    syncState.callback?.({
      connection: 'online',
      syncState: 'caching',
      pendingCount: 0,
      conflictCount: 0,
      lastSynced: null,
      syncProgress: null,
      cacheProgress: null,
    })

    expect(getState().status).toBe('syncing')
  })

  it('maps online+idle to online status', () => {
    getState().setStatus('syncing')
    syncState.callback?.({
      connection: 'online',
      syncState: 'idle',
      pendingCount: 0,
      conflictCount: 0,
      lastSynced: new Date(),
      syncProgress: null,
      cacheProgress: null,
    })

    expect(getState().status).toBe('online')
  })

  it('updates pendingCount and conflictCount from subscription', () => {
    syncState.callback?.({
      connection: 'online',
      syncState: 'idle',
      pendingCount: 5,
      conflictCount: 2,
      lastSynced: null,
      syncProgress: null,
      cacheProgress: null,
    })

    expect(getState().pendingCount).toBe(5)
    expect(getState().conflictCount).toBe(2)
  })
})
