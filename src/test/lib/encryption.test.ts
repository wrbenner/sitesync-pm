import { describe, it, expect } from 'vitest'
import { isSensitiveField, SENSITIVE_FIELDS } from '../../lib/encryption'

// ── SENSITIVE_FIELDS registry ──────────────────────────────────────────────

describe('SENSITIVE_FIELDS', () => {
  it('should define workers sensitive fields including ssn and tax_id', () => {
    expect(SENSITIVE_FIELDS.workers).toContain('ssn')
    expect(SENSITIVE_FIELDS.workers).toContain('tax_id')
  })

  it('should define contracts sensitive fields', () => {
    expect(SENSITIVE_FIELDS.contracts).toContain('terms')
    expect(SENSITIVE_FIELDS.contracts).toContain('penalty_clauses')
  })

  it('should define budget_items sensitive fields', () => {
    expect(SENSITIVE_FIELDS.budget_items).toContain('negotiated_rate')
    expect(SENSITIVE_FIELDS.budget_items).toContain('margin')
  })

  it('should define change_orders sensitive fields', () => {
    expect(SENSITIVE_FIELDS.change_orders).toContain('internal_cost')
    expect(SENSITIVE_FIELDS.change_orders).toContain('markup')
  })

  it('should be a non-empty record', () => {
    expect(Object.keys(SENSITIVE_FIELDS).length).toBeGreaterThan(0)
  })
})

// ── isSensitiveField ───────────────────────────────────────────────────────

describe('isSensitiveField', () => {
  it('should return true for workers.ssn', () => {
    expect(isSensitiveField('workers', 'ssn')).toBe(true)
  })

  it('should return true for workers.tax_id', () => {
    expect(isSensitiveField('workers', 'tax_id')).toBe(true)
  })

  it('should return true for contracts.terms', () => {
    expect(isSensitiveField('contracts', 'terms')).toBe(true)
  })

  it('should return true for contracts.penalty_clauses', () => {
    expect(isSensitiveField('contracts', 'penalty_clauses')).toBe(true)
  })

  it('should return true for budget_items.negotiated_rate', () => {
    expect(isSensitiveField('budget_items', 'negotiated_rate')).toBe(true)
  })

  it('should return true for budget_items.margin', () => {
    expect(isSensitiveField('budget_items', 'margin')).toBe(true)
  })

  it('should return true for change_orders.internal_cost', () => {
    expect(isSensitiveField('change_orders', 'internal_cost')).toBe(true)
  })

  it('should return true for change_orders.markup', () => {
    expect(isSensitiveField('change_orders', 'markup')).toBe(true)
  })

  it('should return false for non-sensitive field on known entity', () => {
    expect(isSensitiveField('workers', 'name')).toBe(false)
    expect(isSensitiveField('workers', 'trade')).toBe(false)
    expect(isSensitiveField('contracts', 'title')).toBe(false)
  })

  it('should return false for unknown entity type', () => {
    expect(isSensitiveField('rfis', 'title')).toBe(false)
    expect(isSensitiveField('tasks', 'description')).toBe(false)
    expect(isSensitiveField('unknown_table', 'any_field')).toBe(false)
  })

  it('should return false for empty entity type', () => {
    expect(isSensitiveField('', 'ssn')).toBe(false)
  })

  it('should return false for empty field name on sensitive entity', () => {
    expect(isSensitiveField('workers', '')).toBe(false)
  })
})
