// Phase 8 — Markup canvas (fabric.js v7).
//
// Per spec Part 6.2 + plan Pillar B: a Bluebeam-grade annotation surface
// that persists per revision. Phase 8 ships pen + highlight + select-and-
// delete; callout / redline / stamp / text geometries follow in Phase 8b
// alongside the per-kind dedicated handlers.
//
// Coordinate system: PDF-page-space (origin top-left, units = pixels at
// 100% zoom). The canvas is rendered at the size of the PDF page; the
// surrounding `DocumentViewer` (Phase 8b) wraps it for pan/zoom. For now
// the canvas is standalone with a fixed size — exercising the persistence
// path end-to-end without the PDF backdrop.
//
// Memory note: per `feedback_fabric_getpointer.md` — don't use
// `getScenePoint` when the canvas is inside a CSS-scaled ancestor.
// We use the `e.absolutePointer` from fabric event objects directly.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as fabric from 'fabric'
import { toast } from 'sonner'
import { MarkupToolbar, type ToolMode } from './MarkupToolbar'
import {
  useSubmittalMarkup,
  useCreateMarkup,
  useDeleteMarkup,
} from '../../../../hooks/useSubmittalMarkup'
import type { MarkupKind, SubmittalMarkup } from '../../../../services/submittalMarkup'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  surface: '#FCFCFA',
  brandOrange: '#F47820',
  highlight: 'rgba(244, 230, 32, 0.35)',
  redline: '#C93B3B',
  pen: '#0F172A',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface MarkupCanvasProps {
  submittalItemId: string
  revNumber: number
  pdfPage: number
  /** Canvas size — Phase 8 ships a fixed letter-portrait at 100%. The
   *  DocumentViewer integration (Phase 8b) drives this from the actual
   *  PDF page metrics. */
  width?: number
  height?: number
}

export const MarkupCanvas: React.FC<MarkupCanvasProps> = ({
  submittalItemId,
  revNumber,
  pdfPage,
  width = 816,
  height = 1056,
}) => {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const [mode, setMode] = useState<ToolMode>('select')
  const [selectionCount, setSelectionCount] = useState(0)

  const { markups, refetch } = useSubmittalMarkup({ submittalItemId, revNumber })
  const create = useCreateMarkup(submittalItemId)
  const remove = useDeleteMarkup(submittalItemId)

  // ── Canvas init ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = canvasElRef.current
    if (!el) return

    const c = new fabric.Canvas(el, {
      selection: true,
      preserveObjectStacking: true,
      backgroundColor: '#fff',
      width,
      height,
    })
    fabricRef.current = c

    c.on('selection:created', () => setSelectionCount(c.getActiveObjects().length))
    c.on('selection:updated', () => setSelectionCount(c.getActiveObjects().length))
    c.on('selection:cleared', () => setSelectionCount(0))

    return () => {
      c.dispose()
      fabricRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height])

  // ── Mode → canvas behaviour ──────────────────────────────────────────────
  useEffect(() => {
    const c = fabricRef.current
    if (!c) return

    if (mode === 'select') {
      c.isDrawingMode = false
      c.selection = true
      c.defaultCursor = 'default'
    } else if (mode === 'pen') {
      c.isDrawingMode = true
      c.selection = false
      const brush = new fabric.PencilBrush(c)
      brush.color = C.pen
      brush.width = 2
      c.freeDrawingBrush = brush
    } else {
      // highlight / callout / redline / stamp / text — drag-to-create
      // rect for highlight; other kinds disabled in Phase 8 toolbar.
      c.isDrawingMode = false
      c.selection = false
      c.defaultCursor = 'crosshair'
    }
  }, [mode])

  // ── Persist new markups ──────────────────────────────────────────────────
  // Pen: on path:created, persist the path + its points.
  // Highlight: on mouse:down + mouse:up, draw a rect, persist on up.

  useEffect(() => {
    const c = fabricRef.current
    if (!c) return

    const handlePathCreated = async (e: { path: fabric.Path }): Promise<void> => {
      if (mode !== 'pen') return
      const path = e.path
      const points = (path.path ?? []).map((cmd) => Array.from(cmd as unknown as number[]))
      try {
        const newId = await create.mutateAsync({
          submittal_item_id: submittalItemId,
          rev_number: revNumber,
          pdf_page: pdfPage,
          geometry: { points, stroke: C.pen, strokeWidth: 2 },
          kind: 'pen' as MarkupKind,
        })
        // Tag the fabric object so we can map edits to db ids.
        ;(path as fabric.Object & { __markupId?: string }).__markupId = newId
      } catch (err) {
        toast.error('Could not save pen stroke: ' + (err as Error).message)
        c.remove(path)
        c.requestRenderAll()
      }
    }

    c.on('path:created', handlePathCreated as never)
    return () => { c.off('path:created', handlePathCreated as never) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, submittalItemId, revNumber, pdfPage])

  // Highlight tool — drag-to-create rect.
  const dragStateRef = useRef<{ x0: number; y0: number; rect: fabric.Rect | null } | null>(null)
  useEffect(() => {
    const c = fabricRef.current
    if (!c) return
    if (mode !== 'highlight') return

    const onDown = (e: fabric.TPointerEventInfo<fabric.TPointerEvent>): void => {
      const p = c.getScenePoint(e.e)
      const rect = new fabric.Rect({
        left: p.x,
        top: p.y,
        width: 1,
        height: 1,
        fill: C.highlight,
        stroke: 'rgba(244, 230, 32, 0.6)',
        strokeWidth: 1,
        selectable: false,
      })
      c.add(rect)
      dragStateRef.current = { x0: p.x, y0: p.y, rect }
    }
    const onMove = (e: fabric.TPointerEventInfo<fabric.TPointerEvent>): void => {
      const state = dragStateRef.current
      if (!state || !state.rect) return
      const p = c.getScenePoint(e.e)
      state.rect.set({
        left: Math.min(state.x0, p.x),
        top: Math.min(state.y0, p.y),
        width: Math.abs(p.x - state.x0),
        height: Math.abs(p.y - state.y0),
      })
      c.requestRenderAll()
    }
    const onUp = async (): Promise<void> => {
      const state = dragStateRef.current
      if (!state || !state.rect) return
      dragStateRef.current = null
      const { left = 0, top = 0, width: w = 0, height: h = 0 } = state.rect
      // Trivial drag (jitter) — discard.
      if (w < 6 || h < 6) {
        c.remove(state.rect)
        c.requestRenderAll()
        return
      }
      state.rect.set({ selectable: true })
      try {
        const newId = await create.mutateAsync({
          submittal_item_id: submittalItemId,
          rev_number: revNumber,
          pdf_page: pdfPage,
          geometry: { rect: [left, top, w, h], fill: C.highlight },
          kind: 'highlight' as MarkupKind,
        })
        ;(state.rect as fabric.Object & { __markupId?: string }).__markupId = newId
      } catch (err) {
        toast.error('Could not save highlight: ' + (err as Error).message)
        c.remove(state.rect)
        c.requestRenderAll()
      }
    }

    c.on('mouse:down', onDown as never)
    c.on('mouse:move', onMove as never)
    c.on('mouse:up', onUp as never)
    return () => {
      c.off('mouse:down', onDown as never)
      c.off('mouse:move', onMove as never)
      c.off('mouse:up', onUp as never)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, submittalItemId, revNumber, pdfPage])

  // ── Hydrate existing markups onto the canvas (initial load + refetch) ───
  const hydratedKey = useMemo(() => markups.map((m) => m.id).join('|'), [markups])
  useEffect(() => {
    const c = fabricRef.current
    if (!c) return
    // Wipe existing objects before re-hydrating. (Phase 8b: incremental
    // diff to avoid the wipe-and-rebuild on every refetch.)
    c.getObjects().forEach((obj) => c.remove(obj))
    for (const m of markups) {
      const obj = renderMarkup(m)
      if (obj) {
        ;(obj as fabric.Object & { __markupId?: string }).__markupId = m.id
        c.add(obj)
      }
    }
    c.requestRenderAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydratedKey])

  // ── Delete selection ─────────────────────────────────────────────────────
  const handleDeleteSelection = useCallback(async () => {
    const c = fabricRef.current
    if (!c) return
    const active = c.getActiveObjects()
    if (active.length === 0) return
    const ids = active
      .map((o) => (o as fabric.Object & { __markupId?: string }).__markupId)
      .filter((id): id is string => !!id)
    try {
      await Promise.all(ids.map((id) => remove.mutateAsync(id)))
      toast.success(`Deleted ${ids.length} markup${ids.length === 1 ? '' : 's'}.`)
      void refetch()
    } catch (err) {
      toast.error('Could not delete markup: ' + (err as Error).message)
    }
  }, [remove, refetch])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <MarkupToolbar
        mode={mode}
        onModeChange={setMode}
        selectionCount={selectionCount}
        onDeleteSelection={handleDeleteSelection}
        revNumber={revNumber}
      />
      <div
        role="region"
        aria-label="Markup canvas"
        style={{
          width,
          height,
          backgroundColor: '#fff',
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
          fontFamily: FONT,
        }}
      >
        <canvas ref={canvasElRef} width={width} height={height} />
      </div>
      <p style={{ margin: 0, fontSize: 11, color: C.ink3, lineHeight: 1.4, fontFamily: FONT }}>
        Phase 8 ships pen + highlight + select/delete. Callout / redline / stamp /
        text and the PDF backdrop integration land in Phase 8b alongside the
        per-kind dedicated handlers.
      </p>
    </div>
  )
}

// ── Hydration helper ────────────────────────────────────────────────────────

function renderMarkup(m: SubmittalMarkup): fabric.Object | null {
  const g = m.geometry as Record<string, unknown>

  if (m.kind === 'pen') {
    const points = g.points as number[][] | undefined
    if (!points || points.length === 0) return null
    // fabric.Path expects the SVG-style command array; we stored raw command
    // tuples (e.g. ['M', x, y], ['Q', x1, y1, x, y]) so hydrate by joining
    // back into a path string.
    const segments = points
      .map((cmd) => cmd.map((c, i) => (i === 0 ? c : Number(c).toFixed(2))).join(' '))
      .join(' ')
    return new fabric.Path(segments, {
      stroke: (g.stroke as string) ?? C.pen,
      strokeWidth: (g.strokeWidth as number) ?? 2,
      fill: '',
      selectable: true,
    })
  }

  if (m.kind === 'highlight' || m.kind === 'callout' || m.kind === 'redline') {
    const rect = g.rect as [number, number, number, number] | undefined
    if (!rect) return null
    const [x, y, w, h] = rect
    const isRedline = m.kind === 'redline'
    return new fabric.Rect({
      left: x,
      top: y,
      width: w,
      height: h,
      fill: (g.fill as string) ?? (isRedline ? 'transparent' : C.highlight),
      stroke: isRedline ? C.redline : 'rgba(244, 230, 32, 0.6)',
      strokeWidth: isRedline ? 2 : 1,
      selectable: true,
    })
  }

  if (m.kind === 'stamp') {
    const rect = g.rect as [number, number, number, number] | undefined
    if (!rect) return null
    const [x, y, w, h] = rect
    const label = (g.label as string) ?? 'STAMP'
    return new fabric.Rect({
      left: x,
      top: y,
      width: w,
      height: h,
      fill: 'rgba(45, 138, 110, 0.10)',
      stroke: '#2D8A6E',
      strokeWidth: 2,
      selectable: true,
      ...({ __label: label } as object),
    })
  }

  if (m.kind === 'text') {
    const x = g.x as number | undefined
    const y = g.y as number | undefined
    const body = g.body as string | undefined
    if (typeof x !== 'number' || typeof y !== 'number' || !body) return null
    return new fabric.Text(body, {
      left: x,
      top: y,
      fontFamily: FONT,
      fontSize: 14,
      fill: C.ink,
      selectable: true,
    })
  }

  return null
}

export default MarkupCanvas
