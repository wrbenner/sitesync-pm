# Phase 1A — Add Zod Schemas to Every Mutation

**Status**: Foundation Layer | **Priority**: Critical | **Effort**: 40 hours | **Risk**: High

## Pre-Requisite: Paste 00_SYSTEM_CONTEXT.md before this prompt

---

## Problem Statement

**Audit Finding**: 55 mutations exist with ZERO runtime input validation. No Zod schemas, no safeguards against malformed data reaching the database.

**Current State**:
- API requests trust client input completely
- Database constraints not enforced at application layer
- Invalid data types can crash mutations
- No request logging or audit trail
- Edge cases (empty strings, invalid enums) bypass validation

**Target State**:
- Every mutation input validated with Zod before database write
- Clear error messages for invalid input
- Type-safe mutations with schema inference
- Validation errors logged to Sentry
- Request/response audit trail

---

## Architecture: Zod Schema Layer

### Schema Directory Structure
```
src/schemas/
  index.ts                    # Barrel export + shared patterns
  rfi.schema.ts               # RFI mutations
  submittal.schema.ts         # Submittal mutations
  punchItem.schema.ts         # Punch list mutations
  task.schema.ts              # Task mutations
  dailyLog.schema.ts          # Daily log mutations
  changeOrder.schema.ts       # Change order mutations
  meeting.schema.ts           # Meeting mutations
  file.schema.ts              # File management mutations
  fieldCapture.schema.ts      # Mobile field capture mutations
  crew.schema.ts              # Crew and personnel mutations
  contact.schema.ts           # Directory contact mutations
  notification.schema.ts      # Notification mutations
  safetyInspection.schema.ts  # Safety inspection mutations
  incident.schema.ts          # Incident report mutations
  drawing.schema.ts           # Drawing mutations
  transmittal.schema.ts       # Transmittal mutations
  agent.schema.ts             # AI agent mutations
  integration.schema.ts       # Integration mutations
```

### Zod Pattern: Shared Base Schemas

**File**: `src/schemas/index.ts`

```typescript
import { z } from 'zod';

// Shared reusable schemas
export const IdSchema = z.string().uuid('Invalid ID format');
export const EmailSchema = z.string().email('Invalid email address');
export const URLSchema = z.string().url('Invalid URL');
export const PhoneSchema = z.string().regex(/^[\d\-\+\(\)\s]+$/, 'Invalid phone format');
export const DateSchema = z.string().datetime('Invalid ISO datetime');
export const TimestampSchema = z.number().positive('Timestamp must be positive');

// Status enums matching database constraints exactly
export const RFIStatusEnum = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'VOID'
]);

export const SubmittalStatusEnum = z.enum([
  'NOT_REQUIRED',
  'PENDING_SUBMISSION',
  'SUBMITTED',
  'APPROVED',
  'APPROVED_AS_NOTED',
  'REJECTED',
  'RESUBMIT'
]);

export const PunchStatusEnum = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
  'VERIFIED',
  'CLOSED'
]);

export const TaskStatusEnum = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'ON_HOLD',
  'CANCELLED'
]);

export const PriorityEnum = z.enum([
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW'
]);

export const UserRoleEnum = z.enum([
  'PROJECT_ADMIN',
  'PM',
  'SUPERINTENDENT',
  'FIELD_WORKER',
  'SUBCONTRACTOR_MANAGER',
  'GUEST'
]);

// Pagination schema
export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['ASC', 'DESC']).default('DESC'),
});

export type Pagination = z.infer<typeof PaginationSchema>;

// Standard response wrapper
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    timestamp: z.string().datetime(),
  });
```

---

## Complete Zod Schemas: 5 Core Entities

### 1. RFI Schema

**File**: `src/schemas/rfi.schema.ts`

```typescript
import { z } from 'zod';
import {
  IdSchema,
  EmailSchema,
  DateSchema,
  RFIStatusEnum,
  PriorityEnum,
} from './index';

// Create RFI input validation
export const CreateRFISchema = z.object({
  projectId: IdSchema,
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(255, 'Title cannot exceed 255 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description cannot exceed 5000 characters'),
  assignedToId: IdSchema.optional(),
  dueDate: DateSchema,
  priority: PriorityEnum.default('MEDIUM'),
  attachments: z.array(IdSchema).default([]),
  relatedDrawingIds: z.array(IdSchema).default([]),
  notes: z.string().max(5000).optional().default(''),
});

export type CreateRFIInput = z.infer<typeof CreateRFISchema>;

// Update RFI input validation
export const UpdateRFISchema = z.object({
  id: IdSchema,
  title: z
    .string()
    .min(5)
    .max(255)
    .optional(),
  description: z
    .string()
    .min(10)
    .max(5000)
    .optional(),
  status: RFIStatusEnum.optional(),
  assignedToId: IdSchema.optional().nullable(),
  dueDate: DateSchema.optional(),
  priority: PriorityEnum.optional(),
  notes: z.string().max(5000).optional(),
  attachments: z.array(IdSchema).optional(),
  relatedDrawingIds: z.array(IdSchema).optional(),
  resolvedDate: DateSchema.optional().nullable(),
  resolvedBy: IdSchema.optional().nullable(),
});

export type UpdateRFIInput = z.infer<typeof UpdateRFISchema>;

// Bulk status update
export const BulkUpdateRFIStatusSchema = z.object({
  ids: z.array(IdSchema).min(1, 'At least one RFI must be selected'),
  status: RFIStatusEnum,
  notes: z.string().max(5000).optional(),
});

export type BulkUpdateRFIStatus = z.infer<typeof BulkUpdateRFIStatusSchema>;

// Delete RFI
export const DeleteRFISchema = z.object({
  id: IdSchema,
  reason: z
    .string()
    .min(5)
    .max(500)
    .optional(),
});

export type DeleteRFIInput = z.infer<typeof DeleteRFISchema>;

// Response schema (infer from database)
export const RFIResponseSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  title: z.string(),
  description: z.string(),
  status: RFIStatusEnum,
  priority: PriorityEnum,
  assignedTo: z.object({ id: IdSchema, name: z.string() }).optional(),
  createdBy: z.object({ id: IdSchema, name: z.string() }),
  createdAt: DateSchema,
  updatedAt: DateSchema,
  dueDate: DateSchema,
  resolvedDate: DateSchema.nullable(),
  resolvedBy: z.object({ id: IdSchema, name: z.string() }).optional(),
  attachmentCount: z.number().int().nonnegative(),
  responseCount: z.number().int().nonnegative(),
});

export type RFIResponse = z.infer<typeof RFIResponseSchema>;
```

### 2. Submittal Schema

**File**: `src/schemas/submittal.schema.ts`

```typescript
import { z } from 'zod';
import {
  IdSchema,
  DateSchema,
  SubmittalStatusEnum,
  PriorityEnum,
} from './index';

export const CreateSubmittalSchema = z.object({
  projectId: IdSchema,
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(255, 'Title cannot exceed 255 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description cannot exceed 5000 characters'),
  supplier: z
    .string()
    .min(2, 'Supplier name required')
    .max(255),
  specSection: z
    .string()
    .min(2)
    .max(100)
    .optional(),
  submittedDate: DateSchema,
  requiredApprovalDate: DateSchema,
  assignedToId: IdSchema.optional(),
  priority: PriorityEnum.default('MEDIUM'),
  attachments: z.array(IdSchema).default([]),
  notes: z.string().max(5000).optional().default(''),
});

export type CreateSubmittalInput = z.infer<typeof CreateSubmittalSchema>;

export const UpdateSubmittalSchema = z.object({
  id: IdSchema,
  title: z.string().min(5).max(255).optional(),
  description: z.string().min(10).max(5000).optional(),
  status: SubmittalStatusEnum.optional(),
  supplier: z.string().min(2).max(255).optional(),
  specSection: z.string().min(2).max(100).optional(),
  submittedDate: DateSchema.optional(),
  requiredApprovalDate: DateSchema.optional(),
  approvedDate: DateSchema.optional().nullable(),
  approvedBy: IdSchema.optional().nullable(),
  rejectionReason: z.string().max(5000).optional().nullable(),
  notes: z.string().max(5000).optional(),
  attachments: z.array(IdSchema).optional(),
});

export type UpdateSubmittalInput = z.infer<typeof UpdateSubmittalSchema>;

export const ApproveSubmittalSchema = z.object({
  id: IdSchema,
  status: z.enum(['APPROVED', 'APPROVED_AS_NOTED']),
  notes: z.string().max(5000).optional(),
});

export type ApproveSubmittalInput = z.infer<typeof ApproveSubmittalSchema>;

export const RejectSubmittalSchema = z.object({
  id: IdSchema,
  reason: z
    .string()
    .min(10, 'Rejection reason must be at least 10 characters')
    .max(5000, 'Rejection reason cannot exceed 5000 characters'),
  notes: z.string().max(5000).optional(),
});

export type RejectSubmittalInput = z.infer<typeof RejectSubmittalSchema>;

export const SubmittalResponseSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  title: z.string(),
  description: z.string(),
  status: SubmittalStatusEnum,
  priority: PriorityEnum,
  supplier: z.string(),
  specSection: z.string().nullable(),
  submittedDate: DateSchema,
  requiredApprovalDate: DateSchema,
  approvedDate: DateSchema.nullable(),
  approvedBy: z.object({ id: IdSchema, name: z.string() }).optional(),
  rejectionReason: z.string().nullable(),
  createdBy: z.object({ id: IdSchema, name: z.string() }),
  createdAt: DateSchema,
  updatedAt: DateSchema,
  attachmentCount: z.number().int().nonnegative(),
});

export type SubmittalResponse = z.infer<typeof SubmittalResponseSchema>;
```

### 3. Punch Item Schema

**File**: `src/schemas/punchItem.schema.ts`

```typescript
import { z } from 'zod';
import {
  IdSchema,
  DateSchema,
  PunchStatusEnum,
  PriorityEnum,
} from './index';

export const CreatePunchItemSchema = z.object({
  projectId: IdSchema,
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(255, 'Title cannot exceed 255 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description cannot exceed 5000 characters'),
  location: z
    .string()
    .min(3, 'Location required')
    .max(255),
  trade: z
    .string()
    .min(2)
    .max(100),
  assignedToId: IdSchema.optional(),
  priority: PriorityEnum.default('MEDIUM'),
  dueDate: DateSchema,
  estimatedHours: z
    .number()
    .positive('Estimated hours must be greater than 0')
    .max(1000),
  area: z.string().max(255).optional(),
  attachments: z.array(IdSchema).default([]),
  relatedDrawingIds: z.array(IdSchema).default([]),
  notes: z.string().max(5000).optional().default(''),
});

export type CreatePunchItemInput = z.infer<typeof CreatePunchItemSchema>;

export const UpdatePunchItemSchema = z.object({
  id: IdSchema,
  title: z.string().min(5).max(255).optional(),
  description: z.string().min(10).max(5000).optional(),
  status: PunchStatusEnum.optional(),
  location: z.string().min(3).max(255).optional(),
  trade: z.string().min(2).max(100).optional(),
  assignedToId: IdSchema.optional().nullable(),
  priority: PriorityEnum.optional(),
  dueDate: DateSchema.optional(),
  estimatedHours: z.number().positive().max(1000).optional(),
  actualHours: z.number().nonnegative().max(1000).optional(),
  completedDate: DateSchema.optional().nullable(),
  completedBy: IdSchema.optional().nullable(),
  verifiedDate: DateSchema.optional().nullable(),
  verifiedBy: IdSchema.optional().nullable(),
  notes: z.string().max(5000).optional(),
  attachments: z.array(IdSchema).optional(),
});

export type UpdatePunchItemInput = z.infer<typeof UpdatePunchItemSchema>;

export const CompletePunchItemSchema = z.object({
  id: IdSchema,
  actualHours: z
    .number()
    .nonnegative('Actual hours cannot be negative')
    .max(1000),
  notes: z.string().max(5000).optional(),
  attachments: z.array(IdSchema).optional(),
});

export type CompletePunchItemInput = z.infer<typeof CompletePunchItemSchema>;

export const VerifyPunchItemSchema = z.object({
  id: IdSchema,
  approved: z.boolean(),
  notes: z.string().max(5000).optional(),
});

export type VerifyPunchItemInput = z.infer<typeof VerifyPunchItemSchema>;

export const PunchItemResponseSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  title: z.string(),
  description: z.string(),
  status: PunchStatusEnum,
  priority: PriorityEnum,
  location: z.string(),
  trade: z.string(),
  assignedTo: z.object({ id: IdSchema, name: z.string() }).optional(),
  createdBy: z.object({ id: IdSchema, name: z.string() }),
  createdAt: DateSchema,
  updatedAt: DateSchema,
  dueDate: DateSchema,
  estimatedHours: z.number(),
  actualHours: z.number().nullable(),
  completedDate: DateSchema.nullable(),
  verifiedDate: DateSchema.nullable(),
  attachmentCount: z.number().int().nonnegative(),
});

export type PunchItemResponse = z.infer<typeof PunchItemResponseSchema>;
```

### 4. Task Schema

**File**: `src/schemas/task.schema.ts`

```typescript
import { z } from 'zod';
import {
  IdSchema,
  DateSchema,
  TaskStatusEnum,
  PriorityEnum,
} from './index';

export const CreateTaskSchema = z.object({
  projectId: IdSchema,
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(255, 'Title cannot exceed 255 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description cannot exceed 5000 characters'),
  assignedToIds: z.array(IdSchema).default([]),
  priority: PriorityEnum.default('MEDIUM'),
  dueDate: DateSchema,
  estimatedHours: z
    .number()
    .positive('Estimated hours must be greater than 0')
    .max(1000),
  tags: z.array(z.string().max(50)).default([]),
  parentTaskId: IdSchema.optional().nullable(),
  dependencies: z.array(IdSchema).default([]),
  notes: z.string().max(5000).optional().default(''),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  id: IdSchema,
  title: z.string().min(5).max(255).optional(),
  description: z.string().min(10).max(5000).optional(),
  status: TaskStatusEnum.optional(),
  assignedToIds: z.array(IdSchema).optional(),
  priority: PriorityEnum.optional(),
  dueDate: DateSchema.optional(),
  estimatedHours: z.number().positive().max(1000).optional(),
  actualHours: z.number().nonnegative().max(1000).optional(),
  percentComplete: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional(),
  completedDate: DateSchema.optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
  dependencies: z.array(IdSchema).optional(),
  notes: z.string().max(5000).optional(),
});

export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export const BulkUpdateTaskStatusSchema = z.object({
  ids: z.array(IdSchema).min(1, 'At least one task must be selected'),
  status: TaskStatusEnum,
  notes: z.string().max(5000).optional(),
});

export type BulkUpdateTaskStatus = z.infer<typeof BulkUpdateTaskStatusSchema>;

export const ReorderTasksSchema = z.object({
  projectId: IdSchema,
  taskOrder: z.array(
    z.object({
      id: IdSchema,
      order: z.number().int().nonnegative(),
    })
  ),
});

export type ReorderTasksInput = z.infer<typeof ReorderTasksSchema>;

export const TaskResponseSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  title: z.string(),
  description: z.string(),
  status: TaskStatusEnum,
  priority: PriorityEnum,
  assignedTo: z.array(z.object({ id: IdSchema, name: z.string() })),
  createdBy: z.object({ id: IdSchema, name: z.string() }),
  createdAt: DateSchema,
  updatedAt: DateSchema,
  dueDate: DateSchema,
  estimatedHours: z.number(),
  actualHours: z.number().nullable(),
  percentComplete: z.number().int().min(0).max(100),
  completedDate: DateSchema.nullable(),
  tags: z.array(z.string()),
  subtaskCount: z.number().int().nonnegative(),
});

export type TaskResponse = z.infer<typeof TaskResponseSchema>;
```

### 5. Change Order Schema

**File**: `src/schemas/changeOrder.schema.ts`

```typescript
import { z } from 'zod';
import {
  IdSchema,
  DateSchema,
  PriorityEnum,
} from './index';

export const ChangeOrderStatusEnum = z.enum([
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'IMPLEMENTED',
  'CLOSED'
]);

export const CreateChangeOrderSchema = z.object({
  projectId: IdSchema,
  number: z
    .string()
    .min(1)
    .max(50)
    .optional(),
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(255, 'Title cannot exceed 255 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description cannot exceed 5000 characters'),
  reason: z
    .string()
    .min(5)
    .max(5000),
  costImpact: z
    .number()
    .int('Cost impact must be in cents (integer)'),
  scheduleImpactDays: z
    .number()
    .int()
    .optional()
    .default(0),
  priority: PriorityEnum.default('MEDIUM'),
  requiredApprovalDate: DateSchema.optional(),
  relatedRFIIds: z.array(IdSchema).default([]),
  attachments: z.array(IdSchema).default([]),
  notes: z.string().max(5000).optional().default(''),
});

export type CreateChangeOrderInput = z.infer<typeof CreateChangeOrderSchema>;

export const UpdateChangeOrderSchema = z.object({
  id: IdSchema,
  title: z.string().min(5).max(255).optional(),
  description: z.string().min(10).max(5000).optional(),
  reason: z.string().min(5).max(5000).optional(),
  costImpact: z.number().int().optional(),
  scheduleImpactDays: z.number().int().optional(),
  priority: PriorityEnum.optional(),
  requiredApprovalDate: DateSchema.optional().nullable(),
  notes: z.string().max(5000).optional(),
  attachments: z.array(IdSchema).optional(),
});

export type UpdateChangeOrderInput = z.infer<typeof UpdateChangeOrderSchema>;

export const ApproveChangeOrderSchema = z.object({
  id: IdSchema,
  approvalComments: z
    .string()
    .min(5, 'Approval comments required')
    .max(5000),
});

export type ApproveChangeOrderInput = z.infer<typeof ApproveChangeOrderSchema>;

export const RejectChangeOrderSchema = z.object({
  id: IdSchema,
  rejectionReason: z
    .string()
    .min(10, 'Rejection reason required')
    .max(5000),
});

export type RejectChangeOrderInput = z.infer<typeof RejectChangeOrderSchema>;

export const ChangeOrderResponseSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  number: z.string(),
  title: z.string(),
  description: z.string(),
  status: ChangeOrderStatusEnum,
  priority: PriorityEnum,
  reason: z.string(),
  costImpact: z.number(),
  scheduleImpactDays: z.number(),
  createdBy: z.object({ id: IdSchema, name: z.string() }),
  createdAt: DateSchema,
  updatedAt: DateSchema,
  approvedBy: z.object({ id: IdSchema, name: z.string() }).optional(),
  approvedDate: DateSchema.nullable(),
  attachmentCount: z.number().int().nonnegative(),
});

export type ChangeOrderResponse = z.infer<typeof ChangeOrderResponseSchema>;
```

---

## Integration Pattern: Mutation Hook Template

**File**: `src/hooks/mutations/createAuditedMutation.ts`

```typescript
import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { ZodSchema } from 'zod';
import { toast } from '@/components/Primitives';
import * as Sentry from '@sentry/react';

interface AuditedMutationOptions<TInput, TOutput> extends Omit<UseMutationOptions<TOutput, Error, TInput>, 'mutationFn'> {
  name: string;
  schema: ZodSchema;
  apiCall: (input: TInput) => Promise<TOutput>;
  onSuccess?: (data: TOutput, variables: TInput) => void | Promise<void>;
}

export function createAuditedMutation<TInput, TOutput>(
  options: AuditedMutationOptions<TInput, TOutput>
) {
  return useMutation<TOutput, Error, TInput>({
    ...options,
    mutationFn: async (input: TInput) => {
      try {
        // Validate input with Zod
        const validated = options.schema.parse(input);

        // Log request for audit trail
        console.info(`[MUTATION] ${options.name}:`, {
          timestamp: new Date().toISOString(),
          input: validated,
        });

        // Execute API call
        const result = await options.apiCall(validated);

        // Call onSuccess if provided
        if (options.onSuccess) {
          await options.onSuccess(result, input);
        }

        return result;
      } catch (error) {
        if (error instanceof Error) {
          // Validation errors
          if (error.name === 'ZodError') {
            toast.error(`Validation error: ${error.message}`);
            Sentry.captureException(error, {
              tags: { mutation: options.name, type: 'validation' },
            });
          } else {
            // API errors
            toast.error(`Failed to ${options.name}: ${error.message}`);
            Sentry.captureException(error, {
              tags: { mutation: options.name, type: 'api' },
            });
          }
        }
        throw error;
      }
    },
  });
}
```

### Usage Example in Mutation Hook

**File**: `src/hooks/mutations/useCreateRFI.ts` (Before and After)

**BEFORE** (No validation):
```typescript
export function useCreateRFI() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: any) => {
      const response = await fetch('/api/rfis', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfis'] });
    },
  });
}
```

**AFTER** (With Zod validation):
```typescript
import { CreateRFISchema } from '@/schemas/rfi.schema';
import { createAuditedMutation } from './createAuditedMutation';

export function useCreateRFI() {
  const queryClient = useQueryClient();

  return createAuditedMutation({
    name: 'createRFI',
    schema: CreateRFISchema,
    apiCall: async (input) => {
      const response = await fetch('/api/rfis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create RFI');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfis'] });
      toast.success('RFI created successfully');
    },
  });
}
```

---

## Complete Mutation Audit: All 55 Mutations

### RFI Mutations (8)
1. `useCreateRFI()` — src/hooks/mutations/useCreateRFI.ts:12
2. `useUpdateRFI()` — src/hooks/mutations/useUpdateRFI.ts:12
3. `useBulkUpdateRFIStatus()` — src/hooks/mutations/useBulkUpdateRFIStatus.ts:12
4. `useDeleteRFI()` — src/hooks/mutations/useDeleteRFI.ts:12
5. `useResolveRFI()` — src/hooks/mutations/useResolveRFI.ts:12
6. `useAddRFIComment()` — src/hooks/mutations/useAddRFIComment.ts:12
7. `useAddRFIAttachment()` — src/hooks/mutations/useAddRFIAttachment.ts:12
8. `useRejectRFI()` — src/hooks/mutations/useRejectRFI.ts:12

### Submittal Mutations (8)
9. `useCreateSubmittal()` — src/hooks/mutations/useCreateSubmittal.ts:12
10. `useUpdateSubmittal()` — src/hooks/mutations/useUpdateSubmittal.ts:12
11. `useApproveSubmittal()` — src/hooks/mutations/useApproveSubmittal.ts:12
12. `useRejectSubmittal()` — src/hooks/mutations/useRejectSubmittal.ts:12
13. `useResubmitSubmittal()` — src/hooks/mutations/useResubmitSubmittal.ts:12
14. `useBulkUpdateSubmittalStatus()` — src/hooks/mutations/useBulkUpdateSubmittalStatus.ts:12
15. `useAddSubmittalComment()` — src/hooks/mutations/useAddSubmittalComment.ts:12
16. `useAddSubmittalAttachment()` — src/hooks/mutations/useAddSubmittalAttachment.ts:12

### Punch List Mutations (7)
17. `useCreatePunchItem()` — src/hooks/mutations/useCreatePunchItem.ts:12
18. `useUpdatePunchItem()` — src/hooks/mutations/useUpdatePunchItem.ts:12
19. `useCompletePunchItem()` — src/hooks/mutations/useCompletePunchItem.ts:12
20. `useVerifyPunchItem()` — src/hooks/mutations/useVerifyPunchItem.ts:12
21. `useBulkUpdatePunchStatus()` — src/hooks/mutations/useBulkUpdatePunchStatus.ts:12
22. `useDeletePunchItem()` — src/hooks/mutations/useDeletePunchItem.ts:12
23. `useAddPunchComment()` — src/hooks/mutations/useAddPunchComment.ts:12

### Task Mutations (7)
24. `useCreateTask()` — src/hooks/mutations/useCreateTask.ts:12
25. `useUpdateTask()` — src/hooks/mutations/useUpdateTask.ts:12
26. `useBulkUpdateTaskStatus()` — src/hooks/mutations/useBulkUpdateTaskStatus.ts:12
27. `useCompleteTask()` — src/hooks/mutations/useCompleteTask.ts:12
28. `useDeleteTask()` — src/hooks/mutations/useDeleteTask.ts:12
29. `useReorderTasks()` — src/hooks/mutations/useReorderTasks.ts:12 (ONLY ONE WITH OPTIMISTIC UPDATES)
30. `useAddTaskComment()` — src/hooks/mutations/useAddTaskComment.ts:12

### Daily Log Mutations (5)
31. `useCreateDailyLog()` — src/hooks/mutations/useCreateDailyLog.ts:12
32. `useUpdateDailyLog()` — src/hooks/mutations/useUpdateDailyLog.ts:12
33. `useDeleteDailyLog()` — src/hooks/mutations/useDeleteDailyLog.ts:12
34. `useAddDailyLogAttachment()` — src/hooks/mutations/useAddDailyLogAttachment.ts:12
35. `usePublishDailyLog()` — src/hooks/mutations/usePublishDailyLog.ts:12

### Change Order Mutations (5)
36. `useCreateChangeOrder()` — src/hooks/mutations/useCreateChangeOrder.ts:12
37. `useUpdateChangeOrder()` — src/hooks/mutations/useUpdateChangeOrder.ts:12
38. `useApproveChangeOrder()` — src/hooks/mutations/useApproveChangeOrder.ts:12
39. `useRejectChangeOrder()` — src/hooks/mutations/useRejectChangeOrder.ts:12
40. `useImplementChangeOrder()` — src/hooks/mutations/useImplementChangeOrder.ts:12

### Meeting Mutations (4)
41. `useCreateMeeting()` — src/hooks/mutations/useCreateMeeting.ts:12
42. `useUpdateMeeting()` — src/hooks/mutations/useUpdateMeeting.ts:12
43. `useDeleteMeeting()` — src/hooks/mutations/useDeleteMeeting.ts:12
44. `useAddMeetingMinutes()` — src/hooks/mutations/useAddMeetingMinutes.ts:12

### File Management Mutations (3)
45. `useUploadFile()` — src/hooks/mutations/useUploadFile.ts:12
46. `useDeleteFile()` — src/hooks/mutations/useDeleteFile.ts:12
47. `useShareFile()` — src/hooks/mutations/useShareFile.ts:12

### Field Capture Mutations (4)
48. `useCreateFieldCapture()` — src/hooks/mutations/useCreateFieldCapture.ts:12
49. `useAddFieldPhoto()` — src/hooks/mutations/useAddFieldPhoto.ts:12
50. `useAddFieldVoiceNote()` — src/hooks/mutations/useAddFieldVoiceNote.ts:12
51. `useUpdateFieldCaptureProgress()` — src/hooks/mutations/useUpdateFieldCaptureProgress.ts:12

### Crew & Personnel Mutations (2)
52. `useCreateCrewMember()` — src/hooks/mutations/useCreateCrewMember.ts:12
53. `useUpdateCrewMember()` — src/hooks/mutations/useUpdateCrewMember.ts:12

### Directory Contact Mutations (1)
54. `useCreateContact()` — src/hooks/mutations/useCreateContact.ts:12
55. `useUpdateContact()` — src/hooks/mutations/useUpdateContact.ts:12

---

## Type Safety: Generics Fix for Mutation Hook Index

**File**: `src/hooks/mutations/index.ts`

**BEFORE**:
```typescript
export * from './useCreateRFI';
export * from './useUpdateRFI';
// ... etc, no type exports
```

**AFTER**:
```typescript
// Type exports
export type { CreateRFIInput, UpdateRFIInput, RFIResponse } from '@/schemas/rfi.schema';
export type { CreateSubmittalInput, UpdateSubmittalInput, SubmittalResponse } from '@/schemas/submittal.schema';
export type { CreatePunchItemInput, UpdatePunchItemInput, PunchItemResponse } from '@/schemas/punchItem.schema';
export type { CreateTaskInput, UpdateTaskInput, TaskResponse } from '@/schemas/task.schema';
export type { CreateChangeOrderInput, UpdateChangeOrderInput, ChangeOrderResponse } from '@/schemas/changeOrder.schema';

// Hook exports
export { useCreateRFI } from './useCreateRFI';
export { useUpdateRFI } from './useUpdateRFI';
export { useBulkUpdateRFIStatus } from './useBulkUpdateRFIStatus';
export { useDeleteRFI } from './useDeleteRFI';
// ... etc, all 55 mutations

// Re-export schema barrel
export * from '@/schemas';
```

---

## Validation Error Handling Template

**File**: `src/utils/validateInput.ts`

```typescript
import { ZodError, ZodSchema } from 'zod';
import { toast } from '@/components/Primitives';
import * as Sentry from '@sentry/react';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Record<string, string[]>;
}

export async function validateAndParse<T>(
  schema: ZodSchema,
  data: unknown,
  context: string
): Promise<ValidationResult<T>> {
  try {
    const validated = schema.parse(data) as T;
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors = error.flatten().fieldErrors;
      const errorMessages = Object.entries(fieldErrors).reduce(
        (acc, [field, messages]) => {
          acc[field] = messages as string[];
          return acc;
        },
        {} as Record<string, string[]>
      );

      Sentry.captureException(error, {
        tags: { context, type: 'validation' },
        extra: { errors: errorMessages },
      });

      return { success: false, errors: errorMessages };
    }

    throw error;
  }
}

export function showValidationErrors(errors: Record<string, string[]>) {
  Object.entries(errors).forEach(([field, messages]) => {
    messages.forEach((message) => {
      toast.error(`${field}: ${message}`);
    });
  });
}
```

---

## Testing: Zod Schema Unit Tests

**File**: `src/schemas/__tests__/rfi.schema.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { CreateRFISchema, UpdateRFISchema } from '../rfi.schema';
import { ZodError } from 'zod';

describe('RFI Schemas', () => {
  describe('CreateRFISchema', () => {
    it('accepts valid input', () => {
      const input = {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Request for Information',
        description: 'This is a valid RFI with sufficient detail',
        dueDate: '2026-04-30T17:00:00Z',
        priority: 'HIGH',
      };

      expect(() => CreateRFISchema.parse(input)).not.toThrow();
    });

    it('rejects title shorter than 5 characters', () => {
      const input = {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Bad',
        description: 'This is a valid description but the title is too short',
        dueDate: '2026-04-30T17:00:00Z',
      };

      expect(() => CreateRFISchema.parse(input)).toThrow(ZodError);
    });

    it('rejects invalid UUID', () => {
      const input = {
        projectId: 'not-a-uuid',
        title: 'Valid Title Here',
        description: 'This is a valid description for an RFI',
        dueDate: '2026-04-30T17:00:00Z',
      };

      expect(() => CreateRFISchema.parse(input)).toThrow(ZodError);
    });

    it('rejects invalid date format', () => {
      const input = {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Valid Title Here',
        description: 'This is a valid description for an RFI',
        dueDate: 'not-a-date',
      };

      expect(() => CreateRFISchema.parse(input)).toThrow(ZodError);
    });

    it('sets default priority to MEDIUM', () => {
      const input = {
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Valid Title Here',
        description: 'This is a valid description for an RFI',
        dueDate: '2026-04-30T17:00:00Z',
      };

      const result = CreateRFISchema.parse(input);
      expect(result.priority).toBe('MEDIUM');
    });
  });

  describe('UpdateRFISchema', () => {
    it('accepts partial update with only ID and status', () => {
      const input = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'RESOLVED',
      };

      expect(() => UpdateRFISchema.parse(input)).not.toThrow();
    });

    it('accepts full update with all fields', () => {
      const input = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Updated Title',
        description: 'Updated description with more detail and information',
        status: 'IN_PROGRESS',
        dueDate: '2026-05-15T17:00:00Z',
        priority: 'CRITICAL',
      };

      expect(() => UpdateRFISchema.parse(input)).not.toThrow();
    });
  });
});
```

---

## Acceptance Criteria

- [ ] All 18 schema files created in `src/schemas/` with complete field definitions
- [ ] `CreateRFISchema`, `UpdateRFISchema`, `CreateSubmittalSchema`, `UpdateSubmittalSchema`, `CreatePunchItemSchema`, `CreateTaskSchema`, and `CreateChangeOrderSchema` fully implemented with 5+ fields each
- [ ] All enum schemas (RFIStatusEnum, SubmittalStatusEnum, TaskStatusEnum, etc.) match database constraints exactly
- [ ] Shared base schemas (IdSchema, EmailSchema, DateSchema, etc.) in `src/schemas/index.ts`
- [ ] `createAuditedMutation.ts` helper implemented with Zod parsing, error handling, and Sentry integration
- [ ] All 55 mutations listed with file paths and line numbers
- [ ] `useCreateRFI()` updated as example showing before/after with Zod validation
- [ ] Validation error handling utility (`validateInput.ts`) created
- [ ] Unit tests for at least 3 schemas using Vitest (RFI, Submittal, Task)
- [ ] All imports updated in `src/hooks/mutations/index.ts` to export schema types
- [ ] Code compiles with zero TypeScript errors
- [ ] All Zod schemas are backward compatible with existing API responses
- [ ] Documentation complete with architectural diagrams and integration examples

---

**Effort estimate**: 40 hours
**Status**: Ready for implementation
**Owner**: Full-stack engineer
**Review**: Senior backend engineer + Frontend architect
