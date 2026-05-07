// Phase 8 — Submittal markup service.
//
// Backed by `submittal_create_markup` + `submittal_delete_markup` RPCs in
// 20260511000000_submittal_phase8_markup_distribute_stamp.sql (project-
// member-gated, kind-validated, hash-chain-ready). Reads go through
// fromTable('submittal_markup') directly — RLS gates SELECT.

import { supabase } from '../lib/supabase'
import { fromTable } from '../lib/db/queries'
import { type Result, ok, fail, dbError } from './errors'

export type MarkupKind = 'highlight' | 'callout' | 'redline' | 'stamp' | 'pen' | 'text'

export interface SubmittalMarkup {
  id: string
  submittal_item_id: string
  rev_number: number
  pdf_page: number
  /** Per-kind shape: pen → { points: [[x,y], ...] }, callout/highlight/redline →
   *  { rect: [x, y, w, h] }, stamp → { rect, label, code }, text → { x, y, body }.
   *  Coordinates are PDF-space (origin top-left, units = pdf user units). */
  geometry: Record<string, unknown>
  kind: MarkupKind
  comment_md: string | null
  created_by: string | null
  created_at: string
}

export interface CreateMarkupInput {
  submittal_item_id: string
  rev_number: number
  pdf_page: number
  geometry: Record<string, unknown>
  kind: MarkupKind
  comment_md?: string | null
}

export const submittalMarkupService = {
  async list(submittalItemId: string, revNumber?: number): Promise<Result<SubmittalMarkup[]>> {
    let q = fromTable('submittal_markup' as never)
      .select('*')
      .eq('submittal_item_id' as never, submittalItemId)
      .order('created_at', { ascending: true })
    if (revNumber != null) {
      q = q.eq('rev_number' as never, revNumber)
    }
    const { data, error } = await q

    if (error) return fail(dbError(error.message, { submittalItemId }))
    return ok(((data as unknown) as SubmittalMarkup[]) ?? [])
  },

  async create(input: CreateMarkupInput): Promise<Result<string>> {
    const { data, error } = await supabase.rpc('submittal_create_markup' as never, {
      p_submittal_item_id: input.submittal_item_id,
      p_rev_number: input.rev_number,
      p_pdf_page: input.pdf_page,
      p_geometry: input.geometry,
      p_kind: input.kind,
      p_comment_md: input.comment_md ?? null,
    } as never)

    if (error) return fail(dbError(error.message, { input }))
    return ok((data as unknown as string) ?? '')
  },

  async remove(markupId: string): Promise<Result<void>> {
    const { error } = await supabase.rpc('submittal_delete_markup' as never, {
      p_markup_id: markupId,
    } as never)

    if (error) return fail(dbError(error.message, { markupId }))
    return ok(undefined)
  },
}
