// ── customRoles — pure permission resolver ─────────────────────────────────
// Computes a user's effective permission set given:
//   1. Their built-in role (from project_members.role)
//   2. Their assigned custom roles (org_custom_role_assignments)
//   3. Optional per-project override (per_project_role_overrides)
//
// The resolver is pure so RLS policies can shell out to it via a Postgres
// function later (tested here in TS first), and so usePermissions.ts in
// the SPA reuses the exact same merge order.

/** Permission identifiers — keep in sync with src/hooks/usePermissions.ts. */
export type Permission = string

export interface BuiltInRoleDef {
  name: string
  permissions: ReadonlyArray<Permission>
}

export interface CustomRoleDef {
  id: string
  name: string
  /** Optional inheritance from a built-in role. The resolver unions
   *  the built-in's permissions with the explicit `permissions` list. */
  inherits_from?: string | null
  permissions: ReadonlyArray<Permission>
  is_active: boolean
}

export interface PerProjectOverride {
  project_id: string
  /** Either a built-in role name or "custom:<custom_role_id>". */
  override_role: string
  add_permissions: ReadonlyArray<Permission>
  remove_permissions: ReadonlyArray<Permission>
  expires_at?: string | null
}

export interface ResolveInput {
  /** Built-in role assigned at the org / project member level. */
  builtInRole: string | null
  /** All custom roles defined in the org (active + inactive). The
   *  resolver filters inactive ones. */
  customRoles: ReadonlyArray<CustomRoleDef>
  /** Custom role IDs the user is assigned. */
  assignedCustomRoleIds: ReadonlyArray<string>
  /** Per-project override that applies to this resolution. */
  override?: PerProjectOverride | null
  /** Built-in role definitions (name → permissions). */
  builtInRoleDefs: ReadonlyArray<BuiltInRoleDef>
  /** ISO timestamp; the resolver checks override.expires_at against it.
   *  Defaults to "now" when omitted. */
  now?: Date
}

export interface ResolveResult {
  /** The effective permission set, deduped + sorted for stable output. */
  permissions: ReadonlyArray<Permission>
  /** Trace of how the set was assembled — useful for the admin UI's
   *  "why does this user have this permission?" surface. */
  trace: ReadonlyArray<{
    source: string
    permissions: ReadonlyArray<Permission>
  }>
}

const norm = (s: string) => s.trim().toLowerCase()

function permsForBuiltIn(name: string | null, defs: ReadonlyArray<BuiltInRoleDef>): ReadonlyArray<Permission> {
  if (!name) return []
  const found = defs.find((d) => norm(d.name) === norm(name))
  return found?.permissions ?? []
}

function permsForCustomRole(
  id: string,
  customRoles: ReadonlyArray<CustomRoleDef>,
  builtInDefs: ReadonlyArray<BuiltInRoleDef>,
): ReadonlyArray<Permission> {
  const role = customRoles.find((r) => r.id === id && r.is_active)
  if (!role) return []
  const inherited = role.inherits_from
    ? permsForBuiltIn(role.inherits_from, builtInDefs)
    : []
  return [...new Set([...inherited, ...role.permissions])]
}

/**
 * Compute the effective permission set.
 *
 * Order of operations:
 *   1. Start with built-in role permissions (or override role when override
 *      is set and not expired).
 *   2. Union all assigned custom-role permissions.
 *   3. Apply override.add_permissions (additive).
 *   4. Apply override.remove_permissions (subtractive).
 */
export function resolveEffectivePermissions(input: ResolveInput): ResolveResult {
  const trace: Array<{ source: string; permissions: ReadonlyArray<Permission> }> = []
  const collected = new Set<Permission>()

  const overrideActive =
    input.override &&
    (!input.override.expires_at ||
      new Date(input.override.expires_at).getTime() > (input.now ?? new Date()).getTime())

  // 1. Base role.
  const baseRoleName = overrideActive && input.override
    ? input.override.override_role.startsWith('custom:')
      ? null
      : input.override.override_role
    : input.builtInRole
  const baseCustomId = overrideActive && input.override?.override_role.startsWith('custom:')
    ? input.override.override_role.slice('custom:'.length)
    : null

  if (baseRoleName) {
    const perms = permsForBuiltIn(baseRoleName, input.builtInRoleDefs)
    perms.forEach((p) => collected.add(p))
    trace.push({ source: `built_in:${baseRoleName}`, permissions: perms })
  }
  if (baseCustomId) {
    const perms = permsForCustomRole(baseCustomId, input.customRoles, input.builtInRoleDefs)
    perms.forEach((p) => collected.add(p))
    trace.push({ source: `custom:${baseCustomId}`, permissions: perms })
  }

  // 2. Custom-role assignments.
  for (const id of input.assignedCustomRoleIds) {
    const perms = permsForCustomRole(id, input.customRoles, input.builtInRoleDefs)
    if (perms.length === 0) continue
    perms.forEach((p) => collected.add(p))
    trace.push({ source: `assigned_custom:${id}`, permissions: perms })
  }

  // 3. Override additions.
  if (overrideActive && input.override?.add_permissions.length) {
    input.override.add_permissions.forEach((p) => collected.add(p))
    trace.push({ source: 'override:add', permissions: input.override.add_permissions })
  }

  // 4. Override removals.
  if (overrideActive && input.override?.remove_permissions.length) {
    input.override.remove_permissions.forEach((p) => collected.delete(p))
    trace.push({ source: 'override:remove', permissions: input.override.remove_permissions })
  }

  return {
    permissions: Array.from(collected).sort(),
    trace,
  }
}
