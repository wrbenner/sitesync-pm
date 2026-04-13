import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMediaQuery } from '../../hooks/useMediaQuery'

// We need to track active listeners to fire change events in tests.
type MQLListener = (e: MediaQueryListEvent) => void

function makeMockMql(matches: boolean) {
  const listeners: MQLListener[] = []
  const mql = {
    matches,
    media: '',
    onchange: null,
    addListener: (fn: MQLListener) => listeners.push(fn),
    removeListener: (fn: MQLListener) => {
      const i = listeners.indexOf(fn)
      if (i >= 0) listeners.splice(i, 1)
    },
    addEventListener: (_: string, fn: MQLListener) => listeners.push(fn),
    removeEventListener: (_: string, fn: MQLListener) => {
      const i = listeners.indexOf(fn)
      if (i >= 0) listeners.splice(i, 1)
    },
    dispatchEvent: () => false,
    _fire: (newMatches: boolean) => {
      mql.matches = newMatches
      listeners.forEach((fn) => fn({ matches: newMatches } as MediaQueryListEvent))
    },
  }
  return mql
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => makeMockMql(query.includes('max-width: 600px') ? false : true)),
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useMediaQuery', () => {
  it('returns a boolean', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 600px)'))
    expect(typeof result.current).toBe('boolean')
  })

  it('returns initial match value from matchMedia', () => {
    const mql = makeMockMql(true)
    vi.mocked(window.matchMedia).mockReturnValue(mql as unknown as MediaQueryList)

    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'))
    expect(result.current).toBe(true)
  })

  it('returns false when query does not match initially', () => {
    const mql = makeMockMql(false)
    vi.mocked(window.matchMedia).mockReturnValue(mql as unknown as MediaQueryList)

    const { result } = renderHook(() => useMediaQuery('(max-width: 320px)'))
    expect(result.current).toBe(false)
  })

  it('updates when media query changes', () => {
    const mql = makeMockMql(false)
    vi.mocked(window.matchMedia).mockReturnValue(mql as unknown as MediaQueryList)

    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'))
    expect(result.current).toBe(false)

    act(() => {
      mql._fire(true)
    })

    expect(result.current).toBe(true)
  })

  it('removes listener on unmount', () => {
    const mql = makeMockMql(false)
    vi.mocked(window.matchMedia).mockReturnValue(mql as unknown as MediaQueryList)
    const removeEventListenerSpy = vi.spyOn(mql, 'removeEventListener')

    const { unmount } = renderHook(() => useMediaQuery('(min-width: 1024px)'))
    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
