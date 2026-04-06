# Phase 1B — Add onError + Optimistic Updates to Every Mutation

**Status**: Foundation Layer | **Priority**: Critical | **Effort**: 35 hours | **Risk**: High

## Pre-Requisite: Paste 00_SYSTEM_CONTEXT.md before this prompt

---

## Problem Statement

**Audit Findings**:
- 39 mutations missing `onError` handlers (71%)
- 54 mutations missing optimistic updates (98%)
- Only `useReorderTasks` implements optimistic UI updates
- 49 mutations missing audit trail writes (89%)
- Network failures silently fail without user notification
- Cache inconsistencies after failed mutations
- No rollback mechanism for partial updates

**Current State**:
- User clicks button, nothing happens on network error
- Optimistic UI updates only in drag-drop, not CRUD
- Failed mutations leave data in invalid state
- No audit trail of what was attempted
- No conflict resolution for concurrent edits

**Target State**:
- Every mutation has error notification, recovery, and retry UI
- Optimistic updates on all CRUD operations
- Automatic cache rollback on failure
- Complete audit trail (request, response, errors)
- Conflict detection and resolution for concurrent edits

---

## Architecture: Error Handling & Optimistic Updates

### Standard onError Pattern

```typescript
// Pattern: Standard error handler for all mutations
interface ErrorHandlerOptions {
  operationName: string;
  userFacingAction: string; // e.g., "Create RFI"
  onRollback?: () => void;
  showDetails?: boolean;
}

export function createErrorHandler(options: ErrorHandlerOptions) {
  return (error: Error) => {
    // 1. User notification
    const errorMessage =
      error instanceof NetworkError
        ? `${options.userFacingAction} failed. Check your connection and try again.`
        : error instanceof ValidationError
          ? `${options.userFacingAction} validation failed: ${error.message}`
          : `${options.userFacingAction} failed. Please try again.`;

    toast.error(errorMessage, {
      action: {
        label: 'Retry',
        onClick: () => {
          // Retry logic handled by React Query
        },
      },
    });

    // 2. Rollback optimistic updates
    if (options.onRollback) {
      options.onRollback();
    }

    // 3. Log to Sentry
    Sentry.captureException(error, {
      tags: {
        operation: options.operationName,
        type: 'mutation_error',
      },
      extra: {
        userFacingAction: options.userFacingAction,
      },
    });

    // 4. Potentially show error details in development
    if (options.showDetails && isDevelopment()) {
      console.error(`[${options.operationName}]`, error);
    }
  };
}
```

### Standard Optimistic Update Pattern

```typescript
// Pattern: Save previous data, update cache, rollback on error
interface OptimisticUpdateOptions<T> {
  queryKey: (string | number)[];
  newData: T;
  updateFn: (oldData: T[] | undefined, newData: T) => T[] | undefined;
}

export function createOptimisticUpdate<T>(
  queryClient: QueryClient,
  options: OptimisticUpdateOptions<T>
) {
  // 1. Get previous data before mutation
  const previousData = queryClient.getQueryData<T[]>(options.queryKey);

  // 2. Update cache immediately (optimistic)
  queryClient.setQueryData<T[]>(options.queryKey, (oldData) =>
    options.updateFn(oldData, options.newData)
  );

  // 3. Return rollback function
  return () => {
    queryClient.setQueryData<T[]>(options.queryKey, previousData);
  };
}
```

### Standard Audit Trail Pattern

```typescript
// Pattern: Log every mutation request/response/error
interface AuditEntry {
  id: string;
  operation: string;
  entityType: string;
  entityId?: string;
  userId: string;
  requestData: unknown;
  responseData?: unknown;
  error?: string;
  status: 'success' | 'error' | 'pending';
  timestamp: ISO8601DateTime;
  ipAddress: string;
  userAgent: string;
}

export async function writeAuditEntry(entry: Omit<AuditEntry, 'id' | 'timestamp' | 'ipAddress' | 'userAgent'>) {
  const auditEntry: AuditEntry = {
    ...entry,
    id: generateUUID(),
    timestamp: new Date().toISOString(),
    ipAddress: await getClientIP(),
    userAgent: navigator.userAgent,
  };

  const response = await fetch('/api/audit-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(auditEntry),
  });

  if (!response.ok) {
    Sentry.captureMessage('Failed to write audit log', 'warning');
  }
}
```

---

## Complete Mutation Examples: Before & After

### Example 1: useCreateRFI

**BEFORE** (No error handling, no optimistic updates):
```typescript
import { useMutation } from '@tanstack/react-query';
import { CreateRFIInput } from '@/schemas/rfi.schema';

export function useCreateRFI() {
  return useMutation({
    mutationFn: async (input: CreateRFIInput) => {
      const response = await fetch('/api/rfis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      return response.json();
    },
  });
}
```

**AFTER** (Full error handling + optimistic updates + audit trail):
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CreateRFIInput, RFIResponse } from '@/schemas/rfi.schema';
import { toast } from '@/components/Primitives';
import * as Sentry from '@sentry/react';
import { writeAuditEntry } from '@/utils/auditLog';

export function useCreateRFI() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateRFIInput) => {
      const response = await fetch('/api/rfis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create RFI');
      }

      return response.json() as Promise<RFIResponse>;
    },

    // Optimistic update: update cache before request completes
    onMutate: async (input: CreateRFIInput) => {
      // Cancel any outgoing refetches to avoid race condition
      await queryClient.cancelQueries({ queryKey: ['rfis', input.projectId] });

      // Snapshot the previous value
      const previousRFIs = queryClient.getQueryData<RFIResponse[]>([
        'rfis',
        input.projectId,
      ]);

      // Create optimistic RFI (temp ID, temporary timestamps)
      const optimisticRFI: RFIResponse = {
        id: `temp_${Date.now()}`,
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        status: 'OPEN',
        priority: input.priority || 'MEDIUM',
        createdBy: currentUser!,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dueDate: input.dueDate,
        resolvedDate: null,
        attachmentCount: 0,
        responseCount: 0,
      };

      // Optimistically update the cache
      queryClient.setQueryData<RFIResponse[]>(
        ['rfis', input.projectId],
        (old) => (old ? [optimisticRFI, ...old] : [optimisticRFI])
      );

      // Return rollback function
      return { previousRFIs };
    },

    // Success: invalidate cache to refetch fresh data
    onSuccess: async (rfiResponse: RFIResponse, input: CreateRFIInput) => {
      // Show success message
      toast.success(`RFI "${rfiResponse.title}" created successfully`, {
        action: {
          label: 'View',
          onClick: () => {
            // Navigate to RFI detail
          },
        },
      });

      // Invalidate query to force refetch
      await queryClient.invalidateQueries({
        queryKey: ['rfis', input.projectId],
      });

      // Write audit trail
      await writeAuditEntry({
        operation: 'CREATE_RFI',
        entityType: 'RFI',
        entityId: rfiResponse.id,
        userId: currentUser!.id,
        requestData: input,
        responseData: rfiResponse,
        status: 'success',
      });
    },

    // Error: rollback optimistic update and show error
    onError: (error: Error, input: CreateRFIInput, context: any) => {
      // Rollback optimistic update
      if (context?.previousRFIs) {
        queryClient.setQueryData(
          ['rfis', input.projectId],
          context.previousRFIs
        );
      }

      // Show error to user
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : 'Failed to create RFI. Please try again.';

      toast.error(errorMessage, {
        action: {
          label: 'Retry',
          onClick: () => {
            // Retry is handled by React Query's retry mechanism
          },
        },
      });

      // Log to Sentry
      Sentry.captureException(error, {
        tags: {
          operation: 'CREATE_RFI',
          projectId: input.projectId,
        },
        extra: { input },
      });

      // Write audit trail for error
      writeAuditEntry({
        operation: 'CREATE_RFI',
        entityType: 'RFI',
        userId: currentUser!.id,
        requestData: input,
        error: error.message,
        status: 'error',
      });
    },

    // Retry logic with exponential backoff
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
```

### Example 2: useUpdateRFI

**AFTER** (Full error handling + optimistic updates):
```typescript
export function useUpdateRFI() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async (input: UpdateRFIInput) => {
      const response = await fetch(`/api/rfis/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update RFI');
      }

      return response.json() as Promise<RFIResponse>;
    },

    onMutate: async (input: UpdateRFIInput) => {
      await queryClient.cancelQueries({ queryKey: ['rfi', input.id] });
      await queryClient.cancelQueries({ queryKey: ['rfis'] });

      // Get previous data
      const previousRFI = queryClient.getQueryData<RFIResponse>(['rfi', input.id]);
      const previousRFIs = queryClient.getQueryData<RFIResponse[]>(['rfis']);

      // Optimistically update single RFI
      if (previousRFI) {
        const optimisticRFI: RFIResponse = {
          ...previousRFI,
          ...input,
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData(['rfi', input.id], optimisticRFI);

        // Also update in list
        queryClient.setQueryData<RFIResponse[]>(['rfis'], (old) =>
          old
            ? old.map((rfi) => (rfi.id === input.id ? optimisticRFI : rfi))
            : undefined
        );
      }

      return { previousRFI, previousRFIs };
    },

    onSuccess: async (rfiResponse: RFIResponse, input: UpdateRFIInput) => {
      toast.success(`RFI updated successfully`);

      // Sync detail view
      queryClient.setQueryData(['rfi', input.id], rfiResponse);

      // Sync list view
      queryClient.setQueryData<RFIResponse[]>(['rfis'], (old) =>
        old
          ? old.map((rfi) => (rfi.id === input.id ? rfiResponse : rfi))
          : undefined
      );

      // Audit trail
      await writeAuditEntry({
        operation: 'UPDATE_RFI',
        entityType: 'RFI',
        entityId: input.id,
        userId: currentUser!.id,
        requestData: input,
        responseData: rfiResponse,
        status: 'success',
      });
    },

    onError: (error: Error, input: UpdateRFIInput, context: any) => {
      // Rollback
      if (context?.previousRFI) {
        queryClient.setQueryData(['rfi', input.id], context.previousRFI);
      }
      if (context?.previousRFIs) {
        queryClient.setQueryData(['rfis'], context.previousRFIs);
      }

      toast.error(`Failed to update RFI: ${error.message}`);

      Sentry.captureException(error, {
        tags: { operation: 'UPDATE_RFI', rfiId: input.id },
      });

      writeAuditEntry({
        operation: 'UPDATE_RFI',
        entityType: 'RFI',
        entityId: input.id,
        userId: currentUser!.id,
        requestData: input,
        error: error.message,
        status: 'error',
      });
    },

    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
```

### Example 3: useBulkUpdateRFIStatus

**AFTER** (Bulk operations + partial failure handling):
```typescript
export function useBulkUpdateRFIStatus() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async (input: BulkUpdateRFIStatus) => {
      const response = await fetch('/api/rfis/bulk-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error('Bulk update failed');
      }

      return response.json() as Promise<{
        successful: string[];
        failed: Array<{ id: string; error: string }>;
      }>;
    },

    onMutate: async (input: BulkUpdateRFIStatus) => {
      await queryClient.cancelQueries({ queryKey: ['rfis'] });

      const previousRFIs = queryClient.getQueryData<RFIResponse[]>(['rfis']);

      // Optimistically update all selected RFIs
      queryClient.setQueryData<RFIResponse[]>(['rfis'], (old) =>
        old
          ? old.map((rfi) =>
              input.ids.includes(rfi.id)
                ? {
                    ...rfi,
                    status: input.status as any,
                    updatedAt: new Date().toISOString(),
                  }
                : rfi
            )
          : undefined
      );

      return { previousRFIs };
    },

    onSuccess: async (result, input) => {
      if (result.failed.length === 0) {
        toast.success(`${result.successful.length} RFIs updated`);
      } else {
        toast.warning(
          `${result.successful.length} updated, ${result.failed.length} failed`
        );
      }

      // Refetch to ensure consistency
      await queryClient.invalidateQueries({ queryKey: ['rfis'] });

      // Audit trail
      await writeAuditEntry({
        operation: 'BULK_UPDATE_RFI_STATUS',
        entityType: 'RFI',
        userId: currentUser!.id,
        requestData: input,
        responseData: result,
        status: result.failed.length === 0 ? 'success' : 'error',
      });
    },

    onError: (error: Error, input: BulkUpdateRFIStatus, context: any) => {
      if (context?.previousRFIs) {
        queryClient.setQueryData(['rfis'], context.previousRFIs);
      }

      toast.error(`Bulk update failed: ${error.message}`);
      Sentry.captureException(error, {
        tags: { operation: 'BULK_UPDATE_RFI_STATUS' },
        extra: { count: input.ids.length },
      });
    },

    retry: 2,
  });
}
```

### Example 4: useDeleteRFI (Destructive Operation)

**AFTER** (Reversible with undo):
```typescript
export function useDeleteRFI() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async (input: DeleteRFIInput) => {
      const response = await fetch(`/api/rfis/${input.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: input.reason }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete RFI');
      }
    },

    onMutate: async (input: DeleteRFIInput) => {
      await queryClient.cancelQueries({ queryKey: ['rfis'] });

      const previousRFIs = queryClient.getQueryData<RFIResponse[]>(['rfis']);

      // Optimistically remove from list
      queryClient.setQueryData<RFIResponse[]>(['rfis'], (old) =>
        old ? old.filter((rfi) => rfi.id !== input.id) : undefined
      );

      // Remove from detail cache
      queryClient.removeQueries({ queryKey: ['rfi', input.id] });

      return { previousRFIs, rfiId: input.id };
    },

    onSuccess: async (_, input) => {
      // Show undo action for 10 seconds
      toast.success(`RFI deleted`, {
        action: {
          label: 'Undo',
          onClick: async () => {
            // Call undelete endpoint
            const response = await fetch(`/api/rfis/${input.id}/restore`, {
              method: 'POST',
            });
            if (response.ok) {
              await queryClient.invalidateQueries({ queryKey: ['rfis'] });
              toast.success('RFI restored');
            }
          },
        },
      });

      await writeAuditEntry({
        operation: 'DELETE_RFI',
        entityType: 'RFI',
        entityId: input.id,
        userId: currentUser!.id,
        requestData: input,
        status: 'success',
      });
    },

    onError: (error: Error, input: DeleteRFIInput, context: any) => {
      if (context?.previousRFIs) {
        queryClient.setQueryData(['rfis'], context.previousRFIs);
      }

      toast.error(`Failed to delete RFI: ${error.message}`);
    },

    retry: 1,
  });
}
```

### Example 5: useReorderTasks (Already has optimistic, now with error recovery)

**AFTER** (Full error recovery for drag-drop):
```typescript
export function useReorderTasks() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async (input: ReorderTasksInput) => {
      const response = await fetch('/api/tasks/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error('Failed to reorder tasks');
      }

      return response.json();
    },

    onMutate: async (input: ReorderTasksInput) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', input.projectId] });

      const previousTasks = queryClient.getQueryData<TaskResponse[]>([
        'tasks',
        input.projectId,
      ]);

      // Reorder in cache immediately
      const newTaskOrder = input.taskOrder.map((t) => t.id);
      queryClient.setQueryData<TaskResponse[]>(
        ['tasks', input.projectId],
        (old) => {
          if (!old) return undefined;
          return [...old].sort((a, b) =>
            newTaskOrder.indexOf(a.id) - newTaskOrder.indexOf(b.id)
          );
        }
      );

      return { previousTasks };
    },

    onSuccess: async (_, input) => {
      // No toast for reorder - too frequent
      await queryClient.invalidateQueries({
        queryKey: ['tasks', input.projectId],
      });

      await writeAuditEntry({
        operation: 'REORDER_TASKS',
        entityType: 'Task',
        userId: currentUser!.id,
        requestData: input,
        status: 'success',
      });
    },

    onError: (error: Error, input: ReorderTasksInput, context: any) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', input.projectId], context.previousTasks);
      }

      toast.error('Failed to reorder tasks. Order reverted.');

      Sentry.captureException(error, {
        tags: { operation: 'REORDER_TASKS' },
      });
    },

    retry: 2,
  });
}
```

---

## Complete Mutation Error Handling Audit

### RFI Mutations (8 total)
1. `useCreateRFI` — MISSING onError, MISSING optimistic ✓ EXAMPLE ABOVE
2. `useUpdateRFI` — MISSING onError, MISSING optimistic ✓ EXAMPLE ABOVE
3. `useBulkUpdateRFIStatus` — MISSING onError, MISSING optimistic ✓ EXAMPLE ABOVE
4. `useDeleteRFI` — MISSING onError, MISSING optimistic ✓ EXAMPLE ABOVE
5. `useResolveRFI` — MISSING onError, MISSING optimistic (src/hooks/mutations/useResolveRFI.ts:12)
6. `useAddRFIComment` — MISSING onError, MISSING optimistic (src/hooks/mutations/useAddRFIComment.ts:12)
7. `useAddRFIAttachment` — MISSING onError, MISSING optimistic (src/hooks/mutations/useAddRFIAttachment.ts:12)
8. `useRejectRFI` — MISSING onError, MISSING optimistic (src/hooks/mutations/useRejectRFI.ts:12)

### Submittal Mutations (8 total)
9. `useCreateSubmittal` — MISSING onError, MISSING optimistic (src/hooks/mutations/useCreateSubmittal.ts:12)
10. `useUpdateSubmittal` — MISSING onError, MISSING optimistic (src/hooks/mutations/useUpdateSubmittal.ts:12)
11. `useApproveSubmittal` — MISSING onError, MISSING optimistic (src/hooks/mutations/useApproveSubmittal.ts:12)
12. `useRejectSubmittal` — MISSING onError, MISSING optimistic (src/hooks/mutations/useRejectSubmittal.ts:12)
13. `useResubmitSubmittal` — MISSING onError, MISSING optimistic (src/hooks/mutations/useResubmitSubmittal.ts:12)
14. `useBulkUpdateSubmittalStatus` — MISSING onError, MISSING optimistic (src/hooks/mutations/useBulkUpdateSubmittalStatus.ts:12)
15. `useAddSubmittalComment` — MISSING onError, MISSING optimistic (src/hooks/mutations/useAddSubmittalComment.ts:12)
16. `useAddSubmittalAttachment` — MISSING onError, MISSING optimistic (src/hooks/mutations/useAddSubmittalAttachment.ts:12)

### Punch List Mutations (7 total)
17. `useCreatePunchItem` — MISSING onError, MISSING optimistic (src/hooks/mutations/useCreatePunchItem.ts:12)
18. `useUpdatePunchItem` — MISSING onError, MISSING optimistic (src/hooks/mutations/useUpdatePunchItem.ts:12)
19. `useCompletePunchItem` — MISSING onError, MISSING optimistic (src/hooks/mutations/useCompletePunchItem.ts:12)
20. `useVerifyPunchItem` — MISSING onError, MISSING optimistic (src/hooks/mutations/useVerifyPunchItem.ts:12)
21. `useBulkUpdatePunchStatus` — MISSING onError, MISSING optimistic (src/hooks/mutations/useBulkUpdatePunchStatus.ts:12)
22. `useDeletePunchItem` — MISSING onError, MISSING optimistic (src/hooks/mutations/useDeletePunchItem.ts:12)
23. `useAddPunchComment` — MISSING onError, MISSING optimistic (src/hooks/mutations/useAddPunchComment.ts:12)

### Task Mutations (7 total)
24. `useCreateTask` — MISSING onError, MISSING optimistic (src/hooks/mutations/useCreateTask.ts:12)
25. `useUpdateTask` — MISSING onError, MISSING optimistic (src/hooks/mutations/useUpdateTask.ts:12)
26. `useBulkUpdateTaskStatus` — MISSING onError, MISSING optimistic (src/hooks/mutations/useBulkUpdateTaskStatus.ts:12)
27. `useCompleteTask` — MISSING onError, MISSING optimistic (src/hooks/mutations/useCompleteTask.ts:12)
28. `useDeleteTask` — MISSING onError, MISSING optimistic (src/hooks/mutations/useDeleteTask.ts:12)
29. `useReorderTasks` — HAS optimistic, MISSING onError ✓ EXAMPLE ABOVE
30. `useAddTaskComment` — MISSING onError, MISSING optimistic (src/hooks/mutations/useAddTaskComment.ts:12)

### Daily Log Mutations (5 total)
31. `useCreateDailyLog` — MISSING onError, MISSING optimistic (src/hooks/mutations/useCreateDailyLog.ts:12)
32. `useUpdateDailyLog` — MISSING onError, MISSING optimistic (src/hooks/mutations/useUpdateDailyLog.ts:12)
33. `useDeleteDailyLog` — MISSING onError, MISSING optimistic (src/hooks/mutations/useDeleteDailyLog.ts:12)
34. `useAddDailyLogAttachment` — MISSING onError, MISSING optimistic (src/hooks/mutations/useAddDailyLogAttachment.ts:12)
35. `usePublishDailyLog` — MISSING onError, MISSING optimistic (src/hooks/mutations/usePublishDailyLog.ts:12)

### Change Order Mutations (5 total)
36. `useCreateChangeOrder` — MISSING onError, MISSING optimistic (src/hooks/mutations/useCreateChangeOrder.ts:12)
37. `useUpdateChangeOrder` — MISSING onError, MISSING optimistic (src/hooks/mutations/useUpdateChangeOrder.ts:12)
38. `useApproveChangeOrder` — MISSING onError, MISSING optimistic (src/hooks/mutations/useApproveChangeOrder.ts:12)
39. `useRejectChangeOrder` — MISSING onError, MISSING optimistic (src/hooks/mutations/useRejectChangeOrder.ts:12)
40. `useImplementChangeOrder` — MISSING onError, MISSING optimistic (src/hooks/mutations/useImplementChangeOrder.ts:12)

### Meeting Mutations (4 total)
41. `useCreateMeeting` — MISSING onError, MISSING optimistic (src/hooks/mutations/useCreateMeeting.ts:12)
42. `useUpdateMeeting` — MISSING onError, MISSING optimistic (src/hooks/mutations/useUpdateMeeting.ts:12)
43. `useDeleteMeeting` — MISSING onError, MISSING optimistic (src/hooks/mutations/useDeleteMeeting.ts:12)
44. `useAddMeetingMinutes` — MISSING onError, MISSING optimistic (src/hooks/mutations/useAddMeetingMinutes.ts:12)

### File Management Mutations (3 total)
45. `useUploadFile` — MISSING onError, MISSING optimistic (src/hooks/mutations/useUploadFile.ts:12)
46. `useDeleteFile` — MISSING onError, MISSING optimistic (src/hooks/mutations/useDeleteFile.ts:12)
47. `useShareFile` — MISSING onError, MISSING optimistic (src/hooks/mutations/useShareFile.ts:12)

### Field Capture Mutations (4 total)
48. `useCreateFieldCapture` — MISSING onError, MISSING optimistic (src/hooks/mutations/useCreateFieldCapture.ts:12)
49. `useAddFieldPhoto` — MISSING onError, MISSING optimistic (src/hooks/mutations/useAddFieldPhoto.ts:12)
50. `useAddFieldVoiceNote` — MISSING onError, MISSING optimistic (src/hooks/mutations/useAddFieldVoiceNote.ts:12)
51. `useUpdateFieldCaptureProgress` — MISSING onError, MISSING optimistic (src/hooks/mutations/useUpdateFieldCaptureProgress.ts:12)

### Crew & Personnel Mutations (2 total)
52. `useCreateCrewMember` — MISSING onError, MISSING optimistic (src/hooks/mutations/useCreateCrewMember.ts:12)
53. `useUpdateCrewMember` — MISSING onError, MISSING optimistic (src/hooks/mutations/useUpdateCrewMember.ts:12)

### Directory Contact Mutations (2 total)
54. `useCreateContact` — MISSING onError, MISSING optimistic (src/hooks/mutations/useCreateContact.ts:12)
55. `useUpdateContact` — MISSING onError, MISSING optimistic (src/hooks/mutations/useUpdateContact.ts:12)

---

## Audit Log Infrastructure

### Create Audit Logging Service

**File**: `src/utils/auditLog.ts`

```typescript
import { generateUUID } from '@/utils/id';
import * as Sentry from '@sentry/react';

export interface AuditEntry {
  id: string;
  operation: string;
  entityType: string;
  entityId?: string;
  userId: string;
  projectId?: string;
  requestData: unknown;
  responseData?: unknown;
  error?: string;
  status: 'success' | 'error' | 'pending';
  timestamp: string;
  ipAddress?: string;
  userAgent: string;
  durationMs?: number;
}

export async function writeAuditEntry(
  entry: Omit<AuditEntry, 'id' | 'timestamp' | 'userAgent'>
): Promise<void> {
  const auditEntry: AuditEntry = {
    ...entry,
    id: generateUUID(),
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
  };

  try {
    const response = await fetch('/api/audit-logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': auditEntry.id,
      },
      body: JSON.stringify(auditEntry),
    });

    if (!response.ok) {
      Sentry.captureMessage(
        `Failed to write audit log: ${response.status}`,
        'warning'
      );
    }
  } catch (error) {
    // Log audit failures to Sentry but don't fail the mutation
    Sentry.captureException(error, {
      tags: { context: 'audit_log_write' },
      extra: { operation: entry.operation },
    });
  }
}

export async function getAuditLog(
  entityType: string,
  entityId: string
): Promise<AuditEntry[]> {
  const response = await fetch(
    `/api/audit-logs?entityType=${entityType}&entityId=${entityId}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch audit log');
  }

  return response.json();
}
```

---

## Conflict Resolution for Concurrent Edits

**File**: `src/hooks/mutations/useConflictDetection.ts`

```typescript
import { MutationStatus } from '@tanstack/react-query';

export interface ConflictError extends Error {
  name: 'ConflictError';
  serverVersion: unknown;
  clientVersion: unknown;
}

export function isConflictError(error: unknown): error is ConflictError {
  return (
    error instanceof Error &&
    error.name === 'ConflictError'
  );
}

export function handleConflict(conflict: ConflictError) {
  // Show conflict resolution UI to user
  const choice = confirm(
    `This item was modified by another user.\n\nYour changes: ${JSON.stringify(conflict.clientVersion)}\nServer changes: ${JSON.stringify(conflict.serverVersion)}\n\nClick OK to keep your changes, Cancel to use server version.`
  );

  if (choice) {
    return { strategy: 'FORCE_UPDATE', payload: conflict.clientVersion };
  } else {
    return { strategy: 'ACCEPT_SERVER', payload: conflict.serverVersion };
  }
}
```

---

## Toast Notification Patterns

**File**: `src/components/ToastPatterns.tsx`

```typescript
import { toast } from '@/components/Primitives';

// Pattern 1: Simple error
toast.error('Failed to create RFI');

// Pattern 2: Error with retry
toast.error('Failed to create RFI', {
  action: {
    label: 'Retry',
    onClick: () => mutation.mutate(input),
  },
});

// Pattern 3: Error with details
toast.error('Validation failed: Title too short', {
  action: {
    label: 'Edit',
    onClick: () => scrollToField('title'),
  },
});

// Pattern 4: Reversible destructive action
toast.success('RFI deleted', {
  action: {
    label: 'Undo',
    onClick: async () => {
      await restoreRFI();
    },
  },
});

// Pattern 5: Long-running operation
const toastId = toast.loading('Creating RFI...');
try {
  await createRFI();
  toast.success('RFI created', { id: toastId });
} catch (error) {
  toast.error('Failed to create RFI', { id: toastId });
}
```

---

## Acceptance Criteria

- [ ] `createAuditedMutation.ts` wrapper implemented with Zod validation, onError, and audit logging
- [ ] All 55 mutations updated with complete `onMutate` optimistic update pattern
- [ ] All 55 mutations updated with complete `onError` rollback pattern
- [ ] All 55 mutations updated with complete `onSuccess` audit trail logging
- [ ] At least 5 complete before/after mutation examples provided (useCreateRFI, useUpdateRFI, useBulkUpdateRFIStatus, useDeleteRFI, useReorderTasks)
- [ ] `writeAuditEntry()` service created and callable from every mutation
- [ ] Audit table schema supports entityType, operation, userId, status, timestamp
- [ ] Network retry logic with exponential backoff (3 retries, max 30 seconds)
- [ ] Conflict detection and resolution for concurrent edits
- [ ] Toast patterns for success, error, retry, undo, and loading states
- [ ] Sentry integration logging every mutation error with tags and context
- [ ] All mutations cancel pending requests before updating cache
- [ ] All mutations rollback correctly when error occurs
- [ ] All mutations handle partial failure (bulk operations)
- [ ] Code compiles with zero TypeScript errors
- [ ] Audit logs can be queried by entity type and ID
- [ ] Undo functionality works for destructive operations (delete)

---

**Effort estimate**: 35 hours
**Status**: Ready for implementation
**Owner**: Full-stack engineer
**Review**: Backend architect + Frontend lead
