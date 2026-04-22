import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { DrawingPair, DrawingDiscrepancy } from '../types/ai'

// ── Pipeline Stages ─────────────────────────────────────────
export type AnalysisStage =
  | 'idle'
  | 'classifying'
  | 'pairing'
  | 'detecting_edges'
  | 'generating_overlap'
  | 'analyzing_discrepancies'
  | 'complete'
  | 'failed'

export interface PipelineState {
  stage: AnalysisStage
  totalPairs: number
  processedPairs: number
  discrepancyCount: number
  autoRfiCount: number
  error: string | null
}

const EMPTY_STATE: PipelineState = {
  stage: 'idle',
  totalPairs: 0,
  processedPairs: 0,
  discrepancyCount: 0,
  autoRfiCount: 0,
  error: null,
}

const pairsKey = (projectId: string) => ['drawing_pairs', projectId] as const
const discrepanciesKey = (projectId: string) => ['drawing_discrepancies', projectId] as const
const drawingDiscrepanciesKey = (drawingId: string) =>
  ['drawing_discrepancies', 'drawing', drawingId] as const

// ── Queries ─────────────────────────────────────────────────
export function useProjectDrawingPairs(projectId: string | undefined) {
  return useQuery<DrawingPair[]>({
    queryKey: pairsKey(projectId ?? ''),
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drawing_pairs')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
      if (error) {
        // Table may not exist yet — degrade gracefully
        if (error.code === '42P01' || error.message?.includes('does not exist') || String((error as Record<string, unknown>).code) === 'PGRST204') return []
        throw error
      }
      return (data ?? []) as unknown as DrawingPair[]
    },
  })
}

export function useProjectDiscrepancies(projectId: string | undefined) {
  return useQuery<DrawingDiscrepancy[]>({
    queryKey: discrepanciesKey(projectId ?? ''),
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drawing_discrepancies')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist') || String((error as Record<string, unknown>).code) === 'PGRST204') return []
        throw error
      }
      return (data ?? []) as unknown as DrawingDiscrepancy[]
    },
  })
}

export function useDiscrepanciesForDrawing(
  drawingId: string | undefined,
  projectId: string | undefined,
) {
  return useQuery<DrawingDiscrepancy[]>({
    queryKey: drawingDiscrepanciesKey(drawingId ?? ''),
    enabled: !!drawingId && !!projectId,
    retry: false,
    queryFn: async () => {
      const { data: pairs, error: pairErr } = await supabase
        .from('drawing_pairs')
        .select('id')
        .or(`arch_drawing_id.eq.${drawingId!},struct_drawing_id.eq.${drawingId!}`)
        .eq('project_id', projectId!)
      if (pairErr) {
        // Table/columns may not exist yet — return empty
        console.warn('[useDiscrepanciesForDrawing] drawing_pairs query failed:', pairErr.message)
        return []
      }
      const pairIds = (pairs ?? []).map((p: { id: string }) => p.id)
      if (pairIds.length === 0) return []
      const { data, error } = await supabase
        .from('drawing_discrepancies')
        .select('*')
        .in('pair_id', pairIds)
        .order('severity', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as DrawingDiscrepancy[]
    },
  })
}

// ── Edge function wrappers ──────────────────────────────────
async function invokeExtractPairs(projectId: string) {
  const { data, error } = await supabase.functions.invoke('extract-drawing-pairs', {
    body: { project_id: projectId },
  })
  if (error) throw new Error(error.message || 'extract-drawing-pairs failed')
  return data as { pairs: DrawingPair[]; inserted_count: number; candidate_count: number }
}

async function invokeDetectEdges(pairId: string, archUrl: string, structUrl: string) {
  const { data, error } = await supabase.functions.invoke('detect-edges', {
    body: { pair_id: pairId, arch_image_url: archUrl, struct_image_url: structUrl },
  })
  if (error) throw new Error(error.message || 'detect-edges failed')
  return data
}

async function invokeGenerateOverlap(pairId: string, archUrl: string, structUrl: string) {
  const { data, error } = await supabase.functions.invoke('generate-overlap', {
    body: { pair_id: pairId, arch_image_url: archUrl, struct_image_url: structUrl },
  })
  if (error) throw new Error(error.message || 'generate-overlap failed')
  return data
}

async function invokeAnalyzeDiscrepancies(pairId: string, archUrl: string, structUrl: string) {
  const { data, error } = await supabase.functions.invoke('analyze-discrepancies', {
    body: { pair_id: pairId, arch_image_url: archUrl, struct_image_url: structUrl },
  })
  if (error) throw new Error(error.message || 'analyze-discrepancies failed')
  return data as {
    pair_id: string
    discrepancy_count: number
    high_severity_count: number
    auto_rfi_count: number
  }
}

async function getDrawingFileUrls(pairId: string, supabaseClient = supabase) {
  const { data, error } = await supabaseClient
    .from('drawing_pairs')
    .select(
      'id, arch_drawing_id, struct_drawing_id, arch:arch_drawing_id(file_url), struct:struct_drawing_id(file_url)',
    )
    .eq('id', pairId)
    .single()
  if (error) throw error
  type DrawingRef = { file_url: string | null } | { file_url: string | null }[] | null
  const archRef = data?.arch as DrawingRef
  const structRef = data?.struct as DrawingRef
  const archRow = Array.isArray(archRef) ? archRef[0] : archRef
  const structRow = Array.isArray(structRef) ? structRef[0] : structRef
  return {
    archUrl: archRow?.file_url ?? null,
    structUrl: structRow?.file_url ?? null,
  }
}

// ── Discrepancy actions ─────────────────────────────────────
export function useConfirmDiscrepancy() {
  const qc = useQueryClient()
  return useMutation<DrawingDiscrepancy, Error, { id: string; projectId: string; drawingId?: string }>({
    mutationFn: async ({ id }) => {
      const { data, error } = await supabase
        .from('drawing_discrepancies')
        .update({ user_confirmed: true, is_false_positive: false })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return data as unknown as DrawingDiscrepancy
    },
    onSuccess: (_res, variables) => {
      qc.invalidateQueries({ queryKey: discrepanciesKey(variables.projectId) })
      if (variables.drawingId) {
        qc.invalidateQueries({ queryKey: drawingDiscrepanciesKey(variables.drawingId) })
      }
    },
  })
}

export function useDismissDiscrepancy() {
  const qc = useQueryClient()
  return useMutation<DrawingDiscrepancy, Error, { id: string; projectId: string; drawingId?: string }>({
    mutationFn: async ({ id }) => {
      const { data, error } = await supabase
        .from('drawing_discrepancies')
        .update({ is_false_positive: true, user_confirmed: false })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return data as unknown as DrawingDiscrepancy
    },
    onSuccess: (_res, variables) => {
      qc.invalidateQueries({ queryKey: discrepanciesKey(variables.projectId) })
      if (variables.drawingId) {
        qc.invalidateQueries({ queryKey: drawingDiscrepanciesKey(variables.drawingId) })
      }
    },
  })
}

// ── Orchestrator ────────────────────────────────────────────
export function useDrawingIntelligence(projectId: string | undefined) {
  const qc = useQueryClient()
  const [state, setState] = useState<PipelineState>(EMPTY_STATE)
  const pairsQuery = useProjectDrawingPairs(projectId)
  const discrepancyQuery = useProjectDiscrepancies(projectId)

  const analyzeDrawingSet = useCallback(async () => {
    if (!projectId) {
      setState((s) => ({ ...s, stage: 'failed', error: 'No project selected' }))
      return
    }
    setState({ ...EMPTY_STATE, stage: 'pairing' })

    let totalDiscrepancies = 0
    let totalAutoRfis = 0

    try {
      // 1. Extract pairs from classifications.
      const pairResult = await invokeExtractPairs(projectId)
      const pairs = pairResult.pairs ?? []
      setState((s) => ({
        ...s,
        stage: pairs.length > 0 ? 'detecting_edges' : 'complete',
        totalPairs: pairs.length,
      }))

      // 2. For each pair: edges → overlap → discrepancies.
      for (const p of pairs) {
        const { archUrl, structUrl } = await getDrawingFileUrls(p.id)
        if (!archUrl || !structUrl) {
          setState((s) => ({ ...s, processedPairs: s.processedPairs + 1 }))
          continue
        }

        setState((s) => ({ ...s, stage: 'detecting_edges' }))
        try {
          await invokeDetectEdges(p.id, archUrl, structUrl)
        } catch {
          // Edge detection failure should not halt the pipeline
        }

        setState((s) => ({ ...s, stage: 'generating_overlap' }))
        try {
          await invokeGenerateOverlap(p.id, archUrl, structUrl)
        } catch {
          /* overlap is non-critical */
        }

        setState((s) => ({ ...s, stage: 'analyzing_discrepancies' }))
        try {
          const analysis = await invokeAnalyzeDiscrepancies(p.id, archUrl, structUrl)
          totalDiscrepancies += analysis.discrepancy_count ?? 0
          totalAutoRfis += analysis.auto_rfi_count ?? 0
        } catch {
          /* discrepancy analysis failure per-pair should not kill the run */
        }

        setState((s) => ({
          ...s,
          processedPairs: s.processedPairs + 1,
          discrepancyCount: totalDiscrepancies,
          autoRfiCount: totalAutoRfis,
        }))
      }

      setState((s) => ({
        ...s,
        stage: 'complete',
        discrepancyCount: totalDiscrepancies,
        autoRfiCount: totalAutoRfis,
      }))

      qc.invalidateQueries({ queryKey: pairsKey(projectId) })
      qc.invalidateQueries({ queryKey: discrepanciesKey(projectId) })
    } catch (err) {
      setState((s) => ({
        ...s,
        stage: 'failed',
        error: (err as Error).message ?? 'Analysis failed',
      }))
    }
  }, [projectId, qc])

  const reset = useCallback(() => setState(EMPTY_STATE), [])

  return {
    state,
    pairs: pairsQuery.data ?? [],
    discrepancies: discrepancyQuery.data ?? [],
    isLoading: pairsQuery.isLoading || discrepancyQuery.isLoading,
    analyzeDrawingSet,
    reset,
  }
}
