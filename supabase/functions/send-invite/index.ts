// ── send-invite Edge Function ────────────────────────────────
// Phase 7: Team invitation generation + email delivery.
// Adapted from sitesyncai-backend-main/src/invite/invite.service.ts.
//
// Enhancements:
// - Per-project invitations (project_ids[])
// - Bulk invite (array of emails)
// - Re-send logic for existing pending invites
// - Revoke action


import { create as createJwt, getNumericDate } from 'https://deno.land/x/djwt@v2.9.1/mod.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  authenticateRequest,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'

type Role = 'owner' | 'admin' | 'pm' | 'editor' | 'viewer'

interface InviteBody {
  action?: 'invite' | 'revoke' | 'verify'
  emails?: string[]
  email?: string
  role?: Role
  organization_id: string
  organization_name?: string
  project_ids?: string[]
  expires_hours?: number
  invite_id?: string
  token?: string
}

const _INVITE_TTL_SECONDS = 48 * 60 * 60

async function signInviteToken(
  secret: string,
  payload: {
    email: string
    role: Role
    organization_id: string
    project_ids: string[]
    invite_id: string
  },
  ttlSeconds: number,
): Promise<string> {
  const keyData = new TextEncoder().encode(secret)
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
  return await createJwt(
    { alg: 'HS256', typ: 'JWT' },
    { ...payload, exp: getNumericDate(ttlSeconds), iss: 'sitesync-invite' },
    key,
  )
}

function inviteEmailHtml(opts: {
  organization_name: string
  accept_url: string
  role: string
  expires_hours: number
  project_count: number
}): string {
  const projScope =
    opts.project_count > 0 ? `${opts.project_count} project${opts.project_count === 1 ? '' : 's'}` : 'your organization'
  return `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;background:#f3f4f6;margin:0;padding:32px">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:32px;text-align:center;color:#fff">
      <h1 style="margin:0;font-size:24px">You're invited to SiteSync</h1>
    </div>
    <div style="padding:32px;color:#1f2937;line-height:1.6">
      <p>You've been invited to join <strong>${opts.organization_name}</strong> on SiteSync AI as a <strong>${opts.role}</strong>.</p>
      <p style="color:#6b7280">Access: ${projScope}</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${opts.accept_url}" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600">Accept Invitation</a>
      </div>
      <p style="color:#6b7280;font-size:14px">This invitation expires in ${opts.expires_hours} hours.</p>
      <p style="color:#9ca3af;font-size:12px;margin-top:32px">If you didn't expect this email, you can safely ignore it.</p>
    </div>
  </div>
</body></html>`
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  if (req.method !== 'POST') {
    return errorResponse(new HttpError(405, 'Method not allowed'), corsHeaders)
  }

  try {
    const auth = await authenticateRequest(req)
    const body = await parseJsonBody<InviteBody>(req)
    const action = body.action ?? 'invite'

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const jwtSecret =
      Deno.env.get('INVITE_JWT_SECRET') ?? Deno.env.get('SUPABASE_JWT_SECRET') ?? ''
    if (!jwtSecret) throw new HttpError(500, 'INVITE_JWT_SECRET not configured', 'config_error')
    const admin = createClient(supabaseUrl, serviceKey)

    // ── Revoke ───────────────────────────────────────────────
    if (action === 'revoke') {
      if (!body.invite_id) throw new HttpError(400, 'invite_id required', 'validation_error')
      const { error } = await admin
        .from('invite_logs')
        .update({ status: 'revoked' })
        .eq('id', body.invite_id)
      if (error) throw new HttpError(500, error.message, 'db_error')
      return new Response(JSON.stringify({ revoked: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // ── Verify token (public accept flow) ────────────────────
    if (action === 'verify') {
      if (!body.token) throw new HttpError(400, 'token required', 'validation_error')
      const { data } = await admin
        .from('invite_logs')
        .select('id, email, role, organization_id, project_ids, status, expires_at')
        .eq('token', body.token)
        .maybeSingle()
      if (!data) throw new HttpError(404, 'Invite not found', 'not_found')
      if (data.status !== 'pending') throw new HttpError(410, `Invite ${data.status}`, 'invite_state')
      if (new Date(data.expires_at).getTime() < Date.now()) {
        await admin.from('invite_logs').update({ status: 'expired' }).eq('id', data.id)
        throw new HttpError(410, 'Invite expired', 'invite_expired')
      }
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // ── Invite (single or bulk) ──────────────────────────────
    const emails = body.emails ?? (body.email ? [body.email] : [])
    if (emails.length === 0) {
      throw new HttpError(400, 'emails or email required', 'validation_error')
    }
    if (!body.organization_id) {
      throw new HttpError(400, 'organization_id required', 'validation_error')
    }
    const role = (body.role ?? 'viewer') as Role
    const expiresHours = body.expires_hours ?? 48
    const ttl = Math.min(expiresHours * 3600, 14 * 24 * 3600) // cap at 14 days

    const appUrl = Deno.env.get('APP_URL') ?? 'https://app.sitesync.ai'
    const results: Array<{ email: string; status: string; invite_id?: string; error?: string }> = []

    for (const rawEmail of emails) {
      const email = String(rawEmail).trim().toLowerCase()
      if (!email || !email.includes('@')) {
        results.push({ email: rawEmail, status: 'skipped', error: 'invalid_email' })
        continue
      }

      // Deduplicate pending invites — update existing row in place.
      const { data: existing } = await admin
        .from('invite_logs')
        .select('id')
        .eq('organization_id', body.organization_id)
        .eq('email', email)
        .eq('status', 'pending')
        .maybeSingle()

      const expiresAt = new Date(Date.now() + ttl * 1000).toISOString()
      const inviteId = existing?.id ?? crypto.randomUUID()
      const token = await signInviteToken(
        jwtSecret,
        {
          email,
          role,
          organization_id: body.organization_id,
          project_ids: body.project_ids ?? [],
          invite_id: inviteId,
        },
        ttl,
      )

      if (existing) {
        await admin
          .from('invite_logs')
          .update({ token, expires_at: expiresAt, role, project_ids: body.project_ids ?? [] })
          .eq('id', existing.id)
      } else {
        const { error: insErr } = await admin.from('invite_logs').insert({
          id: inviteId,
          organization_id: body.organization_id,
          email,
          role,
          project_ids: body.project_ids ?? [],
          invited_by: auth.user.id,
          token,
          status: 'pending',
          expires_at: expiresAt,
        })
        if (insErr) {
          results.push({ email, status: 'failed', error: insErr.message })
          continue
        }
      }

      const acceptUrl = `${appUrl}/accept-invite?token=${encodeURIComponent(token)}`
      const orgName = body.organization_name ?? 'SiteSync'
      const html = inviteEmailHtml({
        organization_name: orgName,
        accept_url: acceptUrl,
        role,
        expires_hours: expiresHours,
        project_count: body.project_ids?.length ?? 0,
      })

      // Delegate email delivery to the send-email function so credentials stay server-side.
      try {
        await admin.functions.invoke('send-email', {
          body: {
            to: email,
            subject: `You're invited to join ${orgName} on SiteSync`,
            html,
          },
        })
        results.push({ email, status: 'sent', invite_id: inviteId })
      } catch (e) {
        results.push({ email, status: 'queued', invite_id: inviteId, error: String(e) })
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
