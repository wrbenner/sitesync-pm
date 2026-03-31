# V6 Track A: A1 — Migrate Zustand Stores to React Query

**Status:** BLOCKING CRITICAL | V5 missed this entirely
**Priority:** P0 (All downstream features broken without permission/audit layer)
**Estimated Effort:** 40-50 hours (26 stores × 1.5-2 hours each)

---

## THE PROBLEM

The codebase has **26 Zustand stores** that bypass the **entire security and audit layer**:
- ❌ NO permission checks (`checkPermission()` never called)
- ❌ NO Zod validation (raw data inserted)
- ❌ NO audit trail (mutations not tracked)
- ❌ NO error handling (no toast, no Sentry)
- ❌ NO optimistic updates (no UX feedback)
- ❌ NO cache invalidation (stale data persists)

**Real-world consequence:** A user with `rfis.view` permission can still DELETE RFIs from the store directly, then the delete persists locally even if the API rejects it.

---

## AFFECTED STORES (Line Counts & `as any` Count)

```
authStore.ts                 155 lines   3 as any
budgetStore.ts              156 lines   6 as any
copilotStore.ts             193 lines   2 as any
crewStore.ts                 95 lines   3 as any
dailyLogStore.ts            116 lines   4 as any
directoryStore.ts            98 lines   3 as any
fieldCaptureStore.ts        ?          2 as any
fileStore.ts                220 lines   4 as any
meetingStore.ts             123 lines   3 as any
projectContextStore.ts      171 lines   4 as any
punchListStore.ts           123 lines   4 as any
rfiStore.ts                 125 lines   3 as any
submittalStore.ts           133 lines   4 as any
+ 13 others (activityStore, agentOrchestrator, dailyLogStore,
  digitalTwinStore, notificationStore, presenceStore, projectStore,
  scheduleStore, uiStore, userStore, + 3 more)

TOTAL: ~2,200 lines of unaudited data access
```

---

## MIGRATION PATTERN

The fix follows a simple architecture:

### 1. Keep Zustand FOR UI-ONLY STATE

Zustand stays for:
- Selected tab / filter
- Expanded sections (accordion state)
- Modal open/close state
- Sidebar collapsed state
- Form field values (temporary)

Example from `uiStore.ts` (KEEP THIS):
```typescript
export const useUIStore = create<UIState>()((set) => ({
  selectedTab: 'overview',
  setSelectedTab: (tab: string) => set({ selectedTab: tab }),

  expandedSections: {},
  toggleSection: (id: string) => set(s => ({
    expandedSections: { ...s.expandedSections, [id]: !s.expandedSections[id] }
  })),
}))
```

### 2. Move ALL Data Fetching to React Query useQuery

Replace store `loadXxx()` methods with hooks:

```typescript
// OLD (rfiStore.ts - LINE 35-48)
loadRfis: async (projectId) => {
  set({ loading: true, error: null });
  try {
    const { data, error } = await supabase
      .from('rfis')
      .select('*')
      .eq('project_id', projectId)
      .order('rfi_number', { ascending: false });
    if (error) throw error;
    set({ rfis: (data ?? []) as RFI[], loading: false });
  } catch (e) {
    set({ error: (e as Error).message, loading: false });
  }
},

// NEW (hooks/queries/useRFIs.ts)
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { RFI } from '../../types/database'

export function useRFIs(projectId: string) {
  return useQuery({
    queryKey: ['rfis', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfis')
        .select('*')
        .eq('project_id', projectId)
        .order('rfi_number', { ascending: false })

      if (error) throw error
      return (data ?? []) as RFI[]
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
```

### 3. Move ALL Data Mutations to useAuditedMutation

Replace store mutation methods with mutation hooks:

```typescript
// OLD (rfiStore.ts - LINE 51-68)
createRfi: async (rfi) => {
  const { data, error } = await (supabase.from('rfis') as any)
    .insert({
      project_id: rfi.project_id,
      title: rfi.title,
      description: rfi.description ?? null,
      status: 'draft',
      priority: rfi.priority,
      created_by: rfi.created_by,
      assigned_to: rfi.assigned_to ?? null,
      due_date: rfi.due_date ?? null,
      linked_drawing_id: rfi.linked_drawing_id ?? null,
    })
    .select()
    .single();

  if (error) return { error: error.message, rfi: null };
  return { error: null, rfi: data as RFI };
},

// NEW (hooks/mutations/useCreateRFI.ts)
import { useAuditedMutation } from './createAuditedMutation'
import { rfiSchema } from '../../components/forms/schemas'

export function useCreateRFI() {
  return useAuditedMutation<
    { data: Record<string, unknown>; projectId: string },
    { data: RFI; projectId: string }
  >({
    permission: 'rfis.create',
    schema: rfiSchema,
    action: 'create_rfi',
    entityType: 'rfi',
    getEntityTitle: (p) => (p.data.title as string) || undefined,
    getNewValue: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await supabase
        .from('rfis')
        .insert(params.data)
        .select()
        .single()

      if (error) throw error
      return { data: data as RFI, projectId: params.projectId }
    },
    invalidateKeys: (p, r) => [['rfis', r.projectId]],
    analyticsEvent: 'rfi_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create RFI',
  })
}
```

### 4. Delete Raw supabase.from() Calls from Stores

All supabase queries exit the store. No exceptions.

---

## BEFORE/AFTER: rfiStore.ts (COMPLETE)

### BEFORE (Current - 125 lines)
```typescript
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { RFI, RFIResponse, Priority, RfiStatus } from '../types/database';

interface RfiState {
  rfis: RFI[];
  responses: Record<string, RFIResponse[]>;
  loading: boolean;
  error: string | null;

  loadRfis: (projectId: string) => Promise<void>;
  createRfi: (rfi: {...}) => Promise<{ error: string | null; rfi: RFI | null }>;
  updateRfi: (rfiId: string, updates: Partial<RFI>) => Promise<{ error: string | null }>;
  updateRfiStatus: (rfiId: string, status: RfiStatus) => Promise<{ error: string | null }>;
  loadResponses: (rfiId: string) => Promise<void>;
  addResponse: (rfiId: string, userId: string, text: string, attachments?: string[]) => Promise<{ error: string | null }>;
  deleteRfi: (rfiId: string) => Promise<{ error: string | null }>;
}

export const useRfiStore = create<RfiState>()((set, get) => ({
  rfis: [],
  responses: {},
  loading: false,
  error: null,

  loadRfis: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('rfis')
        .select('*')
        .eq('project_id', projectId)
        .order('rfi_number', { ascending: false });

      if (error) throw error;
      set({ rfis: (data ?? []) as RFI[], loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  createRfi: async (rfi) => {
    const { data, error } = await (supabase.from('rfis') as any)    // ← as any #1
      .insert({
        project_id: rfi.project_id,
        title: rfi.title,
        description: rfi.description ?? null,
        status: 'draft',
        priority: rfi.priority,
        created_by: rfi.created_by,
        assigned_to: rfi.assigned_to ?? null,
        due_date: rfi.due_date ?? null,
        linked_drawing_id: rfi.linked_drawing_id ?? null,
      })
      .select()
      .single();

    if (error) return { error: error.message, rfi: null };
    return { error: null, rfi: data as RFI };
  },

  updateRfi: async (rfiId, updates) => {
    const { error } = await (supabase.from('rfis') as any)        // ← as any #2
      .update(updates)
      .eq('id', rfiId);

    return { error: error?.message ?? null };
  },

  updateRfiStatus: async (rfiId, status) => {
    const { error } = await supabase.from('rfis').update({ status }).eq('id', rfiId);
    return { error: error?.message ?? null };
  },

  loadResponses: async (rfiId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('rfi_responses')
        .select('*')
        .eq('rfi_id', rfiId)
        .order('created_at');

      if (error) throw error;
      set(s => ({
        responses: { ...s.responses, [rfiId]: (data ?? []) as RFIResponse[] },
        loading: false,
      }));
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  addResponse: async (rfiId, userId, text, attachments) => {
    const { error } = await (supabase.from('rfi_responses') as any)  // ← as any #3
      .insert({
        rfi_id: rfiId,
        user_id: userId,
        content: text,
        attachments: attachments ?? [],
        created_at: new Date().toISOString(),
      });

    if (error) return { error: error.message };
    await get().loadResponses(rfiId);
    return { error: null };
  },

  deleteRfi: async (rfiId) => {
    const { error } = await supabase.from('rfis').delete().eq('id', rfiId);
    if (!error) {
      set(s => ({ rfis: s.rfis.filter(r => r.id !== rfiId) }));
    }
    return { error: error?.message ?? null };
  },
}));
```

### AFTER (Refactored)

**File 1: src/stores/rfiUIStore.ts** (NEW - UI state only, ~40 lines)
```typescript
import { create } from 'zustand'

interface RfiUIState {
  selectedRfiId: string | null
  setSelectedRfiId: (id: string | null) => void

  expandedResponses: Record<string, boolean>
  toggleResponseExpanded: (id: string) => void

  filterStatus: string | null
  setFilterStatus: (status: string | null) => void
}

export const useRfiUIStore = create<RfiUIState>()((set) => ({
  selectedRfiId: null,
  setSelectedRfiId: (id) => set({ selectedRfiId: id }),

  expandedResponses: {},
  toggleResponseExpanded: (id) => set(s => ({
    expandedResponses: { ...s.expandedResponses, [id]: !s.expandedResponses[id] }
  })),

  filterStatus: null,
  setFilterStatus: (status) => set({ filterStatus: status }),
}))
```

**File 2: src/hooks/queries/useRFIs.ts** (NEW - ~30 lines)
```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { usePermissions } from '../usePermissions'
import type { RFI } from '../../types/database'

export function useRFIs(projectId: string) {
  const { checkPermission } = usePermissions()

  return useQuery({
    queryKey: ['rfis', projectId],
    queryFn: async () => {
      // Permission check happens here
      if (!checkPermission('rfis.view')) {
        throw new Error('Permission denied: rfis.view')
      }

      const { data, error } = await supabase
        .from('rfis')
        .select('*')
        .eq('project_id', projectId)
        .order('rfi_number', { ascending: false })

      if (error) throw error
      return (data ?? []) as RFI[]
    },
    enabled: !!projectId && checkPermission('rfis.view'),
    staleTime: 1000 * 60 * 5,
  })
}

export function useRFIDetail(rfiId: string) {
  return useQuery({
    queryKey: ['rfis', 'detail', rfiId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfis')
        .select('*')
        .eq('id', rfiId)
        .single()

      if (error) throw error
      return data as RFI
    },
    enabled: !!rfiId,
    staleTime: 1000 * 60 * 5,
  })
}
```

**File 3: src/hooks/mutations/useCreateRFI.ts** (NEW - ~50 lines)
```typescript
import { useAuditedMutation } from './createAuditedMutation'
import { rfiSchema } from '../../components/forms/schemas'
import type { RFI } from '../../types/database'

export interface CreateRFIParams {
  data: {
    project_id: string
    title: string
    description?: string
    priority: 'low' | 'medium' | 'high'
    assigned_to?: string
    due_date?: string
    created_by: string
    linked_drawing_id?: string
  }
  projectId: string
}

export function useCreateRFI() {
  return useAuditedMutation<CreateRFIParams, { data: RFI; projectId: string }>({
    permission: 'rfis.create',
    schema: rfiSchema,
    action: 'create_rfi',
    entityType: 'rfi',
    getEntityTitle: (p) => p.data.title,
    getNewValue: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await supabase
        .from('rfis')
        .insert({
          project_id: params.data.project_id,
          title: params.data.title,
          description: params.data.description ?? null,
          status: 'draft',
          priority: params.data.priority,
          created_by: params.data.created_by,
          assigned_to: params.data.assigned_to ?? null,
          due_date: params.data.due_date ?? null,
          linked_drawing_id: params.data.linked_drawing_id ?? null,
        })
        .select()
        .single()

      if (error) throw error
      return { data: data as RFI, projectId: params.projectId }
    },
    invalidateKeys: (p, r) => [['rfis', r.projectId]],
    analyticsEvent: 'rfi_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create RFI',
  })
}
```

**File 4: src/hooks/mutations/useUpdateRFI.ts** (NEW - ~45 lines)
```typescript
import { useAuditedMutation } from './createAuditedMutation'
import { rfiSchema } from '../../components/forms/schemas'
import type { RFI } from '../../types/database'

export interface UpdateRFIParams {
  id: string
  updates: Partial<RFI>
  projectId: string
}

export function useUpdateRFI() {
  return useAuditedMutation<UpdateRFIParams, { projectId: string; id: string }>({
    permission: 'rfis.edit',
    schema: rfiSchema.partial(),
    schemaKey: 'updates',
    action: 'update_rfi',
    entityType: 'rfi',
    getEntityId: (p) => p.id,
    getNewValue: (p) => p.updates,
    mutationFn: async ({ id, updates, projectId }) => {
      const { error } = await supabase
        .from('rfis')
        .update(updates)
        .eq('id', id)

      if (error) throw error
      return { projectId, id }
    },
    invalidateKeys: (_, r) => [['rfis', r.projectId], ['rfis', 'detail', r.id]],
    analyticsEvent: 'rfi_updated',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to update RFI',
  })
}
```

**File 5: src/hooks/mutations/useDeleteRFI.ts** (NEW - ~40 lines)
```typescript
import { useAuditedMutation } from './createAuditedMutation'
import type { RFI } from '../../types/database'

export interface DeleteRFIParams {
  id: string
  projectId: string
}

export function useDeleteRFI() {
  return useAuditedMutation<DeleteRFIParams, { projectId: string }>({
    permission: 'rfis.delete',
    action: 'delete_rfi',
    entityType: 'rfi',
    getEntityId: (p) => p.id,
    mutationFn: async ({ id, projectId }) => {
      const { error } = await supabase.from('rfis').delete().eq('id', id)

      if (error) throw error
      return { projectId }
    },
    invalidateKeys: (_, r) => [['rfis', r.projectId]],
    analyticsEvent: 'rfi_deleted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to delete RFI',
  })
}
```

**File 6: src/hooks/queries/useRFIResponses.ts** (NEW - ~35 lines)
```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { RFIResponse } from '../../types/database'

export function useRFIResponses(rfiId: string) {
  return useQuery({
    queryKey: ['rfi_responses', rfiId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfi_responses')
        .select('*')
        .eq('rfi_id', rfiId)
        .order('created_at')

      if (error) throw error
      return (data ?? []) as RFIResponse[]
    },
    enabled: !!rfiId,
    staleTime: 1000 * 60 * 5,
  })
}
```

**File 7: src/hooks/mutations/useCreateRFIResponse.ts** (CONVERT from plain useMutation - line 76 in mutations/index.ts)
```typescript
// BEFORE (line 76-92 in mutations/index.ts - NOT audited!)
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

// AFTER (in hooks/mutations/useCreateRFIResponse.ts - NOW audited!)
import { useAuditedMutation } from './createAuditedMutation'
import type { RFIResponse } from '../../types/database'

export interface CreateRFIResponseParams {
  data: {
    rfi_id: string
    user_id: string
    content: string
    attachments?: string[]
  }
  rfiId: string
  projectId: string
}

export function useCreateRFIResponse() {
  return useAuditedMutation<CreateRFIResponseParams, { rfiId: string; projectId: string }>({
    permission: 'rfi_responses.create',
    schema: rfiResponseSchema,
    action: 'create_rfi_response',
    entityType: 'rfi_response',
    getEntityTitle: (p) => `Response to RFI ${p.rfiId}`,
    getNewValue: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await supabase
        .from('rfi_responses')
        .insert(params.data)
        .select()
        .single()

      if (error) throw error
      return { data: data as RFIResponse, rfiId: params.rfiId, projectId: params.projectId }
    },
    invalidateKeys: (p, r) => [
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

---

## BEFORE/AFTER: budgetStore.ts

### BEFORE (Current - 156 lines)
```typescript
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { BudgetDivision, BudgetLineItem, ChangeOrder, ChangeOrderStatus } from '../types/database';

interface BudgetState {
  divisions: BudgetDivision[];
  lineItems: Record<string, BudgetLineItem[]>;
  changeOrders: ChangeOrder[];
  loading: boolean;
  error: string | null;

  loadBudget: (projectId: string) => Promise<void>;
  importDivisions: (projectId: string, divisions: Omit<BudgetDivision, 'id' | 'created_at'>[]) => Promise<{ error: string | null }>;
  addDivision: (division: Omit<BudgetDivision, 'id' | 'created_at'>) => Promise<{ error: string | null }>;
  updateDivision: (id: string, updates: Partial<BudgetDivision>) => Promise<{ error: string | null }>;
  loadLineItems: (divisionId: string) => Promise<void>;
  addLineItem: (item: Omit<BudgetLineItem, 'id'>) => Promise<{ error: string | null }>;
  loadChangeOrders: (projectId: string) => Promise<void>;
  addChangeOrder: (co: Omit<ChangeOrder, 'id' | 'co_number' | 'created_at' | 'updated_at'>) => Promise<{ error: string | null }>;
  updateChangeOrderStatus: (id: string, status: ChangeOrderStatus, approvedBy?: string) => Promise<{ error: string | null }>;
  getSummary: () => BudgetSummary;
}

export const useBudgetStore = create<BudgetState>()((set, get) => ({
  divisions: [],
  lineItems: {},
  changeOrders: [],
  loading: false,
  error: null,

  loadBudget: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const [divResult, coResult] = await Promise.all([
        supabase.from('budget_divisions').select('*').eq('project_id', projectId).order('code'),
        supabase.from('change_orders').select('*').eq('project_id', projectId).order('co_number'),
      ]);

      if (divResult.error) throw divResult.error;
      if (coResult.error) throw coResult.error;

      set({
        divisions: (divResult.data ?? []) as BudgetDivision[],
        changeOrders: (coResult.data ?? []) as ChangeOrder[],
        loading: false,
      });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  importDivisions: async (projectId, divisions) => {
    const { error } = await (supabase.from('budget_divisions') as any).insert(   // ← as any #1
      divisions.map((d) => ({ ...d, project_id: projectId }))
    );

    if (error) return { error: error.message };
    await get().loadBudget(projectId);
    return { error: null };
  },

  addDivision: async (division) => {
    const { error } = await (supabase.from('budget_divisions') as any).insert(division);  // ← as any #2
    if (error) return { error: error.message };
    await get().loadBudget(division.project_id);
    return { error: null };
  },

  updateDivision: async (id, updates) => {
    const { error } = await (supabase.from('budget_divisions') as any).update(updates).eq('id', id);  // ← as any #3
    if (!error) {
      // Optimistic update only affects local state - if API rejects, no sync!
      set(s => ({
        divisions: s.divisions.map(d => d.id === id ? { ...d, ...updates } : d),
      }));
    }
    return { error: error?.message ?? null };
  },

  // ... more unaudited mutations
}));
```

### AFTER (Split into UI store + Query hooks + Mutation hooks)

**File 1: src/stores/budgetUIStore.ts** (NEW - ~45 lines)
```typescript
import { create } from 'zustand'

interface BudgetUIState {
  selectedDivisionId: string | null
  setSelectedDivisionId: (id: string | null) => void

  expandedSections: Record<string, boolean>
  toggleSection: (id: string) => void

  showImportModal: boolean
  setShowImportModal: (show: boolean) => void
}

export const useBudgetUIStore = create<BudgetUIState>()((set) => ({
  selectedDivisionId: null,
  setSelectedDivisionId: (id) => set({ selectedDivisionId: id }),

  expandedSections: {},
  toggleSection: (id) => set(s => ({
    expandedSections: { ...s.expandedSections, [id]: !s.expandedSections[id] }
  })),

  showImportModal: false,
  setShowImportModal: (show) => set({ showImportModal: show }),
}))
```

**File 2: src/hooks/queries/useBudgetDivisions.ts** (NEW - ~30 lines)
```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { usePermissions } from '../usePermissions'
import type { BudgetDivision } from '../../types/database'

export function useBudgetDivisions(projectId: string) {
  const { checkPermission } = usePermissions()

  return useQuery({
    queryKey: ['budget_divisions', projectId],
    queryFn: async () => {
      if (!checkPermission('budget.view')) {
        throw new Error('Permission denied: budget.view')
      }

      const { data, error } = await supabase
        .from('budget_divisions')
        .select('*')
        .eq('project_id', projectId)
        .order('code')

      if (error) throw error
      return (data ?? []) as BudgetDivision[]
    },
    enabled: !!projectId && checkPermission('budget.view'),
    staleTime: 1000 * 60 * 10,
  })
}
```

**File 3: src/hooks/mutations/useAddDivision.ts** (NEW - ~50 lines)
```typescript
import { useAuditedMutation } from './createAuditedMutation'
import { budgetDivisionSchema } from '../../components/forms/schemas'
import type { BudgetDivision } from '../../types/database'

export interface AddDivisionParams {
  division: Omit<BudgetDivision, 'id' | 'created_at'>
  projectId: string
}

export function useAddDivision() {
  return useAuditedMutation<AddDivisionParams, { projectId: string }>({
    permission: 'budget.edit',
    schema: budgetDivisionSchema,
    schemaKey: 'division',
    action: 'add_budget_division',
    entityType: 'budget_division',
    getEntityTitle: (p) => p.division.code,
    getNewValue: (p) => p.division,
    mutationFn: async (params) => {
      const { error } = await supabase
        .from('budget_divisions')
        .insert({
          ...params.division,
          project_id: params.projectId,
        })

      if (error) throw error
      return { projectId: params.projectId }
    },
    invalidateKeys: (p, r) => [['budget_divisions', r.projectId]],
    analyticsEvent: 'budget_division_added',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to add budget division',
  })
}
```

---

## BEFORE/AFTER: crewStore.ts

### BEFORE (Current - 95 lines)
```typescript
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Crew } from '../types/database';

export interface CrewWithDetails extends Crew {
  location: string;
  task: string;
  productivity: number;
  eta: string;
}

interface CrewState {
  crews: CrewWithDetails[];
  loading: boolean;
  error: string | null;

  loadCrews: (projectId: string) => Promise<void>;
  addCrew: (crew: Omit<CrewWithDetails, 'id' | 'created_at'>) => Promise<{ error: string | null }>;
  updateCrew: (id: string, updates: Partial<CrewWithDetails>) => Promise<{ error: string | null }>;
  deleteCrew: (id: string) => Promise<{ error: string | null }>;
  getSummary: () => { total: number; active: number; totalWorkers: number; avgProductivity: number };
}

export const useCrewStore = create<CrewState>()((set, get) => ({
  crews: [],
  loading: false,
  error: null,

  loadCrews: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('crews')
        .select('*')
        .eq('project_id', projectId)
        .order('name');

      if (error) throw error;
      const crews: CrewWithDetails[] = (data ?? []).map((c: any) => ({  // ← any in map
        ...c,
        location: c.location || 'TBD',
        task: c.task || 'Unassigned',
        productivity: c.productivity || 0,
        eta: c.eta || 'TBD',
      }));
      set({ crews, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  addCrew: async (crew) => {
    const { error } = await (supabase.from('crews') as any).insert({   // ← as any #1
      project_id: crew.project_id,
      name: crew.name,
      foreman_id: crew.foreman_id,
      trade: crew.trade,
      size: crew.size,
      status: crew.status,
    });

    if (error) return { error: error.message };
    await get().loadCrews(crew.project_id);
    return { error: null };
  },

  updateCrew: async (id, updates) => {
    const { error } = await (supabase.from('crews') as any).update(updates).eq('id', id);  // ← as any #2
    if (!error) {
      set((s) => ({
        crews: s.crews.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      }));
    }
    return { error: error?.message ?? null };
  },

  deleteCrew: async (id) => {
    const { error } = await (supabase.from('crews') as any).delete().eq('id', id);  // ← as any #3
    if (!error) {
      set((s) => ({ crews: s.crews.filter((c) => c.id !== id) }));
    }
    return { error: error?.message ?? null };
  },

  getSummary: () => {
    const crews = get().crews;
    const active = crews.filter((c) => c.status === 'active');
    return {
      total: crews.length,
      active: active.length,
      totalWorkers: crews.reduce((s, c) => s + c.size, 0),
      avgProductivity: crews.length > 0 ? Math.round(crews.reduce((s, c) => s + c.productivity, 0) / crews.length) : 0,
    };
  },
}));
```

### AFTER

**File 1: src/stores/crewUIStore.ts** (NEW - ~40 lines)
```typescript
import { create } from 'zustand'

interface CrewUIState {
  selectedCrewId: string | null
  setSelectedCrewId: (id: string | null) => void

  expandedCrews: Record<string, boolean>
  toggleCrewExpanded: (id: string) => void

  filterStatus: 'all' | 'active' | 'inactive'
  setFilterStatus: (status: 'all' | 'active' | 'inactive') => void
}

export const useCrewUIStore = create<CrewUIState>()((set) => ({
  selectedCrewId: null,
  setSelectedCrewId: (id) => set({ selectedCrewId: id }),

  expandedCrews: {},
  toggleCrewExpanded: (id) => set(s => ({
    expandedCrews: { ...s.expandedCrews, [id]: !s.expandedCrews[id] }
  })),

  filterStatus: 'all',
  setFilterStatus: (status) => set({ filterStatus: status }),
}))
```

**File 2: src/hooks/queries/useCrews.ts** (NEW - ~40 lines)
```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { usePermissions } from '../usePermissions'
import type { Crew } from '../../types/database'

export interface CrewWithDetails extends Crew {
  location: string
  task: string
  productivity: number
  eta: string
}

function enrichCrew(c: Crew): CrewWithDetails {
  return {
    ...c,
    location: c.location || 'TBD',
    task: c.task || 'Unassigned',
    productivity: c.productivity || 0,
    eta: c.eta || 'TBD',
  }
}

export function useCrews(projectId: string) {
  const { checkPermission } = usePermissions()

  return useQuery({
    queryKey: ['crews', projectId],
    queryFn: async () => {
      if (!checkPermission('crews.view')) {
        throw new Error('Permission denied: crews.view')
      }

      const { data, error } = await supabase
        .from('crews')
        .select('*')
        .eq('project_id', projectId)
        .order('name')

      if (error) throw error
      return (data ?? []).map(enrichCrew) as CrewWithDetails[]
    },
    enabled: !!projectId && checkPermission('crews.view'),
    staleTime: 1000 * 60 * 5,
  })
}

export function useCrewSummary(projectId: string) {
  const { data: crews = [], isLoading } = useCrews(projectId)

  return {
    summary: {
      total: crews.length,
      active: crews.filter(c => c.status === 'active').length,
      totalWorkers: crews.reduce((s, c) => s + c.size, 0),
      avgProductivity: crews.length > 0
        ? Math.round(crews.reduce((s, c) => s + c.productivity, 0) / crews.length)
        : 0,
    },
    isLoading,
  }
}
```

**File 3: src/hooks/mutations/useAddCrew.ts** (NEW - ~50 lines)
```typescript
import { useAuditedMutation } from './createAuditedMutation'
import { crewSchema } from '../../components/forms/schemas'
import type { Crew } from '../../types/database'

export interface AddCrewParams {
  crew: Omit<Crew, 'id' | 'created_at'>
  projectId: string
}

export function useAddCrew() {
  return useAuditedMutation<AddCrewParams, { projectId: string }>({
    permission: 'crews.create',
    schema: crewSchema,
    schemaKey: 'crew',
    action: 'create_crew',
    entityType: 'crew',
    getEntityTitle: (p) => p.crew.name,
    getNewValue: (p) => p.crew,
    mutationFn: async (params) => {
      const { error } = await supabase
        .from('crews')
        .insert({
          ...params.crew,
          project_id: params.projectId,
        })

      if (error) throw error
      return { projectId: params.projectId }
    },
    invalidateKeys: (p, r) => [['crews', r.projectId]],
    analyticsEvent: 'crew_added',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to add crew',
  })
}
```

**File 4: src/hooks/mutations/useUpdateCrew.ts** (NEW - ~50 lines)
```typescript
import { useAuditedMutation } from './createAuditedMutation'
import { crewSchema } from '../../components/forms/schemas'
import type { Crew } from '../../types/database'

export interface UpdateCrewParams {
  id: string
  updates: Partial<Crew>
  projectId: string
}

export function useUpdateCrew() {
  return useAuditedMutation<UpdateCrewParams, { projectId: string; id: string }>({
    permission: 'crews.edit',
    schema: crewSchema.partial(),
    schemaKey: 'updates',
    action: 'update_crew',
    entityType: 'crew',
    getEntityId: (p) => p.id,
    getNewValue: (p) => p.updates,
    mutationFn: async ({ id, updates, projectId }) => {
      const { error } = await supabase
        .from('crews')
        .update(updates)
        .eq('id', id)

      if (error) throw error
      return { projectId, id }
    },
    invalidateKeys: (_, r) => [['crews', r.projectId]],
    analyticsEvent: 'crew_updated',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to update crew',
  })
}
```

**File 5: src/hooks/mutations/useDeleteCrew.ts** (NEW - ~45 lines)
```typescript
import { useAuditedMutation } from './createAuditedMutation'
import type { Crew } from '../../types/database'

export interface DeleteCrewParams {
  id: string
  projectId: string
}

export function useDeleteCrew() {
  return useAuditedMutation<DeleteCrewParams, { projectId: string }>({
    permission: 'crews.delete',
    action: 'delete_crew',
    entityType: 'crew',
    getEntityId: (p) => p.id,
    mutationFn: async ({ id, projectId }) => {
      const { error } = await supabase.from('crews').delete().eq('id', id)

      if (error) throw error
      return { projectId }
    },
    invalidateKeys: (_, r) => [['crews', r.projectId]],
    analyticsEvent: 'crew_deleted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to delete crew',
  })
}
```

---

## COMPONENT USAGE CHANGES

### Before (Using Store)
```typescript
import { useRfiStore } from '../stores/rfiStore'
import { useProjectStore } from '../stores/projectStore'

export function RFIList() {
  const { rfis, loading, error, loadRfis } = useRfiStore()
  const { currentProjectId } = useProjectStore()

  useEffect(() => {
    loadRfis(currentProjectId)
  }, [currentProjectId, loadRfis])

  if (loading) return <Skeleton />
  if (error) return <ErrorBoundary message={error} />

  return (
    <div>
      {rfis.map(rfi => <RFICard key={rfi.id} rfi={rfi} />)}
    </div>
  )
}
```

### After (Using React Query)
```typescript
import { useRFIs } from '../hooks/queries/useRFIs'
import { useProjectStore } from '../stores/projectStore'

export function RFIList() {
  const { currentProjectId } = useProjectStore()
  const { data: rfis = [], isLoading, error } = useRFIs(currentProjectId)

  if (isLoading) return <Skeleton />
  if (error) return <ErrorBoundary message={error.message} />

  return (
    <div>
      {rfis.map(rfi => <RFICard key={rfi.id} rfi={rfi} />)}
    </div>
  )
}
```

---

## DETAILED STORE-BY-STORE MIGRATION MAP

| Store | Current Lines | UI-only State | Query Hooks Needed | Mutation Hooks Needed | Estimated Hours |
|-------|---|---|---|---|---|
| authStore.ts | 155 | user, token, role | useAuth, useCurrentUser | useLogin, useLogout, useSSO | 2 |
| budgetStore.ts | 156 | selectedDiv, expandedSections | useBudgetDivisions, useChangeOrders, useLineItems | useAddDivision, useUpdateDivision, useImportDivisions, useAddChangeOrder | 2.5 |
| copilotStore.ts | 193 | selectedContext, messages | useCopilotHistory | useAskCopilot | 2 |
| crewStore.ts | 95 | selectedCrew, filterStatus | useCrews | useAddCrew, useUpdateCrew, useDeleteCrew | 1.5 |
| dailyLogStore.ts | 116 | selectedLog, expandedPhotos | useDailyLogs, usePhotosByLog | useCreateDailyLog, useUpdateDailyLog | 2 |
| directoryStore.ts | 98 | selectedContact, searchTerm | useDirectoryContacts | useAddContact, useUpdateContact, useDeleteContact | 1.5 |
| fieldCaptureStore.ts | ? | selectedCapture | useFieldCaptures | useCreateCapture, useUpdateCapture | 1.5 |
| fileStore.ts | 220 | selectedFile, expandedFolders | useFiles | useUploadFile, useDeleteFile, useCreateFolder | 2.5 |
| meetingStore.ts | 123 | selectedMeeting, expandedAgenda | useMeetings | useCreateMeeting, useUpdateMeeting, useAddAttendee | 2 |
| projectContextStore.ts | 171 | selectedContext, expandedSections | useProjectContexts | useCreateContext, useUpdateContext | 2 |
| punchListStore.ts | 123 | selectedItem, filterStatus | usePunchList | useCreatePunchItem, useUpdatePunchItem, useClosePunchItem | 2 |
| rfiStore.ts | 125 | selectedRfi, filterStatus | useRFIs, useRFIResponses | useCreateRFI, useUpdateRFI, useDeleteRFI, useCreateRFIResponse | 2.5 |
| submittalStore.ts | 133 | selectedSubmittal, filterStatus | useSubmittals | useCreateSubmittal, useUpdateSubmittal | 2 |
| **TOTAL** | **~2,200** | — | — | — | **~30 hours** |

---

## Execution Order (CRITICAL)

**Phase 1 (Days 1-2):** Create the foundation
1. Create `src/hooks/queries/` directory
2. Create `src/hooks/mutations/` directory
3. Create all `useXxxUIStore` files (keep Zustand minimal)

**Phase 2 (Days 3-4):** Migrate core queries
1. Implement all `useQuery` hooks
2. Test with existing components (can use side-by-side)

**Phase 3 (Days 5-7):** Migrate mutations
1. Implement all `useAuditedMutation` hooks
2. Convert all `useMutation()` calls to `useAuditedMutation()`
3. Delete non-audited mutations

**Phase 4 (Day 8):** Cut over components
1. Replace all store imports in components with hook imports
2. Test full end-to-end
3. Delete old store files

---

## Verification Script

```bash
#!/bin/bash
# Verify Store Migration Complete

set -e

echo "✓ Checking Zustand stores are empty (UI-only)..."
for store in src/stores/*Store.ts; do
  # Each store file should have no supabase imports
  if grep -q "from '../lib/supabase'" "$store"; then
    # Exception: authStore, uiStore can have supabase
    if [[ ! "$store" =~ (authStore|uiStore|presenceStore) ]]; then
      echo "❌ FAIL: $store still imports supabase"
      exit 1
    fi
  fi
done

echo "✓ No supabase.from() calls in stores..."
if grep -r "supabase\.from" src/stores/ --include="*.ts"; then
  echo "❌ FAIL: Found supabase.from() in stores"
  exit 1
fi

echo "✓ All mutations use useAuditedMutation..."
count=$(grep -r "useMutation(" src/hooks/mutations/ --include="*.ts" | grep -v "useAuditedMutation" | wc -l)
if [ "$count" -gt 5 ]; then  # Allow a few setup mutations
  echo "❌ FAIL: Still have plain useMutation() calls"
  exit 1
fi

echo "✓ No 'as any' casts in stores..."
if grep -r "as any" src/stores/ --include="*.ts"; then
  echo "❌ FAIL: Found 'as any' in stores"
  exit 1
fi

echo "✓ All query hooks exist..."
required_hooks=(
  "useRFIs"
  "useCrews"
  "useBudgetDivisions"
  "useDailyLogs"
  "useDirectoryContacts"
)

for hook in "${required_hooks[@]}"; do
  if ! grep -r "export function $hook" src/hooks/queries/ --include="*.ts"; then
    echo "❌ FAIL: Missing $hook"
    exit 1
  fi
done

echo "✓ All mutation hooks exist..."
required_mutations=(
  "useCreateRFI"
  "useUpdateRFI"
  "useDeleteRFI"
  "useAddCrew"
  "useUpdateCrew"
)

for mutation in "${required_mutations[@]}"; do
  if ! grep -r "export function $mutation" src/hooks/mutations/ --include="*.ts"; then
    echo "❌ FAIL: Missing $mutation"
    exit 1
  fi
done

echo "✓ Permission checks in all queries..."
count=$(grep -r "checkPermission" src/hooks/queries/ --include="*.ts" | wc -l)
if [ "$count" -lt 5 ]; then
  echo "❌ FAIL: Permission checks missing from queries"
  exit 1
fi

echo "✓ Audit calls in all mutations..."
count=$(grep -r "useAuditedMutation" src/hooks/mutations/ --include="*.ts" | wc -l)
if [ "$count" -lt 10 ]; then
  echo "❌ FAIL: Not enough useAuditedMutation calls"
  exit 1
fi

echo ""
echo "✅ ALL CHECKS PASSED - Store migration complete!"
echo ""
echo "Statistics:"
echo "  - Zustand stores (UI-only): $(ls src/stores/*UIStore.ts 2>/dev/null | wc -l)"
echo "  - Query hooks: $(ls src/hooks/queries/use*.ts 2>/dev/null | wc -l)"
echo "  - Mutation hooks: $(ls src/hooks/mutations/use*.ts 2>/dev/null | wc -l)"
```

Run with:
```bash
bash scripts/verify-store-migration.sh
```

Expected output:
```
✓ Checking Zustand stores are empty (UI-only)...
✓ No supabase.from() calls in stores...
✓ All mutations use useAuditedMutation...
✓ No 'as any' casts in stores...
✓ All query hooks exist...
✓ All mutation hooks exist...
✓ Permission checks in all queries...
✓ Audit calls in all mutations...

✅ ALL CHECKS PASSED - Store migration complete!

Statistics:
  - Zustand stores (UI-only): 15
  - Query hooks: 40+
  - Mutation hooks: 30+
```
