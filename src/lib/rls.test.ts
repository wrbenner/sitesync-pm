import { describe, it, expect, beforeEach } from 'vitest'
import {
  PermissionError,
  setTenantContext,
  clearTenantContext,
  getTenantContext,
  hasPermission,
  type TenantContext,
} from './rls'

beforeEach(() => {
  clearTenantContext()
})

describe('rls — PermissionError', () => {
  it('extends Error with name = "PermissionError"', () => {
    const e = new PermissionError('No access')
    expect(e).toBeInstanceOf(Error)
    expect(e.name).toBe('PermissionError')
    expect(e.message).toBe('No access')
  })

  it('captures the projectId when supplied', () => {
    const e = new PermissionError('Denied', 'proj-1')
    expect(e.projectId).toBe('proj-1')
  })

  it('projectId is undefined when not supplied', () => {
    expect(new PermissionError('x').projectId).toBeUndefined()
  })

  it('is throwable + catchable as PermissionError', () => {
    expect(() => {
      throw new PermissionError('boom', 'p-1')
    }).toThrow(PermissionError)
  })
})

describe('rls — tenant context (lightweight in-memory cache)', () => {
  it('returns the set context', () => {
    const ctx: TenantContext = { companyId: 'c1', projectId: 'p1', userId: 'u1' }
    setTenantContext(ctx)
    expect(getTenantContext()).toEqual(ctx)
  })

  it('overwriting set replaces the cache', () => {
    setTenantContext({ companyId: 'c1', projectId: 'p1', userId: 'u1' })
    setTenantContext({ companyId: 'c2', projectId: 'p2', userId: 'u2' })
    expect(getTenantContext()).toEqual({ companyId: 'c2', projectId: 'p2', userId: 'u2' })
  })

  it('clearTenantContext resets to null', () => {
    setTenantContext({ companyId: 'c1', projectId: 'p1', userId: 'u1' })
    clearTenantContext()
    // In tests Supabase IS configured (test env vars are set), so getTenantContext
    // returns the actual currentContext value (null after clear).
    expect(getTenantContext()).toBeNull()
  })

  it('initial context (after beforeEach clear) is null', () => {
    expect(getTenantContext()).toBeNull()
  })
})

describe('rls — hasPermission', () => {
  it('owner has every permission', () => {
    for (const p of ['view', 'edit', 'approve', 'admin'] as const) {
      expect(hasPermission('owner', p)).toBe(true)
    }
  })

  it('admin has every permission', () => {
    for (const p of ['view', 'edit', 'approve', 'admin'] as const) {
      expect(hasPermission('admin', p)).toBe(true)
    }
  })

  it('project_manager has every permission', () => {
    for (const p of ['view', 'edit', 'approve', 'admin'] as const) {
      expect(hasPermission('project_manager', p)).toBe(true)
    }
  })

  it('superintendent can view/edit/approve but not admin', () => {
    expect(hasPermission('superintendent', 'view')).toBe(true)
    expect(hasPermission('superintendent', 'edit')).toBe(true)
    expect(hasPermission('superintendent', 'approve')).toBe(true)
    expect(hasPermission('superintendent', 'admin')).toBe(false)
  })

  it('subcontractor + member can view/edit but not approve/admin', () => {
    for (const role of ['subcontractor', 'member'] as const) {
      expect(hasPermission(role, 'view')).toBe(true)
      expect(hasPermission(role, 'edit')).toBe(true)
      expect(hasPermission(role, 'approve')).toBe(false)
      expect(hasPermission(role, 'admin')).toBe(false)
    }
  })

  it('viewer can only view', () => {
    expect(hasPermission('viewer', 'view')).toBe(true)
    expect(hasPermission('viewer', 'edit')).toBe(false)
    expect(hasPermission('viewer', 'approve')).toBe(false)
    expect(hasPermission('viewer', 'admin')).toBe(false)
  })

  it('unknown role falls back to viewer permissions (view only)', () => {
    expect(hasPermission('mystery_role', 'view')).toBe(true)
    expect(hasPermission('mystery_role', 'edit')).toBe(false)
  })

  it('empty role string also falls back to viewer', () => {
    expect(hasPermission('', 'view')).toBe(true)
    expect(hasPermission('', 'admin')).toBe(false)
  })
})
