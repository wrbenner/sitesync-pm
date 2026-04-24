import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

export type AnnotationType =
  | 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'polygon'
  | 'freehand' | 'text' | 'cloud' | 'callout' | 'stamp'
  | 'dimension' | 'note' | 'highlight'

export interface DrawingAnnotation {
  id: string
  project_id: string
  drawing_id: string
  page_number: number
  annotation_type: AnnotationType
  shape_data: Record<string, unknown>
  color: string
  scale: number | null
  created_by: string
  is_resolved: boolean
  linked_rfi_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Enhanced annotation fields
  annotation_data: Record<string, unknown>
  stroke_color: string
  stroke_width: number
  fill_color: string | null
  opacity: number
  rotation: number
  is_locked: boolean
  layer_index: number
  label: string | null
  linked_punch_item_id: string | null
}

export interface CreateAnnotationInput {
  project_id: string
  drawing_id: string
  page_number: number
  annotation_type: AnnotationType
  shape_data: Record<string, unknown>
  color: string
  scale?: number
  notes?: string
  linked_rfi_id?: string
  // Enhanced fields
  annotation_data?: Record<string, unknown>
  stroke_color?: string
  stroke_width?: number
  fill_color?: string | null
  opacity?: number
  rotation?: number
  is_locked?: boolean
  layer_index?: number
  label?: string | null
  linked_punch_item_id?: string | null
}

export interface UpdateAnnotationInput {
  id: string
  drawingId: string
  is_resolved?: boolean
  notes?: string
  // Enhanced fields
  annotation_type?: AnnotationType
  shape_data?: Record<string, unknown>
  color?: string
  annotation_data?: Record<string, unknown>
  stroke_color?: string
  stroke_width?: number
  fill_color?: string | null
  opacity?: number
  rotation?: number
  is_locked?: boolean
  layer_index?: number
  label?: string | null
  linked_rfi_id?: string | null
  linked_punch_item_id?: string | null
}

export function useDrawingAnnotations(drawingId: string | undefined) {
  return useQuery({
    queryKey: ['drawing_annotations', drawingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drawing_annotations')
        .select('*')
        .eq('drawing_id', drawingId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!drawingId,
  })
}

export function useCreateDrawingAnnotation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateAnnotationInput) => {
      const { data, error } = await supabase
        .from('drawing_annotations')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['drawing_annotations', v.drawing_id] })
      toast.success('Annotation saved')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save annotation'),
  })
}

export function useUpdateDrawingAnnotation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, drawingId, ...updates }: UpdateAnnotationInput) => {
      const { data, error } = await supabase
        .from('drawing_annotations')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return { ...data, drawingId }
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['drawing_annotations', v.drawingId] })
      toast.success('Annotation updated')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update'),
  })
}

export function useDeleteDrawingAnnotation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, drawingId }: { id: string; drawingId: string }) => {
      const { error } = await supabase.from('drawing_annotations').delete().eq('id', id)
      if (error) throw error
      return { drawingId }
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['drawing_annotations', v.drawingId] })
      toast.success('Annotation deleted')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete'),
  })
}
