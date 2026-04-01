import { describe, it, expect } from 'vitest'
import {
  ApiError,
  NetworkError,
  AuthError,
  PermissionError,
  ValidationError,
  NotFoundError,
  transformSupabaseError,
} from '../../api/errors'

describe('API Error Classes', () => {
  describe('ApiError', () => {
    it('creates with default values', () => {
      const err = new ApiError('test error')
      expect(err.message).toBe('test error')
      expect(err.status).toBe(500)
      expect(err.code).toBe('UNKNOWN')
      expect(err.userMessage).toBeTruthy()
      expect(err.name).toBe('ApiError')
    })

    it('creates with custom values', () => {
      const err = new ApiError('test', 400, 'BAD_REQUEST', 'Something went wrong', { field: 'name' })
      expect(err.status).toBe(400)
      expect(err.code).toBe('BAD_REQUEST')
      expect(err.userMessage).toBe('Something went wrong')
      expect(err.details).toEqual({ field: 'name' })
    })

    it('is an instance of Error', () => {
      const err = new ApiError('test')
      expect(err).toBeInstanceOf(Error)
      expect(err).toBeInstanceOf(ApiError)
    })
  })

  describe('NetworkError', () => {
    it('has status 0', () => {
      const err = new NetworkError()
      expect(err.status).toBe(0)
      expect(err.code).toBe('NETWORK_ERROR')
      expect(err.userMessage).toContain('internet')
    })
  })

  describe('AuthError', () => {
    it('has status 401', () => {
      const err = new AuthError()
      expect(err.status).toBe(401)
      expect(err.code).toBe('AUTH_ERROR')
      expect(err.userMessage).toContain('session')
    })
  })

  describe('PermissionError', () => {
    it('has status 403', () => {
      const err = new PermissionError()
      expect(err.status).toBe(403)
      expect(err.code).toBe('PERMISSION_ERROR')
      expect(err.userMessage).toContain('permission')
    })
  })

  describe('ValidationError', () => {
    it('has status 422 and field errors', () => {
      const err = new ValidationError('invalid data', { name: 'Name is required' })
      expect(err.status).toBe(422)
      expect(err.code).toBe('VALIDATION_ERROR')
      expect(err.fieldErrors).toEqual({ name: 'Name is required' })
    })

    it('defaults to empty field errors', () => {
      const err = new ValidationError()
      expect(err.fieldErrors).toEqual({})
    })
  })

  describe('NotFoundError', () => {
    it('has status 404', () => {
      const err = new NotFoundError()
      expect(err.status).toBe(404)
      expect(err.code).toBe('NOT_FOUND')
      expect(err.userMessage).toContain('not found')
    })
  })
})

describe('transformSupabaseError', () => {
  it('transforms JWT errors to AuthError', () => {
    const err = transformSupabaseError({ message: 'JWT expired', code: 'PGRST301' })
    expect(err).toBeInstanceOf(AuthError)
    expect(err.status).toBe(401)
  })

  it('transforms token errors to AuthError', () => {
    const err = transformSupabaseError({ message: 'invalid token provided' })
    expect(err).toBeInstanceOf(AuthError)
  })

  it('transforms RLS policy errors to PermissionError', () => {
    const err = transformSupabaseError({ message: 'new row violates row-level security policy', code: '42501' })
    expect(err).toBeInstanceOf(PermissionError)
    expect(err.status).toBe(403)
  })

  it('transforms permission keyword to PermissionError', () => {
    const err = transformSupabaseError({ message: 'permission denied for table rfis' })
    expect(err).toBeInstanceOf(PermissionError)
  })

  it('transforms not found to NotFoundError', () => {
    const err = transformSupabaseError({ message: 'no rows returned', code: 'PGRST116' })
    expect(err).toBeInstanceOf(NotFoundError)
    expect(err.status).toBe(404)
  })

  it('transforms unique constraint to ValidationError', () => {
    const err = transformSupabaseError({ message: 'duplicate key value violates unique constraint', code: '23505' })
    expect(err).toBeInstanceOf(ValidationError)
    expect((err as ValidationError).fieldErrors._form).toContain('already exists')
  })

  it('transforms foreign key to ValidationError', () => {
    const err = transformSupabaseError({ message: 'foreign key constraint failed', code: '23503' })
    expect(err).toBeInstanceOf(ValidationError)
    expect((err as ValidationError).fieldErrors._form).toContain('does not exist')
  })

  it('transforms network errors to NetworkError', () => {
    const err = transformSupabaseError({ message: 'Failed to fetch' })
    expect(err).toBeInstanceOf(NetworkError)
    expect(err.status).toBe(0)
  })

  it('returns generic ApiError for unknown errors', () => {
    const err = transformSupabaseError({ message: 'something weird happened', code: '99999' })
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(500)
  })

  it('handles empty message gracefully', () => {
    const err = transformSupabaseError({ message: '' })
    expect(err).toBeInstanceOf(ApiError)
    expect(err.userMessage).toBeTruthy()
  })

  it('does not propagate hint field from Supabase errors', () => {
    const err = transformSupabaseError({
      message: 'query error',
      code: '99999',
      hint: 'Check the index on column user_id in table audit_log',
    })
    expect((err as unknown as Record<string, unknown>).hint).toBeUndefined()
    expect(err.userMessage).not.toContain('user_id')
    expect(err.userMessage).not.toContain('audit_log')
    expect(err.details).toBeUndefined()
  })

  it('humanizes timeout messages', () => {
    const err = transformSupabaseError({ message: 'query timeout after 5000ms' })
    expect(err.userMessage).toContain('timed out')
  })

  it('humanizes rate limit messages', () => {
    const err = transformSupabaseError({ message: 'rate limit exceeded' })
    expect(err.userMessage).toContain('Too many requests')
  })

  it('humanizes not null messages', () => {
    const err = transformSupabaseError({ message: 'not null violation on column title' })
    expect(err.userMessage).toContain('required field')
  })
})

describe('auditTrail error transformation', () => {
  it('does not expose table names in userMessage for generic DB errors', () => {
    const err = transformSupabaseError({
      message: 'relation "audit_log" does not exist',
      code: '42P01',
      details: 'ERROR: relation "audit_log" does not exist at character 15',
    })
    expect(err).toBeInstanceOf(ApiError)
    expect(err.userMessage).not.toContain('audit_log')
    expect(err.userMessage).not.toContain('relation')
  })

  it('does not expose SQL details in userMessage for PostgREST errors', () => {
    const err = transformSupabaseError({
      message: 'permission denied for table audit_log',
      code: '42501',
      details: null,
    })
    expect(err).toBeInstanceOf(PermissionError)
    expect(err.userMessage).not.toContain('audit_log')
    expect(err.userMessage).not.toContain('table')
  })

  it('returns safe fallback message for unknown audit query errors', () => {
    const err = transformSupabaseError({
      message: 'canceling statement due to conflict with recovery on table "public.audit_log"',
      code: '40001',
    })
    expect(err).toBeInstanceOf(ApiError)
    expect(err.userMessage).not.toContain('audit_log')
    expect(err.userMessage).not.toContain('public.')
  })

  it('exposes userMessage suitable for toast display', () => {
    const err = transformSupabaseError({ message: 'could not connect to server' })
    expect(err.userMessage).toBeTruthy()
    expect(typeof err.userMessage).toBe('string')
    expect(err.userMessage.length).toBeGreaterThan(0)
  })

  it('transformed audit errors always have message and code properties', () => {
    const inputs = [
      { message: 'relation "audit_log" does not exist', code: '42P01' },
      { message: 'permission denied for table audit_log', code: '42501' },
      { message: 'canceling statement due to conflict with recovery on table "public.audit_log"', code: '40001' },
    ]
    for (const input of inputs) {
      const err = transformSupabaseError(input)
      expect(typeof err.message).toBe('string')
      expect(err.message.length).toBeGreaterThan(0)
      expect(typeof err.code).toBe('string')
      expect(err.code.length).toBeGreaterThan(0)
    }
  })

  it('unauthorized audit trail access throws ApiError with status 403', () => {
    const err = new ApiError('You do not have access to this project', 403, 'FORBIDDEN')
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(403)
    expect(typeof err.message).toBe('string')
    expect(typeof err.code).toBe('string')
    expect(err.userMessage).not.toContain('audit_log')
  })
})
