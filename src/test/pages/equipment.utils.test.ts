/**
 * Tests for Equipment page pure utility functions.
 *
 * formatCurrency and the statusBadge color logic are private helpers in
 * Equipment.tsx. This file documents their specified behavior.
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Replicated helpers (mirrors Equipment.tsx)
// ---------------------------------------------------------------------------

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '$0.00'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

/**
 * Derive the color category for a fleet status value.
 * Returns 'active' | 'idle' | 'down' | 'transit' | 'off_site' | 'neutral'.
 */
function resolveStatusCategory(value: string | null | undefined): string {
  const v = (value || '').toLowerCase()
  if (v === 'active' || v === 'operational') return 'active'
  if (v === 'idle') return 'idle'
  if (v === 'maintenance' || v === 'down') return 'down'
  if (v === 'transit' || v === 'in_transit') return 'transit'
  if (v === 'off_site') return 'off_site'
  return 'neutral'
}

/**
 * Derive the color category for a maintenance status value.
 */
function resolveMaintenanceCategory(value: string | null | undefined): string {
  const v = (value || '').toLowerCase()
  if (v === 'completed' || v === 'complete') return 'completed'
  if (v === 'scheduled' || v === 'pending') return 'scheduled'
  if (v === 'overdue') return 'overdue'
  if (v === 'in_progress') return 'in_progress'
  return 'unknown'
}

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------

describe('formatCurrency', () => {
  it('formats a whole dollar amount', () => {
    expect(formatCurrency(1000)).toBe('$1,000.00')
  })

  it('formats a fractional dollar amount', () => {
    expect(formatCurrency(99.5)).toBe('$99.50')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('returns $0.00 for null', () => {
    expect(formatCurrency(null)).toBe('$0.00')
  })

  it('returns $0.00 for undefined', () => {
    expect(formatCurrency(undefined)).toBe('$0.00')
  })

  it('formats large amounts with thousands separator', () => {
    expect(formatCurrency(1_500_000)).toBe('$1,500,000.00')
  })

  it('formats negative values', () => {
    expect(formatCurrency(-250)).toBe('-$250.00')
  })
})

// ---------------------------------------------------------------------------
// Status badge color category — fleet status
// ---------------------------------------------------------------------------

describe('resolveStatusCategory (fleet)', () => {
  it('active maps to active', () => {
    expect(resolveStatusCategory('active')).toBe('active')
  })

  it('operational maps to active', () => {
    expect(resolveStatusCategory('operational')).toBe('active')
  })

  it('idle maps to idle', () => {
    expect(resolveStatusCategory('idle')).toBe('idle')
  })

  it('maintenance maps to down', () => {
    expect(resolveStatusCategory('maintenance')).toBe('down')
  })

  it('down maps to down', () => {
    expect(resolveStatusCategory('down')).toBe('down')
  })

  it('transit maps to transit', () => {
    expect(resolveStatusCategory('transit')).toBe('transit')
  })

  it('in_transit maps to transit', () => {
    expect(resolveStatusCategory('in_transit')).toBe('transit')
  })

  it('off_site maps to off_site', () => {
    expect(resolveStatusCategory('off_site')).toBe('off_site')
  })

  it('null maps to neutral', () => {
    expect(resolveStatusCategory(null)).toBe('neutral')
  })

  it('undefined maps to neutral', () => {
    expect(resolveStatusCategory(undefined)).toBe('neutral')
  })

  it('unknown string maps to neutral', () => {
    expect(resolveStatusCategory('on_break')).toBe('neutral')
  })

  it('is case insensitive', () => {
    expect(resolveStatusCategory('ACTIVE')).toBe('active')
    expect(resolveStatusCategory('Idle')).toBe('idle')
  })
})

// ---------------------------------------------------------------------------
// Status badge color category — maintenance status
// ---------------------------------------------------------------------------

describe('resolveMaintenanceCategory', () => {
  it('completed maps to completed', () => {
    expect(resolveMaintenanceCategory('completed')).toBe('completed')
  })

  it('complete maps to completed', () => {
    expect(resolveMaintenanceCategory('complete')).toBe('completed')
  })

  it('scheduled maps to scheduled', () => {
    expect(resolveMaintenanceCategory('scheduled')).toBe('scheduled')
  })

  it('pending maps to scheduled', () => {
    expect(resolveMaintenanceCategory('pending')).toBe('scheduled')
  })

  it('overdue maps to overdue', () => {
    expect(resolveMaintenanceCategory('overdue')).toBe('overdue')
  })

  it('in_progress maps to in_progress', () => {
    expect(resolveMaintenanceCategory('in_progress')).toBe('in_progress')
  })

  it('null maps to unknown', () => {
    expect(resolveMaintenanceCategory(null)).toBe('unknown')
  })

  it('undefined maps to unknown', () => {
    expect(resolveMaintenanceCategory(undefined)).toBe('unknown')
  })
})
