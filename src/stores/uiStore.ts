import { create } from 'zustand';

const THEME_STORAGE_KEY = 'sitesync-theme-mode';

function readStoredTheme(): 'light' | 'dark' | 'system' {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch { /* SSR or storage unavailable */ }
  return 'light';
}

interface UiState {
  sidebarCollapsed: boolean;
  activeView: string;
  commandPaletteOpen: boolean;
  searchQuery: string;
  themeMode: 'light' | 'dark' | 'system';

  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  setActiveView: (view: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSearchQuery: (q: string) => void;
  setThemeMode: (mode: 'light' | 'dark' | 'system') => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  activeView: 'dashboard',
  commandPaletteOpen: false,
  searchQuery: '',
  themeMode: readStoredTheme(),

  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setActiveView: (view) => set({ activeView: view }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setThemeMode: (mode) => {
    try { localStorage.setItem(THEME_STORAGE_KEY, mode); } catch { /* noop */ }
    set({ themeMode: mode });
  },
}));
