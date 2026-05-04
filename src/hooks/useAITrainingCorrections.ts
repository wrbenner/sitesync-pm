// Phase 5: Training Pipeline hook.
// Thin client around ai_training_corrections. Every correction the user
// submits on an AI prediction (classification, discrepancy, edge detection)
// funnels through here so the export-training-data Edge Function can pick it
// up and feed Roboflow.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fromTable } from '../lib/db/queries'

export type CorrectionType = 'classification' | 'discrepancy' | 'edge_detection' | 'entity'

export interface CorrectionInput {
  correctionType: CorrectionType
  projectId: string | null
  drawingId?: string | null
  sourceTable: string
  sourceRecordId: string
  originalValue: Record<string, unknown>
  correctedValue: Record<string, unknown>
  pageImageUrl?: string | null
  annotationCoordinates?: Record<string, unknown> | null
}

export interface CorrectionRow {
  id: string
  project_id: string | null
  user_id: string | null
  correction_type: CorrectionType
  original_value: Record<string, unknown>
  corrected_value: Record<string, unknown>
  source_record_id: string | null
  source_table: string | null
  drawing_id: string | null
  page_image_url: string | null
  annotation_coordinates: Record<string, unknown> | null
  is_exported: boolean
  exported_at: string | null
  created_at: string
}

export function useLogCorrection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CorrectionInput): Promise<CorrectionRow> => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id ?? null

      const { data, error } = await fromTable('ai_training_corrections')
        .insert({
          correction_type: input.correctionType,
          project_id: input.projectId,
          user_id: userId,
          source_table: input.sourceTable,
          source_record_id: input.sourceRecordId,
          original_value: input.originalValue,
          corrected_value: input.correctedValue,
          drawing_id: input.drawingId ?? null,
          page_image_url: input.pageImageUrl ?? null,
          annotation_coordinates: input.annotationCoordinates ?? null,
        } as never)
        .select('*')
        .single()

      if (error) throw error
      return data as unknown as CorrectionRow
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['ai-training-corrections', vars.projectId] })
    },
  })
}

export function useCorrectionHistory(projectId: string | null | undefined) {
  return useQuery<CorrectionRow[]>({
    queryKey: ['ai-training-corrections', projectId ?? null],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await fromTable('ai_training_corrections')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as unknown as CorrectionRow[]
    },
    staleTime: 30_000,
  })
}
