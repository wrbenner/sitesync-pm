import { describe, it, expect } from 'vitest'
import {
  getMemberLifecycleState,
  getValidMemberTransitions,
  isValidMemberTransition,
  canAssignRole,
  getDefaultPermissions,
} from './projectMemberMachine'

describe('projectMemberMachine — getMemberLifecycleState', () => {
  it('detects suspended via permissions._memberStatus', () => {
    expect(
      getMemberLifecycleState({
        invited_at: '2026-01-01',
        accepted_at: '2026-01-02',
        permissions: { _memberStatus: 'suspended' },
      }),
    ).toBe('suspended')
  })

  it('detects removed via permissions._memberStatus', () => {
    expect(
      getMemberLifecycleState({
        invited_at: '2026-01-01',
        accepted_at: '2026-01-02',
        permissions: { _memberStatus: 'removed' },
      }),
    ).toBe('removed')
  })

  it('returns active when accepted_at is set', () => {
    expect(
      getMemberLifecycleState({
        invited_at: '2026-01-01',
        accepted_at: '2026-01-02',
        permissions: null,
      }),
    ).toBe('active')
  })

  it('returns invited when invited_at set but not accepted', () => {
    expect(
      getMemberLifecycleState({
        invited_at: '2026-01-01',
        accepted_at: null,
        permissions: null,
      }),
    ).toBe('invited')
  })

  it('defaults to active when both timestamps are null', () => {
    expect(
      getMemberLifecycleState({
        invited_at: null,
        accepted_at: null,
        permissions: null,
      }),
    ).toBe('active')
  })
})

describe('projectMemberMachine — getValidMemberTransitions', () => {
  it('non-management caller cannot transition any state', () => {
    expect(getValidMemberTransitions('invited', 'viewer')).toEqual([])
    expect(getValidMemberTransitions('active', 'foreman')).toEqual([])
  })

  it('PM can accept or remove an invited member', () => {
    expect(getValidMemberTransitions('invited', 'project_manager')).toEqual(
      expect.arrayContaining(['active', 'removed']),
    )
  })

  it('PM can suspend or remove an active member', () => {
    expect(getValidMemberTransitions('active', 'project_manager')).toEqual(
      expect.arrayContaining(['suspended', 'removed']),
    )
  })

  it('PM can reactivate a suspended member', () => {
    expect(getValidMemberTransitions('suspended', 'project_manager')).toContain('active')
  })

  it('only project_executive (or owner) can re-add a removed member', () => {
    expect(getValidMemberTransitions('removed', 'project_executive')).toEqual(['active'])
    expect(getValidMemberTransitions('removed', 'owner')).toEqual(['active'])
    expect(getValidMemberTransitions('removed', 'project_manager')).toEqual([])
  })
})

describe('projectMemberMachine — isValidMemberTransition', () => {
  it('returns true for a privileged + valid transition', () => {
    expect(isValidMemberTransition('invited', 'active', 'project_manager')).toBe(true)
  })

  it('returns false for an unprivileged caller', () => {
    expect(isValidMemberTransition('active', 'suspended', 'foreman')).toBe(false)
  })
})

describe('projectMemberMachine — canAssignRole', () => {
  it('callers can assign roles strictly below their level', () => {
    expect(canAssignRole('owner', 'project_manager')).toBe(true)
    expect(canAssignRole('project_manager', 'foreman')).toBe(true)
    expect(canAssignRole('superintendent', 'foreman')).toBe(true)
  })

  it('callers cannot assign their own level', () => {
    expect(canAssignRole('project_manager', 'project_manager')).toBe(false)
    expect(canAssignRole('owner', 'project_executive')).toBe(false) // both at level 7
  })

  it('callers cannot assign higher roles', () => {
    expect(canAssignRole('foreman', 'project_manager')).toBe(false)
    expect(canAssignRole('viewer', 'foreman')).toBe(false)
  })
})

describe('projectMemberMachine — getDefaultPermissions', () => {
  it('viewer base permissions: only view', () => {
    const p = getDefaultPermissions('viewer')
    expect(p['rfis.view']).toBe(true)
    expect(p['rfis.create']).toBe(false)
    expect(p['daily_log.view']).toBe(false)
  })

  it('field_engineer can create RFIs and view daily logs', () => {
    const p = getDefaultPermissions('field_engineer')
    expect(p['rfis.create']).toBe(true)
    expect(p['rfis.respond']).toBe(true)
    expect(p['daily_log.view']).toBe(true)
  })

  it('superintendent can create daily logs and punch items', () => {
    const p = getDefaultPermissions('superintendent')
    expect(p['daily_log.create']).toBe(true)
    expect(p['punch_list.create']).toBe(true)
  })

  it('project_manager unlocks edits + approvals', () => {
    const p = getDefaultPermissions('project_manager')
    expect(p['rfis.edit']).toBe(true)
    expect(p['submittals.approve']).toBe(true)
    expect(p['daily_log.approve']).toBe(true)
    expect(p['punch_list.verify']).toBe(true)
  })

  it('project_executive unlocks budget + change-order approval', () => {
    const p = getDefaultPermissions('project_executive')
    expect(p['budget.view']).toBe(true)
    expect(p['budget.edit']).toBe(true)
    expect(p['change_orders.approve']).toBe(true)
  })

  it('higher roles inherit lower-role permissions (cumulative)', () => {
    const pm = getDefaultPermissions('project_manager')
    const fe = getDefaultPermissions('field_engineer')
    // Anything true for field_engineer must be true for PM
    for (const [k, v] of Object.entries(fe)) {
      if (v === true) expect(pm[k]).toBe(true)
    }
  })
})
