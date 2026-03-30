import { create } from 'zustand';

export type UserRole = 'project_manager' | 'superintendent' | 'engineer' | 'owner' | 'subcontractor';

export interface AppUser {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: UserRole;
  company: string;
  avatar?: string;
}

// Re-export as User for backward compatibility
export type User = AppUser;

interface UserState {
  currentUser: AppUser;
  isAuthenticated: boolean;
  setCurrentUser: (user: Partial<AppUser> & { id: string; email: string }) => void;
  clearUser: () => void;
  preferences: {
    compactView: boolean;
  };
  setPreference: <K extends keyof UserState['preferences']>(key: K, value: UserState['preferences'][K]) => void;
}

const DEFAULT_USER: AppUser = {
  id: 'dev-user',
  name: 'Development User',
  initials: 'DU',
  email: 'dev@sitesync.ai',
  role: 'project_manager',
  company: 'SiteSync AI',
};

export const useUserStore = create<UserState>((set) => ({
  currentUser: DEFAULT_USER,
  isAuthenticated: false,

  setCurrentUser: (user) => {
    const name = user.name || user.email.split('@')[0];
    const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || 'U';
    set({
      currentUser: {
        id: user.id,
        name,
        initials,
        email: user.email,
        role: (user.role as UserRole) || 'project_manager',
        company: user.company || '',
        avatar: user.avatar,
      },
      isAuthenticated: true,
    });
  },

  clearUser: () => set({ currentUser: DEFAULT_USER, isAuthenticated: false }),

  preferences: {
    compactView: false,
  },

  setPreference: (key, value) =>
    set((s) => ({ preferences: { ...s.preferences, [key]: value } })),
}));
