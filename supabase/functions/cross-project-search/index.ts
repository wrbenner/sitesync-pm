// cross-project-search: full-text search across the org-wide
// org_search_index, RLS-filtered server-side via search_org() SQL fn.
//
// CRITICAL: We pass auth.uid() to the SQL helper which JOINs on
// project_members, so projects the user isn't a member of never
// surface. We never return rows from inaccessible projects, even
// with hit-count obfuscation.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  errorResponse,
  HttpError,
  parseJsonBody,
  handleCors,
  getCorsHeaders,
} from '../shared/auth.ts'

interface SearchRequest {
  organization_id: string
  q: string
  limit?: number
  /** Filter to specific entity types. Optional; default = all. */
  entity_types?: string[]
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  try {
    const auth = await authenticateRequest(req)
    const body = await parseJsonBody<SearchRequest>(req)
    if (!body.organization_id) throw new HttpError(400, 'organization_id required')
    if (!body.q || body.q.trim().length < 2) {
      throw new HttpError(400, 'query must be at least 2 chars')
    }
    const limit = Math.min(body.limit ?? 50, 200)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Confirm caller is in the org (cheap pre-filter; the SQL fn
    // also enforces project_members at row level).
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', body.organization_id)
      .eq('user_id', auth.userId)
      .maybeSingle()
    if (!member) {
      throw new HttpError(403, 'Not an organization member')
    }

    const { data, error } = await supabase.rpc('search_org', {
      p_organization_id: body.organization_id,
      p_user_id: auth.userId,
      p_query: body.q,
      p_limit: limit,
    })
    if (error) {
      throw new HttpError(500, 'Search failed: ' + error.message)
    }

    let rows = data as Array<{ entity_type: string; entity_id: string; project_id: string; title: string; body: string; rank: number }>
    if (body.entity_types && body.entity_types.length > 0) {
      const types = new Set(body.entity_types)
      rows = rows.filter((r) => types.has(r.entity_type))
    }

    return new Response(JSON.stringify({ results: rows, count: rows.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
    })
  } catch (e) {
    return errorResponse(e, getCorsHeaders(req))
  }
})
