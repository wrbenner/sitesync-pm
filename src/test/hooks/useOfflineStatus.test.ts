import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useOfflineStatus, useIsOnline } from '../../hooks/useOfflineStatus'

describe('useOfflineStatus', () => {
  it('should report online status', () => {
    const { result } = renderHook(() => useOfflineStatus())
    expect(typeof result.current.isOnline).toBe('boolean')
  })

  it('should report pending changes count', () => {
    const { result } = renderHook(() => useOfflineStatus())
    expect(typeof result.current.pendingChanges).toBe('number')
  })

  it('should expose sync function', () => {
    const { result } = renderHook(() => useOfflineStatus())
    expect(typeof result.current.sync).toBe('function')
  })

  it('should expose cacheProject function', () => {
    const { result } = renderHook(() => useOfflineStatus())
    expect(typeof result.current.cacheProject).toBe('function')
  })

  it('should report conflict count', () => {
    const { result } = renderHook(() => useOfflineStatus())
    expect(typeof result.current.conflictCount).toBe('number')
    expect(result.current.conflictCount).toBe(0)
  })

  it('should report sync state', () => {
    const { result } = renderHook(() => useOfflineStatus())
    expect(['idle', 'syncing', 'caching', 'error']).toContain(result.current.syncState)
  })
})

describe('useIsOnline', () => {
  it('returns a boolean', () => {
    const { result } = renderHook(() => useIsOnline())
    expect(typeof result.current).toBe('boolean')
  })
})
