import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  signupSchema,
  magicLinkSchema,
  resetPasswordSchema,
} from './auth'

describe('loginSchema', () => {
  it('accepts a valid email + password', () => {
    expect(() => loginSchema.parse({ email: 'a@b.com', password: 'x' })).not.toThrow()
  })

  it('rejects empty email', () => {
    expect(() => loginSchema.parse({ email: '', password: 'x' }))
      .toThrow(/Email is required/)
  })

  it('rejects malformed email', () => {
    expect(() => loginSchema.parse({ email: 'not-an-email', password: 'x' }))
      .toThrow(/valid email/)
  })

  it('rejects empty password', () => {
    expect(() => loginSchema.parse({ email: 'a@b.com', password: '' }))
      .toThrow(/Password is required/)
  })

  it('login allows short passwords (only signup enforces 8-char min)', () => {
    // Login should accept any non-empty password — old accounts may have
    // legacy short passwords; signup enforces the new minimum.
    expect(() => loginSchema.parse({ email: 'a@b.com', password: '1' })).not.toThrow()
  })
})

describe('signupSchema', () => {
  function valid(overrides: Record<string, string> = {}) {
    return {
      email: 'walker@example.com',
      password: 'long-enough-password',
      confirmPassword: 'long-enough-password',
      firstName: 'Walker',
      lastName: 'Benner',
      organization: 'SiteSync',
      ...overrides,
    }
  }

  it('accepts a valid signup payload', () => {
    expect(() => signupSchema.parse(valid())).not.toThrow()
  })

  it('rejects passwords shorter than 8 characters', () => {
    expect(() =>
      signupSchema.parse(valid({ password: 'short', confirmPassword: 'short' })),
    ).toThrow(/at least 8 characters/)
  })

  it('rejects when password and confirmPassword differ', () => {
    expect(() =>
      signupSchema.parse(valid({ password: 'long-password-1', confirmPassword: 'long-password-2' })),
    ).toThrow(/Passwords do not match/)
  })

  it('attaches the mismatch error to the confirmPassword field path', () => {
    const r = signupSchema.safeParse(valid({ password: 'a-long-password', confirmPassword: 'mismatch' }))
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(['confirmPassword'])
    }
  })

  it('rejects empty firstName / lastName / organization', () => {
    expect(() => signupSchema.parse(valid({ firstName: '' })))
      .toThrow(/First name is required/)
    expect(() => signupSchema.parse(valid({ lastName: '' })))
      .toThrow(/Last name is required/)
    expect(() => signupSchema.parse(valid({ organization: '' })))
      .toThrow(/Organization is required/)
  })

  it('rejects firstName / lastName > 80 chars', () => {
    expect(() => signupSchema.parse(valid({ firstName: 'a'.repeat(81) }))).toThrow()
    expect(() => signupSchema.parse(valid({ lastName: 'a'.repeat(81) }))).toThrow()
  })

  it('jobTitle is optional but capped at 120 chars when supplied', () => {
    expect(() => signupSchema.parse({ ...valid(), jobTitle: '' })).not.toThrow()
    expect(() => signupSchema.parse({ ...valid(), jobTitle: 'PM' })).not.toThrow()
    expect(() => signupSchema.parse({ ...valid(), jobTitle: 'a'.repeat(121) })).toThrow()
  })
})

describe('magicLinkSchema + resetPasswordSchema', () => {
  it('both accept a valid email', () => {
    expect(() => magicLinkSchema.parse({ email: 'a@b.com' })).not.toThrow()
    expect(() => resetPasswordSchema.parse({ email: 'a@b.com' })).not.toThrow()
  })

  it('both reject empty email', () => {
    expect(() => magicLinkSchema.parse({ email: '' })).toThrow(/Email is required/)
    expect(() => resetPasswordSchema.parse({ email: '' })).toThrow(/Email is required/)
  })

  it('both reject malformed email', () => {
    expect(() => magicLinkSchema.parse({ email: 'invalid' })).toThrow(/valid email/)
    expect(() => resetPasswordSchema.parse({ email: 'invalid' })).toThrow(/valid email/)
  })
})
