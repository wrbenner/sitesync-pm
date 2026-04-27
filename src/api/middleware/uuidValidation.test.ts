import { describe, it, expect } from 'vitest'
import { validateProjectId } from './projectScope'
import { validateOrgId } from './organizationScope'
import { ValidationError } from '../errors'

// Both validators guard every scoped query at the API boundary. A regression
// that accepts malformed IDs would let SQL injection-shaped strings reach
// Supabase RLS — which would reject them, but only AFTER the round-trip.
// More dangerous: a regression that REJECTS valid IDs blocks legitimate
// users from their own data.

const VALID_V4 = '00000000-0000-4000-8000-000000000001'
const VALID_V4_UPPERCASE = '00000000-0000-4000-8000-00000000000A'
const VALID_V4_MIXED = '12345678-90ab-4cde-89af-deadbeef1234'

describe('validateProjectId — accepts valid UUID v4', () => {
  it.each([
    VALID_V4,
    VALID_V4_UPPERCASE,
    VALID_V4_MIXED,
    '12345678-90ab-4cde-9012-123456789012',  // [89ab] = 9
    '12345678-90ab-4cde-a012-123456789012',  // [89ab] = a
    '12345678-90ab-4cde-b012-123456789012',  // [89ab] = b
  ])('%s passes validation', (id) => {
    expect(() => validateProjectId(id)).not.toThrow()
  })
})

describe('validateProjectId — rejects malformed IDs with ValidationError', () => {
  it.each([
    '',
    'not-a-uuid',
    '12345678-90ab-4cde-9012-12345678901',     // 11 chars in last group (too short)
    '12345678-90ab-4cde-9012-1234567890123',   // 13 chars in last group (too long)
    '12345678-90ab-3cde-9012-123456789012',    // version digit = 3 (must be 4)
    '12345678-90ab-5cde-9012-123456789012',    // version digit = 5 (must be 4)
    '12345678-90ab-4cde-c012-123456789012',    // variant digit = c (must be 8/9/a/b)
    '12345678-90ab-4cde-7012-123456789012',    // variant digit = 7
    '12345678 90ab 4cde 9012 123456789012',    // spaces instead of dashes
    '12345678_90ab_4cde_9012_123456789012',    // underscores instead of dashes
    '"; DROP TABLE projects; --',               // SQL-injection shape
    '<script>alert(1)</script>',                // XSS shape
    'NaN',
    'undefined',
    'null',
  ])('"%s" throws ValidationError', (id) => {
    expect(() => validateProjectId(id)).toThrow(ValidationError)
  })

  it('throws specifically with a "Invalid project ID" message', () => {
    try {
      validateProjectId('bad')
      expect.fail('expected throw')
    } catch (e) {
      expect((e as Error).message).toMatch(/Invalid project ID/i)
    }
  })

  it('throws with a fieldErrors entry for the projectId field', () => {
    try {
      validateProjectId('bad')
      expect.fail('expected throw')
    } catch (e) {
      const ve = e as ValidationError
      expect(ve.fieldErrors?.projectId).toMatch(/UUID v4/i)
    }
  })
})

describe('validateOrgId — accepts valid UUIDs', () => {
  it.each([VALID_V4, VALID_V4_UPPERCASE, VALID_V4_MIXED])('%s passes', (id) => {
    expect(() => validateOrgId(id)).not.toThrow()
  })
})

describe('validateOrgId — rejects malformed IDs', () => {
  it.each([
    '',
    'org-1',
    '12345',
    'INVALID',
    '12345678-90ab-3cde-9012-123456789012',    // version digit ≠ 4
    'NaN',
  ])('"%s" throws', (id) => {
    expect(() => validateOrgId(id)).toThrow(/Invalid organization ID/i)
  })
})

describe('UUID v4 strictness — both validators agree on edge cases', () => {
  it('uppercase A-F is accepted (case-insensitive)', () => {
    const upper = '12345678-90AB-4CDE-A012-123456789012'
    expect(() => validateProjectId(upper)).not.toThrow()
    expect(() => validateOrgId(upper)).not.toThrow()
  })

  it('all-zeros UUID v4 (a documented edge case) is structurally valid', () => {
    // 00000000-0000-4000-8000-000000000000 has version=4, variant=8 → valid v4 shape.
    expect(() => validateProjectId('00000000-0000-4000-8000-000000000000')).not.toThrow()
  })

  it('UUID v1 is rejected by both validators (version digit ≠ 4)', () => {
    const v1 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
    expect(() => validateProjectId(v1)).toThrow()
    expect(() => validateOrgId(v1)).toThrow()
  })
})
