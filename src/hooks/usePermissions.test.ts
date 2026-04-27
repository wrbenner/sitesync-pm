import { describe, it, expect } from 'vitest'
import {
  ROLE_LEVELS,
  ROLE_HIERARCHY,
  PERMISSION_MATRIX,
  MODULE_PERMISSIONS,
  PermissionError,
  type Permission,
  type ProjectRole,
} from './usePermissions'

// PERMISSION_MATRIX is the master security table for the entire app.
// Every page guard, button enable/disable, and API route check ultimately
// reads from this table. A regression here is a real security hole.

describe('usePermissions — ROLE_LEVELS', () => {
  it('owner and project_executive share the top level (7)', () => {
    expect(ROLE_LEVELS.owner).toBe(7)
    expect(ROLE_LEVELS.project_executive).toBe(7)
  })

  it('admin = 6, project_manager = 5, superintendent = 4', () => {
    expect(ROLE_LEVELS.admin).toBe(6)
    expect(ROLE_LEVELS.project_manager).toBe(5)
    expect(ROLE_LEVELS.superintendent).toBe(4)
  })

  it('viewer is the lowest tier (1)', () => {
    expect(ROLE_LEVELS.viewer).toBe(1)
    for (const [role, level] of Object.entries(ROLE_LEVELS)) {
      if (role === 'viewer') continue
      expect(level).toBeGreaterThanOrEqual(1)
    }
  })

  it('every level is a positive integer', () => {
    for (const [role, level] of Object.entries(ROLE_LEVELS)) {
      expect(Number.isInteger(level), `${role} level must be integer`).toBe(true)
      expect(level).toBeGreaterThan(0)
    }
  })

  it('ROLE_HIERARCHY is the same object as ROLE_LEVELS (alias)', () => {
    expect(ROLE_HIERARCHY).toBe(ROLE_LEVELS)
  })
})

describe('usePermissions — PERMISSION_MATRIX shape invariants', () => {
  it('every permission has at least one role granted', () => {
    for (const [perm, roles] of Object.entries(PERMISSION_MATRIX)) {
      expect(roles.length, `${perm} has no roles granted (orphan permission)`).toBeGreaterThan(0)
    }
  })

  it('every role string in the matrix is a valid ProjectRole', () => {
    const validRoles = new Set(Object.keys(ROLE_LEVELS))
    for (const [perm, roles] of Object.entries(PERMISSION_MATRIX)) {
      for (const role of roles) {
        expect(
          validRoles.has(role),
          `${perm} grants to unknown role "${role}"`,
        ).toBe(true)
      }
    }
  })

  it('owner has every documented permission', () => {
    for (const [perm, roles] of Object.entries(PERMISSION_MATRIX)) {
      expect(roles, `owner missing from ${perm}`).toContain('owner')
    }
  })

  it('viewer can only have *.view permissions (read-only invariant)', () => {
    for (const [perm, roles] of Object.entries(PERMISSION_MATRIX)) {
      if (!roles.includes('viewer' as ProjectRole)) continue
      expect(
        perm.endsWith('.view') || perm === 'files.download',
        `viewer was granted write permission "${perm}"`,
      ).toBe(true)
    }
  })

  it('project.delete is owner-only (highest-stakes destructive op)', () => {
    expect(PERMISSION_MATRIX['project.delete']).toEqual(['owner'])
  })

  it('org.settings + org.billing are owner-only', () => {
    expect(PERMISSION_MATRIX['org.settings']).toEqual(['owner'])
    expect(PERMISSION_MATRIX['org.billing']).toEqual(['owner'])
  })

  it('change_orders.approve and budget.approve are owner-or-admin only', () => {
    expect(PERMISSION_MATRIX['change_orders.approve']).toEqual(['owner', 'admin'])
    expect(PERMISSION_MATRIX['budget.approve']).toEqual(['owner', 'admin'])
  })

  it('rfis.void is owner-or-admin only', () => {
    expect(PERMISSION_MATRIX['rfis.void']).toEqual(['owner', 'admin'])
  })

  it('subcontractors can submit submittals + respond to RFIs but not approve', () => {
    expect(PERMISSION_MATRIX['rfis.respond']).toContain('subcontractor')
    expect(PERMISSION_MATRIX['submittals.create']).toContain('subcontractor')
    expect(PERMISSION_MATRIX['submittals.approve']).not.toContain('subcontractor')
    expect(PERMISSION_MATRIX['change_orders.approve']).not.toContain('subcontractor')
  })

  it('viewer cannot perform any destructive operation', () => {
    const destructive: Permission[] = [
      'tasks.delete', 'rfis.delete', 'submittals.delete', 'change_orders.delete',
      'punch_list.delete', 'drawings.delete', 'files.delete', 'meetings.delete',
      'project.delete',
    ]
    for (const perm of destructive) {
      expect(
        PERMISSION_MATRIX[perm],
        `viewer should not have ${perm}`,
      ).not.toContain('viewer' as ProjectRole)
    }
  })

  it('subcontractor cannot delete or approve anything', () => {
    for (const [perm, roles] of Object.entries(PERMISSION_MATRIX)) {
      if (!perm.endsWith('.delete') && !perm.endsWith('.approve')) continue
      expect(
        roles,
        `subcontractor should not have ${perm}`,
      ).not.toContain('subcontractor' as ProjectRole)
    }
  })
})

describe('usePermissions — MODULE_PERMISSIONS', () => {
  it('every module-permission value is a documented Permission key', () => {
    const validPerms = new Set(Object.keys(PERMISSION_MATRIX))
    for (const [moduleId, perm] of Object.entries(MODULE_PERMISSIONS)) {
      expect(
        validPerms.has(perm),
        `module "${moduleId}" maps to undefined permission "${perm}"`,
      ).toBe(true)
    }
  })
})

describe('usePermissions — PermissionError', () => {
  it('extends Error with name = "PermissionError"', () => {
    const e = new PermissionError('No access')
    expect(e).toBeInstanceOf(Error)
    expect(e.name).toBe('PermissionError')
    expect(e.message).toBe('No access')
  })

  it('captures the permission key when supplied', () => {
    const e = new PermissionError('Denied', 'rfis.delete')
    expect(e.permission).toBe('rfis.delete')
  })

  it('permission is undefined when not supplied', () => {
    expect(new PermissionError('x').permission).toBeUndefined()
  })

  it('is throwable + catchable as PermissionError', () => {
    expect(() => {
      throw new PermissionError('boom', 'p')
    }).toThrow(PermissionError)
  })
})
