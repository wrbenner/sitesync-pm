// Typed error hierarchy for the SiteSync API layer.
// Every error has a user-friendly message for toast display.

import type { PostgrestError } from '@supabase/supabase-js'

export class ApiError extends Error {
  status: number
  code: string
  userMessage: string
  a11yMessage: string
  details?: unknown

  constructor(message: string, status = 500, code = 'UNKNOWN', userMessage?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.userMessage = userMessage || humanizeError(message)
    this.a11yMessage = `Error: ${this.userMessage}`
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

export class RetryableError extends ApiError {
  retryAfterMs: number
  constructor(message: string, retryAfterMs = 5000) {
    super(message, 503, 'RETRYABLE', 'Something went wrong. Retrying automatically...')
    this.name = 'RetryableError'
    this.retryAfterMs = retryAfterMs
  }
}

// Convert a raw Supabase/Postgres error into a typed ApiError
export function transformSupabaseError(
  error: PostgrestError | { message: string; code?: string; details?: string | null; hint?: string | null }
): ApiError {
  const msg = error.message?.toLowerCase() || ''
  const code = error.code || ''

  // Rate limiting
  if (code === '429' || msg.includes('rate limit') || msg.includes('too many requests')) {
    return new ApiError(error.message, 429, 'RATE_LIMITED', 'Too many requests. Please wait a moment and try again.')
  }

  // Timeout
  if (msg.includes('timeout') || msg.includes('statement timeout') || code === '57014') {
    return new ApiError(error.message, 504, 'TIMEOUT', 'The request timed out. Please try again.')
  }

  // Payload too large
  if (msg.includes('payload too large') || msg.includes('request entity too large')) {
    return new ApiError(error.message, 413, 'PAYLOAD_TOO_LARGE', 'The file or data is too large. Please reduce the size and try again.')
  }

  // Storage quota
  if (msg.includes('quota') || msg.includes('storage limit')) {
    return new ApiError(error.message, 507, 'STORAGE_QUOTA', 'Storage limit reached. Please contact your administrator.')
  }

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

  return new ApiError(error.message, 500, code, humanizeError(error.message))
}

export function isRetryable(error: unknown): error is RetryableError {
  return (
    error instanceof RetryableError ||
    error instanceof NetworkError ||
    (error instanceof ApiError && error.status === 429)
  )
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
