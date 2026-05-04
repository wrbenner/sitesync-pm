import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'

// ── Inspection Checklists ──────────────────────────────────

export interface InspectionChecklist {
  id: string
  project_id: string
  name: string
  description: string | null
  category: string
  is_template: boolean
  source_template_id: string | null
  linked_entity_type: string | null
  linked_entity_id: string | null
  status: string
  completed_at: string | null
  completed_by: string | null
  pass_rate: number | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface InspectionChecklistItem {
  id: string
  checklist_id: string
  sort_order: number
  task_type: string
  label: string
  description: string | null
  is_required: boolean
  status: string
  value_text: string | null
  value_number: number | null
  value_meter: number | null
  meter_unit: string | null
  photo_urls: string[]
  notes: string | null
  completed_by: string | null
  completed_at: string | null
  created_at: string
}

export function useInspectionChecklists(
  projectId: string | undefined,
  filters?: { category?: string; status?: string }
) {
  return useQuery({
    queryKey: ['inspection_checklists', projectId, filters],
    queryFn: async () => {
      let query = fromTable('inspection_checklists')
        .select('*')
        .eq('project_id' as never, projectId!)
        .eq('is_template' as never, false)
        .order('created_at', { ascending: false })

      if (filters?.category) {
        query = query.eq('category' as never, filters.category)
      }
      if (filters?.status) {
        query = query.eq('status' as never, filters.status)
      }

      const { data, error } = await query
      if (error) throw error
      return data as InspectionChecklist[]
    },
    enabled: !!projectId,
  })
}

export function useChecklistTemplates(projectId: string | undefined) {
  return useQuery({
    queryKey: ['checklist_templates', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('inspection_checklists')
        .select('*')
        .eq('project_id' as never, projectId!)
        .eq('is_template' as never, true)
        .order('name')

      if (error) throw error
      return data as InspectionChecklist[]
    },
    enabled: !!projectId,
  })
}

export function useChecklistItems(checklistId: string | undefined) {
  return useQuery({
    queryKey: ['checklist_items', checklistId],
    queryFn: async () => {
      const { data, error } = await fromTable('inspection_checklist_items')
        .select('*')
        .eq('checklist_id' as never, checklistId!)
        .order('sort_order', { ascending: true })

      if (error) throw error
      return data as InspectionChecklistItem[]
    },
    enabled: !!checklistId,
  })
}
