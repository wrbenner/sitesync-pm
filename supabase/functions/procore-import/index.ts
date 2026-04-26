// procore-import: One-shot import of a Procore project into SiteSync.
//
// Sales-cycle unblocker. The customer pastes their Procore credentials +
// project IDs in the SiteSync UI and we pull RFIs, submittals, change
// orders, and drawing metadata into a target SiteSync project.
//
// This is INTENTIONALLY a one-shot import, not bidirectional sync.
// Customers who want ongoing sync will graduate to the integrations
// flow (src/services/integrations/procore.ts) once we certify with
// Procore's marketplace. The import tool exists to convert "kicking
// the tires" into "running on real data" within an hour.
//
// Auth: Supabase JWT required. Caller must be a member of the target
// project with at least project_engineer role.

import {
  authenticateRequest,
  errorResponse,
  HttpError,
  verifyProjectMembership,
  requireMinimumRole,
  parseJsonBody,
  requireUuid,
} from '../shared/auth.ts'

// ── Types ───────────────────────────────────────────────────

interface ImportRequest {
  target_project_id: string
  procore: {
    api_key: string
    company_id: string
    procore_project_id: number | string
  }
  scopes?: ('rfis' | 'submittals' | 'change_orders' | 'drawings')[]
}

interface ImportResult {
  ok: boolean
  imported: {
    rfis: number
    submittals: number
    change_orders: number
    drawings: number
  }
  errors: Array<{ scope: string; error: string }>
}

interface ProcoreRFI {
  id: number
  number: number
  subject?: string
  status?: string
  priority?: string
  due_date?: string | null
  created_at?: string
  description?: string
}

interface ProcoreSubmittal {
  id: number
  number: number
  title?: string
  status?: { name?: string } | string
  spec_section?: string | null
  due_date?: string | null
  created_at?: string
  type?: string
}

interface ProcoreChangeOrder {
  id: number
  number?: number
  title?: string
  description?: string | null
  status?: string
  total_amount?: number | string | null
  created_at?: string
}

interface ProcoreDrawing {
  id: number
  drawing_number?: string
  title?: string
  discipline?: string | null
  current_revision?: string | null
  status?: string
}

// ── Procore API helper ──────────────────────────────────────

const PROCORE_BASE = 'https://api.procore.com/rest/v1.0'

async function procoreFetch<T = unknown>(
  apiKey: string,
  companyId: string,
  path: string,
): Promise<T> {
  const res = await fetch(`${PROCORE_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Procore-Company-Id': companyId,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new HttpError(
      res.status === 401 ? 401 : res.status === 403 ? 403 : 502,
      `Procore API ${path}: ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ''}`,
      'procore_api_error',
    )
  }
  return (await res.json()) as T
}

// ── Status mapping ──────────────────────────────────────────

function mapProcoreRFIStatus(s: string | undefined): string {
  switch ((s ?? '').toLowerCase()) {
    case 'draft': return 'draft'
    case 'open': return 'open'
    case 'pending': return 'in_review'
    case 'closed': return 'closed'
    case 'void': return 'rejected'
    default: return 'open'
  }
}

function mapProcoreSubmittalStatus(s: string | undefined): string {
  switch ((s ?? '').toLowerCase()) {
    case 'draft': return 'draft'
    case 'pending submission': case 'pending_submission': return 'draft'
    case 'in review': case 'in_review': case 'under review': return 'in_review'
    case 'approved': return 'approved'
    case 'approved as noted': case 'approved_as_noted': return 'approved_as_noted'
    case 'revise & resubmit': case 'revise_and_resubmit': return 'revise_resubmit'
    case 'rejected': return 'rejected'
    default: return 'draft'
  }
}

function mapProcoreChangeOrderStatus(s: string | undefined): string {
  switch ((s ?? '').toLowerCase()) {
    case 'draft': return 'draft'
    case 'pending': case 'pending_review': return 'pending_review'
    case 'approved': case 'executed': return 'approved'
    case 'rejected': case 'voided': return 'rejected'
    default: return 'draft'
  }
}

// ── Handler ─────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    })
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { user, supabase: userClient } = await authenticateRequest(req)
    const body = await parseJsonBody<ImportRequest>(req)

    const targetProjectId = requireUuid(body.target_project_id, 'target_project_id')

    // The caller must be a project member with at least project_engineer role.
    // This is the same gate parse-ifc uses; keeps the rule consistent.
    const role = await verifyProjectMembership(userClient, user.id, targetProjectId)
    requireMinimumRole(role, 'project_engineer', 'import from Procore into this project')

    if (!body.procore?.api_key || !body.procore.company_id || body.procore.procore_project_id == null) {
      throw new HttpError(400, 'procore.{api_key, company_id, procore_project_id} are required')
    }

    const apiKey = body.procore.api_key
    const companyId = String(body.procore.company_id)
    const procoreProjectId = String(body.procore.procore_project_id)
    const scopes = new Set(body.scopes ?? ['rfis', 'submittals', 'change_orders', 'drawings'])

    const result: ImportResult = {
      ok: true,
      imported: { rfis: 0, submittals: 0, change_orders: 0, drawings: 0 },
      errors: [],
    }

    // ── 1. RFIs ────────────────────────────────────────────
    if (scopes.has('rfis')) {
      try {
        const rfis = await procoreFetch<ProcoreRFI[]>(
          apiKey,
          companyId,
          `/projects/${procoreProjectId}/rfis`,
        )
        const rows = rfis.map((r) => ({
          project_id: targetProjectId,
          number: r.number,
          title: (r.subject ?? '').slice(0, 500) || `Procore RFI #${r.number}`,
          description: r.description ?? null,
          status: mapProcoreRFIStatus(r.status),
          priority: (r.priority ?? 'medium').toLowerCase(),
          due_date: r.due_date ?? null,
          metadata: { source: 'procore', source_id: r.id },
        }))
        if (rows.length > 0) {
          // upsert on (project_id, number) — assumes a unique constraint exists.
          // If not, this still inserts; duplicates can be addressed in a follow-up.
          const { error } = await userClient
            .from('rfis')
            .upsert(rows, { onConflict: 'project_id,number' })
          if (error) result.errors.push({ scope: 'rfis', error: error.message })
          else result.imported.rfis = rows.length
        }
      } catch (e) {
        result.errors.push({ scope: 'rfis', error: e instanceof Error ? e.message : String(e) })
      }
    }

    // ── 2. Submittals ──────────────────────────────────────
    if (scopes.has('submittals')) {
      try {
        const submittals = await procoreFetch<ProcoreSubmittal[]>(
          apiKey,
          companyId,
          `/projects/${procoreProjectId}/submittals`,
        )
        const rows = submittals.map((s) => {
          const statusName = typeof s.status === 'string' ? s.status : s.status?.name
          return {
            project_id: targetProjectId,
            number: s.number,
            title: (s.title ?? '').slice(0, 500) || `Procore Submittal #${s.number}`,
            spec_section: s.spec_section ?? null,
            type: (s.type ?? 'product_data').toLowerCase().replace(/\s+/g, '_'),
            status: mapProcoreSubmittalStatus(statusName),
            due_date: s.due_date ?? null,
            metadata: { source: 'procore', source_id: s.id },
          }
        })
        if (rows.length > 0) {
          const { error } = await userClient
            .from('submittals')
            .upsert(rows, { onConflict: 'project_id,number' })
          if (error) result.errors.push({ scope: 'submittals', error: error.message })
          else result.imported.submittals = rows.length
        }
      } catch (e) {
        result.errors.push({ scope: 'submittals', error: e instanceof Error ? e.message : String(e) })
      }
    }

    // ── 3. Change orders ───────────────────────────────────
    if (scopes.has('change_orders')) {
      try {
        // Procore exposes "change_events" + "change_order_packages"; we pull
        // change_orders directly which is the closest parallel to our table.
        const cos = await procoreFetch<ProcoreChangeOrder[]>(
          apiKey,
          companyId,
          `/projects/${procoreProjectId}/change_orders`,
        ).catch(() => [] as ProcoreChangeOrder[])
        const rows = cos.map((c, idx) => ({
          project_id: targetProjectId,
          number: c.number ?? idx + 1,
          title: (c.title ?? '').slice(0, 500) || `Procore CO #${c.number ?? idx + 1}`,
          description: c.description ?? null,
          amount: typeof c.total_amount === 'string'
            ? Math.round(Number(c.total_amount.replace(/[^0-9.-]/g, '')) * 100)
            : c.total_amount != null
              ? Math.round(Number(c.total_amount) * 100)
              : 0,
          status: mapProcoreChangeOrderStatus(c.status),
          type: 'co' as const,
          reason: 'imported_from_procore' as const,
          metadata: { source: 'procore', source_id: c.id },
        }))
        if (rows.length > 0) {
          const { error } = await userClient
            .from('change_orders')
            .upsert(rows, { onConflict: 'project_id,number' })
          if (error) result.errors.push({ scope: 'change_orders', error: error.message })
          else result.imported.change_orders = rows.length
        }
      } catch (e) {
        result.errors.push({ scope: 'change_orders', error: e instanceof Error ? e.message : String(e) })
      }
    }

    // ── 4. Drawings (metadata only) ────────────────────────
    if (scopes.has('drawings')) {
      try {
        const drawings = await procoreFetch<ProcoreDrawing[]>(
          apiKey,
          companyId,
          `/projects/${procoreProjectId}/drawings`,
        ).catch(() => [] as ProcoreDrawing[])
        const rows = drawings.map((d) => ({
          project_id: targetProjectId,
          sheet_number: (d.drawing_number ?? '').slice(0, 64) || `PR-${d.id}`,
          title: (d.title ?? '').slice(0, 500) || `Procore drawing #${d.id}`,
          discipline: d.discipline ?? null,
          revision: d.current_revision ?? '0',
          status: 'current' as const,
          metadata: { source: 'procore', source_id: d.id },
        }))
        if (rows.length > 0) {
          const { error } = await userClient
            .from('drawings')
            .upsert(rows, { onConflict: 'project_id,sheet_number' })
          if (error) result.errors.push({ scope: 'drawings', error: error.message })
          else result.imported.drawings = rows.length
        }
      } catch (e) {
        result.errors.push({ scope: 'drawings', error: e instanceof Error ? e.message : String(e) })
      }
    }

    result.ok = result.errors.length === 0

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (e) {
    return errorResponse(e, { 'Access-Control-Allow-Origin': '*' })
  }
})
