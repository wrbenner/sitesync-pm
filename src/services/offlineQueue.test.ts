import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the syncManager before importing the store
vi.mock('../lib/syncManager', () => {
  const listeners = new Set<(state: unknown) => void>()
  return {
    syncManager: {
      subscribe: vi.fn((cb: (state: unknown) => void) => {
        listeners.add(cb)
        return () => listeners.delete(cb)
      }),
      sync: vi.fn().mockResolvedValue(undefined),
      getState: vi.fn().mockReturnValue({
        connection: 'online',
        syncState: 'idle',
        pendingCount: 0,
        conflictCount: 0,
        lastSynced: null,
      }),
      _listeners: listeners,
    },
  }
})

describe('useOfflineStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with online status and empty queue', async () => {
    const { useOfflineStore } = await import('./offlineQueue')
    const state = useOfflineStore.getState()

    expect(state.status).toBe('online')
    expect(state.queue).toEqual([])
    expect(state.pendingCount).toBe(0)
    expect(state.conflictCount).toBe(0)
  })

  it('addToQueue appends a mutation with id, timestamp, and retryCount 0', async () => {
    const { useOfflineStore } = await import('./offlineQueue')
    useOfflineStore.getState().clearQueue()

    useOfflineStore.getState().addToQueue({
      type: 'create',
      entityType: 'punch_item',
      data: { title: 'Cracked tile' },
    })

    const { queue } = useOfflineStore.getState()
    expect(queue).toHaveLength(1)
    expect(queue[0].type).toBe('create')
    expect(queue[0].entityType).toBe('punch_item')
    expect(queue[0].retryCount).toBe(0)
    expect(queue[0].id).toMatch(/^q-/)
    expect(queue[0].timestamp).toBeInstanceOf(Date)
  })

  it('addToQueue accumulates multiple mutations', async () => {
    const { useOfflineStore } = await import('./offlineQueue')
    useOfflineStore.getState().clearQueue()

    useOfflineStore.getState().addToQueue({ type: 'create', entityType: 'daily_log', data: {} })
    useOfflineStore.getState().addToQueue({ type: 'update', entityType: 'punch_item', entityId: 'pi-1', data: { status: 'resolved' } })

    expect(useOfflineStore.getState().queue).toHaveLength(2)
  })

  it('removeFromQueue removes only the targeted mutation', async () => {
    const { useOfflineStore } = await import('./offlineQueue')
    useOfflineStore.getState().clearQueue()

    useOfflineStore.getState().addToQueue({ type: 'create', entityType: 'note', data: {} })
    useOfflineStore.getState().addToQueue({ type: 'update', entityType: 'photo', data: {} })

    const { queue } = useOfflineStore.getState()
    const idToRemove = queue[0].id

    useOfflineStore.getState().removeFromQueue(idToRemove)

    const after = useOfflineStore.getState().queue
    expect(after).toHaveLength(1)
    expect(after[0].id).not.toBe(idToRemove)
  })

  it('removeFromQueue is a no-op for unknown id', async () => {
    const { useOfflineStore } = await import('./offlineQueue')
    useOfflineStore.getState().clearQueue()
    useOfflineStore.getState().addToQueue({ type: 'create', entityType: 'note', data: {} })

    useOfflineStore.getState().removeFromQueue('q-does-not-exist')

    expect(useOfflineStore.getState().queue).toHaveLength(1)
  })

  it('clearQueue empties all mutations', async () => {
    const { useOfflineStore } = await import('./offlineQueue')
    useOfflineStore.getState().addToQueue({ type: 'create', entityType: 'rfi', data: {} })
    useOfflineStore.getState().addToQueue({ type: 'delete', entityType: 'submittal', data: {} })

    useOfflineStore.getState().clearQueue()

    expect(useOfflineStore.getState().queue).toHaveLength(0)
  })

  it('setStatus updates status field', async () => {
    const { useOfflineStore } = await import('./offlineQueue')

    useOfflineStore.getState().setStatus('offline')
    expect(useOfflineStore.getState().status).toBe('offline')

    useOfflineStore.getState().setStatus('syncing')
    expect(useOfflineStore.getState().status).toBe('syncing')

    useOfflineStore.getState().setStatus('online')
    expect(useOfflineStore.getState().status).toBe('online')
  })

  it('simulateSync calls syncManager.sync', async () => {
    const { useOfflineStore } = await import('./offlineQueue')
    const { syncManager } = await import('../lib/syncManager')

    await useOfflineStore.getState().simulateSync()

    expect(syncManager.sync).toHaveBeenCalled()
  })

  it('simulateOffline sets status to offline and queues sample mutations', async () => {
    const { useOfflineStore } = await import('./offlineQueue')
    useOfflineStore.getState().clearQueue()

    useOfflineStore.getState().simulateOffline()

    expect(useOfflineStore.getState().status).toBe('offline')
    expect(useOfflineStore.getState().queue.length).toBeGreaterThan(0)
  })

  it('generated mutation ids are unique', async () => {
    const { useOfflineStore } = await import('./offlineQueue')
    useOfflineStore.getState().clearQueue()

    for (let i = 0; i < 5; i++) {
      useOfflineStore.getState().addToQueue({ type: 'create', entityType: 'item', data: { i } })
    }

    const ids = useOfflineStore.getState().queue.map((q) => q.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(5)
  })
})

describe('mapStatus', () => {
  it('maps offline connection to offline regardless of syncState', async () => {
    const { useOfflineStore } = await import('./offlineQueue')
    const { syncManager } = await import('../lib/syncManager') as { syncManager: { _listeners: Set<(s: unknown) => void>; subscribe: ReturnType<typeof vi.fn>; sync: ReturnType<typeof vi.fn> } }

    // Trigger the subscriber with offline state
    for (const cb of (syncManager as unknown as { _listeners: Set<(s: unknown) => void> })._listeners) {
      cb({ connection: 'offline', syncState: 'idle', pendingCount: 0, conflictCount: 0, lastSynced: null })
    }

    expect(useOfflineStore.getState().status).toBe('offline')
  })

  it('maps online + syncing syncState to syncing', async () => {
    const { useOfflineStore } = await import('./offlineQueue')
    const { syncManager } = await import('../lib/syncManager') as { syncManager: { _listeners: Set<(s: unknown) => void>; subscribe: ReturnType<typeof vi.fn>; sync: ReturnType<typeof vi.fn> } }

    for (const cb of (syncManager as unknown as { _listeners: Set<(s: unknown) => void> })._listeners) {
      cb({ connection: 'online', syncState: 'syncing', pendingCount: 2, conflictCount: 0, lastSynced: null })
    }

    expect(useOfflineStore.getState().status).toBe('syncing')
  })
})
