import { describe, it, expect } from 'vitest';
import {
  resolveEffectivePermissions,
  type BuiltInRoleDef,
  type CustomRoleDef,
} from '../index';

const BUILT_INS: ReadonlyArray<BuiltInRoleDef> = [
  { name: 'pm', permissions: ['rfis.view', 'rfis.create', 'rfis.respond', 'submittals.view'] },
  { name: 'viewer', permissions: ['rfis.view', 'submittals.view', 'dashboard.view'] },
  { name: 'admin', permissions: ['*'] },
];

const CUSTOMS: ReadonlyArray<CustomRoleDef> = [
  {
    id: 'r1',
    name: 'PM-plus-billing',
    inherits_from: 'pm',
    permissions: ['org.billing'],
    is_active: true,
  },
  {
    id: 'r2',
    name: 'Inactive role',
    permissions: ['files.delete'],
    is_active: false,
  },
];

describe('resolveEffectivePermissions', () => {
  it('returns the built-in role permissions when no customs / override', () => {
    const r = resolveEffectivePermissions({
      builtInRole: 'pm',
      customRoles: CUSTOMS,
      assignedCustomRoleIds: [],
      builtInRoleDefs: BUILT_INS,
    });
    expect(r.permissions).toContain('rfis.view');
    expect(r.permissions).toContain('rfis.respond');
    expect(r.permissions).not.toContain('org.billing');
  });

  it('unions assigned custom roles with the base role', () => {
    const r = resolveEffectivePermissions({
      builtInRole: 'pm',
      customRoles: CUSTOMS,
      assignedCustomRoleIds: ['r1'],
      builtInRoleDefs: BUILT_INS,
    });
    expect(r.permissions).toContain('rfis.respond'); // from PM
    expect(r.permissions).toContain('org.billing');  // from custom
  });

  it('inherited built-in permissions on a custom role are included', () => {
    const r = resolveEffectivePermissions({
      builtInRole: null,
      customRoles: CUSTOMS,
      assignedCustomRoleIds: ['r1'],
      builtInRoleDefs: BUILT_INS,
    });
    // r1 inherits from PM → should have PM perms ∪ org.billing
    expect(r.permissions).toContain('rfis.respond');
    expect(r.permissions).toContain('org.billing');
  });

  it('skips inactive custom roles', () => {
    const r = resolveEffectivePermissions({
      builtInRole: 'pm',
      customRoles: CUSTOMS,
      assignedCustomRoleIds: ['r2'],
      builtInRoleDefs: BUILT_INS,
    });
    expect(r.permissions).not.toContain('files.delete');
  });

  it('per-project override replaces base role with built-in viewer', () => {
    const r = resolveEffectivePermissions({
      builtInRole: 'pm',
      customRoles: CUSTOMS,
      assignedCustomRoleIds: [],
      builtInRoleDefs: BUILT_INS,
      override: {
        project_id: 'p1',
        override_role: 'viewer',
        add_permissions: [],
        remove_permissions: [],
      },
    });
    expect(r.permissions).toContain('rfis.view');
    expect(r.permissions).not.toContain('rfis.respond'); // viewer doesn't have it
  });

  it('override can grant a custom role as the base', () => {
    const r = resolveEffectivePermissions({
      builtInRole: 'viewer',
      customRoles: CUSTOMS,
      assignedCustomRoleIds: [],
      builtInRoleDefs: BUILT_INS,
      override: {
        project_id: 'p1',
        override_role: 'custom:r1',
        add_permissions: [],
        remove_permissions: [],
      },
    });
    expect(r.permissions).toContain('rfis.respond'); // custom inherits PM
    expect(r.permissions).toContain('org.billing');
  });

  it('override.add_permissions adds to the resolved set', () => {
    const r = resolveEffectivePermissions({
      builtInRole: 'viewer',
      customRoles: CUSTOMS,
      assignedCustomRoleIds: [],
      builtInRoleDefs: BUILT_INS,
      override: {
        project_id: 'p1',
        override_role: 'viewer',
        add_permissions: ['rfis.respond'],
        remove_permissions: [],
      },
    });
    expect(r.permissions).toContain('rfis.respond');
  });

  it('override.remove_permissions subtracts from the resolved set', () => {
    const r = resolveEffectivePermissions({
      builtInRole: 'pm',
      customRoles: CUSTOMS,
      assignedCustomRoleIds: [],
      builtInRoleDefs: BUILT_INS,
      override: {
        project_id: 'p1',
        override_role: 'pm',
        add_permissions: [],
        remove_permissions: ['rfis.respond'],
      },
    });
    expect(r.permissions).not.toContain('rfis.respond');
    expect(r.permissions).toContain('rfis.view'); // others preserved
  });

  it('expired overrides are ignored', () => {
    const r = resolveEffectivePermissions({
      builtInRole: 'pm',
      customRoles: CUSTOMS,
      assignedCustomRoleIds: [],
      builtInRoleDefs: BUILT_INS,
      override: {
        project_id: 'p1',
        override_role: 'viewer',
        add_permissions: [],
        remove_permissions: [],
        expires_at: '2000-01-01T00:00:00Z',
      },
    });
    expect(r.permissions).toContain('rfis.respond'); // still PM
  });

  it('returns deduped + sorted permissions', () => {
    const r = resolveEffectivePermissions({
      builtInRole: 'pm',
      customRoles: CUSTOMS,
      assignedCustomRoleIds: ['r1'],
      builtInRoleDefs: BUILT_INS,
    });
    const sorted = [...r.permissions].sort();
    expect(r.permissions).toEqual(sorted);
    expect(new Set(r.permissions).size).toBe(r.permissions.length);
  });

  it('trace records each contributing source', () => {
    const r = resolveEffectivePermissions({
      builtInRole: 'pm',
      customRoles: CUSTOMS,
      assignedCustomRoleIds: ['r1'],
      builtInRoleDefs: BUILT_INS,
      override: {
        project_id: 'p1',
        override_role: 'pm',
        add_permissions: ['files.upload'],
        remove_permissions: ['rfis.respond'],
      },
    });
    expect(r.trace.find((t) => t.source === 'built_in:pm')).toBeDefined();
    expect(r.trace.find((t) => t.source === 'assigned_custom:r1')).toBeDefined();
    expect(r.trace.find((t) => t.source === 'override:add')).toBeDefined();
    expect(r.trace.find((t) => t.source === 'override:remove')).toBeDefined();
  });
});
