import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useUiStore } from './uiStore'

// Reset the zustand store between tests so state from one test doesn't
// leak into another. We also use fake timers for the auto-dismiss
// timeouts so tests don't block on real wall-clock waits.

beforeEach(() => {
  vi.useFakeTimers()
  // Snapshot initial defaults and restore them.
  useUiStore.setState({
    sidebarCollapsed: false,
    activeView: 'dashboard',
    commandPaletteOpen: false,
    searchQuery: '',
    themeMode: 'light',
    a11yStatusMessage: '',
    a11yAlertMessage: '',
    toasts: [],
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('uiStore — sidebar', () => {
  it('setSidebarCollapsed updates state', () => {
    useUiStore.getState().setSidebarCollapsed(true)
    expect(useUiStore.getState().sidebarCollapsed).toBe(true)
  })

  it('toggleSidebar flips boolean', () => {
    expect(useUiStore.getState().sidebarCollapsed).toBe(false)
    useUiStore.getState().toggleSidebar()
    expect(useUiStore.getState().sidebarCollapsed).toBe(true)
    useUiStore.getState().toggleSidebar()
    expect(useUiStore.getState().sidebarCollapsed).toBe(false)
  })
})

describe('uiStore — view + command palette + search', () => {
  it('setActiveView writes through', () => {
    useUiStore.getState().setActiveView('rfis')
    expect(useUiStore.getState().activeView).toBe('rfis')
  })

  it('setCommandPaletteOpen toggles open/closed', () => {
    useUiStore.getState().setCommandPaletteOpen(true)
    expect(useUiStore.getState().commandPaletteOpen).toBe(true)
    useUiStore.getState().setCommandPaletteOpen(false)
    expect(useUiStore.getState().commandPaletteOpen).toBe(false)
  })

  it('setSearchQuery writes through', () => {
    useUiStore.getState().setSearchQuery('concrete')
    expect(useUiStore.getState().searchQuery).toBe('concrete')
  })
})

describe('uiStore — theme', () => {
  it('setThemeMode persists to localStorage', () => {
    const setSpy = vi.spyOn(Storage.prototype, 'setItem')
    useUiStore.getState().setThemeMode('dark')
    expect(useUiStore.getState().themeMode).toBe('dark')
    expect(setSpy).toHaveBeenCalledWith('sitesync-theme-mode', 'dark')
    setSpy.mockRestore()
  })

  it('setThemeMode swallows localStorage errors', () => {
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => useUiStore.getState().setThemeMode('system')).not.toThrow()
    expect(useUiStore.getState().themeMode).toBe('system')
    setSpy.mockRestore()
  })
})

describe('uiStore — a11y announcements', () => {
  it('announceStatus sets the message + clears after 100ms', () => {
    useUiStore.getState().announceStatus('Loading RFIs')
    expect(useUiStore.getState().a11yStatusMessage).toBe('Loading RFIs')
    vi.advanceTimersByTime(100)
    expect(useUiStore.getState().a11yStatusMessage).toBe('')
  })

  it('announceAlert sets the message + clears after 100ms', () => {
    useUiStore.getState().announceAlert('Network error')
    expect(useUiStore.getState().a11yAlertMessage).toBe('Network error')
    vi.advanceTimersByTime(100)
    expect(useUiStore.getState().a11yAlertMessage).toBe('')
  })

  it('rapid successive announceStatus calls only leave one outstanding timer', () => {
    // The bug-M21 fix: each call should clear any previous status timer so the
    // last message wins and orphan timers don't fire on stale state.
    useUiStore.getState().announceStatus('First')
    useUiStore.getState().announceStatus('Second')
    expect(useUiStore.getState().a11yStatusMessage).toBe('Second')
    vi.advanceTimersByTime(100)
    expect(useUiStore.getState().a11yStatusMessage).toBe('')
  })
})

describe('uiStore — toasts', () => {
  it('addToast appends a toast with a unique id', () => {
    useUiStore.getState().addToast({ type: 'success', title: 'Saved' })
    const toasts = useUiStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].title).toBe('Saved')
    expect(toasts[0].id).toMatch(/^toast-/)
  })

  it('toasts auto-dismiss after 5 seconds', () => {
    useUiStore.getState().addToast({ type: 'info', title: 'Hello' })
    expect(useUiStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(5000)
    expect(useUiStore.getState().toasts).toHaveLength(0)
  })

  it('dismissToast(id) removes a specific toast and clears its timer', () => {
    useUiStore.getState().addToast({ type: 'info', title: 'A' })
    useUiStore.getState().addToast({ type: 'info', title: 'B' })
    const toastA = useUiStore.getState().toasts[0]
    useUiStore.getState().dismissToast(toastA.id)
    const remaining = useUiStore.getState().toasts
    expect(remaining).toHaveLength(1)
    expect(remaining[0].title).toBe('B')
    // Advancing 5s should NOT cause toastA to fire again or B to disappear early.
    vi.advanceTimersByTime(5000)
    // B's timer eventually fires (5s after addToast was called).
    expect(useUiStore.getState().toasts).toHaveLength(0)
  })

  it('dismissToast on unknown id is a no-op', () => {
    useUiStore.getState().addToast({ type: 'info', title: 'A' })
    expect(() => useUiStore.getState().dismissToast('does-not-exist')).not.toThrow()
    expect(useUiStore.getState().toasts).toHaveLength(1)
  })

  it('multiple toasts coexist and each dismisses independently', () => {
    useUiStore.getState().addToast({ type: 'info', title: 'A' })
    useUiStore.getState().addToast({ type: 'success', title: 'B' })
    useUiStore.getState().addToast({ type: 'warning', title: 'C' })
    expect(useUiStore.getState().toasts).toHaveLength(3)
  })
})
