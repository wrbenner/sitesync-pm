import { supabase, fromTable } from '../lib/supabase';
import {
  type Result,
  ok,
  fail,
  dbError,
  permissionError,
  notFoundError,
  validationError,
} from './errors';
import {
  type CompanyStatus,
  getValidCompanyTransitions,
} from '../machines/companyMachine';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

async function resolveProjectRole(
  projectId: string,
  userId: string | null,
): Promise<string | null> {
  if (!userId) return null;

  const { data } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();

  return data?.role ?? null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type InsuranceStatus = 'current' | 'expiring' | 'expired' | 'missing';

export interface Company {
  id: string;
  project_id: string;
  name: string;
  trade: string | null;
  status: CompanyStatus;
  insurance_status: InsuranceStatus | null;
  insurance_expiry: string | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Contact {
  id: string;
  project_id: string;
  contact_name: string;
  company: string | null;
  role: string | null;
  trade: string | null;
  phone: string | null;
  email: string | null;
  status: 'active' | 'inactive' | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  created_at: string | null;
}

export type CreateCompanyInput = {
  project_id: string;
  name: string;
  trade?: string;
  insurance_status?: InsuranceStatus;
  insurance_expiry?: string;
};

export type CreateContactInput = {
  project_id: string;
  contact_name: string;
  company?: string;
  role?: string;
  trade?: string;
  phone?: string;
  email?: string;
};

// ── Service ───────────────────────────────────────────────────────────────────

export const directoryService = {
  // ── Companies ──────────────────────────────────────────────────────────────

  async loadCompanies(projectId: string): Promise<Result<Company[]>> {
    const { data, error } = await fromTable('companies')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) return fail(dbError(error.message, { projectId }));
    return ok((data ?? []) as unknown as Company[]);
  },

  async createCompany(input: CreateCompanyInput): Promise<Result<Company>> {
    const userId = await getCurrentUserId();

    const { data, error } = await fromTable('companies')
      .insert({
        project_id: input.project_id,
        name: input.name,
        trade: input.trade ?? null,
        status: 'active' as CompanyStatus,
        insurance_status: input.insurance_status ?? 'missing',
        insurance_expiry: input.insurance_expiry ?? null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) return fail(dbError(error.message, { project_id: input.project_id }));
    return ok(data as unknown as Company);
  },

  /**
   * Transition company status with lifecycle enforcement.
   * Resolves the user's authoritative role from the database.
   */
  async transitionCompanyStatus(
    companyId: string,
    newStatus: CompanyStatus,
  ): Promise<Result> {
    const { data: company, error: fetchError } = await fromTable('companies')
      .select('status, project_id')
      .eq('id', companyId)
      .single();

    if (fetchError || !company) {
      return fail(notFoundError('Company', companyId));
    }

    const userId = await getCurrentUserId();
    const row = company as unknown as { status: CompanyStatus; project_id: string };
    const role = await resolveProjectRole(row.project_id, userId);

    if (!role) {
      return fail(permissionError('User is not a member of this project'));
    }

    const currentStatus = row.status;
    const validTransitions = getValidCompanyTransitions(currentStatus, role);

    if (!validTransitions.includes(newStatus)) {
      return fail(
        validationError(
          `Invalid transition: ${currentStatus} → ${newStatus} (role: ${role}). Valid: ${validTransitions.join(', ') || 'none'}`,
          { currentStatus, newStatus, role, validTransitions },
        ),
      );
    }

    const { error } = await fromTable('companies')
      .update({ status: newStatus, updated_by: userId })
      .eq('id', companyId);

    if (error) return fail(dbError(error.message, { companyId, newStatus }));
    return ok(null);
  },

  /**
   * Update company fields (non-status). Use transitionCompanyStatus() for status changes.
   */
  async updateCompany(companyId: string, updates: Partial<Company>): Promise<Result> {
    const userId = await getCurrentUserId();
    const { status: _status, created_by: _cb, deleted_at: _da, ...safeUpdates } =
      updates as Record<string, unknown>;

    const { error } = await fromTable('companies')
      .update({ ...safeUpdates, updated_by: userId })
      .eq('id', companyId);

    if (error) return fail(dbError(error.message, { companyId }));
    return ok(null);
  },

  async deleteCompany(companyId: string): Promise<Result> {
    const userId = await getCurrentUserId();

    const { error } = await fromTable('companies')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', companyId);

    if (error) return fail(dbError(error.message, { companyId }));
    return ok(null);
  },

  // ── Contacts ───────────────────────────────────────────────────────────────

  async loadContacts(projectId: string): Promise<Result<Contact[]>> {
    const { data, error } = await fromTable('directory_contacts')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('contact_name', { ascending: true });

    if (error) return fail(dbError(error.message, { projectId }));
    return ok((data ?? []) as unknown as Contact[]);
  },

  async createContact(input: CreateContactInput): Promise<Result<Contact>> {
    const userId = await getCurrentUserId();

    const { data, error } = await fromTable('directory_contacts')
      .insert({
        project_id: input.project_id,
        contact_name: input.contact_name,
        company: input.company ?? null,
        role: input.role ?? null,
        trade: input.trade ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        status: 'active',
        created_by: userId,
      })
      .select()
      .single();

    if (error) return fail(dbError(error.message, { project_id: input.project_id }));
    return ok(data as unknown as Contact);
  },

  async updateContact(contactId: string, updates: Partial<Contact>): Promise<Result> {
    const userId = await getCurrentUserId();
    const { status: _s, created_by: _cb, deleted_at: _da, ...safeUpdates } =
      updates as Record<string, unknown>;

    const { error } = await fromTable('directory_contacts')
      .update({ ...safeUpdates, updated_by: userId })
      .eq('id', contactId);

    if (error) return fail(dbError(error.message, { contactId }));
    return ok(null);
  },

  async deleteContact(contactId: string): Promise<Result> {
    const userId = await getCurrentUserId();

    const { error } = await fromTable('directory_contacts')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', contactId);

    if (error) return fail(dbError(error.message, { contactId }));
    return ok(null);
  },
};
