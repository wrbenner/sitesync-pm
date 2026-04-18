// ── Email Templates ──────────────────────────────────────
// Branded HTML email templates for SiteSync PM transactional emails.
// Ported from sitesyncai-backend/src/resend/resend.utils.ts and rebranded
// with SiteSync PM orange (#F47820) instead of the original yellow palette.

export interface BrandPalette {
  primary: string
  primaryDark: string
  secondary: string
  white: string
  grey: string
  lightGrey: string
  success: string
  danger: string
  warning: string
  info: string
}

export const brand: BrandPalette = {
  primary: '#F47820',
  primaryDark: '#C45A0C',
  secondary: '#FF9C42',
  white: '#FFFFFF',
  grey: '#1A1613',
  lightGrey: '#F7F8FA',
  success: '#16A34A',
  danger: '#DC2626',
  warning: '#F59E0B',
  info: '#2563EB',
}

const escapeHtml = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

const baseStyles = `
  body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${brand.lightGrey}; color: ${brand.grey}; line-height: 1.6; }
  .container { max-width: 600px; margin: 0 auto; background-color: ${brand.white}; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
  .header { background: linear-gradient(135deg, ${brand.primary} 0%, ${brand.secondary} 100%); padding: 40px 30px; text-align: center; color: ${brand.white}; }
  .header h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
  .content { padding: 40px 30px; }
  .message { font-size: 16px; color: ${brand.grey}; margin-bottom: 24px; line-height: 1.7; }
  .cta { display: inline-block; background: linear-gradient(135deg, ${brand.primary} 0%, ${brand.secondary} 100%); color: ${brand.white}; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(244,120,32,0.3); }
  .info-box { background-color: ${brand.lightGrey}; border-left: 4px solid ${brand.primary}; padding: 16px 20px; margin: 24px 0; border-radius: 0 8px 8px 0; font-size: 14px; }
  .footer { padding: 24px 30px; text-align: center; color: #8B8680; font-size: 12px; border-top: 1px solid #E5E7EB; }
  .brand-name { font-weight: 700; color: ${brand.primary}; }
`

const shell = (title: string, inner: string): string => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>${baseStyles}</style>
</head>
<body>
<div class="container">
${inner}
<div class="footer">
  Sent by <span class="brand-name">SiteSync PM</span> — the construction command center.<br/>
  You received this email as part of your project activity.
</div>
</div>
</body>
</html>`

// ── Invite ───────────────────────────────────────────────

export interface InviteEmailData {
  recipientEmail: string
  inviterName?: string
  organizationName?: string
  token: string
  expiresInHours?: number
  appBaseUrl?: string
}

export function getInviteHtml(data: InviteEmailData): string {
  const inviter = escapeHtml(data.inviterName ?? 'Your teammate')
  const org = escapeHtml(data.organizationName ?? 'SiteSync PM')
  const hours = data.expiresInHours ?? 48
  const baseUrl = data.appBaseUrl ?? 'https://sitesync.pm'
  const link = `${baseUrl}/invite/${encodeURIComponent(data.token)}`
  const email = escapeHtml(data.recipientEmail)
  const body = `
  <div class="header"><h1>You're invited to ${org}</h1></div>
  <div class="content">
    <p class="message">Hi there,</p>
    <p class="message"><strong>${inviter}</strong> has invited you to join <strong>${org}</strong> on SiteSync PM — the construction project management command center.</p>
    <div style="text-align:center;margin:32px 0;">
      <a class="cta" href="${link}">Accept invitation</a>
    </div>
    <div class="info-box">
      <strong>This invite expires in ${hours} hours.</strong><br/>
      Invitation sent to ${email}. If the link doesn't work, copy this URL:<br/>
      <a href="${link}" style="color:${brand.primary};word-break:break-all;">${link}</a>
    </div>
    <p class="message">If you weren't expecting this email, you can safely ignore it.</p>
  </div>`
  return shell(`You're invited to ${org}`, body)
}

// ── Report ───────────────────────────────────────────────

export interface ReportEmailData {
  recipientEmail: string
  recipientName?: string
  reportTitle: string
  projectName: string
  reportUrl: string
  summary?: string
  generatedAt?: string
}

export function getReportHtml(data: ReportEmailData): string {
  const name = escapeHtml(data.recipientName ?? 'there')
  const title = escapeHtml(data.reportTitle)
  const project = escapeHtml(data.projectName)
  const summary = data.summary ? escapeHtml(data.summary) : null
  const generated = escapeHtml(data.generatedAt ?? new Date().toLocaleDateString())
  const body = `
  <div class="header"><h1>Your report is ready</h1></div>
  <div class="content">
    <p class="message">Hi ${name},</p>
    <p class="message">
      The <strong>${title}</strong> report for <strong>${project}</strong> has been generated.
    </p>
    ${summary ? `<div class="info-box"><strong>Summary:</strong><br/>${summary}</div>` : ''}
    <div style="text-align:center;margin:32px 0;">
      <a class="cta" href="${escapeHtml(data.reportUrl)}">View report</a>
    </div>
    <p class="message" style="font-size:13px;color:#8B8680;">Generated ${generated}</p>
  </div>`
  return shell(`Report: ${title}`, body)
}

// ── Discrepancy Alert ────────────────────────────────────

export interface DiscrepancyAlertEmailData {
  recipientEmail: string
  recipientName?: string
  projectName: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  discrepancyCount: number
  autoRfiCount?: number
  drawingPair?: string
  viewerUrl: string
}

export function getDiscrepancyAlertHtml(data: DiscrepancyAlertEmailData): string {
  const name = escapeHtml(data.recipientName ?? 'there')
  const project = escapeHtml(data.projectName)
  const sev = data.severity
  const severityColor =
    sev === 'critical' ? brand.danger : sev === 'high' ? '#EA580C' : sev === 'medium' ? brand.warning : brand.info
  const severityLabel = sev.charAt(0).toUpperCase() + sev.slice(1)
  const pair = data.drawingPair ? escapeHtml(data.drawingPair) : null

  const body = `
  <div class="header" style="background:linear-gradient(135deg, ${severityColor} 0%, ${brand.primary} 100%);"><h1>Discrepancy detected</h1></div>
  <div class="content">
    <p class="message">Hi ${name},</p>
    <p class="message">
      SiteSync PM detected <strong>${data.discrepancyCount}</strong>
      ${sev === 'critical' ? 'critical ' : ''}discrepanc${data.discrepancyCount === 1 ? 'y' : 'ies'}
      on <strong>${project}</strong>${pair ? ` while analyzing <strong>${pair}</strong>` : ''}.
    </p>
    <div class="info-box" style="border-left-color:${severityColor};">
      <strong style="color:${severityColor};">Severity: ${severityLabel}</strong><br/>
      ${data.discrepancyCount} new discrepanc${data.discrepancyCount === 1 ? 'y' : 'ies'}
      ${data.autoRfiCount ? `• ${data.autoRfiCount} auto-drafted RFI${data.autoRfiCount === 1 ? '' : 's'}` : ''}
    </div>
    <div style="text-align:center;margin:32px 0;">
      <a class="cta" href="${escapeHtml(data.viewerUrl)}">Review discrepancies</a>
    </div>
    <p class="message" style="font-size:13px;color:#8B8680;">
      Early detection saves weeks of rework. Review these findings before the affected trades mobilize.
    </p>
  </div>`
  return shell(`Discrepancy detected on ${project}`, body)
}
