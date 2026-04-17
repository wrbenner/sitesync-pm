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
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) return fail(dbError(error.message, { userId }));
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

    const { data, error } = await supabase
      .from('organization_members')
      .select('*, profile:profiles(*)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });

    if (error) return fail(dbError(error.message, { organizationId }));
    return ok((data ?? []) as unknown as OrgMemberWithProfile[]);
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
