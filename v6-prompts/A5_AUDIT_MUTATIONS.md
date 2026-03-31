# V6 Track A: A5 — Migrate 13 Non-Audited Mutations to createAuditedMutation

**Status:** CRITICAL AUDIT GAP | 13 untracked mutations
**Priority:** P0 (Compliance violation - no audit trail)
**Estimated Effort:** 6-8 hours

---

## THE PROBLEM

**30 mutations** use `useAuditedMutation()` (full features: permissions, validation, audit, error handling).
**13 mutations** use plain `useMutation()` (NO audit trail, NO permission checks, NO validation).

**Compliance consequence:** Deleting RFIs, approving changes, marking notifications read — none tracked.

```typescript
// WRONG: Plain useMutation with no audit
export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('tasks').delete().eq('id', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      toast.success('Task deleted')  // ← Only user feedback, no audit!
    },
    onError: () => {
      toast.error('Failed to delete')
    },
  })
}
```

**Correct:** useAuditedMutation with all features
```typescript
export function useDeleteTask() {
  return useAuditedMutation<{ id: string }, void>({
    permission: 'tasks.delete',
    action: 'delete_task',
    entityType: 'task',
    getEntityId: (p) => p.id,
    mutationFn: async ({ id }) => {
      await typedFrom('tasks').delete().eq('id', id)
    },
    invalidateKeys: () => [['tasks']],
    analyticsEvent: 'task_deleted',
    getAnalyticsProps: (p) => ({ task_id: p.id }),
    errorMessage: 'Failed to delete task',
  })
}
```

---

## 13 MUTATIONS TO MIGRATE

### 1. useCreateRFIResponse (Line 76 in mutations/index.ts)

**BEFORE:**
```typescript
export function useCreateRFIResponse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; rfiId: string; projectId: string }) => {
      const { data, error } = await from('rfi_responses').insert(params.data).select().single()
      if (error) throw error
      return { data, rfiId: params.rfiId, projectId: params.projectId }
    },
    onSuccess: (result: { rfiId: string; projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['rfis', result.projectId] })
      queryClient.invalidateQueries({ queryKey: ['rfis', 'detail', result.rfiId] })
      queryClient.invalidateQueries({ queryKey: ['rfi_responses', result.rfiId] })
      posthog.capture('rfi_response_created', { rfi_id: result.rfiId })
    },
    onError: createOnError('create_rfi_response'),
  })
}
```

**AFTER:**
```typescript
import { useAuditedMutation } from './createAuditedMutation'
import { typedFrom } from '../../lib/typedSupabase'
import type { RFIResponse } from '../../types/database'

const rfiResponseSchema = z.object({
  rfi_id: z.string().uuid(),
  user_id: z.string().uuid(),
  content: z.string().min(1, 'Response text required'),
  attachments: z.array(z.string()).optional(),
})

export function useCreateRFIResponse() {
  return useAuditedMutation<
    { data: Record<string, unknown>; rfiId: string; projectId: string },
    { rfiId: string; projectId: string }
  >({
    permission: 'rfi_responses.create',
    schema: rfiResponseSchema,
    schemaKey: 'data',
    action: 'create_rfi_response',
    entityType: 'rfi_response',
    getEntityTitle: (p) => `Response to RFI ${p.rfiId}`,
    getNewValue: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await typedFrom('rfi_responses')
        .insert(params.data)
        .select()
        .single()

      if (error) throw error
      return { rfiId: params.rfiId, projectId: params.projectId }
    },
    invalidateKeys: (_, r) => [
      ['rfis', r.projectId],
      ['rfis', 'detail', r.rfiId],
      ['rfi_responses', r.rfiId],
    ],
    analyticsEvent: 'rfi_response_created',
    getAnalyticsProps: (p) => ({ rfi_id: p.rfiId, project_id: p.projectId }),
    errorMessage: 'Failed to create RFI response',
  })
}
```

**Zod Schema Location:** `src/components/forms/schemas.ts`
```typescript
export const rfiResponseSchema = z.object({
  rfi_id: z.string().uuid('Invalid RFI ID'),
  user_id: z.string().uuid('Invalid user ID'),
  content: z.string().min(1, 'Response text required').max(5000),
  attachments: z.array(z.string()).optional().default([]),
})
```

---

### 2. useDeleteTask (NEW MUTATION)

**LOCATION:** Currently not in mutations/index.ts - needs creation

**FILE:** `src/hooks/mutations/useDeleteTask.ts`

```typescript
import { useAuditedMutation } from './createAuditedMutation'
import { typedFrom } from '../../lib/typedSupabase'

export interface DeleteTaskParams {
  id: string
  projectId: string
}

export function useDeleteTask() {
  return useAuditedMutation<DeleteTaskParams, { projectId: string }>({
    permission: 'tasks.delete',
    action: 'delete_task',
    entityType: 'task',
    getEntityId: (p) => p.id,
    mutationFn: async ({ id, projectId }) => {
      const { error } = await typedFrom('tasks').delete().eq('id', id)

      if (error) throw error
      return { projectId }
    },
    invalidateKeys: (_, r) => [['tasks', r.projectId]],
    analyticsEvent: 'task_deleted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId, task_id: p.id }),
    errorMessage: 'Failed to delete task',
  })
}
```

---

### 3. useCreateFile

**LOCATION:** Needs to be found/created

**FILE:** `src/hooks/mutations/useCreateFile.ts`

```typescript
import { useAuditedMutation } from './createAuditedMutation'
import { typedFrom } from '../../lib/typedSupabase'
import { fileSchema } from '../../components/forms/schemas'
import type { File } from '../../types/database'

export interface CreateFileParams {
  data: {
    project_id: string
    name: string
    folder_id?: string
    file_type: string
    file_size: number
    created_by: string
  }
  projectId: string
}

export function useCreateFile() {
  return useAuditedMutation<CreateFileParams, { projectId: string; data: File }>({
    permission: 'files.create',
    schema: fileSchema,
    schemaKey: 'data',
    action: 'create_file',
    entityType: 'file',
    getEntityTitle: (p) => p.data.name,
    getNewValue: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await typedFrom('files')
        .insert(params.data)
        .select()
        .single()

      if (error) throw error
      return { projectId: params.projectId, data: data as File }
    },
    invalidateKeys: (p, r) => [['files', r.projectId]],
    analyticsEvent: 'file_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId, file_type: p.data.file_type }),
    errorMessage: 'Failed to create file',
  })
}
```

---

### 4. useDeleteFile

**FILE:** `src/hooks/mutations/useDeleteFile.ts`

```typescript
import { useAuditedMutation } from './createAuditedMutation'
import { typedFrom } from '../../lib/typedSupabase'

export interface DeleteFileParams {
  id: string
  projectId: string
}

export function useDeleteFile() {
  return useAuditedMutation<DeleteFileParams, { projectId: string }>({
    permission: 'files.delete',
    action: 'delete_file',
    entityType: 'file',
    getEntityId: (p) => p.id,
    mutationFn: async ({ id, projectId }) => {
      const { error } = await typedFrom('files').delete().eq('id', id)

      if (error) throw error
      return { projectId }
    },
    invalidateKeys: (_, r) => [['files', r.projectId]],
    analyticsEvent: 'file_deleted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId, file_id: p.id }),
    errorMessage: 'Failed to delete file',
  })
}
```

---

### 5. useCreateFieldCapture

**FILE:** `src/hooks/mutations/useCreateFieldCapture.ts`

```typescript
import { useAuditedMutation } from './createAuditedMutation'
import { typedFrom } from '../../lib/typedSupabase'
import { fieldCaptureSchema } from '../../components/forms/schemas'
import type { FieldCapture } from '../../types/database'

export interface CreateFieldCaptureParams {
  data: {
    project_id: string
    user_id: string
    location: string
    photo_url?: string
    description?: string
    captured_at: string
  }
  projectId: string
}

export function useCreateFieldCapture() {
  return useAuditedMutation<CreateFieldCaptureParams, { projectId: string; data: FieldCapture }>({
    permission: 'field_captures.create',
    schema: fieldCaptureSchema,
    schemaKey: 'data',
    action: 'create_field_capture',
    entityType: 'field_capture',
    getEntityTitle: (p) => `Capture at ${p.data.location}`,
    getNewValue: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await typedFrom('field_captures')
        .insert(params.data)
        .select()
        .single()

      if (error) throw error
      return { projectId: params.projectId, data: data as FieldCapture }
    },
    invalidateKeys: (p, r) => [['field_captures', r.projectId]],
    analyticsEvent: 'field_capture_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create field capture',
  })
}
```

---

### 6. useCreateDirectoryContact

**FILE:** `src/hooks/mutations/useCreateDirectoryContact.ts`

```typescript
import { useAuditedMutation } from './createAuditedMutation'
import { typedFrom } from '../../lib/typedSupabase'
import { directoryContactSchema } from '../../components/forms/schemas'
import type { DirectoryContact } from '../../types/database'

export interface CreateDirectoryContactParams {
  data: {
    project_id: string
    name: string
    company: string
    email: string
    phone: string
    role: string
    created_by: string
  }
  projectId: string
}

export function useCreateDirectoryContact() {
  return useAuditedMutation<
    CreateDirectoryContactParams,
    { projectId: string; data: DirectoryContact }
  >({
    permission: 'directory.create',
    schema: directoryContactSchema,
    schemaKey: 'data',
    action: 'create_directory_contact',
    entityType: 'directory_contact',
    getEntityTitle: (p) => p.data.name,
    getNewValue: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await typedFrom('directory_contacts')
        .insert(params.data)
        .select()
        .single()

      if (error) throw error
      return { projectId: params.projectId, data: data as DirectoryContact }
    },
    invalidateKeys: (p, r) => [['directory_contacts', r.projectId]],
    analyticsEvent: 'directory_contact_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create contact',
  })
}
```

---

### 7. useCreateCrew

**FILE:** `src/hooks/mutations/useCreateCrew.ts`

```typescript
import { useAuditedMutation } from './createAuditedMutation'
import { typedFrom } from '../../lib/typedSupabase'
import { crewSchema } from '../../components/forms/schemas'
import type { Crew } from '../../types/database'

export interface CreateCrewParams {
  data: {
    project_id: string
    name: string
    foreman_id?: string
    trade: string
    size: number
    status: 'active' | 'inactive'
  }
  projectId: string
}

export function useCreateCrew() {
  return useAuditedMutation<CreateCrewParams, { projectId: string; data: Crew }>({
    permission: 'crews.create',
    schema: crewSchema,
    schemaKey: 'data',
    action: 'create_crew',
    entityType: 'crew',
    getEntityTitle: (p) => p.data.name,
    getNewValue: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await typedFrom('crews')
        .insert(params.data)
        .select()
        .single()

      if (error) throw error
      return { projectId: params.projectId, data: data as Crew }
    },
    invalidateKeys: (p, r) => [['crews', r.projectId]],
    analyticsEvent: 'crew_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId, trade: p.data.trade }),
    errorMessage: 'Failed to create crew',
  })
}
```

---

### 8. useMarkNotificationRead

**FILE:** `src/hooks/mutations/useMarkNotificationRead.ts`

```typescript
import { useAuditedMutation } from './createAuditedMutation'
import { typedFrom } from '../../lib/typedSupabase'

export interface MarkNotificationReadParams {
  id: string
}

export function useMarkNotificationRead() {
  return useAuditedMutation<MarkNotificationReadParams, void>({
    permission: 'notifications.update',
    action: 'mark_notification_read',
    entityType: 'notification',
    getEntityId: (p) => p.id,
    mutationFn: async ({ id }) => {
      const { error } = await typedFrom('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
    },
    invalidateKeys: () => [['notifications']],
    analyticsEvent: 'notification_marked_read',
    getAnalyticsProps: (p) => ({ notification_id: p.id }),
    errorMessage: 'Failed to mark notification as read',
  })
}
```

---

### 9. useMarkAllNotificationsRead

**FILE:** `src/hooks/mutations/useMarkAllNotificationsRead.ts`

```typescript
import { useAuditedMutation } from './createAuditedMutation'
import { typedFrom } from '../../lib/typedSupabase'
import { useAuthStore } from '../../stores/authStore'

export function useMarkAllNotificationsRead() {
  const { user } = useAuthStore()

  return useAuditedMutation<void, void>({
    permission: 'notifications.update',
    action: 'mark_all_notifications_read',
    entityType: 'notification',
    getEntityTitle: () => 'All notifications',
    mutationFn: async () => {
      const { error } = await typedFrom('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null)
        .eq('user_id', user?.id!)

      if (error) throw error
    },
    invalidateKeys: () => [['notifications']],
    analyticsEvent: 'all_notifications_marked_read',
    errorMessage: 'Failed to mark all notifications as read',
  })
}
```

---

### 10. useCreateActivityFeedItem

**FILE:** `src/hooks/mutations/useCreateActivityFeedItem.ts`

```typescript
import { useAuditedMutation } from './createAuditedMutation'
import { typedFrom } from '../../lib/typedSupabase'
import type { ActivityFeedItem } from '../../types/database'

export interface CreateActivityFeedItemParams {
  data: {
    project_id: string
    entity_type: string
    entity_id: string
    action: string
    user_id: string
    old_value?: Record<string, any>
    new_value?: Record<string, any>
    created_at: string
  }
  projectId: string
}

export function useCreateActivityFeedItem() {
  return useAuditedMutation<
    CreateActivityFeedItemParams,
    { projectId: string; data: ActivityFeedItem }
  >({
    permission: 'activity_feed.create',
    action: 'create_activity_feed_item',
    entityType: 'activity_feed_item',
    getEntityTitle: (p) => `${p.data.action} on ${p.data.entity_type}`,
    getNewValue: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await typedFrom('activity_feed')
        .insert(params.data)
        .select()
        .single()

      if (error) throw error
      return { projectId: params.projectId, data: data as ActivityFeedItem }
    },
    invalidateKeys: (p, r) => [['activity_feed', r.projectId]],
    analyticsEvent: 'activity_feed_item_created',
    getAnalyticsProps: (p) => ({
      project_id: p.projectId,
      entity_type: p.data.entity_type,
      action: p.data.action,
    }),
    errorMessage: 'Failed to create activity feed item',
  })
}
```

---

### 11. useUpdateCorrectiveAction

**FILE:** `src/hooks/mutations/useUpdateCorrectiveAction.ts`

```typescript
import { useAuditedMutation } from './createAuditedMutation'
import { typedFrom } from '../../lib/typedSupabase'
import { correctiveActionSchema } from '../../components/forms/schemas'
import type { CorrectiveAction } from '../../types/database'

export interface UpdateCorrectiveActionParams {
  id: string
  updates: Partial<CorrectiveAction>
  projectId: string
}

export function useUpdateCorrectiveAction() {
  return useAuditedMutation<UpdateCorrectiveActionParams, { projectId: string }>({
    permission: 'corrective_actions.edit',
    schema: correctiveActionSchema.partial(),
    schemaKey: 'updates',
    action: 'update_corrective_action',
    entityType: 'corrective_action',
    getEntityId: (p) => p.id,
    getNewValue: (p) => p.updates,
    mutationFn: async ({ id, updates, projectId }) => {
      const { error } = await typedFrom('corrective_actions')
        .update(updates)
        .eq('id', id)

      if (error) throw error
      return { projectId }
    },
    invalidateKeys: (_, r) => [['corrective_actions', r.projectId]],
    analyticsEvent: 'corrective_action_updated',
    getAnalyticsProps: (p) => ({ project_id: p.projectId, action_id: p.id }),
    errorMessage: 'Failed to update corrective action',
  })
}
```

---

### 12. useCreateDrawingMarkup

**FILE:** `src/hooks/mutations/useCreateDrawingMarkup.ts`

```typescript
import { useAuditedMutation } from './createAuditedMutation'
import { typedFrom } from '../../lib/typedSupabase'
import type { DrawingMarkup } from '../../types/database'

export interface CreateDrawingMarkupParams {
  data: {
    drawing_id: string
    user_id: string
    markup_type: 'circle' | 'line' | 'text' | 'polygon'
    coordinates: Record<string, any>
    text?: string
    color?: string
    created_at: string
  }
  drawingId: string
  projectId: string
}

export function useCreateDrawingMarkup() {
  return useAuditedMutation<
    CreateDrawingMarkupParams,
    { drawingId: string; projectId: string; data: DrawingMarkup }
  >({
    permission: 'drawings.edit',
    action: 'create_drawing_markup',
    entityType: 'drawing_markup',
    getEntityTitle: (p) => `${p.data.markup_type} markup`,
    getNewValue: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await typedFrom('drawing_markups')
        .insert(params.data)
        .select()
        .single()

      if (error) throw error
      return {
        drawingId: params.drawingId,
        projectId: params.projectId,
        data: data as DrawingMarkup,
      }
    },
    invalidateKeys: (_, r) => [['drawing_markups', r.drawingId]],
    analyticsEvent: 'drawing_markup_created',
    getAnalyticsProps: (p) => ({
      project_id: p.projectId,
      markup_type: p.data.markup_type,
    }),
    errorMessage: 'Failed to create drawing markup',
  })
}
```

---

### 13. useCreateTransmittal

**FILE:** `src/hooks/mutations/useCreateTransmittal.ts`

```typescript
import { useAuditedMutation } from './createAuditedMutation'
import { typedFrom } from '../../lib/typedSupabase'
import { transmittalSchema } from '../../components/forms/schemas'
import type { Transmittal } from '../../types/database'

export interface CreateTransmittalParams {
  data: {
    project_id: string
    submittal_id?: string
    title: string
    description?: string
    created_by: string
    to_recipient: string
    sent_date: string
  }
  projectId: string
}

export function useCreateTransmittal() {
  return useAuditedMutation<CreateTransmittalParams, { projectId: string; data: Transmittal }>({
    permission: 'transmittals.create',
    schema: transmittalSchema,
    schemaKey: 'data',
    action: 'create_transmittal',
    entityType: 'transmittal',
    getEntityTitle: (p) => p.data.title,
    getNewValue: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await typedFrom('transmittals')
        .insert(params.data)
        .select()
        .single()

      if (error) throw error
      return { projectId: params.projectId, data: data as Transmittal }
    },
    invalidateKeys: (p, r) => [['transmittals', r.projectId]],
    analyticsEvent: 'transmittal_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create transmittal',
  })
}
```

---

## COMPONENT USAGE UPDATES

### Before (Using Plain useMutation)
```typescript
import { useDeleteTask } from '../hooks/mutations'

export function TaskCard({ taskId }: { taskId: string }) {
  const { mutate: deleteTask } = useDeleteTask()  // ← Plain mutation, no audit!

  return (
    <div>
      <button onClick={() => deleteTask(taskId)}>
        Delete Task
      </button>
    </div>
  )
}
```

### After (Using useAuditedMutation)
```typescript
import { useDeleteTask } from '../hooks/mutations/useDeleteTask'

export function TaskCard({ taskId }: { taskId: string }) {
  const { mutate: deleteTask } = useDeleteTask()  // ← Audited, permission-checked

  return (
    <div>
      <button onClick={() => deleteTask({ id: taskId, projectId: 'proj-1' })}>
        Delete Task
      </button>
    </div>
  )
}
```

---

## AUDIT TABLE SCHEMA (VERIFY)

All audited mutations write to `audit_trail` table:

```sql
-- Verify this table exists and has correct columns
CREATE TABLE audit_trail (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,  -- 'create_task', 'delete_rfi', etc.
  entity_type VARCHAR(50) NOT NULL,  -- 'task', 'rfi', etc.
  entity_id UUID NOT NULL,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT now(),

  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_action (action),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_user (user_id),
  INDEX idx_created (created_at DESC)
)
```

---

## VERIFICATION SCRIPT

```bash
#!/bin/bash
# Verify all non-audited mutations migrated

set -e

echo "✓ Checking all mutations use useAuditedMutation..."

# Find all mutation files
mutation_count=$(find src/hooks/mutations -name "use*.ts" | wc -l)
if [ "$mutation_count" -lt 40 ]; then
  echo "❌ FAIL: Only $mutation_count mutation files (expected >= 40)"
  exit 1
fi
echo "  Mutation files: $mutation_count"

# Check for plain useMutation calls (should be very few, only setup mutations)
plain_mutations=$(grep -r "return useMutation(" src/hooks/mutations --include="*.ts" | wc -l)
if [ "$plain_mutations" -gt 5 ]; then
  echo "❌ FAIL: $plain_mutations plain useMutation calls (expected <= 5)"
  grep -r "return useMutation(" src/hooks/mutations --include="*.ts" | head -10
  exit 1
fi
echo "  Plain useMutation calls: $plain_mutations (acceptable <= 5)"

echo "✓ Checking specific required mutations..."
required_mutations=(
  "useCreateRFIResponse"
  "useDeleteTask"
  "useCreateFile"
  "useDeleteFile"
  "useCreateFieldCapture"
  "useCreateDirectoryContact"
  "useCreateCrew"
  "useMarkNotificationRead"
  "useMarkAllNotificationsRead"
  "useCreateActivityFeedItem"
  "useUpdateCorrectiveAction"
  "useCreateDrawingMarkup"
  "useCreateTransmittal"
)

for mutation in "${required_mutations[@]}"; do
  if ! grep -r "export function $mutation" src/hooks/mutations --include="*.ts"; then
    echo "❌ FAIL: Missing $mutation"
    exit 1
  fi
done

echo "✓ Checking all mutations import createAuditedMutation..."
audit_imports=$(grep -r "from './createAuditedMutation'" src/hooks/mutations --include="*.ts" | wc -l)
if [ "$audit_imports" -lt 30 ]; then
  echo "❌ FAIL: Only $audit_imports files import createAuditedMutation (expected >= 30)"
  exit 1
fi

echo "✓ Checking mutations have permission checks..."
permission_checks=$(grep -r "permission:" src/hooks/mutations --include="*.ts" | wc -l)
if [ "$permission_checks" -lt 35 ]; then
  echo "❌ FAIL: Only $permission_checks mutations have permission checks (expected >= 35)"
  exit 1
fi

echo "✓ Checking mutations have audit actions..."
audit_actions=$(grep -r "action:" src/hooks/mutations --include="*.ts" | wc -l)
if [ "$audit_actions" -lt 35 ]; then
  echo "❌ FAIL: Only $audit_actions mutations have audit actions (expected >= 35)"
  exit 1
fi

echo "✓ Checking mutations have invalidation keys..."
invalidations=$(grep -r "invalidateKeys:" src/hooks/mutations --include="*.ts" | wc -l)
if [ "$invalidations" -lt 35 ]; then
  echo "❌ FAIL: Only $invalidations mutations have invalidation keys (expected >= 35)"
  exit 1
fi

echo "✓ Checking mutations have analytics..."
analytics=$(grep -r "analyticsEvent:" src/hooks/mutations --include="*.ts" | wc -l)
if [ "$analytics" -lt 35 ]; then
  echo "❌ FAIL: Only $analytics mutations have analytics (expected >= 35)"
  exit 1
fi

echo "✓ Checking old mutations/index.ts still has base mutations..."
# Keep useCreateRFI, useUpdateRFI, useDeleteRFI, etc. in mutations/index.ts
if [ ! -f "src/hooks/mutations/index.ts" ]; then
  echo "❌ FAIL: src/hooks/mutations/index.ts not found"
  exit 1
fi

echo "✓ Verifying audit_trail table..."
if ! grep -q "audit_trail" src/types/database.ts 2>/dev/null; then
  echo "⚠ WARNING: audit_trail type not found in database types"
fi

echo ""
echo "✅ ALL CHECKS PASSED - Audit mutation migration complete!"
echo ""
echo "Statistics:"
echo "  - Total mutation files: $mutation_count"
echo "  - Plain useMutation calls: $plain_mutations"
echo "  - Required mutations implemented: ${#required_mutations[@]}"
echo "  - Mutations with permissions: $permission_checks"
echo "  - Mutations with audit actions: $audit_actions"
echo "  - Mutations with cache invalidation: $invalidations"
echo "  - Mutations with analytics: $analytics"
```

Run with:
```bash
bash scripts/verify-audit-mutations.sh
```

Expected output:
```
✓ Checking all mutations use useAuditedMutation...
  Mutation files: 45
✓ Checking specific required mutations...
✓ Checking all mutations import createAuditedMutation...
✓ Checking mutations have permission checks...
✓ Checking mutations have audit actions...
✓ Checking mutations have invalidation keys...
✓ Checking mutations have analytics...
✓ Checking old mutations/index.ts still has base mutations...
✓ Verifying audit_trail table...

✅ ALL CHECKS PASSED - Audit mutation migration complete!

Statistics:
  - Total mutation files: 45
  - Plain useMutation calls: 3
  - Required mutations implemented: 13
  - Mutations with permissions: 40+
  - Mutations with audit actions: 40+
  - Mutations with cache invalidation: 40+
  - Mutations with analytics: 40+
```

---

## SUMMARY TABLE

| Mutation | Permission Required | Schema Needed | Invalidation Key | Audit Action | Status |
|----------|---|---|---|---|---|
| useCreateRFIResponse | rfi_responses.create | rfiResponseSchema | ['rfi_responses', rfiId] | create_rfi_response | ✓ DONE |
| useDeleteTask | tasks.delete | — | ['tasks'] | delete_task | ✓ NEW |
| useCreateFile | files.create | fileSchema | ['files'] | create_file | ✓ NEW |
| useDeleteFile | files.delete | — | ['files'] | delete_file | ✓ NEW |
| useCreateFieldCapture | field_captures.create | fieldCaptureSchema | ['field_captures'] | create_field_capture | ✓ NEW |
| useCreateDirectoryContact | directory.create | directoryContactSchema | ['directory_contacts'] | create_directory_contact | ✓ NEW |
| useCreateCrew | crews.create | crewSchema | ['crews'] | create_crew | ✓ NEW |
| useMarkNotificationRead | notifications.update | — | ['notifications'] | mark_notification_read | ✓ NEW |
| useMarkAllNotificationsRead | notifications.update | — | ['notifications'] | mark_all_notifications_read | ✓ NEW |
| useCreateActivityFeedItem | activity_feed.create | — | ['activity_feed'] | create_activity_feed_item | ✓ NEW |
| useUpdateCorrectiveAction | corrective_actions.edit | correctiveActionSchema | ['corrective_actions'] | update_corrective_action | ✓ NEW |
| useCreateDrawingMarkup | drawings.edit | — | ['drawing_markups'] | create_drawing_markup | ✓ NEW |
| useCreateTransmittal | transmittals.create | transmittalSchema | ['transmittals'] | create_transmittal | ✓ NEW |

---

## Execution Order

1. Create all 13 mutation files in `src/hooks/mutations/`
2. Add Zod schemas to `src/components/forms/schemas.ts` (if not exists)
3. Test each mutation in isolation (unit tests)
4. Update all components importing old mutations
5. Run verification script
6. Delete old plain mutations from components (if copied)

**Estimated Time:** 6-8 hours (0.5 hours per mutation avg)
