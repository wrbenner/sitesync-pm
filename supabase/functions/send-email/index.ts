// ── send-email Edge Function ─────────────────────────────
// Phase 6: Resend API wrapper for transactional emails.
// Adapted from sitesyncai-backend-main/src/resend/resend.service.ts.
//
// Supports the four transactional templates called out in the
// integration plan: invoice, payment_receipt, drawing_analysis_complete,
// discrepancy_alert. Falls back to raw html/text for ad hoc sends.


import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'
import {
  getInviteHtml,
  getReportHtml,
  getDiscrepancyAlertHtml,
  type InviteEmailData,
  type ReportEmailData,
  type DiscrepancyAlertEmailData,
} from './templates.ts'

const RESEND_API_BASE = 'https://api.resend.com'

type TemplateName =
  | 'invoice'
  | 'payment_receipt'
  | 'drawing_analysis_complete'
  | 'discrepancy_alert'
  | 'invite'
  | 'report'
  | 'discrepancy_alert_branded'
  | 'custom'

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
  const brand = '<div style="background:#F47820;padding:16px;color:#fff;font-weight:700;font-size:16px;letter-spacing:2px;">SITESYNC AI</div>'
  const wrap = (title: string, body: string) =>
    `<!doctype html><html><body style="font-family:Helvetica,Arial,sans-serif;color:#0F1629;max-width:640px;margin:0 auto;">
      ${brand}
      <div style="padding:24px;">
        <h1 style="font-size:22px;margin:0 0 12px 0;">${title}</h1>
        ${body}
      </div>
      <div style="padding:16px;color:#6B7280;font-size:11px;border-top:1px solid #E5E7EB;">
        Sent by SiteSync AI. Do not reply to this email.
      </div>
    </body></html>`

  if (template === 'invoice') {
    const invoiceNumber = String(data.invoice_number ?? '')
    const amount = Number(data.amount_cents ?? 0) / 100
    const dueAt = String(data.due_at ?? 'Upon receipt')
    return {
      subject: `Invoice ${invoiceNumber} — $${amount.toFixed(2)}`,
      html: wrap(
        `Invoice ${invoiceNumber}`,
        `<p>Your invoice for <strong>$${amount.toFixed(2)}</strong> is ready.</p>
         <p><strong>Due:</strong> ${dueAt}</p>
         ${data.invoice_pdf_url ? `<p><a href="${data.invoice_pdf_url}" style="color:#F47820;">Download PDF</a></p>` : ''}`,
      ),
    }
  }

  if (template === 'payment_receipt') {
    const amount = Number(data.amount_cents ?? 0) / 100
    return {
      subject: `Payment received — $${amount.toFixed(2)}`,
      html: wrap(
        'Payment received',
        `<p>We received your payment of <strong>$${amount.toFixed(2)}</strong>. Thank you.</p>
         ${data.receipt_pdf_url ? `<p><a href="${data.receipt_pdf_url}" style="color:#F47820;">Download receipt</a></p>` : ''}`,
      ),
    }
  }

  if (template === 'drawing_analysis_complete') {
    const projectName = String(data.project_name ?? 'your project')
    const pairs = Number(data.pairs_analyzed ?? 0)
    const discrepancies = Number(data.discrepancies_found ?? 0)
    return {
      subject: `Drawing analysis complete — ${projectName}`,
      html: wrap(
        'Drawing analysis complete',
        `<p>The drawing intelligence pipeline for <strong>${projectName}</strong> finished.</p>
         <ul>
           <li>${pairs} drawing pairs analyzed</li>
           <li>${discrepancies} dimensional discrepancies detected</li>
         </ul>
         ${data.dashboard_url ? `<p><a href="${data.dashboard_url}" style="color:#F47820;">Open dashboard</a></p>` : ''}`,
      ),
    }
  }

  if (template === 'discrepancy_alert') {
    const projectName = String(data.project_name ?? 'your project')
    const severityHigh = Number(data.severity_high ?? 0)
    return {
      subject: `ACTION REQUIRED: ${severityHigh} high severity clashes on ${projectName}`,
      html: wrap(
        'Drawing clashes detected',
        `<p>SiteSync AI detected <strong>${severityHigh}</strong> high severity dimensional mismatches on <strong>${projectName}</strong>.</p>
         <p>Review before issuing RFIs to the architect or structural engineer.</p>
         ${data.report_url ? `<p><a href="${data.report_url}" style="color:#F47820;">View report</a></p>` : ''}`,
      ),
    }
  }

  if (template === 'invite') {
    const d = data as unknown as InviteEmailData
    const org = d.organizationName ?? 'SiteSync PM'
    return {
      subject: `You're invited to ${org}`,
      html: getInviteHtml(d),
    }
  }

  if (template === 'report') {
    const d = data as unknown as ReportEmailData
    return {
      subject: `Report ready: ${d.reportTitle} — ${d.projectName}`,
      html: getReportHtml(d),
    }
  }

  if (template === 'discrepancy_alert_branded') {
    const d = data as unknown as DiscrepancyAlertEmailData
    const sevLabel = d.severity.charAt(0).toUpperCase() + d.severity.slice(1)
    return {
      subject: `${sevLabel} discrepancy detected on ${d.projectName}`,
      html: getDiscrepancyAlertHtml(d),
    }
  }

  throw new HttpError(400, `Unknown template: ${template}`, 'validation_error')
}

Deno.serve(async (req) => {
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
