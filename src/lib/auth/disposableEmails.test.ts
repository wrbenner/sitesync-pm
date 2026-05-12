// src/lib/auth/disposableEmails.test.ts — BRT sub-2 §4.3
import { describe, it, expect } from 'vitest'
import { isDisposableEmail, disposableDomainCount } from './disposableEmails'

describe('isDisposableEmail', () => {
  it('rejects known disposable domains', () => {
    expect(isDisposableEmail('foo@mailinator.com')).toBe(true)
    expect(isDisposableEmail('bar@guerrillamail.com')).toBe(true)
    expect(isDisposableEmail('baz@tempmail.org')).toBe(true)
    expect(isDisposableEmail('alice@yopmail.com')).toBe(true)
  })

  it('rejects subdomains of disposable providers', () => {
    expect(isDisposableEmail('user@foo.mailinator.com')).toBe(true)
  })

  it('is case-insensitive on the domain', () => {
    expect(isDisposableEmail('FOO@MailInator.COM')).toBe(true)
  })

  it('allows real provider domains', () => {
    expect(isDisposableEmail('walker@sitesyncai.com')).toBe(false)
    expect(isDisposableEmail('jane@gmail.com')).toBe(false)
    expect(isDisposableEmail('alice@example.org')).toBe(false)
  })

  it('returns false on malformed input', () => {
    expect(isDisposableEmail('')).toBe(false)
    expect(isDisposableEmail('not-an-email')).toBe(false)
    expect(isDisposableEmail('foo@')).toBe(false)
    expect(isDisposableEmail('@example.com')).toBe(false)
  })

  it('counts > 50 domains in the list', () => {
    expect(disposableDomainCount()).toBeGreaterThan(50)
  })
})
