import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useUiStore } from '../../stores/uiStore'

// Reset store state before each test (no replace flag — preserves action functions)
function resetStore() {
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
}

describe('uiStore', () => {
  beforeEach(() => {
    resetStore()
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('sidebar', () => {
    it('should start with sidebar expanded', () => {
      expect(useUiStore.getState().sidebarCollapsed).toBe(false)
    })

    it('should set sidebar collapsed to true', () => {
      useUiStore.getState().setSidebarCollapsed(true)
      expect(useUiStore.getState().sidebarCollapsed).toBe(true)
    })

    it('should set sidebar collapsed to false', () => {
      useUiStore.setState({ sidebarCollapsed: true })
      useUiStore.getState().setSidebarCollapsed(false)
      expect(useUiStore.getState().sidebarCollapsed).toBe(false)
    })

    it('should toggle sidebar from expanded to collapsed', () => {
      useUiStore.getState().toggleSidebar()
      expect(useUiStore.getState().sidebarCollapsed).toBe(true)
    })

    it('should toggle sidebar from collapsed to expanded', () => {
      useUiStore.setState({ sidebarCollapsed: true })
      useUiStore.getState().toggleSidebar()
      expect(useUiStore.getState().sidebarCollapsed).toBe(false)
    })

    it('should toggle sidebar twice returns to original state', () => {
      useUiStore.getState().toggleSidebar()
      useUiStore.getState().toggleSidebar()
      expect(useUiStore.getState().sidebarCollapsed).toBe(false)
    })
  })

  describe('activeView', () => {
    it('should default to dashboard', () => {
      expect(useUiStore.getState().activeView).toBe('dashboard')
    })

    it('should set active view', () => {
      useUiStore.getState().setActiveView('rfis')
      expect(useUiStore.getState().activeView).toBe('rfis')
    })

    it('should update active view multiple times', () => {
      useUiStore.getState().setActiveView('budget')
      useUiStore.getState().setActiveView('schedule')
      expect(useUiStore.getState().activeView).toBe('schedule')
    })
  })

  describe('command palette', () => {
    it('should start with command palette closed', () => {
      expect(useUiStore.getState().commandPaletteOpen).toBe(false)
    })

    it('should open command palette', () => {
      useUiStore.getState().setCommandPaletteOpen(true)
      expect(useUiStore.getState().commandPaletteOpen).toBe(true)
    })

    it('should close command palette', () => {
      useUiStore.setState({ commandPaletteOpen: true })
      useUiStore.getState().setCommandPaletteOpen(false)
      expect(useUiStore.getState().commandPaletteOpen).toBe(false)
    })
  })

  describe('search query', () => {
    it('should start with empty search query', () => {
      expect(useUiStore.getState().searchQuery).toBe('')
    })

    it('should set search query', () => {
      useUiStore.getState().setSearchQuery('concrete pour')
      expect(useUiStore.getState().searchQuery).toBe('concrete pour')
    })

    it('should clear search query', () => {
      useUiStore.setState({ searchQuery: 'old query' })
      useUiStore.getState().setSearchQuery('')
      expect(useUiStore.getState().searchQuery).toBe('')
    })
  })

  describe('theme mode', () => {
    it('should set theme mode to dark', () => {
      useUiStore.getState().setThemeMode('dark')
      expect(useUiStore.getState().themeMode).toBe('dark')
    })

    it('should set theme mode to system', () => {
      useUiStore.getState().setThemeMode('system')
      expect(useUiStore.getState().themeMode).toBe('system')
    })

    it('should set theme mode to light', () => {
      useUiStore.getState().setThemeMode('dark')
      useUiStore.getState().setThemeMode('light')
      expect(useUiStore.getState().themeMode).toBe('light')
    })

    it('should persist theme to localStorage', () => {
      useUiStore.getState().setThemeMode('dark')
      expect(localStorage.getItem('sitesync-theme-mode')).toBe('dark')
    })
  })

  describe('accessibility announcements', () => {
    it('should set a11y status message', () => {
      useUiStore.getState().announceStatus('Item saved')
      expect(useUiStore.getState().a11yStatusMessage).toBe('Item saved')
    })

    it('should clear status message after 100ms', () => {
      useUiStore.getState().announceStatus('Item saved')
      vi.advanceTimersByTime(100)
      expect(useUiStore.getState().a11yStatusMessage).toBe('')
    })

    it('should set a11y alert message', () => {
      useUiStore.getState().announceAlert('Error occurred')
      expect(useUiStore.getState().a11yAlertMessage).toBe('Error occurred')
    })

    it('should clear alert message after 100ms', () => {
      useUiStore.getState().announceAlert('Error occurred')
      vi.advanceTimersByTime(100)
      expect(useUiStore.getState().a11yAlertMessage).toBe('')
    })
  })

  describe('toasts', () => {
    it('should start with empty toasts', () => {
      expect(useUiStore.getState().toasts).toHaveLength(0)
    })

    it('should add a toast with generated id', () => {
      useUiStore.getState().addToast({ type: 'success', title: 'Saved' })
      const toasts = useUiStore.getState().toasts
      expect(toasts).toHaveLength(1)
      expect(toasts[0].title).toBe('Saved')
      expect(toasts[0].type).toBe('success')
      expect(toasts[0].id).toMatch(/^toast-/)
    })

    it('should add toast with message', () => {
      useUiStore.getState().addToast({ type: 'info', title: 'RFI created', message: 'RFI-042 submitted' })
      const toasts = useUiStore.getState().toasts
      expect(toasts[0].message).toBe('RFI-042 submitted')
    })

    it('should add multiple toasts', () => {
      useUiStore.getState().addToast({ type: 'success', title: 'First' })
      useUiStore.getState().addToast({ type: 'warning', title: 'Second' })
      expect(useUiStore.getState().toasts).toHaveLength(2)
    })

    it('should dismiss a specific toast', () => {
      useUiStore.getState().addToast({ type: 'info', title: 'Hello' })
      useUiStore.getState().addToast({ type: 'error', title: 'Error' })
      const id = useUiStore.getState().toasts[0].id
      useUiStore.getState().dismissToast(id)
      const toasts = useUiStore.getState().toasts
      expect(toasts).toHaveLength(1)
      expect(toasts[0].title).toBe('Error')
    })

    it('should auto-dismiss toasts after 5 seconds', () => {
      useUiStore.getState().addToast({ type: 'success', title: 'Auto dismiss' })
      expect(useUiStore.getState().toasts).toHaveLength(1)
      vi.advanceTimersByTime(5000)
      expect(useUiStore.getState().toasts).toHaveLength(0)
    })

    it('should not dismiss other toasts when one expires', () => {
      useUiStore.getState().addToast({ type: 'success', title: 'First' })
      vi.advanceTimersByTime(2000)
      useUiStore.getState().addToast({ type: 'info', title: 'Second' })
      vi.advanceTimersByTime(3000) // First toast expires (total 5s)
      const toasts = useUiStore.getState().toasts
      // Second toast still has 2s remaining
      expect(toasts.some(t => t.title === 'Second')).toBe(true)
    })

    it('should assign unique ids to each toast', () => {
      useUiStore.getState().addToast({ type: 'info', title: 'A' })
      useUiStore.getState().addToast({ type: 'info', title: 'B' })
      const toasts = useUiStore.getState().toasts
      expect(toasts[0].id).not.toBe(toasts[1].id)
    })
  })
})
