import { supabase } from '../lib/supabase';
import type { Organization, Profile } from '../types/database';
import { type Result, ok, fail, dbError, permissionError } from './errors';

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
    });

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

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<Result> {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
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
      .update({ organization_id: organization.id })
      .eq('user_id', userId);

    return ok(organization);
  },
};
