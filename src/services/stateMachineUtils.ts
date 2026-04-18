import { supabase } from '../lib/supabase';
import { validationError, type ServiceError } from './errors';

export interface TransitionLogParams {
  entityType: string;
  entityId: string;
  projectId: string;
  userId: string | null;
  currentState: string;
  newState: string;
  role: string;
}

/**
 * Validates that newState is a valid target from currentState.
 * Returns a ServiceError if the transition is invalid, null if valid.
 */
export function validateTransition<S extends string>(
  entityType: string,
  currentState: S,
  newState: S,
  validTargets: S[],
): ServiceError | null {
  if (!validTargets.includes(newState)) {
    const validList = validTargets.length > 0 ? validTargets.join(', ') : 'none';
    return validationError(
      `Invalid transition: "${currentState}" → "${newState}" is not allowed for ${entityType}. Valid targets: [${validList}]`,
      { entityType, currentState, newState, validTargets },
    );
  }
  return null;
}

/**
 * Writes a status_change entry to audit_log.
 * Non-blocking — swallows all errors so the caller's mutation always succeeds.
 */
export async function logTransition(params: TransitionLogParams): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      entity_type: params.entityType,
      entity_id: params.entityId,
      project_id: params.projectId,
      user_id: params.userId,
      action: 'status_change',
      before_state: { status: params.currentState },
      after_state: { status: params.newState },
      metadata: {
        role: params.role,
        transition: `${params.currentState} → ${params.newState}`,
      },
    });
  } catch {
    // Audit log failure is non-fatal — mutation already succeeded
  }
}
