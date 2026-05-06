# Custom Roles

The default role set (Owner, Admin, PM, Super, Member, Viewer per [HONEST_STATE.md](../../HONEST_STATE.md)) handles most organizations. Some require custom roles — for example, a "Compliance Officer" with read access across all projects but write access only to insurance and lien-waiver tables, or a "Subcontractor PM" with access to one project only.

## What ships

| Layer | File |
| --- | --- |
| Pure resolver | [src/lib/customRoles/index.ts](../../src/lib/customRoles/index.ts) |
| Org-level table | [supabase/migrations/20260502100001_org_custom_roles.sql](../../supabase/migrations/20260502100001_org_custom_roles.sql) |
| Per-project overrides | [supabase/migrations/20260502100002_per_project_role_overrides.sql](../../supabase/migrations/20260502100002_per_project_role_overrides.sql) |
| Admin UI | [src/pages/admin/custom-roles](../../src/pages/admin/custom-roles) |

## Resolution order

The resolver in [src/lib/customRoles/index.ts](../../src/lib/customRoles/index.ts) determines the effective permission set for a `(user, project)` pair using this order, highest priority first:

1. **Per-project role override** — if a row in `per_project_role_overrides` exists for `(user_id, project_id)`, that role wins for that project only.
2. **Custom role assignment at the organization** — if the user is assigned a custom role in `org_custom_roles_members`.
3. **Default role** — the user's organization-level role (`Owner`, `Admin`, `PM`, `Super`, `Member`, `Viewer`).

## Defining a custom role

1. Open [src/pages/admin/custom-roles](../../src/pages/admin/custom-roles).
2. Click "New role". Provide a display name and description.
3. Toggle permissions in the matrix. The matrix is the same one used by the default roles — see [src/lib/rls.ts](../../src/lib/rls.ts) for the canonical permission list.
4. Save. The role is now selectable as the role for any user in the organization.

## Per-project override

1. Open the project member list.
2. Find the user. Click "Override role for this project".
3. Pick a role (default or custom).
4. The override is stored in `per_project_role_overrides` and consulted before the org-level role on every permission check.

## Permission enforcement

Permissions are enforced on three layers:

- **RLS policies in Postgres** — see [supabase/migrations/00033_rls_permission_enforcement.sql](../../supabase/migrations/00033_rls_permission_enforcement.sql) and [supabase/migrations/00043_complete_rls_enforcement.sql](../../supabase/migrations/00043_complete_rls_enforcement.sql). This is the authoritative gate; bypassing the UI cannot bypass these.
- **Service-layer checks** in [src/api/middleware/projectScope.ts](../../src/api/middleware/projectScope.ts) and feature-specific services.
- **UI gates** — `<PermissionGate>` is the pattern; per [HONEST_STATE.md](../../HONEST_STATE.md) it is not yet uniformly applied across action buttons. Treat the UI as a UX layer, not a security boundary.

## Limitations

- Custom roles cannot grant permissions that the user's *organization* does not have at any role. Roles partition the org's permission surface; they do not expand it.
- Per-project overrides are one row per `(user, project)`. Per-project group overrides are not modeled.
- Roles are not versioned. If you edit a role, the change applies retroactively to every user assigned to it.

## Audit

Every role change is recorded in the audit log via the trigger system in [supabase/migrations/20260415000002_rfi_audit_trigger.sql](../../supabase/migrations/20260415000002_rfi_audit_trigger.sql) and verified by the hash chain at [supabase/migrations/20260426000001_audit_log_hash_chain.sql](../../supabase/migrations/20260426000001_audit_log_hash_chain.sql).
