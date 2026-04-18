// ── send-email Edge Function ─────────────────────────────
// Phase 6: Resend API wrapper for transactional emails.
// Adapted from sitesyncai-backend-main/src/resend/resend.service.ts.
//
// Supports the four transactional templates called out in the
// integration plan: invoice, payment_receipt, drawing_analysis_complete,
// discrepancy_alert. Falls back to raw html/text for ad hoc sends.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'
import { renderTemplate as renderEnhancedTemplate, type TemplateName as EnhancedTemplateName } from './templates.ts'

const RESEND_API_BASE = 'https://api.resend.com'

type TemplateName = EnhancedTemplateName

interface EmailAttachment {
  filename: string
  content: string // base64
  content_type?: string
}

interface EmailRequest {
  to: string | string[]
  from?: string
  subject?: string
  template?: TemplateName
  template_data?: Record<string, unknown>
  html?: string
  text?: string
  attachments?: EmailAttachment[]
  cc?: string | string[]
  bcc?: string | string[]
}

function renderTemplate(
  template: TemplateName,
  data: Record<string, unknown>,
): { subject: string; html: string } {
  return renderEnhancedTemplate(template, data)
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  if (req.method !== 'POST') {
    return errorResponse(new HttpError(405, 'Method not allowed'), corsHeaders)
  }

  try {
    await authenticateRequest(req)
    const body = await parseJsonBody<EmailRequest>(req)

    if (!body.to || (Array.isArray(body.to) && body.to.length === 0)) {
      throw new HttpError(400, '`to` is required', 'validation_error')
    }

    let subject = body.subject ?? ''
    let html = body.html ?? ''
    const text = body.text

    if (body.template && body.template !== 'custom') {
      const rendered = renderTemplate(body.template, body.template_data ?? {})
      subject = body.subject ?? rendered.subject
      html = body.html ?? rendered.html
    }

    if (!subject) throw new HttpError(400, 'subject is required', 'validation_error')
    if (!html && !text) throw new HttpError(400, 'html or text is required', 'validation_error')

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) throw new HttpError(500, 'RESEND_API_KEY not configured', 'config_error')

    const from = body.from ?? Deno.env.get('RESEND_FROM_ADDRESS') ?? 'SiteSync AI <noreply@sitesync.app>'

    const payload: Record<string, unknown> = {
      from,
      to: body.to,
      subject,
    }
    if (html) payload.html = html
    if (text) payload.text = text
    if (body.cc) payload.cc = body.cc
    if (body.bcc) payload.bcc = body.bcc
    if (body.attachments && body.attachments.length > 0) {
      payload.attachments = body.attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        content_type: a.content_type,
      }))
    }

    const res = await fetch(`${RESEND_API_BASE}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (!res.ok) {
      const message =
        (data?.message as string | undefined) ??
        (data?.error as string | undefined) ??
        `Resend ${res.status}`
      throw new HttpError(res.status, message, 'resend_error')
    }

    return new Response(JSON.stringify({ id: data?.id ?? null, success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
