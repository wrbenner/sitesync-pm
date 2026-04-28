import { create } from 'zustand';

const THEME_STORAGE_KEY = 'sitesync-theme-mode';
const SIDEBAR_STORAGE_KEY = 'sitesync-sidebar-collapsed';

function readStoredTheme(): 'light' | 'dark' | 'system' {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch { /* SSR or storage unavailable */ }
  return 'light';
}

function readStoredSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch { /* storage unavailable */ }
  return false;
}

export interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
}

interface UiState {
  sidebarCollapsed: boolean;
  activeView: string;
  commandPaletteOpen: boolean;
  searchQuery: string;
  themeMode: 'light' | 'dark' | 'system';
  a11yStatusMessage: string;
  a11yAlertMessage: string;
  toasts: Toast[];

  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  setActiveView: (view: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSearchQuery: (q: string) => void;
  setThemeMode: (mode: 'light' | 'dark' | 'system') => void;
  announceStatus: (message: string) => void;
  announceAlert: (message: string) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
}

let toastCounter = 0;

// BUG-M21 FIX: Track outstanding timeout IDs so rapid successive calls don't
// leak orphan timers and so toasts can be dismissed cleanly without their
// auto-dismiss timeout firing later on an unrelated toast ID.
let statusTimer: ReturnType<typeof setTimeout> | null = null;
let alertTimer: ReturnType<typeof setTimeout> | null = null;
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: readStoredSidebarCollapsed(),
  activeView: 'dashboard',
  commandPaletteOpen: false,
  searchQuery: '',
  themeMode: readStoredTheme(),
  a11yStatusMessage: '',
  a11yAlertMessage: '',
  toasts: [],

  setSidebarCollapsed: (v) => {
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(v)); } catch { /* noop */ }
    set({ sidebarCollapsed: v });
  },
  toggleSidebar: () => set((s) => {
    const next = !s.sidebarCollapsed;
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)); } catch { /* noop */ }
    return { sidebarCollapsed: next };
  }),
  setActiveView: (view) => set({ activeView: view }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setThemeMode: (mode) => {
    try { localStorage.setItem(THEME_STORAGE_KEY, mode); } catch { /* noop */ }
    set({ themeMode: mode });
  },
  announceStatus: (message) => {
    set({ a11yStatusMessage: message });
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      statusTimer = null;
      set({ a11yStatusMessage: '' });
    }, 100);
  },
  announceAlert: (message) => {
    set({ a11yAlertMessage: message });
    if (alertTimer) clearTimeout(alertTimer);
    alertTimer = setTimeout(() => {
      alertTimer = null;
      set({ a11yAlertMessage: '' });
    }, 100);
  },
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${(++toastCounter).toString(36)}`;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    const handle = setTimeout(() => {
      toastTimers.delete(id);
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
    toastTimers.set(id, handle);
  },
  dismissToast: (id) => {
    const handle = toastTimers.get(id);
    if (handle) {
      clearTimeout(handle);
      toastTimers.delete(id);
    }
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
