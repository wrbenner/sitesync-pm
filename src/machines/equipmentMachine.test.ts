import { describe, it, expect } from 'vitest'
import {
  getValidEquipmentTransitions,
  isValidEquipmentTransition,
  getEquipmentStatusConfig,
  getMaintenanceStatusConfig,
  canCheckout,
  canScheduleMaintenance,
  canRetire,
} from './equipmentMachine'

describe('equipmentMachine — getValidEquipmentTransitions (role-gated)', () => {
  it('non-management roles get nothing', () => {
    expect(getValidEquipmentTransitions('idle', 'viewer')).toEqual([])
    expect(getValidEquipmentTransitions('active', 'subcontractor')).toEqual([])
  })

  it('foreman can move idle → active/maintenance/transit but cannot retire', () => {
    const r = getValidEquipmentTransitions('idle', 'foreman')
    expect(r).toEqual(expect.arrayContaining(['active', 'maintenance', 'transit']))
    expect(r).not.toContain('retired')
  })

  it('PM can retire equipment', () => {
    const r = getValidEquipmentTransitions('idle', 'project_manager')
    expect(r).toContain('retired')
  })

  it('admin and owner have the full transition set', () => {
    expect(getValidEquipmentTransitions('idle', 'admin')).toContain('retired')
    expect(getValidEquipmentTransitions('idle', 'owner')).toContain('retired')
  })

  it('retired is terminal — no transitions out', () => {
    expect(getValidEquipmentTransitions('retired', 'owner')).toEqual([])
  })

  it.each([
    ['active', ['idle', 'maintenance', 'transit', 'off_site']],
    ['transit', ['active', 'idle']],
    ['off_site', ['idle', 'active']],
  ] as const)('%s allows %j (excluding retired for non-PM roles)', (from, expected) => {
    const r = getValidEquipmentTransitions(from, 'foreman')
    for (const target of expected) {
      expect(r).toContain(target)
    }
    expect(r).not.toContain('retired')
  })
})

describe('equipmentMachine — isValidEquipmentTransition', () => {
  it('returns true when target is in the valid set', () => {
    expect(isValidEquipmentTransition('idle', 'active', 'project_manager')).toBe(true)
  })

  it('returns false when role lacks the privilege', () => {
    expect(isValidEquipmentTransition('idle', 'retired', 'foreman')).toBe(false)
  })

  it('returns false for an invalid transition (e.g. retired → active)', () => {
    expect(isValidEquipmentTransition('retired', 'active', 'owner')).toBe(false)
  })
})

describe('equipmentMachine — getEquipmentStatusConfig', () => {
  it.each([
    ['idle', 'Idle'],
    ['active', 'Active'],
    ['maintenance', 'Maintenance'],
    ['transit', 'In Transit'],
    ['off_site', 'Off-Site'],
    ['retired', 'Retired'],
  ] as const)('%s → "%s"', (status, label) => {
    expect(getEquipmentStatusConfig(status).label).toBe(label)
  })

  it('falls back to idle for unknown status', () => {
    // @ts-expect-error — exercising fallback
    expect(getEquipmentStatusConfig('mystery').label).toBe('Idle')
  })
})

describe('equipmentMachine — getMaintenanceStatusConfig', () => {
  it.each([
    ['scheduled', 'Scheduled'],
    ['in_progress', 'In Progress'],
    ['completed', 'Completed'],
  ] as const)('%s → "%s"', (status, label) => {
    expect(getMaintenanceStatusConfig(status).label).toBe(label)
  })
})

describe('equipmentMachine — permission guards', () => {
  it('canCheckout: management roles only', () => {
    expect(canCheckout('owner')).toBe(true)
    expect(canCheckout('foreman')).toBe(true)
    expect(canCheckout('viewer')).toBe(false)
    expect(canCheckout('subcontractor')).toBe(false)
  })

  it('canScheduleMaintenance excludes foreman', () => {
    expect(canScheduleMaintenance('superintendent')).toBe(true)
    expect(canScheduleMaintenance('foreman')).toBe(false)
  })

  it('canRetire is PM/admin/owner only', () => {
    expect(canRetire('owner')).toBe(true)
    expect(canRetire('admin')).toBe(true)
    expect(canRetire('project_manager')).toBe(true)
    expect(canRetire('superintendent')).toBe(false)
    expect(canRetire('foreman')).toBe(false)
  })
})
