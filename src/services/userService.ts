import { supabase } from '../lib/supabase';
import type { Organization, Profile } from '../types/database';
import type { OrgRole, ProjectRole } from '../types/tenant';
import {
  type Result,
  ok,
  fail,
  dbError,
  permissionError,
  notFoundError,
} from './errors';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/**
 * Resolve the user's authoritative org role from the database.
 * Does NOT trust caller-supplied role values.
 */
async function resolveOrgRole(
  organizationId: string,
  userId: string | null,
): Promise<OrgRole | null> {
  if (!userId) return null;

  const { data } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .single();

  return (data?.role as OrgRole) ?? null;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type UpdateProfileInput = Partial<
  Pick<Profile, 'full_name' | 'phone' | 'company' | 'trade' | 'avatar_url' | 'notification_preferences'>
>;

export type OrgMemberWithProfile = {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string | null;
  profile?: Profile | null;
};

// ── Service ──────────────────────────────────────────────────────────────────

export const userService = {
  async createProfile(
    userId: string,
    fullName: string,
    firstName: string,
    lastName?: string,
  ): Promise<Result> {
    const { error } = await supabase.from('profiles').insert({
      user_id: userId,
      full_name: fullName,
      first_name: firstName,
      last_name: lastName ?? null,
    } as Parameters<ReturnType<typeof supabase.from<'profiles'>>['insert']>[0]);

    if (error) return fail(dbError(error.message, { userId }));
    return { data: null, error: null };
  },

  async loadProfile(userId: string): Promise<Result<Profile>> {
    // .maybeSingle() returns null without error when no row exists. Users
    // who signed in via magic-link or OAuth before the auto-create trigger
    // existed (migration 20260428000010) won't have a profile row yet —
    // we don't want every page that mounts the auth store to surface a
    // PostgREST error in that case. Treat missing row as a NotFound, not
    // a hard failure.
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return fail(dbError(error.message, { userId }));
    if (!data) return fail(notFoundError('Profile', userId));
    return ok(data as Profile);
  },

  /**
   * Update profile fields. Always records updated_at timestamp for provenance.
   */
  async updateProfile(userId: string, updates: UpdateProfileInput): Promise<Result> {
    const { error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      } as Parameters<ReturnType<typeof supabase.from<'profiles'>>['update']>[0])
      .eq('user_id', userId);

    if (error) return fail(dbError(error.message, { userId }));
    return { data: null, error: null };
  },

  async loadOrganization(organizationId: string): Promise<Result<Organization>> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (error) return fail(dbError(error.message, { organizationId }));
    return ok(data as Organization);
  },

  async createOrganization(
    name: string,
    userId: string,
  ): Promise<Result<Organization>> {
    if (!userId) return fail(permissionError('Not authenticated'));

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { data, error } = await supabase
      .from('organizations')
      .insert({ name, slug })
      .select()
      .single();

    if (error) return fail(dbError(error.message, { name }));

    const organization = data as Organization;

    await supabase.from('organization_members').insert({
      organization_id: organization.id,
      user_id: userId,
      role: 'owner',
    });

    await supabase
      .from('profiles')
      .update({ organization_id: organization.id } as Parameters<
        ReturnType<typeof supabase.from<'profiles'>>['update']
      >[0])
      .eq('user_id', userId);

    // Seed the "Maple Ridge" demo project so the new org never lands on
    // an empty dashboard. Best-effort — failures here log and continue
    // because the org is already created and usable.
    try {
      const { seedDemoProject } = await import('./demoSeed');
      const seedResult = await seedDemoProject(organization.id);
      if (!seedResult.ok) {
        console.warn(
          `[demoSeed] partial seeding for org ${organization.id}:`,
          seedResult.errors,
        );
      }
    } catch (e) {
      console.warn('[demoSeed] failed to seed demo project:', e);
    }

    return ok(organization);
  },

  /**
   * Get the current user's server-resolved org role.
   * Returns null if the user is not an org member.
   */
  async getMyOrgRole(organizationId: string): Promise<Result<OrgRole | null>> {
    const userId = await getCurrentUserId();
    if (!userId) return fail(permissionError('Not authenticated'));

    const role = await resolveOrgRole(organizationId, userId);
    return ok(role);
  },

  /**
   * Get a user's server-resolved project role.
   * Returns null if the user is not a project member.
   */
  async getProjectRole(
    projectId: string,
    userId?: string,
  ): Promise<Result<ProjectRole | null>> {
    const uid = userId ?? (await getCurrentUserId());
    if (!uid) return fail(permissionError('Not authenticated'));

    const { data } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', uid)
      .single();

    return ok((data?.role as ProjectRole) ?? null);
  },

  /**
   * List all members of an organization with their profiles.
   */
  async listOrganizationMembers(
    organizationId: string,
  ): Promise<Result<OrgMemberWithProfile[]>> {
    const userId = await getCurrentUserId();
    if (!userId) return fail(permissionError('Not authenticated'));

    const role = await resolveOrgRole(organizationId, userId);
    if (!role) return fail(permissionError('User is not a member of this organization'));

    // Two-step join: PostgREST can't auto-embed `profiles` because both
    // tables reference auth.users(id), not each other. Same pattern as
    // projectService.loadMembers — see that function for the why.
    const { data: members, error: mErr } = await supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });

    if (mErr) return fail(dbError(mErr.message, { organizationId }));
    if (!members || members.length === 0) return ok([])

    const userIds = Array.from(new Set(members.map((m) => m.user_id).filter(Boolean)))
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', userIds)

    if (pErr) return fail(dbError(pErr.message, { organizationId }))

    const profileByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]))
    const merged = members.map((m) => ({
      ...m,
      profile: profileByUserId.get(m.user_id) ?? null,
    }))
    return ok(merged as unknown as OrgMemberWithProfile[]);
  },

  /**
   * Fetch a profile by user ID. Returns NotFoundError if absent.
   */
  async getUserProfile(userId: string): Promise<Result<Profile>> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return fail(notFoundError('Profile', userId));
    return ok(data as Profile);
  },
};
