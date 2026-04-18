// Insurance Expiration Alert Edge Function
// Scans insurance_certificates for expiring COIs, sends notification emails.
// Called by pg_cron daily. Alerts at 60, 30, 14, and 7 days before expiration.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { authenticateCron, handleCors, getCorsHeaders, errorResponse } from '../shared/auth.ts'

const ALERT_THRESHOLDS = [60, 30, 14, 7] // days before expiration

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const cors = getCorsHeaders(req)

  try {
    const supabase = authenticateCron(req)

    // Find certificates expiring within 60 days
    const sixtyDaysOut = new Date()
    sixtyDaysOut.setDate(sixtyDaysOut.getDate() + 60)

    const { data: certs, error } = await supabase
      .from('insurance_certificates')
      .select(`
        id, company_name, policy_type, expiration_date, carrier,
        coverage_amount, project_id, contact_email,
        last_alert_sent_at, last_alert_days
      `)
      .lte('expiration_date', sixtyDaysOut.toISOString())
      .neq('status', 'expired')
      .eq('verified', true)

    if (error) throw error
    if (!certs || certs.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date()
    let alertsSent = 0
    let certsExpired = 0

    for (const cert of certs) {
      const expDate = new Date(cert.expiration_date)
      const daysUntilExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      // Mark expired certificates
      if (daysUntilExpiry <= 0) {
        await supabase.from('insurance_certificates').update({
          status: 'expired',
          updated_at: now.toISOString(),
        }).eq('id', cert.id)
        certsExpired++

        // Block non-compliant sub from working
        if (cert.project_id) {
          await supabase.from('notifications').insert({
            project_id: cert.project_id,
            type: 'insurance_expired',
            title: `Insurance Expired: ${cert.company_name}`,
            body: `${cert.policy_type} policy from ${cert.carrier} for ${cert.company_name} has expired. This subcontractor is non-compliant.`,
            severity: 'critical',
            entity_type: 'insurance_certificate',
            entity_id: cert.id,
          })
        }
        continue
      }

      // Determine which alert threshold we're at
      const alertThreshold = ALERT_THRESHOLDS.find((t) => daysUntilExpiry <= t)
      if (!alertThreshold) continue

      // Skip if we already sent an alert for this threshold
      if (cert.last_alert_days && cert.last_alert_days <= alertThreshold) continue

      // Send alert notification
      if (cert.project_id) {
        const severity = daysUntilExpiry <= 7 ? 'critical' : daysUntilExpiry <= 14 ? 'warning' : 'info'

        await supabase.from('notifications').insert({
          project_id: cert.project_id,
          type: 'insurance_expiring',
          title: `Insurance Expiring: ${cert.company_name}`,
          body: `${cert.policy_type} policy from ${cert.carrier} for ${cert.company_name} expires in ${daysUntilExpiry} days (${new Date(cert.expiration_date).toLocaleDateString()}).`,
          severity,
          entity_type: 'insurance_certificate',
          entity_id: cert.id,
        })
      }

      // Send email to subcontractor contact
      if (cert.contact_email) {
        await sendExpirationEmail(
          cert.contact_email,
          cert.company_name,
          cert.policy_type,
          cert.carrier,
          daysUntilExpiry,
          cert.expiration_date,
        )
      }

      // Update alert tracking
      await supabase.from('insurance_certificates').update({
        last_alert_sent_at: now.toISOString(),
        last_alert_days: alertThreshold,
      }).eq('id', cert.id)

      alertsSent++
    }

    return new Response(
      JSON.stringify({ processed: certs.length, alertsSent, certsExpired }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return errorResponse(error, cors)
  }
})

// ── Email Alert ─────────────────────────────────────────

async function sendExpirationEmail(
  to: string,
  companyName: string,
  policyType: string,
  carrier: string,
  daysUntilExpiry: number,
  expirationDate: string,
): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return

  const urgencyColor = daysUntilExpiry <= 7 ? '#C93B3B' : daysUntilExpiry <= 14 ? '#C4850C' : '#3A7BC8'
  const urgencyLabel = daysUntilExpiry <= 7 ? 'URGENT' : daysUntilExpiry <= 14 ? 'ACTION REQUIRED' : 'REMINDER'

  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
      <div style="border-bottom: 2px solid #F47820; padding-bottom: 16px; margin-bottom: 24px;">
        <h2 style="color: #1A1613; margin: 0;">SiteSync PM</h2>
      </div>
      <div style="background: ${urgencyColor}; color: white; padding: 8px 16px; border-radius: 6px; margin-bottom: 16px; font-weight: 600; font-size: 12px; display: inline-block;">
        ${urgencyLabel}: INSURANCE EXPIRING IN ${daysUntilExpiry} DAYS
      </div>
      <h3 style="color: #1A1613; margin: 0 0 16px;">Certificate of Insurance Expiring</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <tr><td style="padding: 8px; color: #5C5550; font-size: 13px; border-bottom: 1px solid #E5E1DC;">Company</td><td style="padding: 8px; color: #1A1613; font-size: 13px; border-bottom: 1px solid #E5E1DC; font-weight: 600;">${companyName}</td></tr>
        <tr><td style="padding: 8px; color: #5C5550; font-size: 13px; border-bottom: 1px solid #E5E1DC;">Policy Type</td><td style="padding: 8px; color: #1A1613; font-size: 13px; border-bottom: 1px solid #E5E1DC;">${policyType}</td></tr>
        <tr><td style="padding: 8px; color: #5C5550; font-size: 13px; border-bottom: 1px solid #E5E1DC;">Carrier</td><td style="padding: 8px; color: #1A1613; font-size: 13px; border-bottom: 1px solid #E5E1DC;">${carrier}</td></tr>
        <tr><td style="padding: 8px; color: #5C5550; font-size: 13px;">Expiration Date</td><td style="padding: 8px; color: ${urgencyColor}; font-size: 13px; font-weight: 600;">${new Date(expirationDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</td></tr>
      </table>
      <p style="color: #5C5550; font-size: 14px; line-height: 1.6;">
        Please upload an updated Certificate of Insurance to SiteSync PM to maintain compliance. Failure to provide updated insurance may result in restricted access to the project site.
      </p>
      <p style="color: #9A9490; font-size: 12px; margin: 24px 0 0; border-top: 1px solid #E5E1DC; padding-top: 12px;">
        Sent via SiteSync PM. Contact your project manager if you have questions.
      </p>
    </div>
  `

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'SiteSync PM <compliance@sitesync.pm>',
      to: [to],
      subject: `${urgencyLabel}: ${policyType} Insurance Expiring in ${daysUntilExpiry} Days`,
      html,
    }),
  })
}
