/**
 * Row Level Security (RLS) enforcement helpers.
 *
 * Provides both client-side guardrails (PermissionError thrown before the
 * network call) and scoped query helpers that apply project_id filters so
 * authorized queries are always tenant-isolated.
 */

import { supabase, isSupabaseConfigured, fromTable } from './supabase';

// ---------------------------------------------------------------------------
// PermissionError
// ---------------------------------------------------------------------------

export class PermissionError extends Error {
  readonly projectId?: string;

  constructor(message: string, projectId?: string) {
    super(message);
    this.name = 'PermissionError';
    this.projectId = projectId;
  }
}

// ---------------------------------------------------------------------------
// Tenant context (lightweight in-memory cache)
// ---------------------------------------------------------------------------

export interface TenantContext {
  companyId: string;
  projectId: string;
  userId: string;
}

let currentContext: TenantContext | null = null;

export function setTenantContext(ctx: TenantContext) {
  currentContext = ctx;
}

export function clearTenantContext() {
  currentContext = null;
}

export function getTenantContext(): TenantContext | null {
  if (!isSupabaseConfigured) return null;
  return currentContext;
}

// ---------------------------------------------------------------------------
// Core access checks (hit the DB, rely on RLS for the final verdict)
// ---------------------------------------------------------------------------

/**
 * Verify the current auth user is a member of projectId.
 * Throws PermissionError if not authenticated or not a member.
 */
export async function ensureProjectAccess(projectId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new PermissionError('Not authenticated', projectId);
  }

  const { data, error } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    throw new PermissionError(
      `Access denied: not a member of project ${projectId}`,
      projectId,
    );
  }
}

/**
 * Return the current user's role on projectId.
 * Throws PermissionError if not authenticated or not a member.
 */
export async function getUserProjectRole(projectId: string): Promise<string> {
  if (!isSupabaseConfigured) return 'owner';

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new PermissionError('Not authenticated', projectId);
  }

  const { data, error } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    throw new PermissionError(
      `Not a member of project ${projectId}`,
      projectId,
    );
  }

  return data.role as string;
}

// ---------------------------------------------------------------------------
// Role hierarchy
// ---------------------------------------------------------------------------

const ROLE_LEVEL: Record<string, number> = {
  owner: 6,
  admin: 5,
  project_manager: 4,
  superintendent: 3,
  subcontractor: 2,
  viewer: 1,
  member: 2,
};

// Minimum role level required for each action category. Subcontractors are
// permitted write access because they submit RFIs, submittals, and daily log
// entries. This aligns with ROLE_PERMISSIONS below so both decision paths
// agree on whether a role may write.
const ACTION_MIN_ROLE: Record<'read' | 'write' | 'admin', string> = {
  read: 'viewer',
  write: 'subcontractor',
  admin: 'project_manager',
};

/**
 * Return true if the current user meets the minimum role required for action.
 * Returns false on any error (not authenticated, not a member, network issue).
 */
export async function canPerformAction(
  projectId: string,
  action: 'read' | 'write' | 'admin',
): Promise<boolean> {
  try {
    const role = await getUserProjectRole(projectId);
    const userLevel = ROLE_LEVEL[role] ?? 0;
    const minLevel = ROLE_LEVEL[ACTION_MIN_ROLE[action]] ?? 0;
    return userLevel >= minLevel;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// RBAC helpers (synchronous, used after role is already known)
// ---------------------------------------------------------------------------

export type ProjectPermission = 'view' | 'edit' | 'approve' | 'admin';

const ROLE_PERMISSIONS: Record<string, ProjectPermission[]> = {
  owner: ['view', 'edit', 'approve', 'admin'],
  admin: ['view', 'edit', 'approve', 'admin'],
  project_manager: ['view', 'edit', 'approve', 'admin'],
  superintendent: ['view', 'edit', 'approve'],
  subcontractor: ['view', 'edit'],
  member: ['view', 'edit'],
  viewer: ['view'],
};

export function hasPermission(role: string, permission: ProjectPermission): boolean {
  const permissions = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS['viewer'];
  return permissions.includes(permission);
}

// ---------------------------------------------------------------------------
// Scoped query helpers
// ---------------------------------------------------------------------------

/**
 * Return a SELECT query already filtered by the active project.
 */
export function scopedQuery(table: string) {
  const ctx = getTenantContext();
  const query = fromTable(table).select('*');
  if (ctx) {
    return query.eq('project_id', ctx.projectId);
  }
  return query;
}

// ---------------------------------------------------------------------------
// Migration note: audit_log RLS
// ---------------------------------------------------------------------------
//
// Verified in supabase/migrations/005_audit_trail.sql:
//   - RLS is ENABLED on audit_log.
//   - SELECT policy "Project members can read audit logs" restricts reads to
//     rows whose project_id appears in project_members for the current user.
//     This satisfies the project-membership enforcement requirement for
//     getEntityHistory(), which now requires an explicit projectId and calls
//     assertProjectAccess() before querying.
//
//   KNOWN GAP: org-scoped rows (project_id IS NULL, organization_id IS NOT NULL)
//   are NOT covered by the current SELECT policy and will be invisible to all
//   users via RLS. If org-level audit entries are needed in the future, add a
//   second SELECT policy, e.g.:
//
//     CREATE POLICY "Org members can read org-scoped audit logs" ON audit_log
//       FOR SELECT USING (
//         project_id IS NULL AND
//         organization_id IN (
//           SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
//         )
//       );
//
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Migration note: drawings and files RLS
// ---------------------------------------------------------------------------
//
// Both `drawings` and `files` tables have RLS ENABLED.
// SELECT policies restrict access to project members only, ensuring that even
// direct Supabase client calls (bypassing the API layer) cannot return
// documents for projects the requesting user is not a member of.
//
// These SQL statements are the canonical policy definitions and are also
// exported as constants below so test suites can assert their correctness.
//
// Run these in a new migration file, e.g.
//   supabase/migrations/00052_drawings_files_rls.sql
// ---------------------------------------------------------------------------

// NOTE: policies wrap auth.uid() in a subselect so Postgres evaluates it once
// per query instead of once per row. LEARNINGS.md documents a 1,571x speedup
// for this pattern (11s full scan to 7ms indexed lookup).
export const DRAWINGS_RLS_POLICY = `
CREATE POLICY "Project members can read drawings" ON drawings
  FOR SELECT USING (
    (select auth.uid()) IN (
      SELECT user_id FROM project_members WHERE project_id = drawings.project_id
    )
  );
`.trim()

export const FILES_RLS_POLICY = `
CREATE POLICY "Project members can read files" ON files
  FOR SELECT USING (
    (select auth.uid()) IN (
      SELECT user_id FROM project_members WHERE project_id = files.project_id
    )
  );
`.trim()

// ---------------------------------------------------------------------------

/**
 * Return an INSERT that automatically injects project_id and created_by.
 */
export function scopedInsert(table: string, data: Record<string, unknown>) {
  const ctx = getTenantContext();
  const enriched = ctx
    ? { ...data, project_id: ctx.projectId, created_by: ctx.userId }
    : data;
  return fromTable(table).insert(enriched);
}

/**
 * Confirm an entity belongs to the active project before a mutation.
 * Returns true when the entity is accessible (or Supabase is not configured).
 */
export async function validateOwnership(table: string, entityId: string): Promise<boolean> {
  const ctx = getTenantContext();
  if (!ctx || !isSupabaseConfigured) return true;

  const { data } = await supabase
    .from(table)
    .select('id')
    .eq('id', entityId)
    .eq('project_id', ctx.projectId)
    .single();

  return !!data;
}
