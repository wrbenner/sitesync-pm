---
name: permission-gate
description: Gate UI elements behind user role checks using PermissionGate component
version: "1.0.0"
when_to_use: When adding any create, edit, delete, approve, or export action that should be restricted by user role; when auditing pages for unauthorized action exposure
allowed-tools: read_file, write_file, bash
---

## Overview

SiteSync is a multi-tenant construction management app where users have one of five roles with clearly defined permissions. The `<PermissionGate>` component conditionally renders its children based on the current user's role, preventing unauthorized access to sensitive actions. It reads from the auth context — no prop-drilling required.

**Golden rule**: Any button, form, or link that can create, modify, delete, approve, or export data must be wrapped in `<PermissionGate>`.

## Role Hierarchy

Construction roles in SiteSync, from highest to lowest authority:

| Role | Constant | Typical Capabilities |
|---|---|---|
| `admin` | `Role.ADMIN` | Full access — user management, billing, all data |
| `project_manager` | `Role.PM` | Create/edit projects, approve submittals, sign RFIs |
| `superintendent` | `Role.SUPERINTENDENT` | Write daily logs, create punch items, manage field crews |
| `subcontractor` | `Role.SUBCONTRACTOR` | View assigned work, submit RFI responses, attach photos |
| `owner_rep` | `Role.OWNER_REP` | Read-only access to all project data, approve change orders |

## The PermissionGate Component

Location: `src/components/PermissionGate.tsx`

```tsx
import { useAuth } from '@/hooks/useAuth';
import type { ReactNode } from 'react';

export type Role =
  | 'admin'
  | 'project_manager'
  | 'superintendent'
  | 'subcontractor'
  | 'owner_rep';

interface Props {
  /**
   * Required role(s). If array, user must have AT LEAST ONE of the listed roles.
   * Use `requiredAll` prop if ALL roles are required (rare).
   */
  requires: Role | Role[];
  /** What to render when the user lacks permission. Defaults to null (hidden). */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Role hierarchy — higher index = higher authority.
 * Admins implicitly have all lower permissions.
 */
const ROLE_RANK: Record<Role, number> = {
  subcontractor: 0,
  owner_rep: 1,
  superintendent: 2,
  project_manager: 3,
  admin: 4,
};

export function PermissionGate({ requires, fallback = null, children }: Props) {
  const { user } = useAuth();

  if (!user?.role) return null; // Not authenticated

  const userRank = ROLE_RANK[user.role as Role] ?? -1;
  const requiredRoles = Array.isArray(requires) ? requires : [requires];

  // User passes if their role rank meets ANY required role
  const hasPermission = requiredRoles.some(
    (role) => userRank >= ROLE_RANK[role]
  );

  return hasPermission ? <>{children}</> : <>{fallback}</>;
}
```

## Usage Patterns

### Pattern 1 — Hide unauthorized actions (most common)

```tsx
import { PermissionGate } from '@/components/PermissionGate';

// Only PMs and above can create a project
<PermissionGate requires="project_manager">
  <button
    onClick={handleCreateProject}
    style={{ minHeight: 56 }}
    className="btn-primary"
  >
    New Project
  </button>
</PermissionGate>

// Only admin can delete
<PermissionGate requires="admin">
  <button onClick={handleDelete} className="btn-destructive">
    Delete Project
  </button>
</PermissionGate>
```

### Pattern 2 — Show a disabled state instead of hiding

Use `fallback` to render a disabled version of the button rather than nothing — this communicates that the feature exists but the user lacks access:

```tsx
<PermissionGate
  requires="superintendent"
  fallback={
    <button
      disabled
      title="Superintendent or higher required"
      style={{ minHeight: 56 }}
      className="btn-primary opacity-40 cursor-not-allowed"
    >
      Create Daily Log
    </button>
  }
>
  <button onClick={handleCreate} style={{ minHeight: 56 }} className="btn-primary">
    Create Daily Log
  </button>
</PermissionGate>
```

### Pattern 3 — Multiple allowed roles

```tsx
// Either a superintendent OR a project_manager can approve punch items
<PermissionGate requires={['superintendent', 'project_manager']}>
  <ApprovePunchItemButton itemId={item.id} />
</PermissionGate>
```

### Pattern 4 — Gate entire form sections

```tsx
function ProjectSettingsForm() {
  return (
    <form>
      {/* All users can view basic info */}
      <ProjectBasicInfoSection />

      {/* Only admin can change billing settings */}
      <PermissionGate requires="admin">
        <BillingSettingsSection />
      </PermissionGate>

      {/* Only PM+ can change project status */}
      <PermissionGate
        requires="project_manager"
        fallback={<StatusReadOnlyDisplay />}
      >
        <ProjectStatusEditor />
      </PermissionGate>
    </form>
  );
}
```

### Pattern 5 — Inline permission check (hook alternative)

For complex logic where you need the permission value rather than a wrapper:

```tsx
import { useAuth } from '@/hooks/useAuth';

function PunchListRow({ item }: { item: PunchItem }) {
  const { user } = useAuth();
  const canEdit = user?.role === 'superintendent' || user?.role === 'project_manager' || user?.role === 'admin';

  return (
    <tr>
      <td>{item.description}</td>
      <td>
        {canEdit && (
          <EditPunchItemButton item={item} />
        )}
      </td>
    </tr>
  );
}
```

## Resolution Steps

### Step 1 — Verify PermissionGate component exists

```bash
ls src/components/PermissionGate.tsx
```

If missing, create from the pattern above.

### Step 2 — Check useAuth hook provides role

```bash
grep -n "role" src/hooks/useAuth.ts
```

The hook must expose `user.role`. If it doesn't, add it:

```typescript
// In useAuth.ts — ensure role comes from the JWT claims or user profile table
const role = session?.user?.user_metadata?.role 
  ?? profileData?.role 
  ?? 'subcontractor'; // Default to lowest privilege
```

### Step 3 — Audit pages for unguarded actions

```bash
# Find buttons with destructive/create/edit actions not inside PermissionGate
grep -rn "onClick={handle\(Create\|Edit\|Delete\|Approve\|Export\)" src/pages/
```

Review each match and determine if it needs a `PermissionGate`.

### Step 4 — Wrap the action

Import `PermissionGate` and wrap the action element with the appropriate `requires` role. Choose the minimum role that should have access.

### Step 5 — Test with different roles

Use Supabase Auth UI or test accounts to verify:
- Authorized role: button is visible and functional
- Unauthorized role: button is hidden (or shows disabled fallback)
- Unauthenticated: component renders nothing (null)

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| Gating only the UI, not the API | Button hidden but API still accepts request | Always enforce permissions in Supabase RLS policies too |
| Using exact role match instead of rank | Admin can't access superintendent features | Use the `ROLE_RANK` hierarchy — admin inherits all lower permissions |
| Wrapping the entire page | Blank page for unauthorized users | Gate individual actions; show read-only view for lower roles |
| Missing fallback on important actions | User doesn't know why feature is missing | Use `fallback` with a disabled state + tooltip |

## Security Note

`PermissionGate` is a **UI-only guard**. It prevents unauthorized users from seeing buttons but does NOT prevent direct API calls. Always back every permission-gated action with a corresponding Supabase Row Level Security (RLS) policy:

```sql
-- Example: only project_managers and admins can insert projects
CREATE POLICY "pm_and_admin_can_create_projects"
ON projects FOR INSERT
TO authenticated
USING (
  auth.jwt() ->> 'role' IN ('project_manager', 'admin')
);
```

## Usage Tracking

usage_count: 0
last_used: null
