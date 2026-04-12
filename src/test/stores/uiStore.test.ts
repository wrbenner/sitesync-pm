import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useUiStore } from '../../stores/uiStore'
import type { Toast } from '../../stores/uiStore'

// Reset store state before each test to prevent cross-test contamination.
const DEFAULT_STATE = {
  sidebarCollapsed: false,
  activeView: 'dashboard',
  commandPaletteOpen: false,
  searchQuery: '',
  themeMode: 'light' as const,
  a11yStatusMessage: '',
  a11yAlertMessage: '',
  toasts: [] as Toast[],
}

beforeEach(() => {
  useUiStore.setState(DEFAULT_STATE)
  vi.useFakeTimers()
  // Clear localStorage to avoid theme persistence bleeding between tests
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

// ── Sidebar ────────────────────────────────────────────────────────────────

describe('sidebar', () => {
  it('should start not collapsed', () => {
    expect(useUiStore.getState().sidebarCollapsed).toBe(false)
  })

  it('should collapse when setSidebarCollapsed(true) is called', () => {
    useUiStore.getState().setSidebarCollapsed(true)
    expect(useUiStore.getState().sidebarCollapsed).toBe(true)
  })

  it('should expand when setSidebarCollapsed(false) is called', () => {
    useUiStore.getState().setSidebarCollapsed(true)
    useUiStore.getState().setSidebarCollapsed(false)
    expect(useUiStore.getState().sidebarCollapsed).toBe(false)
  })

  it('should toggle sidebar from expanded to collapsed', () => {
    expect(useUiStore.getState().sidebarCollapsed).toBe(false)
    useUiStore.getState().toggleSidebar()
    expect(useUiStore.getState().sidebarCollapsed).toBe(true)
  })

  it('should toggle sidebar back to expanded', () => {
    useUiStore.getState().toggleSidebar()
    useUiStore.getState().toggleSidebar()
    expect(useUiStore.getState().sidebarCollapsed).toBe(false)
  })
})

// ── Active View ────────────────────────────────────────────────────────────

describe('activeView', () => {
  it('should default to dashboard', () => {
    expect(useUiStore.getState().activeView).toBe('dashboard')
  })

  it('should update active view', () => {
    useUiStore.getState().setActiveView('rfis')
    expect(useUiStore.getState().activeView).toBe('rfis')
  })

  it('should switch between views', () => {
    useUiStore.getState().setActiveView('tasks')
    expect(useUiStore.getState().activeView).toBe('tasks')
    useUiStore.getState().setActiveView('budget')
    expect(useUiStore.getState().activeView).toBe('budget')
  })
})

// ── Command Palette ────────────────────────────────────────────────────────

describe('commandPalette', () => {
  it('should start closed', () => {
    expect(useUiStore.getState().commandPaletteOpen).toBe(false)
  })

  it('should open when setCommandPaletteOpen(true) is called', () => {
    useUiStore.getState().setCommandPaletteOpen(true)
    expect(useUiStore.getState().commandPaletteOpen).toBe(true)
  })

  it('should close when setCommandPaletteOpen(false) is called', () => {
    useUiStore.getState().setCommandPaletteOpen(true)
    useUiStore.getState().setCommandPaletteOpen(false)
    expect(useUiStore.getState().commandPaletteOpen).toBe(false)
  })
})

// ── Search Query ───────────────────────────────────────────────────────────

describe('searchQuery', () => {
  it('should start empty', () => {
    expect(useUiStore.getState().searchQuery).toBe('')
  })

  it('should update search query', () => {
    useUiStore.getState().setSearchQuery('structural steel')
    expect(useUiStore.getState().searchQuery).toBe('structural steel')
  })

  it('should clear search query when set to empty string', () => {
    useUiStore.getState().setSearchQuery('something')
    useUiStore.getState().setSearchQuery('')
    expect(useUiStore.getState().searchQuery).toBe('')
  })
})

// ── Theme Mode ─────────────────────────────────────────────────────────────

describe('themeMode', () => {
  it('should update theme mode to dark', () => {
    useUiStore.getState().setThemeMode('dark')
    expect(useUiStore.getState().themeMode).toBe('dark')
  })

  it('should update theme mode to system', () => {
    useUiStore.getState().setThemeMode('system')
    expect(useUiStore.getState().themeMode).toBe('system')
  })

  it('should update theme mode back to light', () => {
    useUiStore.getState().setThemeMode('dark')
    useUiStore.getState().setThemeMode('light')
    expect(useUiStore.getState().themeMode).toBe('light')
  })

  it('should persist theme to localStorage', () => {
    useUiStore.getState().setThemeMode('dark')
    expect(localStorage.getItem('sitesync-theme-mode')).toBe('dark')
  })

  it('should persist all three valid theme values to localStorage', () => {
    for (const mode of ['light', 'dark', 'system'] as const) {
      useUiStore.getState().setThemeMode(mode)
      expect(localStorage.getItem('sitesync-theme-mode')).toBe(mode)
    }
  })
})

// ── a11y Announcements ─────────────────────────────────────────────────────

describe('a11y announcements', () => {
  it('should set status message immediately', () => {
    useUiStore.getState().announceStatus('Loading tasks...')
    expect(useUiStore.getState().a11yStatusMessage).toBe('Loading tasks...')
  })

  it('should clear status message after 100ms', () => {
    useUiStore.getState().announceStatus('Loading tasks...')
    expect(useUiStore.getState().a11yStatusMessage).toBe('Loading tasks...')

    vi.advanceTimersByTime(100)
    expect(useUiStore.getState().a11yStatusMessage).toBe('')
  })

  it('should set alert message immediately', () => {
    useUiStore.getState().announceAlert('Error submitting RFI')
    expect(useUiStore.getState().a11yAlertMessage).toBe('Error submitting RFI')
  })

  it('should clear alert message after 100ms', () => {
    useUiStore.getState().announceAlert('Error!')
    vi.advanceTimersByTime(100)
    expect(useUiStore.getState().a11yAlertMessage).toBe('')
  })
})

// ── Toast Notifications ────────────────────────────────────────────────────

describe('toasts', () => {
  it('should start with no toasts', () => {
    expect(useUiStore.getState().toasts).toHaveLength(0)
  })

  it('should add a toast with an auto-generated id', () => {
    useUiStore.getState().addToast({ type: 'success', title: 'RFI submitted' })
    const toasts = useUiStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].title).toBe('RFI submitted')
    expect(toasts[0].type).toBe('success')
    expect(toasts[0].id).toBeDefined()
    expect(typeof toasts[0].id).toBe('string')
  })

  it('should add a toast with an optional message', () => {
    useUiStore.getState().addToast({ type: 'error', title: 'Upload failed', message: 'File too large' })
    const toast = useUiStore.getState().toasts[0]
    expect(toast.message).toBe('File too large')
  })

  it('should support all toast types', () => {
    const types = ['info', 'success', 'warning', 'error'] as const
    for (const type of types) {
      useUiStore.setState({ toasts: [] })
      useUiStore.getState().addToast({ type, title: `${type} toast` })
      expect(useUiStore.getState().toasts[0].type).toBe(type)
    }
  })

  it('should accumulate multiple toasts', () => {
    useUiStore.getState().addToast({ type: 'success', title: 'First' })
    useUiStore.getState().addToast({ type: 'error', title: 'Second' })
    useUiStore.getState().addToast({ type: 'info', title: 'Third' })
    expect(useUiStore.getState().toasts).toHaveLength(3)
  })

  it('should assign unique ids to each toast', () => {
    useUiStore.getState().addToast({ type: 'info', title: 'Toast A' })
    useUiStore.getState().addToast({ type: 'info', title: 'Toast B' })
    const ids = useUiStore.getState().toasts.map((t) => t.id)
    expect(new Set(ids).size).toBe(2) // all unique
  })

  it('should auto-dismiss toast after 5 seconds', () => {
    useUiStore.getState().addToast({ type: 'success', title: 'Saved' })
    expect(useUiStore.getState().toasts).toHaveLength(1)

    vi.advanceTimersByTime(5000)
    expect(useUiStore.getState().toasts).toHaveLength(0)
  })

  it('should not dismiss toast before 5 seconds', () => {
    useUiStore.getState().addToast({ type: 'warning', title: 'Budget alert' })
    vi.advanceTimersByTime(4999)
    expect(useUiStore.getState().toasts).toHaveLength(1)
  })

  it('should dismiss a specific toast by id', () => {
    useUiStore.getState().addToast({ type: 'info', title: 'Keep Me' })
    useUiStore.getState().addToast({ type: 'error', title: 'Remove Me' })

    const toasts = useUiStore.getState().toasts
    const toRemoveId = toasts[1].id

    useUiStore.getState().dismissToast(toRemoveId)

    const remaining = useUiStore.getState().toasts
    expect(remaining).toHaveLength(1)
    expect(remaining[0].title).toBe('Keep Me')
  })

  it('should not crash when dismissing a non-existent id', () => {
    useUiStore.getState().addToast({ type: 'info', title: 'Real Toast' })
    expect(() => useUiStore.getState().dismissToast('does-not-exist')).not.toThrow()
    expect(useUiStore.getState().toasts).toHaveLength(1)
  })
})
