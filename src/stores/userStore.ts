import { create } from 'zustand';
import { userService } from '../services/userService';
import type { UpdateProfileInput } from '../services/userService';
import type { Profile } from '../types/database';
import type { OrgRole, ProjectRole } from '../types/tenant';
import type { ServiceError } from '../services/errors';

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
  profile: Profile | null;
  orgRole: OrgRole | null;
  projectRole: ProjectRole | null;
  loading: boolean;
  error: string | null;
  errorDetails: ServiceError | null;
  preferences: {
    compactView: boolean;
  };

  // Legacy setters (backward-compat)
  setCurrentUser: (user: Partial<AppUser> & { id: string; email: string }) => void;
  clearUser: () => void;
  setPreference: <K extends keyof UserState['preferences']>(key: K, value: UserState['preferences'][K]) => void;

  // Service-delegating async actions
  loadProfile: (userId: string) => Promise<void>;
  updateProfile: (userId: string, updates: UpdateProfileInput) => Promise<{ error: string | null }>;
  loadOrgRole: (organizationId: string) => Promise<void>;
  loadProjectRole: (projectId: string) => Promise<void>;
  clearError: () => void;
}

const DEFAULT_USER: AppUser = {
  id: 'dev-user',
  name: 'Development User',
  initials: 'DU',
  email: 'dev@sitesync.ai',
  role: 'project_manager',
  company: 'SiteSync PM',
};

export const useUserStore = create<UserState>((set) => ({
  currentUser: DEFAULT_USER,
  isAuthenticated: false,
  profile: null,
  orgRole: null,
  projectRole: null,
  loading: false,
  error: null,
  errorDetails: null,

  preferences: {
    compactView: false,
  },

  // ── Legacy setters ─────────────────────────────────────────────────────────

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

  clearUser: () => set({
    currentUser: DEFAULT_USER,
    isAuthenticated: false,
    profile: null,
    orgRole: null,
    projectRole: null,
    error: null,
    errorDetails: null,
  }),

  setPreference: (key, value) =>
    set((s) => ({ preferences: { ...s.preferences, [key]: value } })),

  // ── Service-delegating async actions ───────────────────────────────────────

  loadProfile: async (userId) => {
    set({ loading: true, error: null, errorDetails: null });
    const { data, error } = await userService.loadProfile(userId);
    if (error) {
      set({ error: error.userMessage, errorDetails: error, loading: false });
    } else {
      set({ profile: data, loading: false });
    }
  },

  updateProfile: async (userId, updates) => {
    const { error } = await userService.updateProfile(userId, updates);
    if (error) return { error: error.userMessage };
    set((s) => ({
      profile: s.profile ? { ...s.profile, ...updates } : s.profile,
    }));
    return { error: null };
  },

  loadOrgRole: async (organizationId) => {
    const { data, error } = await userService.getMyOrgRole(organizationId);
    if (!error) {
      set({ orgRole: data ?? null });
    }
  },

  loadProjectRole: async (projectId) => {
    const { data, error } = await userService.getProjectRole(projectId);
    if (!error) {
      set({ projectRole: data ?? null });
    }
  },

  clearError: () => set({ error: null, errorDetails: null }),
}));
