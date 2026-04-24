// Offline field-capture flow integration.
//
// Walks the end-to-end path that field staff actually use:
//   1. Device goes offline mid-walk.
//   2. User snaps a daily-log photo + a punch-item update.
//   3. Both mutations land on the offline queue.
//   4. Device reconnects → SyncManager drains the queue → store reflects sync.

import { describe, it, expect, vi, beforeEach } from 'vitest'

type AnyCallback = (s: Record<string, unknown>) => void

const { mockSubscribe, mockSync, setManagerState } = vi.hoisted(() => {
  const state: { cb: AnyCallback | null } = { cb: null }
  const mockSync = vi.fn().mockImplementation(async () => {
    // Emulate the manager entering "syncing" then settling to "idle" with
    // pendingCount=0 once the queue drains.
    state.cb?.({
      connection: 'online',
      syncState: 'syncing',
      lastSynced: null,
      pendingCount: 0,
      conflictCount: 0,
    })
    state.cb?.({
      connection: 'online',
      syncState: 'idle',
      lastSynced: new Date(),
      pendingCount: 0,
      conflictCount: 0,
    })
    return { synced: 2, failed: 0, conflicts: 0 }
  })
  const mockSubscribe = vi.fn((cb: AnyCallback) => {
    state.cb = cb
    return () => {}
  })
  return {
    mockSubscribe,
    mockSync,
    setManagerState: (s: Record<string, unknown>) => state.cb?.(s),
  }
})

vi.mock('../../lib/syncManager', () => ({
  syncManager: {
    subscribe: mockSubscribe,
    sync: mockSync,
  },
}))

import { useOfflineStore } from '../../services/offlineQueue'

function getState() {
  return useOfflineStore.getState()
}

describe('Field capture offline → reconnect → sync', () => {
  beforeEach(() => {
    getState().clearQueue()
    getState().setStatus('online')
    mockSync.mockClear()
  })

  it('queues a field-capture photo + punch update while offline, then syncs on reconnect', async () => {
    // 1. Go offline
    setManagerState({
      connection: 'offline',
      syncState: 'idle',
      lastSynced: null,
      pendingCount: 0,
      conflictCount: 0,
    })
    expect(getState().status).toBe('offline')

    // 2. Capture two mutations while offline
    getState().addToQueue({
      type: 'create',
      entityType: 'field_capture',
      data: { title: 'Level 9 slab pour — photo', photo_url: 'blob:local/abc' },
    })
    getState().addToQueue({
      type: 'update',
      entityType: 'punch_item',
      entityId: 'PL-019',
      data: { status: 'in_progress' },
    })

    expect(getState().queue).toHaveLength(2)
    expect(getState().queue[0].entityType).toBe('field_capture')
    expect(getState().queue[0].id).toMatch(/^q-/)
    expect(getState().queue[0].retryCount).toBe(0)
    expect(getState().queue[1].entityType).toBe('punch_item')
    expect(getState().queue[1].entityId).toBe('PL-019')

    // 3. Reconnect + manager pushes online state
    setManagerState({
      connection: 'online',
      syncState: 'idle',
      lastSynced: null,
      pendingCount: 2,
      conflictCount: 0,
    })
    expect(getState().status).toBe('online')
    expect(getState().pendingCount).toBe(2)

    // 4. Drain via simulateOnline → calls syncManager.sync()
    getState().simulateOnline()
    expect(mockSync).toHaveBeenCalledTimes(1)

    // Explicit await of the sync for deterministic state after drain
    await getState().simulateSync()
    expect(getState().status).toBe('online')
    expect(getState().pendingCount).toBe(0)
    expect(getState().lastSyncTime).toBeInstanceOf(Date)
  })

  it('preserves queue order for FIFO replay', () => {
    getState().addToQueue({ type: 'create', entityType: 'daily_log_note', data: { text: 'first' } })
    getState().addToQueue({ type: 'create', entityType: 'daily_log_note', data: { text: 'second' } })
    getState().addToQueue({ type: 'create', entityType: 'daily_log_note', data: { text: 'third' } })
    const { queue } = getState()
    expect(queue.map((q) => (q.data as { text: string }).text)).toEqual(['first', 'second', 'third'])
  })

  it('retry counter starts at 0 for new queue entries', () => {
    getState().addToQueue({ type: 'update', entityType: 'rfi', entityId: 'rfi-1', data: { status: 'open' } })
    expect(getState().queue[0].retryCount).toBe(0)
  })

  it('manager conflictCount flows into store', () => {
    setManagerState({
      connection: 'online',
      syncState: 'idle',
      lastSynced: new Date(),
      pendingCount: 0,
      conflictCount: 2,
    })
    expect(getState().conflictCount).toBe(2)
  })

  it('caching state maps to syncing status', () => {
    setManagerState({
      connection: 'online',
      syncState: 'caching',
      lastSynced: null,
      pendingCount: 3,
      conflictCount: 0,
    })
    expect(getState().status).toBe('syncing')
  })

  it('removeFromQueue drops a single entry', () => {
    getState().addToQueue({ type: 'create', entityType: 'field_capture', data: {} })
    getState().addToQueue({ type: 'create', entityType: 'field_capture', data: {} })
    const firstId = getState().queue[0].id
    getState().removeFromQueue(firstId)
    expect(getState().queue).toHaveLength(1)
    expect(getState().queue[0].id).not.toBe(firstId)
  })
})
