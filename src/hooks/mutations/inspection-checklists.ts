import { useMutation, useQueryClient } from '@tanstack/react-query'

import posthog from '../../lib/analytics'
import { createOnError } from './createAuditedMutation'

import type { Database } from '../../types/database'
import { fromTable } from '../../lib/db/queries'

type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
const from = (table: AnyTableName) => fromTable(table as keyof Database['public']['Tables'])

// ── Inspection Checklists ──────────────────────────────────

export function useCreateChecklist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; projectId: string }) => {
      const { data, error } = await from('inspection_checklists').insert(params.data).select().single()
      if (error) throw error
      return { data: data as unknown as Record<string, unknown>, projectId: params.projectId }
    },
    onSuccess: (result: { data: Record<string, unknown>; projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['inspection_checklists', result.projectId] })
      queryClient.invalidateQueries({ queryKey: ['checklist_templates', result.projectId] })
      posthog.capture('checklist_created', { project_id: result.projectId })
    },
    onError: createOnError('create_checklist'),
  })
}

export function useCreateChecklistFromTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      templateId: string
      projectId: string
      name: string
      category?: string
      linkedEntityType?: string
      linkedEntityId?: string
    }) => {
      // 1. Fetch template
      const { data: template, error: tErr } = await from('inspection_checklists')
        .select('*')
        .eq('id' as never, params.templateId)
        .single()
      if (tErr) throw tErr

      // 2. Fetch template items
      const { data: templateItems, error: iErr } = await from('inspection_checklist_items')
        .select('*')
        .eq('checklist_id' as never, params.templateId)
        .order('sort_order', { ascending: true })
      if (iErr) throw iErr

      // 3. Create new checklist from template
      const t = template as unknown as Record<string, unknown>
      const { data: newChecklist, error: cErr } = await from('inspection_checklists')
        .insert({
          project_id: params.projectId,
          name: params.name,
          description: t.description,
          category: params.category || t.category,
          is_template: false,
          source_template_id: params.templateId,
          linked_entity_type: params.linkedEntityType || null,
          linked_entity_id: params.linkedEntityId || null,
          status: 'pending',
        } as never)
        .select()
        .single()
      if (cErr) throw cErr

      // 4. Copy items
      const nc = newChecklist as unknown as Record<string, unknown>
      if (templateItems && (templateItems as unknown[]).length > 0) {
        const items = (templateItems as unknown as Record<string, unknown>[]).map((item) => ({
          checklist_id: nc.id,
          sort_order: item.sort_order,
          task_type: item.task_type,
          label: item.label,
          description: item.description,
          is_required: item.is_required,
          status: 'pending',
          meter_unit: item.meter_unit,
        }))
        const { error: insertErr } = await from('inspection_checklist_items').insert(items as never)
        if (insertErr) throw insertErr
      }

      return { data: nc, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['inspection_checklists', result.projectId] })
      posthog.capture('checklist_created_from_template', { project_id: result.projectId })
    },
    onError: createOnError('create_checklist_from_template'),
  })
}

export function useUpdateChecklistItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      id: string
      updates: Record<string, unknown>
      checklistId: string
      projectId: string
    }) => {
      const { error } = await from('inspection_checklist_items')
        .update(params.updates)
        .eq('id' as never, params.id)
      if (error) throw error

      // Recalculate pass_rate for the checklist
      const { data: items, error: iErr } = await from('inspection_checklist_items')
        .select('status')
        .eq('checklist_id' as never, params.checklistId)
      if (iErr) throw iErr

      const allItems = items as { status: string }[]
      const total = allItems.length
      const completed = allItems.filter((i) => i.status !== 'pending').length
      const passed = allItems.filter((i) => i.status === 'pass').length
      const failed = allItems.filter((i) => i.status === 'fail').length
      const passRate = total > 0 ? Math.round((passed / total) * 100) : null

      const allDone = completed === total
      const newStatus = allDone
        ? (failed > 0 ? 'failed' : 'completed')
        : (completed > 0 ? 'in_progress' : 'pending')

      const checklistUpdate: Record<string, unknown> = {
        pass_rate: passRate,
        status: newStatus,
        updated_at: new Date().toISOString(),
      }
      if (allDone) {
        checklistUpdate.completed_at = new Date().toISOString()
      }

      await from('inspection_checklists')
        .update(checklistUpdate as never)
        .eq('id' as never, params.checklistId)

      return { checklistId: params.checklistId, projectId: params.projectId }
    },
    onSuccess: (result: { checklistId: string; projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['checklist_items', result.checklistId] })
      queryClient.invalidateQueries({ queryKey: ['inspection_checklists', result.projectId] })
      posthog.capture('checklist_item_updated', { project_id: result.projectId })
    },
    onError: createOnError('update_checklist_item'),
  })
}

export function useDeleteChecklist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; projectId: string }) => {
      const { error } = await from('inspection_checklists').delete().eq('id' as never, params.id)
      if (error) throw error
      return { projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['inspection_checklists', result.projectId] })
      posthog.capture('checklist_deleted', { project_id: result.projectId })
    },
    onError: createOnError('delete_checklist'),
  })
}
