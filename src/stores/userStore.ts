import { create } from 'zustand';

export type UserRole = 'project_manager' | 'superintendent' | 'engineer' | 'owner' | 'subcontractor';

export interface User {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: UserRole;
  company: string;
  avatar?: string;
}

interface UserState {
  currentUser: User;
  preferences: {
    compactView: boolean;
  };
  setPreference: <K extends keyof UserState['preferences']>(key: K, value: UserState['preferences'][K]) => void;
}

export const useUserStore = create<UserState>((set) => ({
  currentUser: {
    id: 'user-1',
    name: 'Walker Benner',
    initials: 'WB',
    email: 'walker@sitesync.ai',
    role: 'project_manager',
    company: 'SiteSync AI',
  },

  preferences: {
    compactView: false,
  },

  setPreference: (key, value) =>
    set((s) => ({ preferences: { ...s.preferences, [key]: value } })),
}));
