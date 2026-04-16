export type ErrorCategory =
  | 'ValidationError'
  | 'PermissionError'
  | 'DatabaseError'
  | 'NotFoundError'
  | 'ConflictError';

export interface ServiceError {
  category: ErrorCategory;
  code: string;
  message: string;
  userMessage: string;
  context?: Record<string, unknown>;
}

export type Result<T = void> = {
  data: T | null;
  error: ServiceError | null;
};

export function ok<T>(data: T): Result<T> {
  return { data, error: null };
}

export function fail(error: ServiceError): { data: null; error: ServiceError } {
  return { data: null, error };
}

export function dbError(
  message: string,
  context?: Record<string, unknown>,
): ServiceError {
  return {
    category: 'DatabaseError',
    code: 'DB_ERROR',
    message,
    userMessage: 'A database error occurred. Please try again.',
    context,
  };
}

export function permissionError(message: string): ServiceError {
  return {
    category: 'PermissionError',
    code: 'PERMISSION_DENIED',
    message,
    userMessage: 'You do not have permission to perform this action.',
  };
}

export function notFoundError(entity: string, id?: string): ServiceError {
  return {
    category: 'NotFoundError',
    code: 'NOT_FOUND',
    message: `${entity} not found${id ? ` (id: ${id})` : ''}`,
    userMessage: `${entity} could not be found. It may have been deleted.`,
    context: id ? { id } : undefined,
  };
}

export function validationError(
  message: string,
  context?: Record<string, unknown>,
): ServiceError {
  return {
    category: 'ValidationError',
    code: 'INVALID_TRANSITION',
    message,
    userMessage: message,
    context,
  };
}

export function conflictError(
  message: string,
  context?: Record<string, unknown>,
): ServiceError {
  return {
    category: 'ConflictError',
    code: 'CONFLICT',
    message,
    userMessage: message,
    context,
  };
}
