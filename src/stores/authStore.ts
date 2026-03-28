import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
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

// Mock user for development without Supabase
const MOCK_PROFILE: Profile = {
  id: 'user-1',
  company_id: 'company-1',
  email: 'walker@sitesync.ai',
  first_name: 'Walker',
  last_name: 'Benner',
  role: 'company_admin',
  avatar_url: null,
  phone: null,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_COMPANY: Company = {
  id: 'company-1',
  name: 'SiteSync AI',
  logo_url: null,
  subscription_tier: 'pro',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  company: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    if (!isSupabaseConfigured) {
      // Development mode: use mock data
      set({
        profile: MOCK_PROFILE,
        company: MOCK_COMPANY,
        loading: false,
        initialized: true,
      });
      return;
    }

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
    if (!isSupabaseConfigured) {
      set({ profile: MOCK_PROFILE, company: MOCK_COMPANY });
      return { error: null };
    }

    set({ loading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ loading: false });
    return { error: error?.message ?? null };
  },

  signUp: async (email, password, firstName, lastName) => {
    if (!isSupabaseConfigured) {
      set({ profile: MOCK_PROFILE, company: MOCK_COMPANY });
      return { error: null };
    }

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
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    set({ session: null, user: null, profile: null, company: null });
  },

  loadProfile: async () => {
    if (!isSupabaseConfigured) return;

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
    if (!isSupabaseConfigured) return;

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
    if (!isSupabaseConfigured) {
      set((s) => ({ profile: s.profile ? { ...s.profile, ...updates } : null }));
      return { error: null };
    }

    const { user } = get();
    if (!user) return { error: 'Not authenticated' };

    const { error } = await (supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('profiles') as any)
      .update(updates)
      .eq('id', user.id);

    if (!error) {
      await get().loadProfile();
    }

    return { error: error?.message ?? null };
  },

  createCompany: async (name) => {
    if (!isSupabaseConfigured) {
      const company = { ...MOCK_COMPANY, name };
      set({ company });
      return { error: null, company };
    }

    const { user } = get();
    if (!user) return { error: 'Not authenticated', company: null };

    const { data, error } = await (supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('companies') as any)
      .insert({ name, logo_url: null, subscription_tier: 'free' })
      .select()
      .single();

    if (error) return { error: error.message, company: null };

    const company = data as Company;

    // Link user to company
    await (supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('profiles') as any)
      .update({ company_id: company.id, role: 'company_admin' })
      .eq('id', user.id);

    await get().loadProfile();
    set({ company });

    return { error: null, company };
  },
}));
