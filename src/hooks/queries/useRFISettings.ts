// ── useRFISettings ──────────────────────────────────────────────────────
// One file covering every Settings → RFI sub-tab data layer:
//   • workflow templates
//   • response types
//   • custom fields + values
//   • permissions matrix (project_rfi_permissions)
//   • numbering rules (project_rfi_settings)
//   • notification prefs (project_rfi_notification_prefs)

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fromTable } from '../../lib/db/queries'
import { supabase } from '../../lib/supabase'
import { logAuditEntry } from '../../lib/auditLogger'

const from = (table: string) => fromTable(table as never)

// ── Workflow templates ──────────────────────────────────────────────
export interface WorkflowStage {
  name: string
  sla_days: number
  ball_in_court_role: string
  response_type_filter?: string[]
}

export interface RFIWorkflow {
  id: string
  project_id: string
  name: string
  stages: WorkflowStage[]
  is_default: boolean
}

export function useRFIWorkflows(projectId: string | undefined) {
  return useQuery({
    queryKey: ['rfi_workflows', projectId ?? '__none__'],
    enabled: !!projectId,
    queryFn: async (): Promise<RFIWorkflow[]> => {
      if (!projectId) return []
      const { data } = await from('project_rfi_workflows')
        .select('*')
        .eq('project_id' as never, projectId)
        .order('name' as never, { ascending: true })
      return (data ?? []) as unknown as RFIWorkflow[]
    },
  })
}

export function useSaveRFIWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { projectId: string; id?: string | null; name: string; stages: WorkflowStage[]; is_default?: boolean }) => {
      const payload = {
        project_id: params.projectId,
        name: params.name,
        stages: params.stages,
        is_default: params.is_default ?? false,
      }
      if (params.id) {
        const { error } = await from('project_rfi_workflows').update(payload as never).eq('id' as never, params.id)
        if (error) throw error
      } else {
        const { error } = await from('project_rfi_workflows').insert(payload as never)
        if (error) throw error
      }
      await logAuditEntry({
        projectId: params.projectId,
        entityType: 'project',
        entityId: params.projectId,
        action: 'update',
        afterState: { workflow: params.name },
        metadata: { kind: 'rfi_workflow_save' },
      })
      return params
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['rfi_workflows', vars.projectId] })
    },
  })
}

// ── Response types ──────────────────────────────────────────────────
export interface RFIResponseTypeRow {
  id: string
  project_id: string
  type_code: string
  label: string
  color: string | null
  counts_as_answered: boolean
  requires_resubmittal: boolean
  sort_order: number
}

export function useRFIResponseTypes(projectId: string | undefined) {
  return useQuery({
    queryKey: ['rfi_response_types', projectId ?? '__none__'],
    enabled: !!projectId,
    staleTime: 60_000,
    queryFn: async (): Promise<RFIResponseTypeRow[]> => {
      if (!projectId) return []
      const { data } = await from('project_rfi_response_types')
        .select('*')
        .eq('project_id' as never, projectId)
        .order('sort_order' as never, { ascending: true })
      return (data ?? []) as unknown as RFIResponseTypeRow[]
    },
  })
}

// ── Custom fields ───────────────────────────────────────────────────
export interface CustomFieldDef {
  id: string
  project_id: string
  field_code: string
  label: string
  field_type: 'text' | 'number' | 'date' | 'select' | 'user'
  options: string[]
  required: boolean
  applies_to_workflow_id: string | null
  sort_order: number
}

export function useRFICustomFields(projectId: string | undefined) {
  return useQuery({
    queryKey: ['rfi_custom_fields', projectId ?? '__none__'],
    enabled: !!projectId,
    queryFn: async (): Promise<CustomFieldDef[]> => {
      if (!projectId) return []
      const { data } = await from('project_rfi_custom_fields')
        .select('*')
        .eq('project_id' as never, projectId)
        .order('sort_order' as never, { ascending: true })
      return (data ?? []) as unknown as CustomFieldDef[]
    },
  })
}

export function useSaveRFICustomField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      projectId: string
      id?: string | null
      field_code: string
      label: string
      field_type: CustomFieldDef['field_type']
      options?: string[]
      required?: boolean
    }) => {
      const payload = {
        project_id: params.projectId,
        field_code: params.field_code,
        label: params.label,
        field_type: params.field_type,
        options: params.options ?? [],
        required: params.required ?? false,
      }
      if (params.id) {
        const { error } = await from('project_rfi_custom_fields').update(payload as never).eq('id' as never, params.id)
        if (error) throw error
      } else {
        const { error } = await from('project_rfi_custom_fields').insert(payload as never)
        if (error) throw error
      }
      return params
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['rfi_custom_fields', vars.projectId] })
    },
  })
}

export interface CustomFieldValue {
  id: string
  rfi_id: string
  field_code: string
  value: unknown
}

export function useRFICustomValues(rfiId: string | undefined) {
  return useQuery({
    queryKey: ['rfi_custom_values', rfiId ?? '__none__'],
    enabled: !!rfiId,
    queryFn: async (): Promise<CustomFieldValue[]> => {
      if (!rfiId) return []
      const { data } = await from('rfi_custom_values')
        .select('*')
        .eq('rfi_id' as never, rfiId)
      return (data ?? []) as unknown as CustomFieldValue[]
    },
  })
}

export function useSaveRFICustomValue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { rfiId: string; field_code: string; value: unknown }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await from('rfi_custom_values').upsert({
        rfi_id: params.rfiId,
        field_code: params.field_code,
        value: params.value,
        updated_by: user?.id ?? null,
      } as never, { onConflict: 'rfi_id,field_code' })
      if (error) throw error
      return params
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['rfi_custom_values', vars.rfiId] })
    },
  })
}

// ── Permissions matrix ──────────────────────────────────────────────
export interface RFIPermission {
  id: string
  project_id: string
  role: string
  action: string
  allowed: boolean
}

export const RFI_PERMISSION_ACTIONS = [
  'create',
  'respond',
  'mark_official',
  'close',
  'reopen',
  'see_private',
  'distribute',
  'export',
  'change_settings',
  'delete',
] as const
export type RFIPermissionAction = typeof RFI_PERMISSION_ACTIONS[number]

export const RFI_PERMISSION_ROLES = [
  'owner',
  'admin',
  'manager',
  'member',
  'sub',
  'external',
  'viewer',
] as const
export type RFIPermissionRole = typeof RFI_PERMISSION_ROLES[number]

export function useRFIPermissions(projectId: string | undefined) {
  return useQuery({
    queryKey: ['rfi_permissions', projectId ?? '__none__'],
    enabled: !!projectId,
    staleTime: 30_000,
    queryFn: async (): Promise<RFIPermission[]> => {
      if (!projectId) return []
      const { data } = await from('project_rfi_permissions')
        .select('*')
        .eq('project_id' as never, projectId)
      return (data ?? []) as unknown as RFIPermission[]
    },
  })
}

export function useSetRFIPermission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { projectId: string; role: RFIPermissionRole; action: RFIPermissionAction; allowed: boolean }) => {
      const { error } = await from('project_rfi_permissions').upsert({
        project_id: params.projectId,
        role: params.role,
        action: params.action,
        allowed: params.allowed,
      } as never, { onConflict: 'project_id,role,action' })
      if (error) throw error
      await logAuditEntry({
        projectId: params.projectId,
        entityType: 'project',
        entityId: params.projectId,
        action: 'update',
        afterState: { rfi_permission: { role: params.role, action: params.action, allowed: params.allowed } },
        metadata: { kind: 'rfi_permission_change' },
      })
      return params
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['rfi_permissions', vars.projectId] })
    },
  })
}

// ── Numbering rules ─────────────────────────────────────────────────
export interface RFISettingsRow {
  project_id: string
  number_prefix: string
  number_suffix: string
  number_padding: number
  per_trade_sequences: boolean
  manual_override: boolean
}

export function useRFINumberingSettings(projectId: string | undefined) {
  return useQuery({
    queryKey: ['rfi_settings', projectId ?? '__none__'],
    enabled: !!projectId,
    queryFn: async (): Promise<RFISettingsRow | null> => {
      if (!projectId) return null
      const { data } = await from('project_rfi_settings').select('*').eq('project_id' as never, projectId).maybeSingle()
      return (data ?? null) as unknown as RFISettingsRow | null
    },
  })
}

export function useSaveRFINumberingSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { projectId: string; patch: Partial<Omit<RFISettingsRow, 'project_id'>> }) => {
      const { error } = await from('project_rfi_settings').upsert({
        project_id: params.projectId,
        ...params.patch,
      } as never, { onConflict: 'project_id' })
      if (error) throw error
      return params
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['rfi_settings', vars.projectId] })
    },
  })
}

// ── Notification prefs ──────────────────────────────────────────────
export interface NotificationPref {
  id: string
  project_id: string
  event: string
  channel: string
  enabled: boolean
}

export function useRFINotificationPrefs(projectId: string | undefined) {
  return useQuery({
    queryKey: ['rfi_notification_prefs', projectId ?? '__none__'],
    enabled: !!projectId,
    queryFn: async (): Promise<NotificationPref[]> => {
      if (!projectId) return []
      const { data } = await from('project_rfi_notification_prefs')
        .select('*')
        .eq('project_id' as never, projectId)
      return (data ?? []) as unknown as NotificationPref[]
    },
  })
}

export function useSetRFINotificationPref() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { projectId: string; event: string; channel: string; enabled: boolean }) => {
      const { error } = await from('project_rfi_notification_prefs').upsert({
        project_id: params.projectId,
        event: params.event,
        channel: params.channel,
        enabled: params.enabled,
      } as never, { onConflict: 'project_id,event,channel' })
      if (error) throw error
      return params
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['rfi_notification_prefs', vars.projectId] })
    },
  })
}
