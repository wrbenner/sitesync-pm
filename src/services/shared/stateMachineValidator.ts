import type { RFIState } from '../../machines/rfiMachine';
import { getValidRfiStatusTransitions } from '../../machines/rfiMachine';
import type { TaskState } from '../../machines/taskMachine';
import { getValidTaskStatusTransitions } from '../../machines/taskMachine';
import type { SubmittalState } from '../../machines/submittalMachine';
import { getValidSubmittalStatusTransitions } from '../../machines/submittalMachine';
import type { ChangeOrderState } from '../../machines/changeOrderMachine';
import { getValidCOTransitionsForRole } from '../../machines/changeOrderMachine';
import type { PunchItemState } from '../../machines/punchItemMachine';
import { getValidPunchStatusTransitions } from '../../machines/punchItemMachine';
import { validationError, type ServiceError } from '../errors';

export type LifecycleEntity =
  | 'rfi'
  | 'task'
  | 'submittal'
  | 'change_order'
  | 'punch_item';

/**
 * Validate a lifecycle status transition against the entity's state machine definition.
 *
 * Returns null if the transition is valid.
 * Returns a ServiceError describing the violation if invalid.
 *
 * All service methods that update status fields MUST call this before persisting.
 * Centralising validation here ensures every entity enforces the same machine definitions
 * and produces consistent, human-readable error messages.
 */
export function validateStatusTransition(
  entity: LifecycleEntity,
  currentStatus: string,
  newStatus: string,
  role: string,
): ServiceError | null {
  const validTargets = resolveValidTargets(entity, currentStatus, role);

  if (!validTargets.includes(newStatus)) {
    const label = entity.replace(/_/g, ' ');
    return validationError(
      `Invalid ${label} transition: ${currentStatus} \u2192 ${newStatus} (role: ${role}). Valid: ${validTargets.join(', ') || '(none)'}`,
      { entity, currentStatus, newStatus, role, validTargets },
    );
  }

  return null;
}

function resolveValidTargets(
  entity: LifecycleEntity,
  currentStatus: string,
  role: string,
): string[] {
  switch (entity) {
    case 'rfi':
      return getValidRfiStatusTransitions(currentStatus as RFIState, role);
    case 'task':
      return getValidTaskStatusTransitions(currentStatus as TaskState, role);
    case 'submittal':
      return getValidSubmittalStatusTransitions(currentStatus as SubmittalState, role);
    case 'change_order':
      return getValidCOTransitionsForRole(currentStatus as ChangeOrderState, role);
    case 'punch_item':
      return getValidPunchStatusTransitions(currentStatus as PunchItemState, role);
    default:
      return [];
  }
}
