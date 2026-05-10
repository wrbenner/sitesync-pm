// ─────────────────────────────────────────────────────────────────────────────
// iris-score — emit a Langfuse score against a draft's originating trace
// ─────────────────────────────────────────────────────────────────────────────
//
// When the user accepts / rejects / rewords an Iris draft, the browser POSTs
// here. We:
//
//   1. Authenticate the caller (Bearer JWT → GoTrue).
//   2. Look up the drafted_actions row (RLS-scoped via the user's client),
//      which transitively asserts project membership.
//   3. Read drafted_actions.iris_audit_id (the trace id we wrote at draft
//      creation time).
//   4. Call recordIrisScore via the server-side LANGFUSE_SECRET_KEY (which
//      MUST stay out of the browser bundle — that's the whole reason this
//      edge fn exists).
//
// The response is best-effort: a Langfuse outage is a logged warning, not
// a user-visible failure. The accept/reject mutation in the browser
// already succeeded before we got here.
//
// POST /functions/v1/iris-score
// Authorization: Bearer <jwt>
// Content-Type: application/json
//
// { drafted_action_id: uuid, kind: 'accept'|'reject'|'reword'|'rating', value: number, comment?: string }
//
// Returns: { ok: true } on success
//          { ok: false, reason: 'no_trace_id'|'not_found'|'forbidden' } on
//          recoverable misses (still 200, the caller doesn't need to retry)
//          400/401/500 on real errors

import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  HttpError,
  errorResponse,
  isValidUuid,
} from '../shared/auth.ts'
import { recordIrisScore } from '../shared/langfuse.ts'

interface ScoreRequest {
  drafted_action_id: string
  kind: 'accept' | 'reject' | 'reword' | 'rating'
  value: number
  comment?: string
}

const ALLOWED_KINDS: Array<ScoreRequest['kind']> = ['accept', 'reject', 'reword', 'rating']

Deno.serve(async (req) => {
  const corsCheck = handleCors(req)
  if (corsCheck) return corsCheck

  try {
    const auth = await authenticateRequest(req)
    const body = await parseJsonBody<ScoreRequest>(req)

    if (!body.drafted_action_id || !isValidUuid(body.drafted_action_id)) {
      throw new HttpError(400, 'drafted_action_id is required and must be a valid UUID')
    }
    if (!ALLOWED_KINDS.includes(body.kind)) {
      throw new HttpError(400, `kind must be one of ${ALLOWED_KINDS.join(', ')}`)
    }
    if (typeof body.value !== 'number' || !Number.isFinite(body.value)) {
      throw new HttpError(400, 'value must be a finite number')
    }

    // RLS-scoped lookup. If the caller can't see the row, the query
    // returns null which we treat as "forbidden" (vs server error). The
    // user can't score a draft they don't have access to.
    const { data: row, error } = await auth.supabase
      .from('drafted_actions')
      .select('iris_audit_id')
      .eq('id', body.drafted_action_id)
      .maybeSingle()

    if (error) throw new HttpError(500, `lookup failed: ${error.message}`)

    if (!row) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'forbidden' }),
        {
          status: 200,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        },
      )
    }

    const traceId = (row as { iris_audit_id: string | null }).iris_audit_id
    if (!traceId) {
      // The draft predates trace correlation (or was produced by a path
      // that doesn't populate iris_audit_id). Not an error — just
      // nothing to score against.
      return new Response(
        JSON.stringify({ ok: false, reason: 'no_trace_id' }),
        {
          status: 200,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        },
      )
    }

    // Best-effort score write. Failures are logged but never bubble up
    // (the user-facing accept/reject already happened).
    try {
      await recordIrisScore({
        traceId,
        name: body.kind,
        value: body.value,
        comment: body.comment,
      })
    } catch (err) {
      console.warn('[iris-score] Langfuse score write failed (non-fatal):', err)
    }

    return new Response(
      JSON.stringify({ ok: true }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      },
    )
  } catch (err) {
    return errorResponse(err, getCorsHeaders(req))
  }
})
