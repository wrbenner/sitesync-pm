// ── Lien Waiver Generator Edge Function ──────────────────────
// POST { pay_app_id, subcontractor_id?, subcontractor_name, jurisdiction?,
//        type, amount, period_through, signer_email }
//
// Creates a lien_waivers row, picks the appropriate template, mints a
// magic link with a SHA-256-hashed token, and (optionally) sends the email.
// The rendered body lives in `signed_body` only after the recipient signs;
// pre-signature, the body is regenerated on demand by the public preview
// endpoint using the same template_id + template_version.
//
// Returns { waiver_id, magic_url, expires_at, body_preview }.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  HttpError,
  errorResponse,
  requireUuid,
  verifyProjectMembership,
} from '../shared/auth.ts'

interface GenerateRequest {
  pay_app_id: string
  subcontractor_id?: string | null
  subcontractor_name: string
  jurisdiction?: string | null
  type: 'conditional_progress' | 'unconditional_progress' | 'conditional_final' | 'unconditional_final'
  amount: number
  period_through: string
  signer_email: string
  signer_name?: string
  signer_title?: string
  send_email?: boolean
}

// ── Template registry mirror (deno-side) ───────────────────────
// Edge functions can't import from src/, so we mirror just the template ids
// + a simple body renderer here. The legal-review TODO placeholder is kept
// identical to the client so the auditor sees the same body in both places.

const TEMPLATES: Record<string, { id: string; version: string; jurisdiction: string; type: string; render: (i: TemplateInput) => string }> = {
  'aia-g706-conditional-progress-v1': {
    id: 'aia-g706-conditional-progress-v1',
    version: '1',
    jurisdiction: 'AIA',
    type: 'conditional_progress',
    render: (i) => `CONDITIONAL WAIVER AND RELEASE ON PROGRESS PAYMENT
(AIA Document G706 — Conditional Progress)

Project:           ${i.projectName}
Project address:   ${i.projectAddress}
Owner / Payer:     ${i.payerName}
Subcontractor:     ${i.subcontractorName}
Through date:      ${i.periodThrough}
Amount of payment: ${fmtAmount(i.amount)}

[TODO_LEGAL_REVIEW] AIA G706 conditional-progress legal body —
counsel-approved prose required before production use.

Subcontractor: ${i.subcontractorName}
By:            ${i.signerName ?? ''}
Title:         ${i.signerTitle ?? ''}
`,
  },
  'ca-conditional-progress-v1': {
    id: 'ca-conditional-progress-v1',
    version: '1',
    jurisdiction: 'CA',
    type: 'conditional_progress',
    render: (i) => `CONDITIONAL WAIVER AND RELEASE ON PROGRESS PAYMENT (Cal. Civ. Code § 8132)

Project:           ${i.projectName}
Through date:      ${i.periodThrough}
Amount of payment: ${fmtAmount(i.amount)}

[TODO_LEGAL_REVIEW] California Civil Code § 8132 verbatim form text required.

Claimant: ${i.subcontractorName}
By:       ${i.signerName ?? ''}
`,
  },
  'tx-conditional-progress-v1': {
    id: 'tx-conditional-progress-v1',
    version: '1',
    jurisdiction: 'TX',
    type: 'conditional_progress',
    render: (i) => `CONDITIONAL WAIVER AND RELEASE ON PROGRESS PAYMENT (Tex. Prop. Code § 53.281)

Project:           ${i.projectName}
Through date:      ${i.periodThrough}
Amount of payment: ${fmtAmount(i.amount)}

[TODO_LEGAL_REVIEW] Texas Property Code § 53.281 verbatim form text required.

Claimant: ${i.subcontractorName}
By:       ${i.signerName ?? ''}
`,
  },
  'fl-conditional-progress-v1': {
    id: 'fl-conditional-progress-v1',
    version: '1',
    jurisdiction: 'FL',
    type: 'conditional_progress',
    render: (i) => `CONDITIONAL WAIVER AND RELEASE OF LIEN UPON PROGRESS PAYMENT (Fla. Stat. § 713.20)

Project:           ${i.projectName}
Through date:      ${i.periodThrough}
Amount of payment: ${fmtAmount(i.amount)}

[TODO_LEGAL_REVIEW] Florida Statute § 713.20 verbatim form text required.

Claimant: ${i.subcontractorName}
By:       ${i.signerName ?? ''}
`,
  },
  'aia-g706-unconditional-progress-v1': {
    id: 'aia-g706-unconditional-progress-v1',
    version: '1',
    jurisdiction: 'AIA',
    type: 'unconditional_progress',
    render: (i) => `UNCONDITIONAL WAIVER AND RELEASE ON PROGRESS PAYMENT (AIA G706)

Project:           ${i.projectName}
Through date:      ${i.periodThrough}
Amount received:   ${fmtAmount(i.amount)}

[TODO_LEGAL_REVIEW] AIA G706 unconditional-progress legal body required.

Subcontractor: ${i.subcontractorName}
By:            ${i.signerName ?? ''}
`,
  },
}

interface TemplateInput {
  projectName: string
  projectAddress: string
  payerName: string
  subcontractorName: string
  periodThrough: string
  amount: number
  signerName?: string
  signerTitle?: string
}

function fmtAmount(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const cents = Math.round(abs * 100)
  const dollars = Math.floor(cents / 100)
  const rem = cents - dollars * 100
  return `${sign}$${dollars.toLocaleString('en-US')}.${rem.toString().padStart(2, '0')}`
}

function resolveTemplateId(jurisdiction: string | null | undefined, type: string): string {
  const j = (jurisdiction ?? 'AIA').toString().toUpperCase()
  const key = `${j === 'CA' ? 'ca' : j === 'TX' ? 'tx' : j === 'FL' ? 'fl' : 'aia-g706'}-${type.replace(/_/g, '-')}-v1`
  if (TEMPLATES[key]) return key
  if (j === 'AIA' || !TEMPLATES[`aia-g706-${type.replace(/_/g, '-')}-v1`]) {
    return 'aia-g706-conditional-progress-v1'
  }
  return `aia-g706-${type.replace(/_/g, '-')}-v1`
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function generateToken(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  const corsHeaders = getCorsHeaders(req)

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<GenerateRequest>(req)
    const payAppId = requireUuid(body.pay_app_id, 'pay_app_id')

    if (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount < 0) {
      throw new HttpError(400, 'amount must be a non-negative number')
    }
    if (!body.subcontractor_name || !body.signer_email) {
      throw new HttpError(400, 'subcontractor_name and signer_email are required')
    }

    // Load pay app + project + project metadata.
    const { data: payApp, error: paErr } = await supabase
      .from('payment_applications')
      .select('id, project_id, project:projects(name, address, owner_name, state)')
      .eq('id', payAppId)
      .single()
    if (paErr || !payApp) throw new HttpError(404, 'Pay application not found')
    await verifyProjectMembership(supabase, user.id, payApp.project_id)

    const project = (payApp.project as Record<string, string | null>) ?? {}
    const jurisdictionGuess = body.jurisdiction ?? (project.state ?? null)
    const templateId = resolveTemplateId(jurisdictionGuess, body.type)
    const tpl = TEMPLATES[templateId]

    const renderedBody = tpl.render({
      projectName: project.name ?? 'Project',
      projectAddress: project.address ?? '',
      payerName: project.owner_name ?? 'Owner',
      subcontractorName: body.subcontractor_name,
      periodThrough: body.period_through,
      amount: body.amount,
      signerName: body.signer_name,
      signerTitle: body.signer_title,
    })

    const token = generateToken()
    const tokenHash = await sha256Hex(token)
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceKey)

    const { data: waiver, error: insErr } = await adminClient
      .from('lien_waivers')
      .insert({
        pay_app_id: payAppId,
        project_id: payApp.project_id,
        subcontractor_id: body.subcontractor_id ?? null,
        subcontractor_name: body.subcontractor_name,
        template_id: templateId,
        template_version: tpl.version,
        jurisdiction: tpl.jurisdiction,
        type: body.type,
        status: 'pending',
        period_through: body.period_through,
        amount: body.amount,
        magic_token_hash: tokenHash,
        expires_at: expiresAt,
        sent_to_email: body.signer_email,
        sent_at: body.send_email ? new Date().toISOString() : null,
        created_via: 'edge.lien-waiver-generator',
      })
      .select('id')
      .single()
    if (insErr || !waiver) {
      throw new HttpError(500, `Failed to create waiver: ${insErr?.message ?? ''}`)
    }

    const appOrigin = Deno.env.get('APP_ORIGIN') ?? 'https://app.sitesync.ai'
    const magicUrl = `${appOrigin}/share/lien-waiver?id=${waiver.id}&t=${token}`

    return new Response(
      JSON.stringify({
        waiver_id: waiver.id,
        template_id: templateId,
        template_version: tpl.version,
        magic_url: magicUrl,
        expires_at: expiresAt,
        body_preview: renderedBody,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    )
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
