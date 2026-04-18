// ── Professional Notification Templates ───────────────────────
// Adapted from sitesyncai-backend resend.utils with SiteSync PM
// branding, responsive layout, dark-mode color hints, and
// unsubscribe footer for CAN-SPAM compliance.

const BRAND = '#F47820'
const BRAND_DARK = '#C45A0C'
const TEXT = '#0F1629'
const TEXT_MUTED = '#6B7280'
const BORDER = '#E5E7EB'
const BG_PANEL = '#F9FAFB'
const APP_URL = Deno.env.get('APP_URL') || 'https://app.sitesync.ai'

function layout(title: string, body: string, opts?: { previewText?: string; unsubPath?: string }): string {
  const preview = opts?.previewText ?? title
  const unsub = `${APP_URL}${opts?.unsubPath ?? '/settings/notifications'}`
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escape(title)}</title>
  <style>
    @media (prefers-color-scheme: dark) {
      .bg { background:#0F1629 !important; }
      .card { background:#1F2937 !important; border-color:#374151 !important; }
      .text { color:#F3F4F6 !important; }
      .muted { color:#9CA3AF !important; }
    }
    @media (max-width:600px){
      .container { width:100% !important; padding:12px !important; }
      .btn { width:100% !important; display:block !important; }
    }
  </style>
</head>
<body class="bg" style="margin:0;padding:0;background:${BG_PANEL};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${TEXT};">
  <span style="display:none;font-size:1px;color:${BG_PANEL};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escape(preview)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG_PANEL};">
    <tr><td align="center">
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;margin:24px auto;">
        <tr><td style="padding:24px 0;">
          <div style="font-weight:800;font-size:20px;letter-spacing:1px;color:${BRAND};">SITESYNC <span style="color:${TEXT};">PM</span></div>
        </td></tr>
        <tr><td class="card" style="background:#ffffff;border:1px solid ${BORDER};border-radius:12px;padding:28px;">
          ${body}
        </td></tr>
        <tr><td style="padding:16px 4px;">
          <div class="muted" style="font-size:11px;color:${TEXT_MUTED};line-height:1.55;">
            Sent by SiteSync PM. <a href="${unsub}" style="color:${TEXT_MUTED};text-decoration:underline;">Manage notifications</a>.<br/>
            SiteSync PM — Construction intelligence that works the way you build.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))
}

function button(label: string, url: string): string {
  return `<a class="btn" href="${url}" style="display:inline-block;padding:14px 28px;background:${BRAND};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${escape(label)}</a>`
}

function badge(text: string, tone: 'high' | 'medium' | 'low' | 'info' = 'info'): string {
  const colorMap = {
    high: { bg: '#FEE2E2', fg: '#991B1B' },
    medium: { bg: '#FEF3C7', fg: '#92400E' },
    low: { bg: '#DBEAFE', fg: '#1E40AF' },
    info: { bg: '#E0E7FF', fg: '#3730A3' },
  }
  const { bg, fg } = colorMap[tone]
  return `<span style="display:inline-block;padding:2px 10px;background:${bg};color:${fg};border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">${escape(text)}</span>`
}

// ── Data types ────────────────────────────────────────────────
export type TemplateName =
  | 'invite'
  | 'rfi_notification'
  | 'daily_digest'
  | 'discrepancy_alert'
  | 'report_ready'
  | 'invoice'
  | 'payment_receipt'
  | 'drawing_analysis_complete'
  | 'custom'

interface Rendered { subject: string; html: string }

// ── Templates ─────────────────────────────────────────────────

export function renderInvite(data: Record<string, unknown>): Rendered {
  const inviterName = String(data.inviter_name ?? 'Your teammate')
  const projectName = String(data.project_name ?? 'a SiteSync PM project')
  const role = String(data.role ?? 'Project Member')
  const acceptUrl = String(data.accept_url ?? APP_URL)
  return {
    subject: `${inviterName} invited you to ${projectName} on SiteSync PM`,
    html: layout(
      `You've been invited`,
      `<h1 class="text" style="font-size:22px;margin:0 0 12px 0;color:${TEXT};">You've been invited to ${escape(projectName)}</h1>
       <p class="text" style="font-size:14px;line-height:1.6;color:${TEXT};margin:0 0 16px 0;">
         <strong>${escape(inviterName)}</strong> has added you as a <strong>${escape(role)}</strong> on <strong>${escape(projectName)}</strong>.
       </p>
       <p class="text" style="font-size:14px;line-height:1.6;color:${TEXT};margin:0 0 24px 0;">
         Click below to accept and start collaborating on RFIs, submittals, drawings, and the field log.
       </p>
       <p style="margin:0 0 16px 0;">${button('Accept invitation', acceptUrl)}</p>
       <p class="muted" style="font-size:12px;color:${TEXT_MUTED};margin:16px 0 0 0;">
         If you didn't expect this, you can ignore it — no account will be created.
       </p>`,
      { previewText: `${inviterName} invited you to collaborate on ${projectName}` },
    ),
  }
}

export function renderRfiNotification(data: Record<string, unknown>): Rendered {
  const rfiNumber = String(data.rfi_number ?? '—')
  const subject = String(data.subject ?? 'RFI notification')
  const priority = String(data.priority ?? 'medium').toLowerCase() as 'high' | 'medium' | 'low'
  const dueInDays = Number(data.due_in_days ?? 0)
  const projectName = String(data.project_name ?? 'your project')
  const url = String(data.url ?? APP_URL)
  return {
    subject: `RFI #${rfiNumber}: ${subject} (due in ${dueInDays}d)`,
    html: layout(
      `RFI #${rfiNumber}`,
      `<div style="margin:0 0 12px 0;">${badge(priority + ' priority', priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'medium')}</div>
       <h1 class="text" style="font-size:22px;margin:0 0 8px 0;color:${TEXT};">RFI #${escape(rfiNumber)}: ${escape(subject)}</h1>
       <p class="muted" style="font-size:13px;color:${TEXT_MUTED};margin:0 0 16px 0;">${escape(projectName)}</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG_PANEL};border-radius:8px;padding:12px;margin:0 0 20px 0;">
         <tr>
           <td style="padding:8px;"><div class="muted" style="font-size:11px;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:0.05em;">Due in</div><div class="text" style="font-size:18px;font-weight:700;color:${dueInDays <= 1 ? '#B91C1C' : TEXT};">${dueInDays} day${dueInDays === 1 ? '' : 's'}</div></td>
           <td style="padding:8px;"><div class="muted" style="font-size:11px;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:0.05em;">Priority</div><div class="text" style="font-size:18px;font-weight:700;color:${TEXT};">${escape(priority.toUpperCase())}</div></td>
         </tr>
       </table>
       <p style="margin:0 0 12px 0;">${button('Review RFI', url)}</p>`,
      { previewText: `You've been assigned RFI #${rfiNumber}. Due in ${dueInDays} days.` },
    ),
  }
}

export function renderDailyDigest(data: Record<string, unknown>): Rendered {
  const projectName = String(data.project_name ?? 'your project')
  const newRfis = Number(data.new_rfis ?? 0)
  const statusChanges = Number(data.status_changes ?? 0)
  const upcomingDeadlines = Number(data.upcoming_deadlines ?? 0)
  const highlights = Array.isArray(data.highlights) ? data.highlights as string[] : []
  const url = String(data.url ?? APP_URL)
  const date = String(data.date ?? new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' }))
  const items = highlights.slice(0, 6)
    .map((h) => `<li style="margin:0 0 6px 0;font-size:14px;line-height:1.5;color:${TEXT};">${escape(h)}</li>`).join('')
  return {
    subject: `Daily digest — ${projectName} (${date})`,
    html: layout(
      `Daily digest`,
      `<h1 class="text" style="font-size:22px;margin:0 0 4px 0;color:${TEXT};">Today on ${escape(projectName)}</h1>
       <p class="muted" style="font-size:13px;color:${TEXT_MUTED};margin:0 0 20px 0;">${escape(date)}</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
         <tr>
           ${[{ k: 'New RFIs', v: newRfis }, { k: 'Status changes', v: statusChanges }, { k: 'Deadlines', v: upcomingDeadlines }]
             .map((c) => `<td width="33%" style="background:${BG_PANEL};border-radius:8px;padding:12px;text-align:center;">
               <div class="text" style="font-size:28px;font-weight:800;color:${BRAND};line-height:1;">${c.v}</div>
               <div class="muted" style="font-size:11px;color:${TEXT_MUTED};margin-top:4px;text-transform:uppercase;letter-spacing:0.05em;">${c.k}</div>
             </td>`).join('<td width="1%" style="padding:0 4px;"></td>')}
         </tr>
       </table>
       ${items ? `<h2 class="text" style="font-size:14px;margin:0 0 8px 0;color:${TEXT};text-transform:uppercase;letter-spacing:0.05em;">Highlights</h2><ul style="margin:0 0 20px 0;padding-left:20px;">${items}</ul>` : ''}
       <p style="margin:0 0 12px 0;">${button('Open project', url)}</p>`,
      { previewText: `${newRfis} new RFIs, ${statusChanges} status changes, ${upcomingDeadlines} upcoming deadlines.` },
    ),
  }
}

export function renderDiscrepancyAlert(data: Record<string, unknown>): Rendered {
  const setName = String(data.set_name ?? 'your drawing set')
  const total = Number(data.total ?? 0)
  const high = Number(data.high_severity ?? 0)
  const medium = Number(data.medium_severity ?? 0)
  const low = Number(data.low_severity ?? 0)
  const imageUrl = typeof data.preview_image_url === 'string' ? data.preview_image_url : null
  const url = String(data.url ?? APP_URL)
  return {
    subject: `${total} new discrepancies in ${setName}${high ? ` — ${high} High severity` : ''}`,
    html: layout(
      `Discrepancies detected`,
      `<h1 class="text" style="font-size:22px;margin:0 0 8px 0;color:${TEXT};">${total} new discrepancies detected</h1>
       <p class="muted" style="font-size:13px;color:${TEXT_MUTED};margin:0 0 16px 0;">${escape(setName)}</p>
       <div style="margin:0 0 16px 0;">
         ${high ? badge(`${high} High`, 'high') + ' ' : ''}
         ${medium ? badge(`${medium} Medium`, 'medium') + ' ' : ''}
         ${low ? badge(`${low} Low`, 'low') : ''}
       </div>
       ${imageUrl ? `<img src="${escape(imageUrl)}" alt="Discrepancy preview" width="540" style="display:block;max-width:100%;height:auto;border-radius:8px;margin:0 0 20px 0;border:1px solid ${BORDER};" />` : ''}
       <p class="text" style="font-size:14px;line-height:1.6;color:${TEXT};margin:0 0 20px 0;">
         The AI diff engine flagged these while comparing the latest revision set. Review and escalate to RFIs as needed.
       </p>
       <p style="margin:0 0 12px 0;">${button('Review discrepancies', url)}</p>`,
      { previewText: `${high} High, ${medium} Medium, ${low} Low severity items awaiting review.` },
    ),
  }
}

export function renderReportReady(data: Record<string, unknown>): Rendered {
  const reportType = String(data.report_type ?? 'Report')
  const projectName = String(data.project_name ?? 'your project')
  const pdfUrl = String(data.pdf_url ?? APP_URL)
  const generatedAt = String(data.generated_at ?? new Date().toLocaleString('en-US'))
  return {
    subject: `${reportType} is ready — ${projectName}`,
    html: layout(
      `${reportType} is ready`,
      `<h1 class="text" style="font-size:22px;margin:0 0 8px 0;color:${TEXT};">${escape(reportType)} is ready</h1>
       <p class="muted" style="font-size:13px;color:${TEXT_MUTED};margin:0 0 20px 0;">${escape(projectName)} · generated ${escape(generatedAt)}</p>
       <p class="text" style="font-size:14px;line-height:1.6;color:${TEXT};margin:0 0 20px 0;">
         Your report has been generated and is ready to download. The PDF includes all discrepancies, their severities, and links back to source drawings.
       </p>
       <p style="margin:0 0 16px 0;">${button('Download PDF', pdfUrl)}</p>
       <p class="muted" style="font-size:12px;color:${TEXT_MUTED};margin:16px 0 0 0;">
         The download link will expire in 7 days. You can regenerate the report anytime from the project dashboard.
       </p>`,
      { previewText: `Your ${reportType} is ready to download.` },
    ),
  }
}

// ── Legacy wrappers ─ preserve backwards compatibility with existing send-email callers
export function renderInvoice(data: Record<string, unknown>): Rendered {
  const invoiceNumber = String(data.invoice_number ?? '')
  const amount = Number(data.amount_cents ?? 0) / 100
  const dueAt = String(data.due_at ?? 'Upon receipt')
  const pdfUrl = typeof data.invoice_pdf_url === 'string' ? data.invoice_pdf_url : null
  return {
    subject: `Invoice ${invoiceNumber} — $${amount.toFixed(2)}`,
    html: layout(
      `Invoice ${invoiceNumber}`,
      `<h1 class="text" style="font-size:22px;margin:0 0 12px 0;color:${TEXT};">Invoice ${escape(invoiceNumber)}</h1>
       <p class="text" style="font-size:14px;color:${TEXT};margin:0 0 8px 0;">Amount due: <strong>$${amount.toFixed(2)}</strong></p>
       <p class="text" style="font-size:14px;color:${TEXT};margin:0 0 20px 0;">Due: ${escape(dueAt)}</p>
       ${pdfUrl ? `<p style="margin:0 0 12px 0;">${button('Download PDF', pdfUrl)}</p>` : ''}`,
    ),
  }
}

export function renderPaymentReceipt(data: Record<string, unknown>): Rendered {
  const amount = Number(data.amount_cents ?? 0) / 100
  const method = String(data.method ?? 'card')
  const receiptNumber = String(data.receipt_number ?? '')
  return {
    subject: `Payment received — $${amount.toFixed(2)}`,
    html: layout(
      `Payment received`,
      `<h1 class="text" style="font-size:22px;margin:0 0 12px 0;color:${TEXT};">Payment received</h1>
       <p class="text" style="font-size:14px;color:${TEXT};">We received <strong>$${amount.toFixed(2)}</strong> via ${escape(method)}.</p>
       ${receiptNumber ? `<p class="muted" style="font-size:12px;color:${TEXT_MUTED};">Receipt: ${escape(receiptNumber)}</p>` : ''}`,
    ),
  }
}

export function renderDrawingAnalysisComplete(data: Record<string, unknown>): Rendered {
  const projectName = String(data.project_name ?? 'your project')
  const total = Number(data.total_discrepancies ?? 0)
  const url = String(data.url ?? APP_URL)
  return {
    subject: `Drawing analysis complete — ${projectName}`,
    html: layout(
      `Analysis complete`,
      `<h1 class="text" style="font-size:22px;margin:0 0 8px 0;color:${TEXT};">Analysis complete</h1>
       <p class="text" style="font-size:14px;color:${TEXT};margin:0 0 20px 0;">${total} discrepancies were found in ${escape(projectName)}.</p>
       <p style="margin:0 0 12px 0;">${button('Open project', url)}</p>`,
    ),
  }
}

// ── Router ────────────────────────────────────────────────────

export function renderTemplate(name: TemplateName, data: Record<string, unknown>): Rendered {
  switch (name) {
    case 'invite': return renderInvite(data)
    case 'rfi_notification': return renderRfiNotification(data)
    case 'daily_digest': return renderDailyDigest(data)
    case 'discrepancy_alert': return renderDiscrepancyAlert(data)
    case 'report_ready': return renderReportReady(data)
    case 'invoice': return renderInvoice(data)
    case 'payment_receipt': return renderPaymentReceipt(data)
    case 'drawing_analysis_complete': return renderDrawingAnalysisComplete(data)
    case 'custom':
    default:
      return {
        subject: String(data.subject ?? 'Notification'),
        html: layout(String(data.title ?? 'Notification'), String(data.body_html ?? escape(String(data.body ?? '')))),
      }
  }
}
