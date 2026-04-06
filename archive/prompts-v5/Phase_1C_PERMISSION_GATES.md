# Phase 1C — Complete PermissionGate Coverage

**Status**: Foundation Layer | **Priority**: Critical | **Effort**: 25 hours | **Risk**: High (Security)

## Pre-Requisite: Paste 00_SYSTEM_CONTEXT.md before this prompt

---

## Problem Statement

**Audit Finding**: Architecture Law 4 violated in 40+ locations. Action buttons exist without PermissionGate checks.

**Current State**:
- Create/Edit/Delete buttons visible to all users regardless of role
- No permission validation on button click
- API mutations accept requests from unauthorized users (if not blocked by backend)
- Field workers can attempt to delete RFIs, change project budgets
- No clear permission matrix or documentation

**Target State**:
- Every action button wrapped in PermissionGate component
- UI hides buttons user cannot use
- API mutations validate permissions before execution
- Clear permission matrix: role + entity type = allowed actions
- Audit trail logs every permission denial
- Mobile field workers see only field-relevant actions

---

## Permission Model: Role + Entity + Action

```typescript
// src/types/permissions.ts

export enum UserRole {
  PROJECT_ADMIN = 'PROJECT_ADMIN',
  PM = 'PM',
  SUPERINTENDENT = 'SUPERINTENDENT',
  FIELD_WORKER = 'FIELD_WORKER',
  SUBCONTRACTOR_MANAGER = 'SUBCONTRACTOR_MANAGER',
  GUEST = 'GUEST',
}

export enum EntityType {
  RFI = 'RFI',
  SUBMITTAL = 'SUBMITTAL',
  PUNCH_ITEM = 'PUNCH_ITEM',
  TASK = 'TASK',
  DAILY_LOG = 'DAILY_LOG',
  CHANGE_ORDER = 'CHANGE_ORDER',
  DRAWING = 'DRAWING',
  MEETING = 'MEETING',
  FILE = 'FILE',
  CREW = 'CREW',
  SAFETY_INSPECTION = 'SAFETY_INSPECTION',
}

export enum Action {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  PUBLISH = 'PUBLISH',
  SHARE = 'SHARE',
  EXPORT = 'EXPORT',
  REORDER = 'REORDER',
}

// Permission matrix: role + entity + action = boolean
export const PERMISSIONS: Record<UserRole, Record<EntityType, Set<Action>>> = {
  [UserRole.PROJECT_ADMIN]: {
    [EntityType.RFI]: new Set([Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.APPROVE, Action.REJECT]),
    [EntityType.SUBMITTAL]: new Set([Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.APPROVE, Action.REJECT]),
    [EntityType.PUNCH_ITEM]: new Set([Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.APPROVE, Action.REJECT]),
    [EntityType.TASK]: new Set([Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.APPROVE, Action.REORDER]),
    [EntityType.DAILY_LOG]: new Set([Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.PUBLISH]),
    [EntityType.CHANGE_ORDER]: new Set([Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.APPROVE, Action.REJECT]),
    [EntityType.DRAWING]: new Set([Action.READ, Action.UPDATE, Action.SHARE]),
    [EntityType.MEETING]: new Set([Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE]),
    [EntityType.FILE]: new Set([Action.READ, Action.UPDATE, Action.DELETE, Action.SHARE, Action.EXPORT]),
    [EntityType.CREW]: new Set([Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE]),
    [EntityType.SAFETY_INSPECTION]: new Set([Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.APPROVE]),
  },

  [UserRole.PM]: {
    [EntityType.RFI]: new Set([Action.CREATE, Action.READ, Action.UPDATE, Action.APPROVE, Action.REJECT]),
    [EntityType.SUBMITTAL]: new Set([Action.CREATE, Action.READ, Action.UPDATE, Action.APPROVE, Action.REJECT]),
    [EntityType.PUNCH_ITEM]: new Set([Action.CREATE, Action.READ, Action.UPDATE]),
    [EntityType.TASK]: new Set([Action.CREATE, Action.READ, Action.UPDATE, Action.REORDER]),
    [EntityType.DAILY_LOG]: new Set([Action.READ, Action.PUBLISH]),
    [EntityType.CHANGE_ORDER]: new Set([Action.CREATE, Action.READ, Action.UPDATE, Action.APPROVE]),
    [EntityType.DRAWING]: new Set([Action.READ, Action.SHARE]),
    [EntityType.MEETING]: new Set([Action.CREATE, Action.READ, Action.UPDATE]),
    [EntityType.FILE]: new Set([Action.READ, Action.SHARE, Action.EXPORT]),
    [EntityType.CREW]: new Set([Action.READ]),
    [EntityType.SAFETY_INSPECTION]: new Set([Action.READ, Action.APPROVE]),
  },

  [UserRole.SUPERINTENDENT]: {
    [EntityType.RFI]: new Set([Action.CREATE, Action.READ, Action.UPDATE]),
    [EntityType.SUBMITTAL]: new Set([Action.READ, Action.UPDATE]),
    [EntityType.PUNCH_ITEM]: new Set([Action.CREATE, Action.READ, Action.UPDATE, Action.APPROVE]),
    [EntityType.TASK]: new Set([Action.READ, Action.UPDATE, Action.APPROVE]),
    [EntityType.DAILY_LOG]: new Set([Action.CREATE, Action.READ, Action.UPDATE, Action.PUBLISH]),
    [EntityType.CHANGE_ORDER]: new Set([Action.READ, Action.UPDATE]),
    [EntityType.DRAWING]: new Set([Action.READ, Action.SHARE]),
    [EntityType.MEETING]: new Set([Action.CREATE, Action.READ, Action.UPDATE]),
    [EntityType.FILE]: new Set([Action.READ, Action.SHARE]),
    [EntityType.CREW]: new Set([Action.READ, Action.UPDATE]),
    [EntityType.SAFETY_INSPECTION]: new Set([Action.CREATE, Action.READ, Action.UPDATE, Action.APPROVE]),
  },

  [UserRole.FIELD_WORKER]: {
    [EntityType.RFI]: new Set([Action.READ]),
    [EntityType.SUBMITTAL]: new Set([Action.READ]),
    [EntityType.PUNCH_ITEM]: new Set([Action.READ, Action.UPDATE, Action.APPROVE]),
    [EntityType.TASK]: new Set([Action.READ, Action.UPDATE]),
    [EntityType.DAILY_LOG]: new Set([Action.CREATE, Action.READ, Action.UPDATE]),
    [EntityType.CHANGE_ORDER]: new Set([Action.READ]),
    [EntityType.DRAWING]: new Set([Action.READ]),
    [EntityType.MEETING]: new Set([Action.READ]),
    [EntityType.FILE]: new Set([Action.READ]),
    [EntityType.CREW]: new Set([Action.READ]),
    [EntityType.SAFETY_INSPECTION]: new Set([Action.CREATE, Action.READ]),
  },

  [UserRole.SUBCONTRACTOR_MANAGER]: {
    [EntityType.RFI]: new Set([Action.READ]),
    [EntityType.SUBMITTAL]: new Set([Action.CREATE, Action.READ, Action.UPDATE]),
    [EntityType.PUNCH_ITEM]: new Set([Action.READ, Action.UPDATE]),
    [EntityType.TASK]: new Set([Action.READ, Action.UPDATE]),
    [EntityType.DAILY_LOG]: new Set([Action.READ]),
    [EntityType.CHANGE_ORDER]: new Set([Action.READ]),
    [EntityType.DRAWING]: new Set([Action.READ]),
    [EntityType.MEETING]: new Set([Action.READ]),
    [EntityType.FILE]: new Set([Action.READ]),
    [EntityType.CREW]: new Set([Action.READ]),
    [EntityType.SAFETY_INSPECTION]: new Set([Action.READ]),
  },

  [UserRole.GUEST]: {
    [EntityType.RFI]: new Set([Action.READ]),
    [EntityType.SUBMITTAL]: new Set([Action.READ]),
    [EntityType.PUNCH_ITEM]: new Set([Action.READ]),
    [EntityType.TASK]: new Set([Action.READ]),
    [EntityType.DAILY_LOG]: new Set([Action.READ]),
    [EntityType.CHANGE_ORDER]: new Set([Action.READ]),
    [EntityType.DRAWING]: new Set([Action.READ]),
    [EntityType.MEETING]: new Set([Action.READ]),
    [EntityType.FILE]: new Set([Action.READ]),
    [EntityType.CREW]: new Set([Action.READ]),
    [EntityType.SAFETY_INSPECTION]: new Set([Action.READ]),
  },
};
```

---

## PermissionGate Component

**File**: `src/components/PermissionGate.tsx`

```typescript
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { EntityType, Action, UserRole } from '@/types/permissions';

interface PermissionGateProps {
  entity: EntityType;
  action: Action;
  entityId?: string; // For row-level security
  children: React.ReactNode;
  fallback?: React.ReactNode; // Shows if no permission (null by default)
  require?: 'all' | 'any'; // For multiple entities
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  entity,
  action,
  entityId,
  children,
  fallback = null,
  require = 'all',
}) => {
  const { currentUser } = useAuth();
  const { can, deniedReason } = usePermissions();

  if (!currentUser) {
    return <>{fallback}</>;
  }

  // Check role-based permission
  const hasPermission = can(entity, action, {
    userId: currentUser.id,
    role: currentUser.role,
    entityId,
  });

  if (!hasPermission) {
    // Log permission denial for audit trail
    if (entityId) {
      console.warn(
        `[PermissionDenied] User ${currentUser.id} denied ${action} on ${entity}:${entityId} (role: ${currentUser.role})`
      );
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

// Hook version for conditional logic
export function useHasPermission(entity: EntityType, action: Action, context?: { userId?: string; entityId?: string }) {
  const { currentUser } = useAuth();
  const { can } = usePermissions();

  if (!currentUser) return false;

  return can(entity, action, {
    userId: context?.userId || currentUser.id,
    role: currentUser.role,
    entityId: context?.entityId,
  });
}

// Composite gate for multiple permissions
interface MultiPermissionGateProps {
  conditions: Array<{ entity: EntityType; action: Action; entityId?: string }>;
  require?: 'all' | 'any';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const MultiPermissionGate: React.FC<MultiPermissionGateProps> = ({
  conditions,
  require = 'all',
  children,
  fallback = null,
}) => {
  const { currentUser } = useAuth();
  const { can } = usePermissions();

  if (!currentUser) {
    return <>{fallback}</>;
  }

  const results = conditions.map((cond) =>
    can(cond.entity, cond.action, {
      role: currentUser.role,
      entityId: cond.entityId,
    })
  );

  const hasPermission =
    require === 'all' ? results.every((r) => r) : results.some((r) => r);

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
```

---

## usePermissions Hook

**File**: `src/hooks/usePermissions.ts`

```typescript
import { useAuth } from '@/hooks/useAuth';
import { EntityType, Action, PERMISSIONS, UserRole } from '@/types/permissions';

interface PermissionContext {
  userId?: string;
  role: UserRole;
  entityId?: string;
  createdByUserId?: string;
}

export function usePermissions() {
  const { currentUser } = useAuth();

  const can = (
    entity: EntityType,
    action: Action,
    context: PermissionContext
  ): boolean => {
    if (!context.role) return false;

    // Get allowed actions for role + entity
    const allowedActions = PERMISSIONS[context.role]?.[entity];
    if (!allowedActions) return false;

    const hasAction = allowedActions.has(action);
    if (!hasAction) return false;

    // Row-level security: some users can only modify their own records
    if (entityId && context.createdByUserId) {
      // Owner can always modify their own
      if (context.userId === context.createdByUserId) {
        return true;
      }

      // Others need explicit role permission
      if (context.role === UserRole.FIELD_WORKER && action === Action.UPDATE) {
        return context.userId === context.createdByUserId;
      }
    }

    return hasAction;
  };

  const deniedReason = (
    entity: EntityType,
    action: Action
  ): string | null => {
    if (!currentUser) return 'Not authenticated';

    const allowed = can(entity, action, {
      role: currentUser.role,
      userId: currentUser.id,
    });

    if (allowed) return null;

    return `You do not have permission to ${action.toLowerCase()} ${entity.toLowerCase()}`;
  };

  return {
    can,
    deniedReason,
    hasRole: (role: UserRole) => currentUser?.role === role,
    hasAnyRole: (roles: UserRole[]) => currentUser && roles.includes(currentUser.role),
  };
}
```

---

## Complete Audit: Ungated Buttons by Page

### Dashboard.tsx
**Location**: `src/pages/Dashboard.tsx`

- **Line 45**: "Create RFI" button (Btn component) — MISSING PermissionGate
- **Line 52**: "Create Submittal" button — MISSING PermissionGate
- **Line 59**: "Create Task" button — MISSING PermissionGate
- **Line 78**: "View All" links in metric cards — MISSING READ permission check

**Fix Template**:
```typescript
// BEFORE
<Btn onClick={() => setShowCreateRFI(true)}>Create RFI</Btn>

// AFTER
<PermissionGate entity={EntityType.RFI} action={Action.CREATE}>
  <Btn onClick={() => setShowCreateRFI(true)}>Create RFI</Btn>
</PermissionGate>
```

### RFIs.tsx
**Location**: `src/pages/RFIs.tsx`

- **Line 12**: "New RFI" button in header — MISSING PermissionGate
- **Line 145**: Edit icon in table rows (40 rows) — MISSING PermissionGate
- **Line 151**: Delete icon in table rows (40 rows) — MISSING PermissionGate
- **Line 178**: "Resolve" action in detail panel — MISSING PermissionGate
- **Line 185**: "Reject" action in detail panel — MISSING PermissionGate
- **Line 212**: Bulk action dropdown — MISSING PermissionGate
- **Line 218**: "Change Status" bulk action — MISSING PermissionGate

**Fix Template**:
```typescript
// BEFORE: Ungated Edit button in table row
{rfi.status === 'OPEN' && (
  <IconButton onClick={() => setSelectedRFI(rfi)}>
    <Edit size={18} />
  </IconButton>
)}

// AFTER: Gated with PermissionGate
<PermissionGate entity={EntityType.RFI} action={Action.UPDATE} entityId={rfi.id}>
  {rfi.status === 'OPEN' && (
    <IconButton onClick={() => setSelectedRFI(rfi)}>
      <Edit size={18} />
    </IconButton>
  )}
</PermissionGate>
```

### Submittals.tsx
**Location**: `src/pages/Submittals.tsx`

- **Line 8**: "New Submittal" button in header — MISSING PermissionGate
- **Line 142**: "Approve" button in detail panel — MISSING PermissionGate (role-specific)
- **Line 148**: "Reject" button in detail panel — MISSING PermissionGate
- **Line 154**: "Resubmit" button in detail panel — MISSING PermissionGate (Subcontractor only)
- **Line 95**: Edit icons in table (50+ rows) — MISSING PermissionGate
- **Line 101**: Delete icons in table (50+ rows) — MISSING PermissionGate

### PunchList.tsx
**Location**: `src/pages/PunchList.tsx`

- **Line 15**: "New Punch Item" button — MISSING PermissionGate (PM, Superintendent only)
- **Line 85**: "Mark Complete" button in rows — MISSING PermissionGate (Field workers)
- **Line 92**: "Verify" button in rows — MISSING PermissionGate (Superintendent only)
- **Line 99**: Delete button in rows — MISSING PermissionGate (PM only)
- **Line 120**: Bulk "Mark Complete" action — MISSING PermissionGate

### Schedule.tsx
**Location**: `src/pages/Schedule.tsx`

- **Line 8**: "New Task" button — MISSING PermissionGate
- **Line 45**: Drag-drop reorder — MISSING PermissionGate (check before allowing reorder)
- **Line 78**: Edit task inline — MISSING PermissionGate
- **Line 102**: Delete task icon — MISSING PermissionGate
- **Line 118**: Assign task dropdown — MISSING PermissionGate

### Budget.tsx
**Location**: `src/pages/Budget.tsx`

- **Line 25**: "New Change Order" button — MISSING PermissionGate (PM, Admin only)
- **Line 95**: Edit change order row icons — MISSING PermissionGate
- **Line 101**: Delete change order row icons — MISSING PermissionGate
- **Line 142**: "Approve" button in detail panel — MISSING PermissionGate (PM, Admin only)
- **Line 148**: "Reject" button in detail panel — MISSING PermissionGate (PM, Admin only)

### DailyLog.tsx
**Location**: `src/pages/DailyLog.tsx`

- **Line 18**: "New Daily Log" button — MISSING PermissionGate (Field workers, Superintendent)
- **Line 65**: Edit daily log icon — MISSING PermissionGate
- **Line 72**: Delete daily log icon — MISSING PermissionGate
- **Line 88**: "Publish" button in detail panel — MISSING PermissionGate
- **Line 95**: "Edit" button in published logs — Should be DISABLED, not hidden

### FieldCapture.tsx
**Location**: `src/pages/FieldCapture.tsx`

- **Line 12**: Camera button — MISSING PermissionGate (Field workers only)
- **Line 28**: Voice record button — MISSING PermissionGate (Field workers only)
- **Line 44**: Submit button for field capture — MISSING PermissionGate
- **Line 68**: Photo edit/delete — MISSING PermissionGate

### Meetings.tsx
**Location**: `src/pages/Meetings.tsx`

- **Line 10**: "Schedule Meeting" button — MISSING PermissionGate (PM, Superintendent)
- **Line 78**: Edit meeting icon — MISSING PermissionGate
- **Line 85**: Cancel meeting icon — MISSING PermissionGate (creator + PM + Admin only)
- **Line 102**: "Add Minutes" button in detail panel — MISSING PermissionGate

### Files.tsx
**Location**: `src/pages/Files.tsx`

- **Line 15**: "Upload File" button — MISSING PermissionGate
- **Line 92**: Delete file icon — MISSING PermissionGate
- **Line 99**: Share file icon — MISSING PermissionGate
- **Line 106**: Download file button — Should be gated but less restrictive

### Crews.tsx
**Location**: `src/pages/Crews.tsx`

- **Line 8**: "Add Crew Member" button — MISSING PermissionGate (PM, Superintendent only)
- **Line 95**: Edit crew member row — MISSING PermissionGate
- **Line 102**: Remove crew member row — MISSING PermissionGate (Admin only)

### Directory.tsx
**Location**: `src/pages/Directory.tsx`

- **Line 20**: "Add Contact" button — MISSING PermissionGate
- **Line 88**: Edit contact button — MISSING PermissionGate
- **Line 95**: Delete contact button — MISSING PermissionGate

---

## API-Level Permission Checks

### Backend Mutation Handler Pattern

**File**: `src/hooks/mutations/patterns/apiMutationWithPermissionCheck.ts`

```typescript
import { useAuth } from '@/hooks/useAuth';
import { useHasPermission } from '@/components/PermissionGate';
import { EntityType, Action } from '@/types/permissions';
import { useMutation } from '@tanstack/react-query';
import { toast } from '@/components/Primitives';
import * as Sentry from '@sentry/react';

interface PermissionCheckOptions {
  entity: EntityType;
  action: Action;
  entityId?: string;
}

export function usePermissionCheckedMutation<TInput, TOutput>(
  mutationFn: (input: TInput) => Promise<TOutput>,
  options: PermissionCheckOptions
) {
  const { currentUser } = useAuth();
  const hasPermission = useHasPermission(options.entity, options.action, {
    entityId: options.entityId,
  });

  return useMutation({
    mutationFn: async (input: TInput) => {
      // UI-level check (defensive)
      if (!hasPermission) {
        const error = new Error(
          `You do not have permission to ${options.action.toLowerCase()} ${options.entity.toLowerCase()}`
        );
        error.name = 'PermissionDenied';
        throw error;
      }

      try {
        const result = await mutationFn(input);

        // Log successful privileged action
        if ([Action.DELETE, Action.APPROVE, Action.REJECT].includes(options.action)) {
          Sentry.captureMessage(
            `User ${currentUser?.id} performed ${options.action} on ${options.entity}`,
            'info'
          );
        }

        return result;
      } catch (error) {
        // Check if backend rejected due to permission
        if (error instanceof Error && error.message.includes('Permission denied')) {
          toast.error('You do not have permission to perform this action');

          Sentry.captureException(error, {
            tags: {
              type: 'permission_violation',
              action: options.action,
              entity: options.entity,
            },
          });
        }

        throw error;
      }
    },

    onError: (error) => {
      if (error instanceof Error && error.name === 'PermissionDenied') {
        toast.error(error.message);
      }
    },
  });
}
```

---

## Complete Implementation Checklist

### Component Gating Changes

**RFIs.tsx** (8 buttons):
- [ ] Line 12: "New RFI" + PermissionGate(RFI, CREATE)
- [ ] Line 145: Edit icons + PermissionGate(RFI, UPDATE)
- [ ] Line 151: Delete icons + PermissionGate(RFI, DELETE)
- [ ] Line 178: "Resolve" action + PermissionGate(RFI, APPROVE)
- [ ] Line 185: "Reject" action + PermissionGate(RFI, REJECT)
- [ ] Line 212: Bulk action dropdown + MultiPermissionGate
- [ ] Line 218: "Change Status" bulk action + PermissionGate(RFI, UPDATE)
- [ ] Line 225: Status change disabled for unauthorized users

**Submittals.tsx** (8 buttons):
- [ ] Line 8: "New Submittal" + PermissionGate(SUBMITTAL, CREATE)
- [ ] Line 95: Edit icons + PermissionGate(SUBMITTAL, UPDATE)
- [ ] Line 101: Delete icons + PermissionGate(SUBMITTAL, DELETE)
- [ ] Line 142: "Approve" button + PermissionGate(SUBMITTAL, APPROVE) — PM/Admin only
- [ ] Line 148: "Reject" button + PermissionGate(SUBMITTAL, REJECT) — PM/Admin only
- [ ] Line 154: "Resubmit" button + PermissionGate(SUBMITTAL, UPDATE) — Subcontractor only
- [ ] Bulk action dropdown + MultiPermissionGate
- [ ] Status transitions respect permissions

**PunchList.tsx** (6 buttons):
- [ ] Line 15: "New Punch Item" + PermissionGate(PUNCH_ITEM, CREATE) — PM/Superintendent
- [ ] Line 85: "Mark Complete" + PermissionGate(PUNCH_ITEM, UPDATE) — Field workers
- [ ] Line 92: "Verify" + PermissionGate(PUNCH_ITEM, APPROVE) — Superintendent
- [ ] Line 99: Delete + PermissionGate(PUNCH_ITEM, DELETE) — PM/Admin
- [ ] Line 120: Bulk "Mark Complete" + MultiPermissionGate
- [ ] Row colors change based on user permissions

**Schedule.tsx** (5 buttons):
- [ ] Line 8: "New Task" + PermissionGate(TASK, CREATE)
- [ ] Line 45: Drag-drop reorder + PermissionGate(TASK, REORDER)
- [ ] Line 78: Edit task inline + PermissionGate(TASK, UPDATE)
- [ ] Line 102: Delete task + PermissionGate(TASK, DELETE)
- [ ] Line 118: Assign task dropdown + PermissionGate(TASK, UPDATE)

**Budget.tsx** (5 buttons):
- [ ] Line 25: "New Change Order" + PermissionGate(CHANGE_ORDER, CREATE) — PM/Admin
- [ ] Line 95: Edit CO row icons + PermissionGate(CHANGE_ORDER, UPDATE)
- [ ] Line 101: Delete CO row icons + PermissionGate(CHANGE_ORDER, DELETE)
- [ ] Line 142: "Approve" button + PermissionGate(CHANGE_ORDER, APPROVE) — PM/Admin
- [ ] Line 148: "Reject" button + PermissionGate(CHANGE_ORDER, REJECT) — PM/Admin

**DailyLog.tsx** (5 buttons):
- [ ] Line 18: "New Daily Log" + PermissionGate(DAILY_LOG, CREATE) — Field workers/Superintendent
- [ ] Line 65: Edit daily log + PermissionGate(DAILY_LOG, UPDATE)
- [ ] Line 72: Delete daily log + PermissionGate(DAILY_LOG, DELETE)
- [ ] Line 88: "Publish" button + PermissionGate(DAILY_LOG, PUBLISH)
- [ ] Line 95: Published logs show as read-only for non-creator

**FieldCapture.tsx** (4 buttons):
- [ ] Line 12: Camera button + PermissionGate(DAILY_LOG, CREATE) — Field workers only
- [ ] Line 28: Voice record button + PermissionGate(DAILY_LOG, CREATE) — Field workers only
- [ ] Line 44: Submit button + PermissionGate(DAILY_LOG, CREATE)
- [ ] Line 68: Photo edit/delete + PermissionGate(DAILY_LOG, UPDATE) — Creator only

**Meetings.tsx** (4 buttons):
- [ ] Line 10: "Schedule Meeting" + PermissionGate(MEETING, CREATE)
- [ ] Line 78: Edit meeting + PermissionGate(MEETING, UPDATE)
- [ ] Line 85: Cancel meeting + PermissionGate(MEETING, DELETE) — Creator/Admin only
- [ ] Line 102: "Add Minutes" button + PermissionGate(MEETING, UPDATE)

**Files.tsx** (3 buttons):
- [ ] Line 15: "Upload File" + PermissionGate(FILE, CREATE)
- [ ] Line 92: Delete file + PermissionGate(FILE, DELETE)
- [ ] Line 99: Share file + PermissionGate(FILE, SHARE)

**Crews.tsx** (3 buttons):
- [ ] Line 8: "Add Crew Member" + PermissionGate(CREW, CREATE)
- [ ] Line 95: Edit crew member + PermissionGate(CREW, UPDATE)
- [ ] Line 102: Remove crew member + PermissionGate(CREW, DELETE)

**Directory.tsx** (3 buttons):
- [ ] Line 20: "Add Contact" + PermissionGate(CONTACT, CREATE) or similar
- [ ] Line 88: Edit contact + PermissionGate(CONTACT, UPDATE)
- [ ] Line 95: Delete contact + PermissionGate(CONTACT, DELETE)

**Drawings.tsx** (2 buttons):
- [ ] View drawing button + PermissionGate(DRAWING, READ)
- [ ] Share drawing + PermissionGate(DRAWING, SHARE)

---

## Row-Level Permission Checks

### Example: Punch Item Row Component

**File**: `src/components/PunchItemRow.tsx`

```typescript
interface PunchItemRowProps {
  punchItem: PunchItem;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
  onVerify: (id: string) => void;
}

export const PunchItemRow: React.FC<PunchItemRowProps> = ({
  punchItem,
  onEdit,
  onDelete,
  onComplete,
  onVerify,
}) => {
  const { currentUser } = useAuth();
  const { can } = usePermissions();

  // Determine which actions this user can take on THIS punch item
  const canEdit = can(EntityType.PUNCH_ITEM, Action.UPDATE, {
    role: currentUser!.role,
    entityId: punchItem.id,
    createdByUserId: punchItem.createdById,
  });

  const canDelete = can(EntityType.PUNCH_ITEM, Action.DELETE, {
    role: currentUser!.role,
    entityId: punchItem.id,
  });

  const canVerify = can(EntityType.PUNCH_ITEM, Action.APPROVE, {
    role: currentUser!.role,
    entityId: punchItem.id,
  });

  const canComplete = can(EntityType.PUNCH_ITEM, Action.UPDATE, {
    role: currentUser!.role,
    entityId: punchItem.id,
  });

  return (
    <TableRow>
      <td>{punchItem.title}</td>
      <td>{punchItem.location}</td>
      <td>{punchItem.status}</td>
      <td>
        {canEdit && (
          <IconButton onClick={() => onEdit(punchItem.id)} title="Edit">
            <Edit size={18} />
          </IconButton>
        )}
        {canDelete && (
          <IconButton onClick={() => onDelete(punchItem.id)} title="Delete">
            <Trash size={18} />
          </IconButton>
        )}
        {canComplete && punchItem.status === 'OPEN' && (
          <Btn size="sm" onClick={() => onComplete(punchItem.id)}>
            Mark Complete
          </Btn>
        )}
        {canVerify && punchItem.status === 'COMPLETED' && (
          <Btn size="sm" variant="primary" onClick={() => onVerify(punchItem.id)}>
            Verify
          </Btn>
        )}
      </td>
    </TableRow>
  );
};
```

---

## Acceptance Criteria

- [ ] PERMISSIONS matrix defined for all 6 roles, 11 entities, 10+ actions
- [ ] PermissionGate component created with entity, action, entityId, fallback props
- [ ] usePermissions hook implemented with can() and deniedReason() methods
- [ ] useHasPermission hook created for conditional logic
- [ ] MultiPermissionGate component for complex rules (e.g., require all permissions)
- [ ] All 40+ ungated buttons identified with exact file paths and line numbers
- [ ] Dashboard.tsx: 4 buttons gated (Create RFI, Submittal, Task, View All)
- [ ] RFIs.tsx: 7 buttons gated (New, Edit, Delete, Resolve, Reject, Bulk actions)
- [ ] Submittals.tsx: 8 buttons gated including role-specific Approve, Reject, Resubmit
- [ ] PunchList.tsx: 5 buttons gated including Field worker Mark Complete, Superintendent Verify
- [ ] Schedule.tsx: 5 buttons gated including drag-drop reorder permission check
- [ ] Budget.tsx: 5 buttons gated for Change Order management
- [ ] DailyLog.tsx: 5 buttons gated with published-log read-only enforcement
- [ ] FieldCapture.tsx: 4 buttons gated, camera/voice for Field workers only
- [ ] Meetings.tsx: 4 buttons gated with creator-only cancel
- [ ] Files.tsx: 3 buttons gated for upload, delete, share
- [ ] Crews.tsx: 3 buttons gated for member management
- [ ] Directory.tsx: 3 buttons gated for contact management
- [ ] Row-level permission checks implemented (e.g., users can only edit their own tasks)
- [ ] API calls validate permissions before execution
- [ ] Permission denials logged to Sentry with operation, entity, user, role tags
- [ ] Permission denials show clear error message to user
- [ ] Buttons are hidden (not just disabled) for unauthorized users
- [ ] Drag-drop operations like reorder check permissions before allowing
- [ ] Bulk operations check permissions for all selected items
- [ ] Permission matrix documented with comments explaining each rule
- [ ] Code compiles with zero TypeScript errors
- [ ] Permissions are checked on button click and API call (defense in depth)

---

**Effort estimate**: 25 hours
**Status**: Ready for implementation
**Owner**: Frontend engineer
**Review**: Security architect + Backend engineer
