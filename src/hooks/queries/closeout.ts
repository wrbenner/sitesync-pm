import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { uploadCloseoutDocument } from '../../lib/storage'
import type { CloseoutItemStatus } from '../../machines/closeoutMachine'
import {
  getCloseoutStatusConfig,
  getCloseoutCategoryConfig,
  computeWarrantyStatus,
  generateCloseoutList,
  type CloseoutCategory,
  type ProjectType,
} from '../../machines/closeoutMachine'

// ── Types ────────────────────────────────────────────────

export interface CloseoutItemRow {
  id: string
  project_id: string
  category: string | null
  description: string
  trade: string
  status: string | null
  assigned_to: string | null
  due_date: string | null
  completed_date: string | null
  document_url: string | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export interface CloseoutDocument {
  id: string
  closeout_item_id: string
  project_id: string
  file_name: string
  file_url: string
  file_path: string
  file_size: number
  file_type: string
  uploaded_by: string | null
  created_at: string | null
}

// ── Fetch all closeout items with computed fields ────────

export function useCloseoutData(projectId: string | undefined) {
  return useQuery({
    queryKey: ['closeout_items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closeout_items')
        .select('*')
        .eq('project_id', projectId!)
        .order('trade', { ascending: true })
        .order('category', { ascending: true })

      if (error) throw error
      const items = (data ?? []) as CloseoutItemRow[]

      // Compute summary stats
      const total = items.length
      const approved = items.filter(i => i.status === 'approved').length
      const submitted = items.filter(i => i.status === 'submitted').length
      const underReview = items.filter(i => i.status === 'under_review').length
      const rejected = items.filter(i => i.status === 'rejected').length
      const requested = items.filter(i => i.status === 'requested').length
      const required = items.filter(i => !i.status || i.status === 'required').length

      // Group by category
      const byCategory = items.reduce<Record<string, CloseoutItemRow[]>>((acc, item) => {
        const cat = item.category || 'other'
        acc[cat] = acc[cat] || []
        acc[cat].push(item)
        return acc
      }, {})

      // Group by trade
      const byTrade = items.reduce<Record<string, CloseoutItemRow[]>>((acc, item) => {
        const trade = item.trade || 'General'
        acc[trade] = acc[trade] || []
        acc[trade].push(item)
        return acc
      }, {})

      // Warranty items with computed status
      const warranties = items
        .filter(i => i.category === 'warranty')
        .map(w => ({
          ...w,
          warrantyStatus: w.due_date ? computeWarrantyStatus(w.due_date) : ('active' as const),
        }))

      const pctComplete = total > 0 ? Math.round((approved / total) * 100) : 0

      return {
        items,
        total,
        approved,
        submitted,
        underReview,
        rejected,
        requested,
        required,
        pctComplete,
        byCategory,
        byTrade,
        warranties,
      }
    },
    enabled: !!projectId,
  })
}

// ── Create closeout item ────────────────────────────────

interface CreateCloseoutItemParams {
  project_id: string
  category: CloseoutCategory | string
  description: string
  trade: string
  assigned_to?: string | null
  due_date?: string | null
  notes?: string | null
  status?: CloseoutItemStatus
}

export function useCreateCloseoutItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: CreateCloseoutItemParams) => {
      const { data, error } = await supabase
        .from('closeout_items')
        .insert({
          project_id: params.project_id,
          category: params.category,
          description: params.description,
          trade: params.trade,
          assigned_to: params.assigned_to || null,
          due_date: params.due_date || null,
          notes: params.notes || null,
          status: params.status || 'required',
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['closeout_items', vars.project_id] })
    },
  })
}

// ── Bulk generate closeout list from templates ──────────

export function useGenerateCloseoutList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ projectId, projectType }: { projectId: string; projectType: ProjectType }) => {
      const templates = generateCloseoutList(projectType)

      // Check if items already exist to avoid duplicates
      const { data: existing } = await supabase
        .from('closeout_items')
        .select('description, category')
        .eq('project_id', projectId)

      const existingSet = new Set(
        (existing ?? []).map((e: { description: string; category: string | null }) => `${e.category}::${e.description}`)
      )

      const newItems = templates
        .filter(t => !existingSet.has(`${t.category}::${t.title}`))
        .map(t => ({
          project_id: projectId,
          category: t.category,
          description: t.title,
          trade: t.trade || 'General',
          notes: t.description + (t.specSection ? ` (Spec ${t.specSection})` : ''),
          status: 'required',
        }))

      if (newItems.length === 0) return { count: 0 }

      const { error } = await supabase.from('closeout_items').insert(newItems)
      if (error) throw error
      return { count: newItems.length }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['closeout_items', vars.projectId] })
    },
  })
}

// ── Transition closeout item status ─────────────────────

export function useTransitionCloseoutStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, projectId }: { id: string; status: CloseoutItemStatus; projectId: string }) => {
      const updates: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      }
      if (status === 'approved') {
        updates.completed_date = new Date().toISOString()
      }
      const { data, error } = await supabase
        .from('closeout_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['closeout_items', vars.projectId] })
    },
  })
}

// ── Update closeout item fields ─────────────────────────

export function useUpdateCloseoutItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      projectId,
      updates,
    }: {
      id: string
      projectId: string
      updates: Partial<Pick<CloseoutItemRow, 'description' | 'trade' | 'assigned_to' | 'due_date' | 'notes' | 'document_url' | 'category'>>
    }) => {
      const { data, error } = await supabase
        .from('closeout_items')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['closeout_items', vars.projectId] })
    },
  })
}

// ── Delete closeout item ────────────────────────────────

export function useDeleteCloseoutItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase.from('closeout_items').delete().eq('id', id)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['closeout_items', vars.projectId] })
    },
  })
}

// ── Upload document for a closeout item ─────────────────

export function useUploadCloseoutDoc() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      projectId,
      closeoutItemId,
      file,
      userId,
    }: {
      projectId: string
      closeoutItemId: string
      file: File
      userId?: string
    }) => {
      // Upload to Supabase storage
      const { url, path, error: uploadError } = await uploadCloseoutDocument(
        projectId,
        closeoutItemId,
        file
      )
      if (uploadError) throw new Error(uploadError)

      // Update the closeout item's document_url
      await supabase
        .from('closeout_items')
        .update({
          document_url: url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', closeoutItemId)

      return { url, path, fileName: file.name, fileSize: file.size }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['closeout_items', vars.projectId] })
    },
  })
}

// ── Re-exports for convenience ──────────────────────────
export { getCloseoutStatusConfig, getCloseoutCategoryConfig, computeWarrantyStatus }
export type { CloseoutItemStatus, CloseoutCategory, ProjectType }
