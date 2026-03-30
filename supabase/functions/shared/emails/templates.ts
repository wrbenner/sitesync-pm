// SiteSync branded email templates
// These return HTML strings for use with Resend API

const BRAND_COLOR = '#F47820'
const DARK_BG = '#0C0D0F'
const LIGHT_BG = '#F8F9FA'
const TEXT_COLOR = '#1A1613'
const MUTED_COLOR = '#6B6560'

function baseLayout(title: string, body: string, ctaUrl: string, ctaText: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:${LIGHT_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
    <tr>
      <td style="background:${DARK_BG};padding:24px 32px;">
        <span style="font-size:20px;font-weight:700;color:white;">SiteSync PM</span>
      </td>
    </tr>
    <tr>
      <td style="background:white;padding:32px;">
        <h2 style="margin:0 0 16px;font-size:18px;color:${TEXT_COLOR};">${title}</h2>
        <div style="font-size:14px;line-height:1.6;color:${MUTED_COLOR};">${body}</div>
        <div style="margin:24px 0;">
          <a href="${ctaUrl}" style="display:inline-block;padding:12px 24px;background:${BRAND_COLOR};color:white;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">${ctaText}</a>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 32px;font-size:11px;color:#999;">
        <p>Sent by SiteSync PM. <a href="#" style="color:#999;">Unsubscribe</a></p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function rfiAssigned(params: { number: number; title: string; assigneeName: string; projectUrl: string }): { subject: string; html: string } {
  return {
    subject: `RFI #${params.number} assigned to you: ${params.title}`,
    html: baseLayout(
      `RFI #${params.number} Assigned to You`,
      `<p>You have been assigned a new Request for Information:</p>
       <p style="font-weight:600;color:${TEXT_COLOR};">${params.title}</p>
       <p>Please review and respond at your earliest convenience.</p>`,
      params.projectUrl + '/rfis',
      'View RFI'
    ),
  }
}

export function submittalReview(params: { number: number; title: string; reviewerName: string; projectUrl: string }): { subject: string; html: string } {
  return {
    subject: `Submittal #${params.number} needs your review`,
    html: baseLayout(
      `Submittal #${params.number} Ready for Review`,
      `<p>A submittal requires your review:</p>
       <p style="font-weight:600;color:${TEXT_COLOR};">${params.title}</p>
       <p>Please review and provide your approval or comments.</p>`,
      params.projectUrl + '/submittals',
      'Review Submittal'
    ),
  }
}

export function dailyLogApproval(params: { date: string; submittedBy: string; projectUrl: string }): { subject: string; html: string } {
  return {
    subject: `Daily log for ${params.date} is ready for approval`,
    html: baseLayout(
      'Daily Log Ready for Approval',
      `<p>The daily log for <strong>${params.date}</strong> has been submitted by ${params.submittedBy} and is ready for your review and approval.</p>`,
      params.projectUrl + '/daily-log',
      'Review Daily Log'
    ),
  }
}

export function punchItemAssigned(params: { title: string; location: string; assigneeName: string; projectUrl: string }): { subject: string; html: string } {
  return {
    subject: `New punch item assigned: ${params.title}`,
    html: baseLayout(
      'New Punch Item Assigned',
      `<p>A punch item has been assigned to you:</p>
       <p style="font-weight:600;color:${TEXT_COLOR};">${params.title}</p>
       <p>Location: ${params.location}</p>`,
      params.projectUrl + '/punch-list',
      'View Punch Item'
    ),
  }
}

export function meetingReminder(params: { title: string; time: string; location: string; projectUrl: string }): { subject: string; html: string } {
  return {
    subject: `Meeting reminder: ${params.title} in 1 hour`,
    html: baseLayout(
      `Meeting in 1 Hour: ${params.title}`,
      `<p>This is a reminder for your upcoming meeting:</p>
       <p style="font-weight:600;color:${TEXT_COLOR};">${params.title}</p>
       <p>Time: ${params.time}<br/>Location: ${params.location}</p>`,
      params.projectUrl + '/meetings',
      'View Meeting'
    ),
  }
}

export function actionItemOverdue(params: { description: string; dueDate: string; meetingTitle: string; projectUrl: string }): { subject: string; html: string } {
  return {
    subject: `Action item overdue: ${params.description}`,
    html: baseLayout(
      'Action Item Overdue',
      `<p>The following action item from <strong>${params.meetingTitle}</strong> is now overdue:</p>
       <p style="font-weight:600;color:${TEXT_COLOR};">${params.description}</p>
       <p>Original due date: ${params.dueDate}</p>`,
      params.projectUrl + '/meetings',
      'View Action Items'
    ),
  }
}

export function projectInvite(params: { projectName: string; inviterName: string; role: string; acceptUrl: string }): { subject: string; html: string } {
  return {
    subject: `You've been invited to ${params.projectName}`,
    html: baseLayout(
      `Join ${params.projectName}`,
      `<p>${params.inviterName} has invited you to join the project <strong>${params.projectName}</strong> as a <strong>${params.role}</strong>.</p>
       <p>Click below to accept and get started.</p>`,
      params.acceptUrl,
      'Accept Invitation'
    ),
  }
}

export function weeklyDigest(params: { projectName: string; weekOf: string; newRfis: number; newSubmittals: number; upcomingDeadlines: number; healthScore: number; projectUrl: string }): { subject: string; html: string } {
  return {
    subject: `Weekly digest for ${params.projectName}`,
    html: baseLayout(
      `Weekly Digest: ${params.projectName}`,
      `<p>Here is your summary for the week of ${params.weekOf}:</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0;">
         <tr><td style="padding:8px;border-bottom:1px solid #eee;">New RFIs</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;text-align:right;">${params.newRfis}</td></tr>
         <tr><td style="padding:8px;border-bottom:1px solid #eee;">New Submittals</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;text-align:right;">${params.newSubmittals}</td></tr>
         <tr><td style="padding:8px;border-bottom:1px solid #eee;">Upcoming Deadlines</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;text-align:right;">${params.upcomingDeadlines}</td></tr>
         <tr><td style="padding:8px;">Health Score</td><td style="padding:8px;font-weight:600;text-align:right;color:${params.healthScore >= 80 ? '#2D8A6E' : params.healthScore >= 60 ? '#C4850C' : '#C0392B'}">${params.healthScore}/100</td></tr>
       </table>`,
      params.projectUrl + '/dashboard',
      'View Dashboard'
    ),
  }
}
