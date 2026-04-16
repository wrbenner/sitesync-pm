import { supabase } from '../lib/supabase';
import type { PunchItem, Priority } from '../types/database';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the current authenticated user ID from Supabase session.
 * Returns null if no session (unauthenticated).
 */
async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/**
 * Resolve the user's authoritative project role from the database.
 * Does NOT trust caller-supplied role values.
 *
 * Returns the role string from project_members, or null if the user
 * is not a member of the project.
 */
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

// ── Types ────────────────────────────────────────────────────────────────────

/** Punch item lifecycle states. Enforced by transitionStatus(). */
export type PunchItemStatus = 'open' | 'in_progress' | 'resolved' | 'verified' | 'closed';

export type CreatePunchItemInput = {
  project_id: string;
  title: string;
  description?: string;
  priority?: Priority;
  assigned_to?: string;
  due_date?: string;
  trade?: string;
  location?: string;
  floor?: string;
  area?: string;
};

export type PunchItemServiceResult<T = void> = {
  data: T | null;
  error: string | null;
};

// ── Role-Based Transition Rules ───────────────────────────────────────────────

/**
 * Roles with elevated authority to verify, close, and forcibly reopen items.
 * All other roles are considered standard (sub-tier) with limited transitions.
 */
const ELEVATED_ROLES = new Set(['admin', 'owner', 'superintendent', 'project_manager', 'gc']);

/**
 * Return the valid next states for a given current state and project role.
 * This is the authoritative transition table for the punch item kernel.
 *
 * Standard flow:
 *   open → in_progress → resolved → verified → closed
 *
 * Elevated roles can:
 *   - Skip directly to verified from open (item already fixed at creation)
 *   - Reject verification (verified → in_progress for rework)
 *   - Close any verified item
 *   - Reopen a closed item
 */
export function getPunchItemValidTransitions(
  currentStatus: PunchItemStatus,
  role: string,
): PunchItemStatus[] {
  const elevated = ELEVATED_ROLES.has(role);

  switch (currentStatus) {
    case 'open':
      return elevated
        ? ['in_progress', 'verified', 'closed']
        : ['in_progress'];
    case 'in_progress':
      return elevated
        ? ['resolved', 'open', 'closed']
        : ['resolved', 'open'];
    case 'resolved':
      return elevated
        ? ['verified', 'open', 'in_progress']
        : ['open'];
    case 'verified':
      return elevated ? ['in_progress', 'closed'] : [];
    case 'closed':
      return elevated ? ['open'] : [];
    default:
      return [];
  }
}

// ── Service ──────────────────────────────────────────────────────────────────

export const punchItemService = {
  /**
   * Load all active (non-deleted) punch items for a project, ordered newest first.
   */
  async loadPunchItems(projectId: string): Promise<PunchItemServiceResult<PunchItem[]>> {
    const { data, error } = await supabase
      .from('punch_items')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('number', { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as PunchItem[], error: null };
  },

  /**
   * Load a single punch item by ID. Returns null if not found or soft-deleted.
   */
  async getPunchItem(itemId: string): Promise<PunchItemServiceResult<PunchItem>> {
    const { data, error } = await supabase
      .from('punch_items')
      .select('*')
      .eq('id', itemId)
      .is('deleted_at', null)
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as PunchItem, error: null };
  },

  /**
   * Create a new punch item in 'open' status with provenance.
   */
  async createPunchItem(input: CreatePunchItemInput): Promise<PunchItemServiceResult<PunchItem>> {
    const userId = await getCurrentUserId();

    const payload: Record<string, unknown> = {
      project_id: input.project_id,
      title: input.title,
      description: input.description ?? null,
      status: 'open' as PunchItemStatus,
      priority: input.priority ?? 'medium',
      assigned_to: input.assigned_to ?? null,
      due_date: input.due_date ?? null,
      trade: input.trade ?? null,
      location: input.location ?? null,
      floor: input.floor ?? null,
      area: input.area ?? null,
      reported_by: userId,
      created_by: userId,
    };

    const { data, error } = await (supabase.from('punch_items') as ReturnType<typeof supabase.from>)
      .insert(payload)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as PunchItem, error: null };
  },

  /**
   * Transition punch item status with lifecycle enforcement.
   *
   * IMPORTANT: This method resolves the user's authoritative role from the
   * database. It does NOT accept caller-supplied roles.
   *
   * Validates that:
   *   1. The item exists and is not deleted
   *   2. The user has a project role
   *   3. The transition is valid per getPunchItemValidTransitions for that role
   */
  async transitionStatus(
    itemId: string,
    newStatus: PunchItemStatus,
  ): Promise<PunchItemServiceResult> {
    // 1. Fetch current item
    const { data: item, error: fetchError } = await supabase
      .from('punch_items')
      .select('status, project_id, assigned_to')
      .eq('id', itemId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !item) {
      return { data: null, error: fetchError?.message ?? 'Punch item not found' };
    }

    // 2. Resolve authoritative role — do NOT trust caller
    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(item.project_id, userId);
    if (!role) {
      return { data: null, error: 'User is not a member of this project' };
    }

    // 3. Validate transition
    const currentStatus = (item.status ?? 'open') as PunchItemStatus;
    const validTransitions = getPunchItemValidTransitions(currentStatus, role);
    if (!validTransitions.includes(newStatus)) {
      return {
        data: null,
        error: `Invalid transition: ${currentStatus} \u2192 ${newStatus} (role: ${role}). Valid: ${validTransitions.join(', ')}`,
      };
    }

    // 4. Execute transition with provenance
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_by: userId,
    };

    if (newStatus === 'resolved') {
      updates.resolved_date = new Date().toISOString();
    }
    if (newStatus === 'verified') {
      updates.verified_date = new Date().toISOString();
      updates.verified_by = userId;
    }
    if (newStatus === 'closed') {
      updates.closed_at = new Date().toISOString();
    }

    const { error } = await (supabase.from('punch_items') as ReturnType<typeof supabase.from>)
      .update(updates)
      .eq('id', itemId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Update punch item fields (non-status). Populates updated_by.
   * Use transitionStatus() for status changes.
   */
  async updatePunchItem(
    itemId: string,
    updates: Partial<PunchItem>,
  ): Promise<PunchItemServiceResult> {
    const userId = await getCurrentUserId();
    // Strip status to prevent bypassing lifecycle enforcement
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _status, ...safeUpdates } = updates as Record<string, unknown>;

    const { error } = await (supabase.from('punch_items') as ReturnType<typeof supabase.from>)
      .update({ ...safeUpdates, updated_by: userId, updated_at: new Date().toISOString() })
      .eq('id', itemId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Assign a punch item to a user. Updates assigned_to and updated_by.
   */
  async assignPunchItem(
    itemId: string,
    assignedTo: string | null,
  ): Promise<PunchItemServiceResult> {
    const userId = await getCurrentUserId();

    const { error } = await (supabase.from('punch_items') as ReturnType<typeof supabase.from>)
      .update({
        assigned_to: assignedTo,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Soft-delete a punch item.
   */
  async deletePunchItem(itemId: string): Promise<PunchItemServiceResult> {
    const userId = await getCurrentUserId();

    const { error } = await (supabase.from('punch_items') as ReturnType<typeof supabase.from>)
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        updated_by: userId,
      })
      .eq('id', itemId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Upload a photo (before or after) for a punch item to Supabase Storage.
   * Returns the public URL of the uploaded photo.
   *
   * The file is stored at: punch-photos/{projectId}/{itemId}/{type}-{timestamp}.{ext}
   */
  async uploadPhoto(
    itemId: string,
    projectId: string,
    file: File,
    type: 'before' | 'after',
  ): Promise<PunchItemServiceResult<string>> {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${projectId}/${itemId}/${type}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('punch-photos')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      return { data: null, error: `Photo upload failed: ${uploadError.message}` };
    }

    const { data: urlData } = supabase.storage
      .from('punch-photos')
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;

    // Append the URL to the photos JSON array on the item
    const { data: current, error: fetchError } = await supabase
      .from('punch_items')
      .select('photos')
      .eq('id', itemId)
      .single();

    if (fetchError) return { data: publicUrl, error: null }; // Return URL even if DB update fails

    const existing = Array.isArray(current?.photos) ? (current.photos as string[]) : [];
    const updatedPhotos = [...existing, publicUrl];

    const userId = await getCurrentUserId();
    await (supabase.from('punch_items') as ReturnType<typeof supabase.from>).update({
      photos: updatedPhotos,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }).eq('id', itemId);

    return { data: publicUrl, error: null };
  },
};
