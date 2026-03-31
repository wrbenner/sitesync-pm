import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Profile, Company } from '../types/database';
import type { Session, User } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  company: Company | null;
  loading: boolean;
  initialized: boolean;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  loadProfile: () => Promise<void>;
  loadCompany: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
  createCompany: (name: string) => Promise<{ error: string | null; company: Company | null }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  company: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({ session, user: session?.user ?? null });

      if (session?.user) {
        await get().loadProfile();
        await get().loadCompany();
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (_event, session) => {
        set({ session, user: session?.user ?? null });
        if (session?.user) {
          await get().loadProfile();
          await get().loadCompany();
        } else {
          set({ profile: null, company: null });
        }
      });
    } catch (error) {
      console.error('Auth initialization failed:', error);
    } finally {
      set({ loading: false, initialized: true });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ loading: false });
    return { error: error?.message ?? null };
  },

  signUp: async (email, password, firstName, lastName) => {
    set({ loading: true });
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
      },
    });
    set({ loading: false });
    return { error: error?.message ?? null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, company: null });
  },

  loadProfile: async () => {
    const { user } = get();
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      set({ profile: data as Profile });
    }
  },

  loadCompany: async () => {
    const { profile } = get();
    if (!profile?.company_id) return;

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', profile.company_id)
      .single();

    if (!error && data) {
      set({ company: data as Company });
    }
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return { error: 'Not authenticated' };

    const { error } = await (supabase
      .from('profiles') as any)
      .update(updates)
      .eq('id', user.id);

    if (!error) {
      await get().loadProfile();
    }

    return { error: error?.message ?? null };
  },

  createCompany: async (name) => {
    const { user } = get();
    if (!user) return { error: 'Not authenticated', company: null };

    const { data, error } = await (supabase
      .from('companies') as any)
      .insert({ name, logo_url: null, subscription_tier: 'free' })
      .select()
      .single();

    if (error) return { error: error.message, company: null };

    const company = data as Company;

    // Link user to company
    await (supabase
      .from('profiles') as any)
      .update({ company_id: company.id, role: 'company_admin' })
      .eq('id', user.id);

    await get().loadProfile();
    set({ company });

    return { error: null, company };
  },
}));
