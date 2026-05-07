// Phase 8 — Submittal Stamp PDF service.
//
// The actual PDF generator lives in the `submittal-stamp-pdf` edge function
// (Phase 8b — Deno + jsPDF + the org's license seal asset). Phase 8 ships
// the client-side service that:
//   1. Calls the edge fn with reviewer_id + disposition + comments
//   2. Edge fn generates PDF, uploads to storage, returns the URL
//   3. Service calls `submittal_record_stamp_url` RPC to persist
//
// Until the edge fn lands, the service surfaces a graceful "coming soon"
// error so the UI can render a "Generate Stamp" button that disabled with
// a tooltip explaining the dependency.

import { supabase } from '../lib/supabase'
import { type Result, ok, fail, dbError } from './errors'

export interface StampPdfInput {
  reviewer_id: string
  disposition: string
  comments?: string | null
  /** When true, includes the AIA §4.2.7 disclaimer + license seal asset on
   *  the generated PDF. Federal projects (UFGS) use a different disclaimer. */
  codeset?: 'ejcdc' | 'aia' | 'ufgs' | 'custom'
}

export interface StampPdfResult {
  pdf_url: string
  reviewer_id: string
}

export const submittalStampService = {
  async generate(input: StampPdfInput): Promise<Result<StampPdfResult>> {
    // Phase 8 surfaces the edge fn signature; the edge fn implementation
    // lands in Phase 8b alongside the org's license-seal asset upload UX.
    const { data, error } = await supabase.functions.invoke('submittal-stamp-pdf' as never, {
      body: {
        reviewer_id: input.reviewer_id,
        disposition: input.disposition,
        comments: input.comments ?? null,
        codeset: input.codeset ?? 'ejcdc',
      },
    } as never)

    if (error) {
      // Graceful: when the edge fn isn't deployed yet, the UI gets a
      // structured "coming soon" error instead of a crash.
      if (/not found|404|function-not-found/i.test(error.message ?? '')) {
        return fail({
          category: 'NotFoundError',
          code: 'STAMP_FN_NOT_DEPLOYED',
          message: 'The stamp PDF edge function is not deployed yet (Phase 8b).',
          userMessage: 'Stamp PDF generation will be available in Phase 8b.',
        })
      }
      return fail(dbError(error.message, { input }))
    }

    const result = data as unknown as StampPdfResult
    if (!result?.pdf_url) {
      return fail(dbError('Stamp PDF function returned no URL', { input }))
    }

    // Persist on the reviewer row.
    const { error: updateErr } = await supabase.rpc('submittal_record_stamp_url' as never, {
      p_reviewer_id: input.reviewer_id,
      p_stamp_url: result.pdf_url,
    } as never)
    if (updateErr) {
      return fail(dbError(updateErr.message, { stage: 'persist' }))
    }

    return ok(result)
  },
}
