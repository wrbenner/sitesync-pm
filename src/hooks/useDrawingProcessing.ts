import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type {
  ClassifyDrawingResult,
  DrawingClassification,
  RevisionDiffResult,
} from '../types/ai'

// ── Query keys ───────────────────────────────────────────────
const classificationKey = (drawingId: string) => ['drawing_classifications', drawingId] as const
const projectClassificationsKey = (projectId: string) =>
  ['drawing_classifications', 'project', projectId] as const

// ── Fetch classifications for a single drawing ───────────────
export function useDrawingClassification(drawingId: string | undefined) {
  return useQuery<DrawingClassification[]>({
    queryKey: classificationKey(drawingId ?? ''),
    enabled: !!drawingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drawing_classifications')
        .select('*')
        .eq('drawing_id', drawingId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as DrawingClassification[]
    },
  })
}

// ── Fetch classifications for a whole project (for badges) ───
export function useProjectClassifications(projectId: string | undefined) {
  return useQuery<DrawingClassification[]>({
    queryKey: projectClassificationsKey(projectId ?? ''),
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drawing_classifications')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as DrawingClassification[]
    },
  })
}

// ── Classification mutation ──────────────────────────────────
interface ClassifyInput {
  projectId: string
  drawingId: string
  pageImageUrl: string
}

export function useClassifyDrawing() {
  const queryClient = useQueryClient()
  return useMutation<ClassifyDrawingResult, Error, ClassifyInput>({
    mutationFn: async ({ projectId, drawingId, pageImageUrl }) => {
      const { data, error } = await supabase.functions.invoke('classify-drawing', {
        body: {
          project_id: projectId,
          drawing_id: drawingId,
          page_image_url: pageImageUrl,
        },
      })
      if (error) throw new Error(error.message || 'Drawing classification failed')
      if (!data || typeof data !== 'object') {
        throw new Error('Classification edge function returned no data')
      }
      return data as ClassifyDrawingResult
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: classificationKey(variables.drawingId) })
      queryClient.invalidateQueries({ queryKey: projectClassificationsKey(variables.projectId) })
    },
  })
}

// ── Revision diff mutation ───────────────────────────────────
interface RevisionDiffInput {
  projectId: string
  drawingId: string
  oldRevisionUrl: string
  newRevisionUrl: string
  oldScale?: string | number | null
  newScale?: string | number | null
  oldLabel?: string
  newLabel?: string
}

export function useRevisionDiff() {
  return useMutation<RevisionDiffResult, Error, RevisionDiffInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke('generate-revision-diff', {
        body: {
          project_id: input.projectId,
          drawing_id: input.drawingId,
          old_revision_url: input.oldRevisionUrl,
          new_revision_url: input.newRevisionUrl,
          old_scale: input.oldScale ?? null,
          new_scale: input.newScale ?? null,
          old_label: input.oldLabel,
          new_label: input.newLabel,
        },
      })
      if (error) throw new Error(error.message || 'Revision diff generation failed')
      if (!data || typeof data !== 'object') {
        throw new Error('Revision diff edge function returned no data')
      }
      return data as RevisionDiffResult
    },
  })
}

// ── Aggregate helper: "should we show a badge?" ──────────────
export function useDrawingProcessing(projectId: string | undefined) {
  const { data: classifications = [], isLoading, error } = useProjectClassifications(projectId)
  const classify = useClassifyDrawing()
  const diff = useRevisionDiff()

  const byDrawing = useCallback(
    (drawingId: string) =>
      classifications.find(
        (c) => c.drawing_id === drawingId && c.processing_status === 'completed',
      ) ?? null,
    [classifications],
  )

  const statusByDrawing = useCallback(
    (drawingId: string) => {
      const latest = classifications.find((c) => c.drawing_id === drawingId)
      return latest?.processing_status ?? null
    },
    [classifications],
  )

  return {
    classifications,
    isLoading,
    error,
    byDrawing,
    statusByDrawing,
    classify,
    diff,
  }
}
