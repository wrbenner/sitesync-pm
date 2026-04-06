import { create } from 'zustand';

const THEME_STORAGE_KEY = 'sitesync-theme-mode';

function readStoredTheme(): 'light' | 'dark' | 'system' {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch { /* SSR or storage unavailable */ }
  return 'light';
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

let toastCounter = 0;

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  activeView: 'dashboard',
  commandPaletteOpen: false,
  searchQuery: '',
  themeMode: readStoredTheme(),
  a11yStatusMessage: '',
  a11yAlertMessage: '',
  toasts: [],

  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setActiveView: (view) => set({ activeView: view }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setThemeMode: (mode) => {
    try { localStorage.setItem(THEME_STORAGE_KEY, mode); } catch { /* noop */ }
    set({ themeMode: mode });
  },
  announceStatus: (message) => {
    set({ a11yStatusMessage: message });
    setTimeout(() => set({ a11yStatusMessage: '' }), 100);
  },
  announceAlert: (message) => {
    set({ a11yAlertMessage: message });
    setTimeout(() => set({ a11yAlertMessage: '' }), 100);
  },
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${(++toastCounter).toString(36)}`;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 5000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
