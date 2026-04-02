import { create } from 'zustand';
import { supabase } from '../lib/supabase';
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
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  loadProfile: () => Promise<void>;
  loadOrganization: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
  createOrganization: (name: string) => Promise<{ error: string | null; organization: Organization | null }>;
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

      // Listen for auth changes
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
      console.error('Auth initialization failed:', error);
      set({ error: error instanceof Error ? error : new Error(String(error)) });
    } finally {
      set({ loading: false, initialized: true });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        set({ error });
      }
      set({ loading: false });
      return { error: error?.message ?? null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      set({ error, loading: false });
      return { error: error.message };
    }
  },

  signUp: async (email, password, fullName) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });
      if (error) {
        set({ error });
      }
      set({ loading: false });
      return { error: error?.message ?? null };
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
      if (error) {
        set({ error });
      }
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
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        set({ error });
      }
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

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!error && data) {
      set({ profile: data as Profile });
    }
  },

  loadOrganization: async () => {
    const { profile } = get();
    if (!profile?.organization_id) return;

    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', profile.organization_id)
      .single();

    if (!error && data) {
      set({ organization: data as Organization });
    }
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return { error: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (!error) {
        await get().loadProfile();
      }

      return { error: error?.message ?? null };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { error };
    }
  },

  createOrganization: async (name) => {
    const { user } = get();
    if (!user) return { error: 'Not authenticated', organization: null };

    try {
      const { data, error } = await supabase
        .from('organizations')
        .insert({ name, slug: name.toLowerCase().replace(/\s+/g, '-') })
        .select()
        .single();

      if (error) return { error: error.message, organization: null };

      const organization = data as Organization;

      // Link user to organization
      await supabase
        .from('profiles')
        .update({ organization_id: organization.id })
        .eq('user_id', user.id);

      await get().loadProfile();
      set({ organization });

      return { error: null, organization };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { error, organization: null };
    }
  },

  clearError: () => set({ error: null }),
}));
