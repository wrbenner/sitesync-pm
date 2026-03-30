import { describe, it, expect } from 'vitest'
import { ApiError, NetworkError, AuthError, PermissionError, ValidationError, NotFoundError, transformSupabaseError } from '../../api/errors'

describe('Error Hierarchy', () => {
  it('ApiError has status and userMessage', () => {
    const err = new ApiError('test', 500, 'TEST', 'User friendly message')
    expect(err.status).toBe(500)
    expect(err.code).toBe('TEST')
    expect(err.userMessage).toBe('User friendly message')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ApiError)
  })

  it('NetworkError has status 0', () => {
    const err = new NetworkError()
    expect(err.status).toBe(0)
    expect(err.userMessage).toContain('connect')
  })

  it('AuthError has status 401', () => {
    const err = new AuthError()
    expect(err.status).toBe(401)
    expect(err.userMessage).toContain('session')
  })

  it('PermissionError has status 403', () => {
    const err = new PermissionError()
    expect(err.status).toBe(403)
    expect(err.userMessage).toContain('permission')
  })

  it('ValidationError has field errors', () => {
    const err = new ValidationError('test', { email: 'Required' })
    expect(err.status).toBe(422)
    expect(err.fieldErrors.email).toBe('Required')
  })

  it('NotFoundError has status 404', () => {
    const err = new NotFoundError()
    expect(err.status).toBe(404)
  })
})

describe('transformSupabaseError', () => {
  it('maps JWT errors to AuthError', () => {
    const err = transformSupabaseError({ message: 'JWT expired', code: 'PGRST301' })
    expect(err).toBeInstanceOf(AuthError)
    expect(err.status).toBe(401)
  })

  it('maps permission errors to PermissionError', () => {
    const err = transformSupabaseError({ message: 'permission denied', code: '42501' })
    expect(err).toBeInstanceOf(PermissionError)
    expect(err.status).toBe(403)
  })

  it('maps not found to NotFoundError', () => {
    const err = transformSupabaseError({ message: 'no rows returned', code: 'PGRST116' })
    expect(err).toBeInstanceOf(NotFoundError)
    expect(err.status).toBe(404)
  })

  it('maps duplicate key to ValidationError', () => {
    const err = transformSupabaseError({ message: 'duplicate key value', code: '23505' })
    expect(err).toBeInstanceOf(ValidationError)
    expect(err.status).toBe(422)
  })

  it('maps network errors to NetworkError', () => {
    const err = transformSupabaseError({ message: 'Failed to fetch' })
    expect(err).toBeInstanceOf(NetworkError)
    expect(err.status).toBe(0)
  })

  it('maps unknown errors to ApiError', () => {
    const err = transformSupabaseError({ message: 'Something unexpected' })
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(500)
  })
})
