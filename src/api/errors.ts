// Typed error hierarchy for the SiteSync API layer.
// Every error has a user-friendly message for toast display.

export class ApiError extends Error {
  status: number
  code: string
  userMessage: string
  details?: unknown

  constructor(message: string, status = 500, code = 'UNKNOWN', userMessage?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.userMessage = userMessage || humanizeError(message)
    this.details = details
  }
}

export class NetworkError extends ApiError {
  constructor(message = 'Network request failed') {
    super(message, 0, 'NETWORK_ERROR', 'Unable to connect. Check your internet connection.')
    this.name = 'NetworkError'
  }
}

export class AuthError extends ApiError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTH_ERROR', 'Your session has expired. Please sign in again.')
    this.name = 'AuthError'
  }
}

export class PermissionError extends ApiError {
  constructor(message = 'Access denied') {
    super(message, 403, 'PERMISSION_ERROR', 'You do not have permission to perform this action.')
    this.name = 'PermissionError'
  }
}

export class ValidationError extends ApiError {
  fieldErrors: Record<string, string>
  constructor(message = 'Validation failed', fieldErrors: Record<string, string> = {}) {
    super(message, 422, 'VALIDATION_ERROR', 'Please check your input and try again.')
    this.name = 'ValidationError'
    this.fieldErrors = fieldErrors
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND', 'The requested item was not found.')
    this.name = 'NotFoundError'
  }
}

// Convert a raw Supabase/Postgres error into a typed ApiError
export function transformSupabaseError(error: { message: string; code?: string; details?: string | null }): ApiError {
  const msg = error.message?.toLowerCase() || ''
  const code = error.code || ''

  // Auth errors
  if (code === 'PGRST301' || msg.includes('jwt') || msg.includes('token')) {
    return new AuthError(error.message)
  }

  // RLS / permission errors
  if (code === '42501' || msg.includes('policy') || msg.includes('permission')) {
    return new PermissionError(error.message)
  }

  // Not found
  if (code === 'PGRST116' || msg.includes('no rows')) {
    return new NotFoundError(error.message)
  }

  // Unique constraint
  if (code === '23505' || msg.includes('duplicate') || msg.includes('unique')) {
    return new ValidationError(error.message, { _form: 'A record with this information already exists.' })
  }

  // Foreign key
  if (code === '23503' || msg.includes('foreign key')) {
    return new ValidationError(error.message, { _form: 'Referenced record does not exist.' })
  }

  // Network
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
    return new NetworkError(error.message)
  }

  return new ApiError(error.message, 500, code, humanizeError(error.message), error.details)
}

// Convert technical error messages into user-friendly text
function humanizeError(message: string): string {
  if (!message) return 'An unexpected error occurred. Please try again.'
  const msg = message.toLowerCase()
  if (msg.includes('timeout')) return 'The request timed out. Please try again.'
  if (msg.includes('rate limit')) return 'Too many requests. Please wait a moment and try again.'
  if (msg.includes('not null')) return 'A required field is missing. Please fill in all required fields.'
  if (msg.includes('check constraint')) return 'Invalid value provided. Please check your input.'
  return 'Something went wrong. Please try again.'
}
