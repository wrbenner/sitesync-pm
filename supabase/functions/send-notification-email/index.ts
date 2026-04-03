import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  handleCors,
  getCorsHeaders,
  authenticateRequest,
  errorResponse,
} from '../shared/auth.ts'

// ── Email Templates ───────────────────────────────────────────

const TEMPLATES: Record<string, { subject: string; body: string }> = {
  rfi_assigned: {
    subject: '{{projectName}}: New RFI {{rfiNumber}} assigned to you',
    body: 'You have been assigned RFI {{rfiNumber}}: {{rfiTitle}}. Due by {{dueDate}}. View it at {{link}}.',
  },
  rfi_overdue: {
    subject: '{{projectName}}: RFI {{rfiNumber}} is OVERDUE',
    body: 'RFI {{rfiNumber}} "{{rfiTitle}}" is {{daysOverdue}} days past due. Please respond immediately.',
  },
  rfi_response: {
    subject: '{{projectName}}: Response on RFI {{rfiNumber}}',
    body: 'Your RFI {{rfiNumber}} received a response from {{responderName}}.',
  },
  submittal_approved: {
    subject: '{{projectName}}: Submittal approved: {{submittalTitle}}',
    body: 'Submittal "{{submittalTitle}}" has been approved by {{approverName}}.',
  },
  submittal_revision: {
    subject: '{{projectName}}: Submittal needs revision: {{submittalTitle}}',
    body: 'Submittal "{{submittalTitle}}" was returned for revision. Comments: {{comments}}',
  },
  change_order_pending: {
    subject: '{{projectName}}: Change order awaiting approval',
    body: 'Change order {{coNumber}} "{{coTitle}}" for {{amount}} needs your approval.',
  },
  daily_log_reminder: {
    subject: '{{projectName}}: Daily log reminder for {{date}}',
    body: 'The daily log for {{date}} has not been submitted yet. Please complete it before end of day.',
  },
  pay_app_review: {
    subject: '{{projectName}}: Payment application ready for review',
    body: 'Pay app period {{periodNumber}} for {{amount}} is ready for your review.',
  },
  punch_item_assigned: {
    subject: '{{projectName}}: New punch item assigned',
    body: 'A new punch item "{{itemTitle}}" at {{location}} has been assigned to you. Due: {{dueDate}}.',
  },
  meeting_scheduled: {
    subject: '{{projectName}}: Meeting scheduled: {{meetingTitle}}',
    body: 'You are invited to {{meetingTitle}} on {{meetingDate}} at {{meetingTime}}. Location: {{location}}.',
  },
}

// ── Template Rendering ────────────────────────────────────────

function renderTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`)
}

// ── HTML Email Wrapper ────────────────────────────────────────

function wrapInHtmlTemplate(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SiteSync AI Notification</title>
</head>
<body style="margin:0;padding:0;background-color:#F7F8FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:#F47820;border-radius:8px 8px 0 0;padding:24px 32px;">
              <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">SiteSync AI</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:32px;border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;">
              <p style="margin:0;color:#111827;font-size:15px;line-height:1.6;">
                ${body.replace(/\n/g, '<br />')}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F7F8FA;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 8px 8px;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#6B7280;font-size:12px;line-height:1.5;">
                You are receiving this because you are a member of this project in SiteSync AI.<br />
                <a href="https://app.sitesync.ai/notifications/unsubscribe" style="color:#F47820;text-decoration:underline;">Unsubscribe from notifications</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Handler ───────────────────────────────────────────────────

serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const corsHeaders = getCorsHeaders(req)

  try {
    await authenticateRequest(req)

    const body = await req.json() as {
      recipientEmail: string
      triggerType: string
      templateData: Record<string, string>
      notificationId: string
    }

    const { recipientEmail, triggerType, templateData, notificationId } = body

    const template = TEMPLATES[triggerType]
    if (!template) {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown trigger type: ${triggerType}` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    const renderedSubject = renderTemplate(template.subject, templateData)
    const renderedBody = renderTemplate(template.body, templateData)

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set')
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + resendApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SiteSync AI <notifications@sitesync.ai>',
        to: [recipientEmail],
        subject: renderedSubject,
        html: wrapInHtmlTemplate(renderedBody),
      }),
    })

    if (resendResponse.ok) {
      const data = await resendResponse.json() as { id?: string }
      return new Response(
        JSON.stringify({ success: true, messageId: data.id, notificationId }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    } else {
      const errorText = await resendResponse.text()
      return new Response(
        JSON.stringify({ success: false, error: errorText, notificationId }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
