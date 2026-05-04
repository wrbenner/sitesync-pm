import type { ProjectRole } from '../types/tenant';
import { ROLE_HIERARCHY } from '../types/tenant';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MemberLifecycleState = 'invited' | 'active' | 'suspended' | 'removed';

export interface MemberTransition {
  from: MemberLifecycleState;
  to: MemberLifecycleState;
  timestamp: string;
  performedBy: string;
  reason?: string;
}

// ── State Derivation ──────────────────────────────────────────────────────────

/**
 * Derives the lifecycle state from DB column values.
 * The `permissions` JSON may carry `_memberStatus` for suspended/removed states
 * since the project_members table has no dedicated status column.
 */
export function getMemberLifecycleState(member: {
  invited_at: string | null;
  accepted_at: string | null;
  permissions: Record<string, unknown> | null;
}): MemberLifecycleState {
  const status = (member.permissions as unknown as Record<string, unknown> | null)?._memberStatus as string | undefined;
  if (status === 'suspended') return 'suspended';
  if (status === 'removed') return 'removed';
  if (member.accepted_at) return 'active';
  if (member.invited_at) return 'invited';
  return 'active';
}

// ── Transition Guards ─────────────────────────────────────────────────────────

const MANAGER_LEVEL = ROLE_HIERARCHY['project_manager']; // 5
const EXECUTIVE_LEVEL = ROLE_HIERARCHY['project_executive']; // 7

/**
 * Returns the list of states a caller with the given role may transition
 * a member to from its current lifecycle state.
 * Server-resolved roles only — never pass client-supplied values.
 */
export function getValidMemberTransitions(
  currentState: MemberLifecycleState,
  callerRole: ProjectRole,
): MemberLifecycleState[] {
  const level = ROLE_HIERARCHY[callerRole] ?? 0;
  const canManage = level >= MANAGER_LEVEL;
  const isExecutive = level >= EXECUTIVE_LEVEL;

  switch (currentState) {
    case 'invited':
      return canManage ? ['active', 'removed'] : [];
    case 'active':
      return canManage ? ['suspended', 'removed'] : [];
    case 'suspended':
      return canManage ? ['active', 'removed'] : [];
    case 'removed':
      return isExecutive ? ['active'] : [];
    default:
      return [];
  }
}

export function isValidMemberTransition(
  from: MemberLifecycleState,
  to: MemberLifecycleState,
  callerRole: ProjectRole,
): boolean {
  return getValidMemberTransitions(from, callerRole).includes(to);
}

// ── Role Assignment Guards ────────────────────────────────────────────────────

/**
 * Returns true if callerRole may assign targetRole.
 * Callers may only assign roles strictly below their own level.
 */
export function canAssignRole(callerRole: ProjectRole, targetRole: ProjectRole): boolean {
  return (ROLE_HIERARCHY[callerRole] ?? 0) > (ROLE_HIERARCHY[targetRole] ?? 0);
}

// ── Permission Cascading ──────────────────────────────────────────────────────

/**
 * Returns the default permission set for a given project role.
 * These are base permissions; callers with sufficient privilege may override.
 */
export function getDefaultPermissions(role: ProjectRole): Record<string, boolean> {
  const base: Record<string, boolean> = {
    'rfis.view': true,
    'rfis.create': false,
    'rfis.respond': false,
    'submittals.view': true,
    'submittals.create': false,
    'schedule.view': true,
    'daily_log.view': false,
    'drawings.view': true,
    'files.view': true,
    'punch_list.view': true,
  };

  const level = ROLE_HIERARCHY[role] ?? 0;

  if (level >= ROLE_HIERARCHY['field_engineer']) {
    base['rfis.create'] = true;
    base['rfis.respond'] = true;
    base['daily_log.view'] = true;
    base['submittals.create'] = true;
  }

  if (level >= ROLE_HIERARCHY['superintendent']) {
    base['submittals.create'] = true;
    base['daily_log.create'] = true;
    base['punch_list.create'] = true;
  }

  if (level >= ROLE_HIERARCHY['project_manager']) {
    base['rfis.edit'] = true;
    base['submittals.edit'] = true;
    base['submittals.approve'] = true;
    base['daily_log.approve'] = true;
    base['punch_list.verify'] = true;
    base['drawings.upload'] = true;
    base['files.upload'] = true;
  }

  if (level >= ROLE_HIERARCHY['project_executive']) {
    base['budget.view'] = true;
    base['budget.edit'] = true;
    base['change_orders.approve'] = true;
  }

  return base;
}
