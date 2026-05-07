// ── useRFIDrawingPins ───────────────────────────────────────────────────
// Pin coords (x, y normalized 0-1) per RFI on a drawing sheet.
//
// Two query angles:
//   • by RFI: list pins on this RFI (Detail / Edit panel)
//   • by drawing: list pins on this sheet (drawing viewer overlay)

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fromTable } from '../../lib/db/queries'
import { supabase } from '../../lib/supabase'
import { logAuditEntry } from '../../lib/auditLogger'

const from = (table: string) => fromTable(table as never)

export interface RFIDrawingPin {
  id: string
  rfi_id: string
  drawing_id: string
  x: number
  y: number
  page: number
  note: string | null
  created_by: string | null
  created_at: string
}

const QK_RFI = (rfiId: string | undefined) => ['rfi_drawing_pins', 'rfi', rfiId ?? '__none__']
const QK_DRAWING = (drawingId: string | undefined) => ['rfi_drawing_pins', 'drawing', drawingId ?? '__none__']

export function useRFIPinsByRFI(rfiId: string | undefined) {
  return useQuery({
    queryKey: QK_RFI(rfiId),
    enabled: !!rfiId,
    queryFn: async (): Promise<RFIDrawingPin[]> => {
      if (!rfiId) return []
      const { data } = await from('rfi_drawing_pins')
        .select('*')
        .eq('rfi_id' as never, rfiId)
        .order('created_at' as never, { ascending: true })
      return (data ?? []) as unknown as RFIDrawingPin[]
    },
  })
}

export function useRFIPinsByDrawing(drawingId: string | undefined) {
  return useQuery({
    queryKey: QK_DRAWING(drawingId),
    enabled: !!drawingId,
    queryFn: async (): Promise<RFIDrawingPin[]> => {
      if (!drawingId) return []
      const { data } = await from('rfi_drawing_pins')
        .select('*')
        .eq('drawing_id' as never, drawingId)
        .order('created_at' as never, { ascending: true })
      return (data ?? []) as unknown as RFIDrawingPin[]
    },
  })
}

export function useAddRFIDrawingPin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      rfiId: string
      projectId: string
      drawingId: string
      x: number
      y: number
      page?: number
      note?: string | null
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await from('rfi_drawing_pins').insert({
        rfi_id: params.rfiId,
        drawing_id: params.drawingId,
        x: params.x,
        y: params.y,
        page: params.page ?? 1,
        note: params.note ?? null,
        created_by: user?.id ?? null,
      } as never).select('id').single()
      if (error) throw error
      await logAuditEntry({
        projectId: params.projectId,
        entityType: 'rfi',
        entityId: params.rfiId,
        action: 'update',
        afterState: { pin_added: { drawing_id: params.drawingId, x: params.x, y: params.y } },
        metadata: { kind: 'rfi_pin_add' },
      })
      return { id: (data as { id: string }).id }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QK_RFI(vars.rfiId) })
      qc.invalidateQueries({ queryKey: QK_DRAWING(vars.drawingId) })
    },
  })
}

export function useRemoveRFIDrawingPin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; rfiId: string; projectId: string; drawingId: string }) => {
      const { error } = await from('rfi_drawing_pins').delete().eq('id' as never, params.id)
      if (error) throw error
      await logAuditEntry({
        projectId: params.projectId,
        entityType: 'rfi',
        entityId: params.rfiId,
        action: 'update',
        beforeState: { pin_removed: params.id },
        metadata: { kind: 'rfi_pin_remove' },
      })
      return params
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QK_RFI(vars.rfiId) })
      qc.invalidateQueries({ queryKey: QK_DRAWING(vars.drawingId) })
    },
  })
}
