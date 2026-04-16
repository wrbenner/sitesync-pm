import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { userService } from '../services/userService';
import type { Profile, Organization } from '../types/database';
import type { Session, User } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  organization: Organization | null;
  loading: boolean;
  initialized: boolean;
  error: Error | null;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, firstName: string, lastName?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  loadProfile: () => Promise<void>;
  loadOrganization: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
  createOrganization: (name: string) => Promise<{ error: string | null; organization: Organization | null }>;
  createCompany: (name: string) => Promise<{ error: string | null; organization: Organization | null }>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  organization: null,
  loading: true,
  initialized: false,
  error: null,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({ session, user: session?.user ?? null });

      if (session?.user) {
        await get().loadProfile();
        await get().loadOrganization();
      }

      supabase.auth.onAuthStateChange(async (_event, session) => {
        set({ session, user: session?.user ?? null });
        if (session?.user) {
          await get().loadProfile();
          await get().loadOrganization();
        } else {
          set({ profile: null, organization: null });
        }
      });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Auth initialization failed:', error);
      set({ error: error instanceof Error ? error : new Error(String(error)) });
    } finally {
      set({ loading: false, initialized: true });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) set({ error });
      set({ loading: false });
      return { error: error?.message ?? null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      set({ error, loading: false });
      return { error: error.message };
    }
  },

  signUp: async (email, password, firstName, lastName) => {
    set({ loading: true, error: null });
    try {
      const fullName = lastName ? `${firstName} ${lastName}` : firstName;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, first_name: firstName, last_name: lastName ?? '' },
        },
      });
      if (error) {
        set({ error, loading: false });
        return { error: error.message };
      }

      if (data.user) {
        await userService.createProfile(data.user.id, fullName, firstName, lastName);
      }

      set({ loading: false });
      return { error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      set({ error, loading: false });
      return { error: error.message };
    }
  },

  signOut: async () => {
    set({ loading: true });
    try {
      await supabase.auth.signOut();
      set({ session: null, user: null, profile: null, organization: null, loading: false });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      set({ error, loading: false });
    }
  },

  resetPassword: async (email: string) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) set({ error });
      set({ loading: false });
      return { error: error?.message ?? null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      set({ error, loading: false });
      return { error: error.message };
    }
  },

  updatePassword: async (newPassword: string) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) set({ error });
      set({ loading: false });
      return { error: error?.message ?? null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      set({ error, loading: false });
      return { error: error.message };
    }
  },

  loadProfile: async () => {
    const { user } = get();
    if (!user) return;
    const { data, error } = await userService.loadProfile(user.id);
    if (!error && data) {
      set({ profile: data });
    }
  },

  loadOrganization: async () => {
    const { profile } = get();
    if (!profile?.organization_id) return;
    const { data, error } = await userService.loadOrganization(profile.organization_id);
    if (!error && data) {
      set({ organization: data });
    }
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return { error: 'Not authenticated' };
    const { error } = await userService.updateProfile(user.id, updates);
    if (!error) {
      await get().loadProfile();
    }
    return { error: error?.userMessage ?? null };
  },

  createOrganization: async (name) => {
    const { user } = get();
    if (!user) return { error: 'Not authenticated', organization: null };
    const { data, error } = await userService.createOrganization(name, user.id);
    if (error) return { error: error.userMessage, organization: null };
    if (data) {
      await get().loadProfile();
      set({ organization: data });
    }
    return { error: null, organization: data };
  },

  createCompany: async (name) => {
    return get().createOrganization(name);
  },

  clearError: () => set({ error: null }),
}));
