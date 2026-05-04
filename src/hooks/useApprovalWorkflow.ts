import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fromTable, supabase } from '../lib/supabase'
import { useProjectId } from './useProjectId'


export type ApprovalEntityType = 'submittal' | 'rfi' | 'change_order' | 'pay_application' | 'daily_log' | 'safety_inspection'
export type ApprovalActionType = 'approve' | 'review' | 'acknowledge'
export type ApprovalAction = 'approved' | 'rejected' | 'returned' | 'acknowledged'

export interface ApprovalStep {
  step_order: number
  role: string
  action_required: ApprovalActionType
  required: boolean
}

export interface ApprovalWorkflowTemplate {
  id: string
  project_id: string
  entity_type: ApprovalEntityType
  name: string
  steps: ApprovalStep[]
  is_default: boolean
  created_by: string | null
  created_at: string
}

export interface ApprovalInstance {
  id: string
  template_id: string | null
  entity_type: string
  entity_id: string
  project_id: string
  current_step: number
  status: 'in_progress' | 'approved' | 'rejected' | 'cancelled'
  created_at: string
  completed_at: string | null
}

export interface ApprovalStepAction {
  id: string
  instance_id: string
  step_order: number
  assigned_to: string | null
  action: ApprovalAction | null
  comments: string | null
  acted_at: string | null
  due_date: string | null
  created_at: string
}

export interface ApprovalStatus {
  instance: ApprovalInstance | null
  template: ApprovalWorkflowTemplate | null
  actions: ApprovalStepAction[]
}

export function useApprovalTemplates(entityType?: ApprovalEntityType) {
  const projectId = useProjectId()
  return useQuery<ApprovalWorkflowTemplate[]>({
    queryKey: ['approval-templates', projectId, entityType ?? 'all'],
    enabled: !!projectId,
    queryFn: async () => {
      let q = fromTable('approval_workflow_templates').select('*').eq('project_id', projectId!)
      if (entityType) q = q.eq('entity_type', entityType)
      const { data, error } = await q.order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as ApprovalWorkflowTemplate[]) ?? []
    },
  })
}

export function useApprovalStatus(entityType: string | undefined, entityId: string | undefined) {
  return useQuery<ApprovalStatus>({
    queryKey: ['approval-status', entityType, entityId],
    enabled: !!entityType && !!entityId,
    queryFn: async () => {
      const { data: instances, error } = await fromTable('approval_instances')
        .select('*')
        .eq('entity_type', entityType!)
        .eq('entity_id', entityId!)
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) throw error
      const instance = ((instances as ApprovalInstance[] | null) ?? [])[0] ?? null
      if (!instance) return { instance: null, template: null, actions: [] }

      const [tplRes, actionsRes] = await Promise.all([
        instance.template_id
          ? fromTable('approval_workflow_templates').select('*').eq('id', instance.template_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        fromTable('approval_step_actions').select('*').eq('instance_id', instance.id).order('step_order'),
      ])

      return {
        instance,
        template: (tplRes.data as ApprovalWorkflowTemplate | null) ?? null,
        actions: (actionsRes.data as unknown as ApprovalStepAction[] | null) ?? [],
      }
    },
  })
}

export function useSaveApprovalTemplate() {
  const qc = useQueryClient()
  const projectId = useProjectId()
  return useMutation({
    mutationFn: async (input: {
      id?: string
      entity_type: ApprovalEntityType
      name: string
      steps: ApprovalStep[]
      is_default: boolean
    }) => {
      if (!projectId) throw new Error('No project selected')
      const { data: userData } = await supabase.auth.getUser()
      const created_by = userData?.user?.id ?? null

      if (input.is_default) {
        await fromTable('approval_workflow_templates')
          .update({ is_default: false } as never)
          .eq('project_id', projectId)
          .eq('entity_type', input.entity_type)
      }

      if (input.id) {
        const { data, error } = await fromTable('approval_workflow_templates')
          .update({ name: input.name, steps: input.steps, is_default: input.is_default } as never)
          .eq('id', input.id)
          .select()
          .single()
        if (error) throw error
        return data as unknown as ApprovalWorkflowTemplate
      }
      const { data, error } = await fromTable('approval_workflow_templates')
        .insert({
          project_id: projectId,
          entity_type: input.entity_type,
          name: input.name,
          steps: input.steps,
          is_default: input.is_default,
          created_by,
        } as never)
        .select()
        .single()
      if (error) throw error
      return data as unknown as ApprovalWorkflowTemplate
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approval-templates', projectId] }),
  })
}

export function useStartApproval() {
  const qc = useQueryClient()
  const projectId = useProjectId()
  return useMutation({
    mutationFn: async ({ entityType, entityId }: { entityType: ApprovalEntityType; entityId: string }) => {
      if (!projectId) throw new Error('No project selected')
      const { data: tpls, error: te } = await fromTable('approval_workflow_templates')
        .select('*')
        .eq('project_id', projectId)
        .eq('entity_type', entityType)
        .eq('is_default', true)
        .limit(1)
      if (te) throw te
      const template = ((tpls as unknown as ApprovalWorkflowTemplate[] | null) ?? [])[0]
      if (!template) throw new Error('No default approval workflow configured for ' + entityType)

      const { data: inst, error: ie } = await fromTable('approval_instances')
        .insert({
          template_id: template.id,
          entity_type: entityType,
          entity_id: entityId,
          project_id: projectId,
          current_step: 1,
          status: 'in_progress',
        } as never)
        .select()
        .single()
      if (ie) throw ie
      return inst as ApprovalInstance
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['approval-status', v.entityType, v.entityId] }),
  })
}

export function useTakeApprovalAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      instanceId: string
      stepOrder: number
      action: ApprovalAction
      comments?: string
      totalSteps: number
      entityType: string
      entityId: string
    }) => {
      const { data: userData } = await supabase.auth.getUser()
      const assigned_to = userData?.user?.id ?? null

      const { error: insErr } = await fromTable('approval_step_actions').insert({
        instance_id: input.instanceId,
        step_order: input.stepOrder,
        assigned_to,
        action: input.action,
        comments: input.comments ?? null,
        acted_at: new Date().toISOString(),
      } as never)
      if (insErr) throw insErr

      let newStatus: ApprovalInstance['status'] = 'in_progress'
      let nextStep = input.stepOrder
      let completed_at: string | null = null

      if (input.action === 'rejected') {
        newStatus = 'rejected'
        completed_at = new Date().toISOString()
      } else if (input.action === 'returned') {
        nextStep = Math.max(1, input.stepOrder - 1)
      } else {
        nextStep = input.stepOrder + 1
        if (nextStep > input.totalSteps) {
          newStatus = 'approved'
          completed_at = new Date().toISOString()
        }
      }

      const { error: upErr } = await fromTable('approval_instances')
        .update({ current_step: nextStep, status: newStatus, completed_at } as never)
        .eq('id', input.instanceId)
      if (upErr) throw upErr
      return { newStatus, nextStep }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['approval-status', v.entityType, v.entityId] })
    },
  })
}
