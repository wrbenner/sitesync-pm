// ── COI Expiration Watcher ──────────────────────────────────
// Daily 6am cron. Walks insurance_certificates and:
//   1. Sends 14 / 7 / 3 / 1-day reminder emails (via send-email if available;
//      falls back to a notifications row + a coi_expiration_alerts row marked
//      'no_email_configured' so we have a paper trail).
//   2. Inserts coi_check_in_blocks rows for any cert that has expired AND
//      doesn't already have an active block.
//
// Idempotent: re-running on the same day will not duplicate emails (we track
// reminder_thresholds_sent on insurance_certificates) or blocks (unique index).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateCron,
  handleCors,
  getCorsHeaders,
  errorResponse,
} from '../shared/auth.ts'

const REMINDER_THRESHOLDS = [14, 7, 3, 1] as const

interface CertRow {
  id: string
  project_id: string | null
  subcontractor_id: string | null
  company: string
  policy_type: string | null
  expiration_date: string | null
  effective_date: string | null
  verified: boolean | null
  reminder_thresholds_sent: number[] | null
  contact_email?: string | null
}

function daysUntil(expirationDate: string, now: Date): number {
  const t = new Date(expirationDate).getTime()
  if (!Number.isFinite(t)) return Number.NaN
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).getTime()
  return Math.ceil((t - today) / (1000 * 60 * 60 * 24))
}

function pickThreshold(
  cert: CertRow,
  now: Date,
): typeof REMINDER_THRESHOLDS[number] | null {
  if (!cert.expiration_date) return null
  const days = daysUntil(cert.expiration_date, now)
  if (!Number.isFinite(days) || days <= 0 || days > REMINDER_THRESHOLDS[0]) return null
  const sent = cert.reminder_thresholds_sent ?? []
  for (const t of REMINDER_THRESHOLDS) {
    if (days <= t && !sent.includes(t)) return t
  }
  return null
}

function reminderEmailHtml(opts: {
  company: string
  policyType: string
  expirationDate: string
  daysUntilExpiry: number
}): string {
  const urgency =
    opts.daysUntilExpiry <= 1
      ? 'CRITICAL'
      : opts.daysUntilExpiry <= 3
      ? 'URGENT'
      : opts.daysUntilExpiry <= 7
      ? 'ACTION REQUIRED'
      : 'REMINDER'
  return `<!doctype html>
<html><body style="font-family:'Inter',Arial,sans-serif;background:#f5f3f0;margin:0;padding:32px">
  <div style="max-width:560px;margin:auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e1dc">
    <div style="background:#F47820;padding:18px 24px;color:#fff">
      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.9">${urgency}</div>
      <h2 style="margin:6px 0 0;font-size:20px">COI expires in ${opts.daysUntilExpiry} day${opts.daysUntilExpiry === 1 ? '' : 's'}</h2>
    </div>
    <div style="padding:24px;color:#1A1613;line-height:1.6;font-size:14px">
      <p><strong>${opts.company}</strong> — your <strong>${opts.policyType ?? 'insurance'}</strong> certificate expires on <strong>${new Date(opts.expirationDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>.</p>
      <p>Upload a current Certificate of Insurance to SiteSync PM before it lapses. Once the certificate expires, your crew will be unable to check in to the site until a renewal is on file.</p>
      <p style="color:#9A9490;font-size:12px;margin-top:24px;border-top:1px solid #E5E1DC;padding-top:12px">SiteSync PM compliance gate.</p>
    </div>
  </div>
</body></html>`
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const cors = getCorsHeaders(req)

  try {
    const supabase: ReturnType<typeof createClient> = authenticateCron(req)
    const now = new Date()

    // Pull every cert that could plausibly need attention: expiring within 14 days
    // OR already expired but possibly missing a block row.
    const horizon = new Date()
    horizon.setUTCDate(horizon.getUTCDate() + REMINDER_THRESHOLDS[0])

    const { data: certs, error } = await supabase
      .from('insurance_certificates')
      .select(
        'id, project_id, subcontractor_id, company, policy_type, expiration_date, effective_date, verified, reminder_thresholds_sent, contact_email',
      )
      .lte('expiration_date', horizon.toISOString())

    if (error) throw error
    const rows = (certs ?? []) as CertRow[]

    let remindersSent = 0
    let remindersLogged = 0
    let blocksCreated = 0

    for (const cert of rows) {
      // ── 1. Reminders ──
      if (cert.verified && cert.expiration_date) {
        const threshold = pickThreshold(cert, now)
        if (threshold) {
          const days = daysUntil(cert.expiration_date, now)
          const emailHtml = reminderEmailHtml({
            company: cert.company,
            policyType: cert.policy_type ?? 'insurance',
            expirationDate: cert.expiration_date,
            daysUntilExpiry: days,
          })

          // Try send-email; if no email configured, log the gap so the PM can
          // see we attempted but had nowhere to deliver.
          let delivery: 'sent' | 'failed' | 'no_email_configured' = 'no_email_configured'
          let failureReason: string | null = null
          if (cert.contact_email) {
            try {
              await supabase.functions.invoke('send-email', {
                body: {
                  to: cert.contact_email,
                  subject: `COI expiring in ${days} day${days === 1 ? '' : 's'}: ${cert.company}`,
                  html: emailHtml,
                },
              })
              delivery = 'sent'
              remindersSent++
            } catch (e) {
              delivery = 'failed'
              failureReason = String(e)
            }
          } else {
            remindersLogged++
          }

          await supabase.from('coi_expiration_alerts').insert({
            insurance_certificate_id: cert.id,
            project_id: cert.project_id,
            threshold_days: threshold,
            channel: 'email',
            recipient: cert.contact_email,
            delivery_status: delivery,
            failure_reason: failureReason,
            created_via: 'cron',
          })

          // Mark the threshold as sent so we don't re-spam tomorrow.
          const sent = cert.reminder_thresholds_sent ?? []
          if (!sent.includes(threshold)) {
            await supabase
              .from('insurance_certificates')
              .update({
                reminder_thresholds_sent: [...sent, threshold],
                last_reminder_sent_at: now.toISOString(),
              })
              .eq('id', cert.id)
          }

          // Also write a notifications row for the project so the PM sees it.
          if (cert.project_id) {
            await supabase.from('notifications').insert({
              project_id: cert.project_id,
              type: 'ai_alert', // closest match in the existing CHECK enum
              title: `COI expiring in ${days} day${days === 1 ? '' : 's'}: ${cert.company}`,
              body: `${cert.policy_type ?? 'Insurance'} for ${cert.company} expires ${new Date(cert.expiration_date).toLocaleDateString()}.`,
              read: false,
            })
          }
        }
      }

      // ── 2. Block rows ──
      if (cert.expiration_date && cert.project_id) {
        const days = daysUntil(cert.expiration_date, now)
        if (days <= 0) {
          // Skip if already blocked.
          const { data: existing } = await supabase
            .from('coi_check_in_blocks')
            .select('id, overridden_at, block_until')
            .eq('project_id', cert.project_id)
            .eq('insurance_certificate_id', cert.id)
            .is('overridden_at', null)
            .maybeSingle()

          if (!existing) {
            const { error: insErr } = await supabase
              .from('coi_check_in_blocks')
              .insert({
                project_id: cert.project_id,
                subcontractor_id: cert.subcontractor_id,
                insurance_certificate_id: cert.id,
                company_name: cert.company,
                expired_on: cert.expiration_date,
                reason: 'coi_expired',
                created_via: 'cron',
              })
            if (!insErr) blocksCreated++
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        scanned: rows.length,
        remindersSent,
        remindersLogged,
        blocksCreated,
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return errorResponse(e, cors)
  }
})
