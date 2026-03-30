import { describe, it, expect } from 'vitest'
import {
  PERMISSION_MATRIX,
  ROLE_LEVELS,
  MODULE_PERMISSIONS,
  DEV_BYPASS_ROLE,
  type ProjectRole,
  type Permission,
} from '../hooks/usePermissions'

// ── Pure function versions of hook logic for testing ─────

function hasPermission(role: ProjectRole, permission: Permission): boolean {
  const allowed = PERMISSION_MATRIX[permission]
  return allowed ? allowed.includes(role) : false
}

function isAtLeast(role: ProjectRole, minRole: ProjectRole): boolean {
  return ROLE_LEVELS[role] >= ROLE_LEVELS[minRole]
}

function canAccessModule(role: ProjectRole, moduleId: string): boolean {
  const permission = MODULE_PERMISSIONS[moduleId]
  if (!permission) return true
  return hasPermission(role, permission)
}

// ── Permission Matrix ────────────────────────────────────

describe('Permission Matrix', () => {
  describe('Owner role', () => {
    it('has access to every permission in the matrix', () => {
      const permissions = Object.keys(PERMISSION_MATRIX) as Permission[]
      for (const perm of permissions) {
        expect(hasPermission('owner', perm)).toBe(true)
      }
    })
  })

  describe('Admin role', () => {
    it('can approve budgets and change orders', () => {
      expect(hasPermission('admin', 'budget.approve')).toBe(true)
      expect(hasPermission('admin', 'change_orders.approve')).toBe(true)
    })
    it('cannot delete projects', () => {
      expect(hasPermission('admin', 'project.delete')).toBe(false)
    })
    it('can manage project members', () => {
      expect(hasPermission('admin', 'project.members')).toBe(true)
    })
    it('can manage org members', () => {
      expect(hasPermission('admin', 'org.members')).toBe(true)
    })
  })

  describe('Project Manager role', () => {
    it('can create tasks and RFIs', () => {
      expect(hasPermission('project_manager', 'tasks.create')).toBe(true)
      expect(hasPermission('project_manager', 'rfis.create')).toBe(true)
    })
    it('can view budget', () => {
      expect(hasPermission('project_manager', 'budget.view')).toBe(true)
    })
    it('cannot approve budget items', () => {
      expect(hasPermission('project_manager', 'budget.approve')).toBe(false)
    })
    it('cannot manage project settings', () => {
      expect(hasPermission('project_manager', 'project.settings')).toBe(false)
    })
    it('can approve daily logs', () => {
      expect(hasPermission('project_manager', 'daily_log.approve')).toBe(true)
    })
    it('can approve submittals', () => {
      expect(hasPermission('project_manager', 'submittals.approve')).toBe(true)
    })
  })

  describe('Superintendent role', () => {
    it('can create daily logs', () => {
      expect(hasPermission('superintendent', 'daily_log.create')).toBe(true)
    })
    it('can create tasks', () => {
      expect(hasPermission('superintendent', 'tasks.create')).toBe(true)
    })
    it('cannot approve budget', () => {
      expect(hasPermission('superintendent', 'budget.approve')).toBe(false)
    })
    it('can view budget but not financials', () => {
      expect(hasPermission('superintendent', 'budget.view')).toBe(true)
      expect(hasPermission('superintendent', 'financials.view')).toBe(false)
    })
    it('cannot approve change orders', () => {
      expect(hasPermission('superintendent', 'change_orders.approve')).toBe(false)
    })
    it('can manage safety', () => {
      expect(hasPermission('superintendent', 'safety.manage')).toBe(true)
    })
  })

  describe('Subcontractor role', () => {
    it('can respond to RFIs', () => {
      expect(hasPermission('subcontractor', 'rfis.respond')).toBe(true)
    })
    it('can submit submittals', () => {
      expect(hasPermission('subcontractor', 'submittals.create')).toBe(true)
    })
    it('cannot view budget', () => {
      expect(hasPermission('subcontractor', 'budget.view')).toBe(false)
    })
    it('cannot create tasks', () => {
      expect(hasPermission('subcontractor', 'tasks.create')).toBe(false)
    })
    it('can view dashboard', () => {
      expect(hasPermission('subcontractor', 'dashboard.view')).toBe(true)
    })
    it('cannot approve anything', () => {
      expect(hasPermission('subcontractor', 'budget.approve')).toBe(false)
      expect(hasPermission('subcontractor', 'change_orders.approve')).toBe(false)
      expect(hasPermission('subcontractor', 'submittals.approve')).toBe(false)
      expect(hasPermission('subcontractor', 'daily_log.approve')).toBe(false)
    })
  })

  describe('Viewer role', () => {
    it('can view dashboard', () => {
      expect(hasPermission('viewer', 'dashboard.view')).toBe(true)
    })
    it('cannot create anything', () => {
      expect(hasPermission('viewer', 'tasks.create')).toBe(false)
      expect(hasPermission('viewer', 'rfis.create')).toBe(false)
      expect(hasPermission('viewer', 'daily_log.create')).toBe(false)
      expect(hasPermission('viewer', 'punch_list.create')).toBe(false)
    })
    it('cannot view budget or financials', () => {
      expect(hasPermission('viewer', 'budget.view')).toBe(false)
      expect(hasPermission('viewer', 'financials.view')).toBe(false)
    })
    it('cannot edit or delete anything', () => {
      expect(hasPermission('viewer', 'tasks.edit')).toBe(false)
      expect(hasPermission('viewer', 'tasks.delete')).toBe(false)
      expect(hasPermission('viewer', 'rfis.edit')).toBe(false)
    })
    it('cannot access admin features', () => {
      expect(hasPermission('viewer', 'project.settings')).toBe(false)
      expect(hasPermission('viewer', 'project.members')).toBe(false)
      expect(hasPermission('viewer', 'org.settings')).toBe(false)
    })
  })
})

// ── Role Hierarchy ───────────────────────────────────────

describe('Role Hierarchy', () => {
  it('owner is at least every role', () => {
    for (const role of ['owner', 'admin', 'project_manager', 'superintendent', 'subcontractor', 'viewer'] as ProjectRole[]) {
      expect(isAtLeast('owner', role)).toBe(true)
    }
  })

  it('viewer is not at least superintendent', () => {
    expect(isAtLeast('viewer', 'superintendent')).toBe(false)
  })

  it('superintendent is at least subcontractor', () => {
    expect(isAtLeast('superintendent', 'subcontractor')).toBe(true)
  })

  it('subcontractor is not at least project_manager', () => {
    expect(isAtLeast('subcontractor', 'project_manager')).toBe(false)
  })

  it('admin is at least project_manager', () => {
    expect(isAtLeast('admin', 'project_manager')).toBe(true)
  })

  it('levels are strictly ordered', () => {
    const roles: ProjectRole[] = ['viewer', 'subcontractor', 'superintendent', 'project_manager', 'admin', 'owner']
    for (let i = 0; i < roles.length - 1; i++) {
      expect(ROLE_LEVELS[roles[i]]).toBeLessThan(ROLE_LEVELS[roles[i + 1]])
    }
  })
})

// ── Dev Bypass Security ──────────────────────────────────

describe('Dev Bypass Security (Bug #1 Fix)', () => {
  it('dev bypass role is viewer, NOT owner', () => {
    expect(DEV_BYPASS_ROLE).toBe('viewer')
  })

  it('dev bypass viewer cannot access admin features', () => {
    expect(hasPermission(DEV_BYPASS_ROLE, 'project.settings')).toBe(false)
    expect(hasPermission(DEV_BYPASS_ROLE, 'project.delete')).toBe(false)
    expect(hasPermission(DEV_BYPASS_ROLE, 'org.settings')).toBe(false)
    expect(hasPermission(DEV_BYPASS_ROLE, 'org.billing')).toBe(false)
  })

  it('dev bypass viewer cannot create entities', () => {
    expect(hasPermission(DEV_BYPASS_ROLE, 'tasks.create')).toBe(false)
    expect(hasPermission(DEV_BYPASS_ROLE, 'rfis.create')).toBe(false)
    expect(hasPermission(DEV_BYPASS_ROLE, 'daily_log.create')).toBe(false)
    expect(hasPermission(DEV_BYPASS_ROLE, 'change_orders.create')).toBe(false)
  })

  it('dev bypass viewer cannot approve anything', () => {
    expect(hasPermission(DEV_BYPASS_ROLE, 'budget.approve')).toBe(false)
    expect(hasPermission(DEV_BYPASS_ROLE, 'change_orders.approve')).toBe(false)
    expect(hasPermission(DEV_BYPASS_ROLE, 'submittals.approve')).toBe(false)
  })

  it('dev bypass viewer CAN view basic pages', () => {
    expect(hasPermission(DEV_BYPASS_ROLE, 'dashboard.view')).toBe(true)
    expect(hasPermission(DEV_BYPASS_ROLE, 'tasks.view')).toBe(true)
    expect(hasPermission(DEV_BYPASS_ROLE, 'rfis.view')).toBe(true)
  })
})

// ── Module Access ────────────────────────────────────────

describe('Module Permissions', () => {
  it('all module IDs map to valid permissions', () => {
    const validPermissions = new Set(Object.keys(PERMISSION_MATRIX))
    for (const [moduleId, permission] of Object.entries(MODULE_PERMISSIONS)) {
      expect(validPermissions.has(permission)).toBe(true)
    }
  })

  it('viewer can access dashboard but not integrations', () => {
    expect(canAccessModule('viewer', 'dashboard')).toBe(true)
    expect(canAccessModule('viewer', 'integrations')).toBe(false)
  })

  it('admin can access all modules', () => {
    for (const moduleId of Object.keys(MODULE_PERMISSIONS)) {
      expect(canAccessModule('admin', moduleId)).toBe(true)
    }
  })

  it('subcontractor cannot access budget or financials', () => {
    expect(canAccessModule('subcontractor', 'budget')).toBe(false)
    expect(canAccessModule('subcontractor', 'financials')).toBe(false)
  })

  it('unknown module IDs default to accessible', () => {
    expect(canAccessModule('viewer', 'some_unknown_module')).toBe(true)
  })
})

// ── Permission Error ─────────────────────────────────────

describe('PermissionError', () => {
  it('can be imported and thrown', async () => {
    const { PermissionError } = await import('../hooks/usePermissions')
    const error = new PermissionError('Not allowed', 'budget.approve')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('PermissionError')
    expect(error.message).toBe('Not allowed')
    expect(error.permission).toBe('budget.approve')
  })
})
