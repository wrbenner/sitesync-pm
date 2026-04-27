import { describe, it, expect } from 'vitest'
import {
  ApiError,
  NetworkError,
  AuthError,
  PermissionError,
  ValidationError,
  NotFoundError,
  RetryableError,
  transformSupabaseError,
  isRetryable,
} from './errors'

describe('errors — ApiError base class', () => {
  it('default constructor sets status=500 / code=UNKNOWN', () => {
    const e = new ApiError('Boom')
    expect(e.status).toBe(500)
    expect(e.code).toBe('UNKNOWN')
    expect(e.name).toBe('ApiError')
  })

  it('humanizes the message into userMessage when no userMessage supplied', () => {
    expect(new ApiError('timeout occurred').userMessage).toMatch(/timed out/i)
    expect(new ApiError('rate limit hit').userMessage).toMatch(/wait a moment/i)
    expect(new ApiError('not null violation').userMessage).toMatch(/required field/i)
    expect(new ApiError('').userMessage).toMatch(/unexpected error/i)
  })

  it('uses the provided userMessage when supplied', () => {
    expect(new ApiError('x', 500, 'X', 'Custom message').userMessage).toBe('Custom message')
  })

  it('a11yMessage prefixes "Error: "', () => {
    const e = new ApiError('boom', 500, 'X', 'Display me')
    expect(e.a11yMessage).toBe('Error: Display me')
  })
})

describe('errors — typed subclasses', () => {
  it('NetworkError is 0/NETWORK_ERROR with retry-friendly message', () => {
    const e = new NetworkError()
    expect(e.status).toBe(0)
    expect(e.code).toBe('NETWORK_ERROR')
    expect(e.userMessage).toMatch(/connect/i)
    expect(e.name).toBe('NetworkError')
  })

  it('AuthError is 401/AUTH_ERROR', () => {
    const e = new AuthError()
    expect(e.status).toBe(401)
    expect(e.code).toBe('AUTH_ERROR')
    expect(e.userMessage).toMatch(/sign in/i)
  })

  it('PermissionError is 403/PERMISSION_ERROR', () => {
    const e = new PermissionError()
    expect(e.status).toBe(403)
    expect(e.code).toBe('PERMISSION_ERROR')
  })

  it('ValidationError is 422 with optional fieldErrors', () => {
    const e = new ValidationError('bad', { name: 'Required' })
    expect(e.status).toBe(422)
    expect(e.code).toBe('VALIDATION_ERROR')
    expect(e.fieldErrors).toEqual({ name: 'Required' })
  })

  it('ValidationError defaults fieldErrors to {}', () => {
    expect(new ValidationError().fieldErrors).toEqual({})
  })

  it('NotFoundError is 404/NOT_FOUND', () => {
    expect(new NotFoundError().status).toBe(404)
    expect(new NotFoundError().code).toBe('NOT_FOUND')
  })

  it('RetryableError is 503/RETRYABLE with default 5s retry-after', () => {
    const e = new RetryableError('flapping')
    expect(e.status).toBe(503)
    expect(e.retryAfterMs).toBe(5000)
  })

  it('RetryableError honours an explicit retryAfterMs', () => {
    expect(new RetryableError('x', 1500).retryAfterMs).toBe(1500)
  })

  it('every subclass remains an instanceof ApiError', () => {
    expect(new NetworkError()).toBeInstanceOf(ApiError)
    expect(new AuthError()).toBeInstanceOf(ApiError)
    expect(new PermissionError()).toBeInstanceOf(ApiError)
    expect(new ValidationError()).toBeInstanceOf(ApiError)
    expect(new NotFoundError()).toBeInstanceOf(ApiError)
    expect(new RetryableError('x')).toBeInstanceOf(ApiError)
  })
})

describe('errors — transformSupabaseError', () => {
  it('rate-limit code 429 → 429 ApiError', () => {
    const e = transformSupabaseError({ message: 'rate limit exceeded', code: '429' })
    expect(e.status).toBe(429)
    expect(e.code).toBe('RATE_LIMITED')
  })

  it('detects rate-limit by message text', () => {
    expect(transformSupabaseError({ message: 'too many requests' }).code).toBe('RATE_LIMITED')
  })

  it('Postgres 57014 → 504 TIMEOUT', () => {
    expect(transformSupabaseError({ message: 'statement timeout', code: '57014' }).code).toBe('TIMEOUT')
  })

  it('payload-too-large → 413 PAYLOAD_TOO_LARGE', () => {
    expect(transformSupabaseError({ message: 'request entity too large' }).code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('storage quota → 507 STORAGE_QUOTA', () => {
    expect(transformSupabaseError({ message: 'storage quota exceeded' }).code).toBe('STORAGE_QUOTA')
  })

  it('PGRST301 (auth) → AuthError', () => {
    const e = transformSupabaseError({ message: 'jwt expired', code: 'PGRST301' })
    expect(e).toBeInstanceOf(AuthError)
    expect(e.status).toBe(401)
  })

  it('Postgres 42501 (RLS) → PermissionError', () => {
    const e = transformSupabaseError({ message: 'policy violation', code: '42501' })
    expect(e).toBeInstanceOf(PermissionError)
    expect(e.status).toBe(403)
  })

  it('PGRST116 (no rows) → NotFoundError', () => {
    expect(transformSupabaseError({ message: 'no rows', code: 'PGRST116' })).toBeInstanceOf(NotFoundError)
  })

  it('Postgres 23505 (unique constraint) → ValidationError with _form message', () => {
    const e = transformSupabaseError({ message: 'duplicate key', code: '23505' })
    expect(e).toBeInstanceOf(ValidationError)
    expect((e as ValidationError).fieldErrors._form).toMatch(/already exists/i)
  })

  it('Postgres 23503 (FK) → ValidationError with _form message', () => {
    const e = transformSupabaseError({ message: 'foreign key violation', code: '23503' })
    expect(e).toBeInstanceOf(ValidationError)
    expect((e as ValidationError).fieldErrors._form).toMatch(/Referenced record/i)
  })

  it('"failed to fetch" → NetworkError', () => {
    const e = transformSupabaseError({ message: 'failed to fetch' })
    expect(e).toBeInstanceOf(NetworkError)
  })

  it('uncategorised error → 500 ApiError with original code', () => {
    const e = transformSupabaseError({ message: 'mystery', code: 'XYZ' })
    expect(e.status).toBe(500)
    expect(e.code).toBe('XYZ')
  })

  it('handles errors with empty message gracefully', () => {
    const e = transformSupabaseError({ message: '' })
    expect(e.status).toBe(500)
    expect(e.userMessage).toBeTruthy()
  })
})

describe('errors — isRetryable', () => {
  it('RetryableError → true', () => {
    expect(isRetryable(new RetryableError('x'))).toBe(true)
  })

  it('NetworkError → true', () => {
    expect(isRetryable(new NetworkError())).toBe(true)
  })

  it('429 ApiError → true', () => {
    expect(isRetryable(new ApiError('x', 429, 'RATE_LIMITED'))).toBe(true)
  })

  it('500 ApiError → false', () => {
    expect(isRetryable(new ApiError('x', 500))).toBe(false)
  })

  it('AuthError (401) → false', () => {
    expect(isRetryable(new AuthError())).toBe(false)
  })

  it('plain Error → false', () => {
    expect(isRetryable(new Error('regular'))).toBe(false)
  })

  it('non-Error values → false', () => {
    expect(isRetryable(null)).toBe(false)
    expect(isRetryable('string')).toBe(false)
    expect(isRetryable(undefined)).toBe(false)
  })
})
