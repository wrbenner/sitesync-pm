import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { userService } from '../services/userService';
import type { Profile, Organization } from '../types/database';
import type { Session, User } from '@supabase/supabase-js';
import type { OrgRole } from '../types/tenant';
import analytics from '../lib/analytics';
import { identifyCrispUser, resetCrispSession } from '../lib/crisp/init';
import { queryClient } from '../lib/queryClient';
import { setSentryUser } from '../lib/sentry';

// BUG-H11 FIX: Keep a module-level reference to the auth subscription so we can
// unsubscribe on teardown (e.g. signOut / HMR) and avoid leaked listeners.
let authSubscription: { unsubscribe: () => void } | null = null;

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  // Primary org from user's profile (loaded on sign-in)
  organization: Organization | null;
  // ── Absorbed from organizationStore (Day 7 consolidation) ──
  // All orgs the user belongs to (populated by OrganizationProvider via React Query)
  organizations: Organization[];
  // Role of the current user in the active org
  currentOrgRole: OrgRole | null;
  loading: boolean;
  initialized: boolean;
  error: Error | null;

  initialize: () => Promise<void>;
  teardown: () => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, firstName: string, lastName?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  // BRT sub-1 §4.3: server-side org switch — validates membership via the
  // switch-active-org edge fn, persists profiles.active_org_id, refreshes
  // the session so the JWT carries the new org_id claim.
  switchActiveOrg: (targetOrgId: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  loadProfile: () => Promise<void>;
  loadOrganization: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
  createOrganization: (name: string) => Promise<{ error: string | null; organization: Organization | null }>;
  createCompany: (name: string) => Promise<{ error: string | null; organization: Organization | null }>;
  clearError: () => void;
  // ── Org management actions (absorbed from organizationStore) ──
  setCurrentOrg: (org: Organization) => Promise<void>;
  setOrganizations: (orgs: Organization[]) => void;
  setCurrentOrgRole: (role: OrgRole | null) => void;
  clearOrganization: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  organization: null,
  organizations: [],
  currentOrgRole: null,
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

      // BUG-H11 FIX: Tear down any prior subscription before creating a new one
      // (e.g. on re-initialize or HMR) and keep a reference for explicit cleanup.
      if (authSubscription) {
        authSubscription.unsubscribe();
        authSubscription = null;
      }
      const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
        set({ session, user: session?.user ?? null });
        if (session?.user) {
          await get().loadProfile();
          await get().loadOrganization();
          // BRT sub-7 §4.3: identify the user once profile is loaded so
          // events captured before identify still attach via session merge.
          const { profile } = get();
          analytics.identify(session.user.id, {
            email: session.user.email ?? '',
            ...(profile?.first_name ? { first_name: profile.first_name } : {}),
            ...(profile?.last_name ? { last_name: profile.last_name } : {}),
          });
          // BRT sub-6 §4.1: identify to Crisp so chat shows org + plan context.
          const { organization } = get();
          identifyCrispUser({
            email: session.user.email ?? '',
            fullName: profile?.first_name && profile?.last_name
              ? `${profile.first_name} ${profile.last_name}`
              : profile?.first_name ?? null,
            orgName: organization?.name ?? null,
            plan: organization?.plan ?? null,
            signupAt: session.user.created_at ?? null,
          });
        } else {
          set({ profile: null, organization: null, organizations: [], currentOrgRole: null });
          // BRT sub-6 §4.1: reset Crisp on signout so a shared device gets a clean thread.
          resetCrispSession();
          // BRT sub-7 §4.3: drop posthog identity on signout so the next
          // user on the same device starts a clean funnel.
          analytics.reset();
        }
      });
      authSubscription = data.subscription;
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
      set({
        session: null,
        user: null,
        profile: null,
        organization: null,
        organizations: [],
        currentOrgRole: null,
        loading: false,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      set({ error, loading: false });
    }
  },

  // BRT sub-1 §4.3 — server-side org switch.
  //
  // Sequence:
  //   1. Call the switch-active-org edge fn (it validates membership via
  //      set_active_org() SECURITY DEFINER + writes profiles.active_org_id).
  //   2. supabase.auth.refreshSession() so the JWT picks up the new
  //      `org_id` custom claim (injected by custom_access_token_hook).
  //   3. Locally mirror the switch via setCurrentOrg(), which cancels
  //      in-flight queries + clears the React Query cache.
  //
  // Failure paths return a customer-grade message; the prior org stays
  // active so the UI doesn't flicker to a half-switched state.
  switchActiveOrg: async (targetOrgId) => {
    const { organizations } = get();
    const target = organizations.find((o) => o.id === targetOrgId);
    if (!target) {
      return { error: 'You are not a member of that organization.' };
    }
    try {
      const { error: fnError } = await supabase.functions.invoke('switch-active-org', {
        body: { target_org_id: targetOrgId },
      });
      if (fnError) {
        if (import.meta.env.DEV) console.error('[switch-active-org] edge fn error:', fnError);
        return { error: 'Could not switch organization. Please try again.' };
      }
      // Refresh the session so the JWT carries the new org_id claim.
      await supabase.auth.refreshSession();
      await get().setCurrentOrg(target);
      return { error: null };
    } catch (err) {
      if (import.meta.env.DEV) console.error('[switch-active-org] unexpected:', err);
      return { error: 'Network error while switching organization.' };
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
      // BRT sub-7 §4.3: group user under org so funnels can roll up by tenant.
      analytics.group('organization', data.id, {
        name: data.name,
        ...(data.slug ? { slug: data.slug } : {}),
      });
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

  // ── Org management (absorbed from organizationStore, Day 7) ──

  // BRT sub-0 day-4 P0-G: org-switch is atomic — cancel in-flight queries,
  // clear cached data, re-tag Sentry scope BEFORE flipping state so org-A
  // data can't render under org-B context after switch. Same-org "rename"
  // calls (Step2OrgDetails) are a no-op on the cache.
  setCurrentOrg: async (org) => {
    const prev = get().organization;
    const isSwitch = prev?.id !== org.id;
    if (isSwitch) {
      await queryClient.cancelQueries();
      queryClient.clear();
      const u = get().user;
      if (u) setSentryUser(u.id, u.email ?? '', undefined, org.id);
    }
    const roleReset = isSwitch ? { currentOrgRole: null } : {};
    set({ organization: org, ...roleReset });
  },

  setOrganizations: (orgs) => {
    set((s) => {
      // Auto-select the first org if none is selected yet, or the previously
      // selected org is no longer in the list (e.g. user was removed).
      const stillValid = s.organization && orgs.some((o) => o.id === s.organization!.id);
      const organization = stillValid ? s.organization : (orgs[0] ?? null);
      return { organizations: orgs, organization };
    });
  },

  setCurrentOrgRole: (role) => set({ currentOrgRole: role }),

  clearOrganization: () => set({
    organization: null,
    organizations: [],
    currentOrgRole: null,
  }),

  teardown: () => {
    // BUG-H11 FIX: Allow callers to explicitly release the Supabase auth
    // subscription (e.g. on logout or unmount).
    if (authSubscription) {
      authSubscription.unsubscribe();
      authSubscription = null;
    }
  },
}));
