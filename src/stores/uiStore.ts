import { create } from 'zustand';

interface UiState {
  sidebarCollapsed: boolean;
  activeView: string;
  commandPaletteOpen: boolean;
  searchQuery: string;

  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  setActiveView: (view: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSearchQuery: (q: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  activeView: 'dashboard',
  commandPaletteOpen: false,
  searchQuery: '',

  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setActiveView: (view) => set({ activeView: view }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setSearchQuery: (q) => set({ searchQuery: q }),
}));
