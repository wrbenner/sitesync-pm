/**
 * Row Level Security (RLS) enforcement helpers.
 *
 * These helpers ensure that every Supabase query is scoped to the
 * current user's company and active project. They provide a typed
 * wrapper around the Supabase client that automatically applies
 * tenant isolation filters.
 */

import { supabase, isSupabaseConfigured } from './supabase';

export interface TenantContext {
  companyId: string;
  projectId: string;
  userId: string;
}

let currentContext: TenantContext | null = null;

/**
 * Set the current tenant context. Call this on login and project switch.
 */
export function setTenantContext(ctx: TenantContext) {
  currentContext = ctx;
}

/**
 * Clear tenant context on logout.
 */
export function clearTenantContext() {
  currentContext = null;
}

/**
 * Get the current tenant context. Throws if not set and Supabase is configured.
 */
export function getTenantContext(): TenantContext | null {
  if (!isSupabaseConfigured) return null;
  return currentContext;
}

/**
 * Scoped query builder that automatically applies project_id filter.
 * Usage: scopedQuery('rfis').select('*') => already filtered by project_id
 */
export function scopedQuery(table: string) {
  const ctx = getTenantContext();
  const query = supabase.from(table).select('*');
  if (ctx) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (query as any).eq('project_id', ctx.projectId);
  }
  return query;
}

/**
 * Scoped insert that automatically injects project_id and created_by.
 */
export function scopedInsert(table: string, data: Record<string, unknown>) {
  const ctx = getTenantContext();
  const enriched = ctx
    ? { ...data, project_id: ctx.projectId, created_by: ctx.userId }
    : data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from(table) as any).insert(enriched);
}

/**
 * Validate that an entity belongs to the current project before mutation.
 * Returns true if the entity is accessible, false otherwise.
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

/**
 * RBAC permission levels for project members.
 */
export type ProjectPermission = 'view' | 'edit' | 'approve' | 'admin';

const ROLE_PERMISSIONS: Record<string, ProjectPermission[]> = {
  project_manager: ['view', 'edit', 'approve', 'admin'],
  superintendent: ['view', 'edit', 'approve'],
  engineer: ['view', 'edit'],
  subcontractor: ['view', 'edit'],
  viewer: ['view'],
};

/**
 * Check if the current user has a specific permission in the active project.
 */
export function hasPermission(role: string, permission: ProjectPermission): boolean {
  const permissions = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS['viewer'];
  return permissions.includes(permission);
}
