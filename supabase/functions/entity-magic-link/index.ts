// ── entity-magic-link ───────────────────────────────────────────────────────
// Mints a per-entity, time-limited share token for a non-app-user (the
// architect / owner counsel). The link looks like:
//
//   https://app.sitesync.example/share/<entity_type>/<entity_id>?t=<jwt>
//
// The JWT is signed with the function's MAGIC_LINK_SECRET; the SHA-256
// of the token is stored in magic_link_tokens.token_hash. The original
// token is emitted ONCE in the response and never persisted.
//
// Two endpoints:
//   POST  { entity_type, entity_id, project_id, recipient_email, scope }
//         → mints a token, writes the row, sends an email (if RESEND_API_KEY set),
//           returns { share_url }
//   GET   ?token=...&entity_type=...&entity_id=...
//         → validates the token (hash compare + expiry + revoked check),
//           records access, returns { ok: true, scope, project_id }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  verifyProjectMembership,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  requireUuid,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'

const MAGIC_LINK_SECRET = Deno.env.get('MAGIC_LINK_SECRET') ?? Deno.env.get('SUPABASE_JWT_SECRET') ?? ''
const SHARE_BASE_URL = Deno.env.get('SHARE_BASE_URL') ?? 'https://app.sitesync.example/sitesync-pm/#/share'

interface MintBody {
  // 'owner_portal' is project-scoped (no entity_id) — used by the Reports
  // page's "Generate share link" flow on the Owner Update card.
  entity_type: 'rfi' | 'submittal' | 'change_order' | 'punch_item' | 'owner_portal'
  /** Required for entity-scoped tokens; ignored for owner_portal. */
  entity_id?: string
  project_id: string
  /** Required for entity-scoped tokens; optional for owner_portal share links. */
  recipient_email?: string
  scope?: 'view' | 'comment'
  /** TTL in hours; default 14 days. */
  ttl_hours?: number
}

interface ValidateQuery {
  token: string
  entity_type: string
  entity_id: string
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    if (req.method === 'GET') {
      return await handleValidate(url)
    }
    return await handleMint(req)
  } catch (err) {
    return errorResponse(err, getCorsHeaders(req))
  }
})

// ── Mint ────────────────────────────────────────────────────────────

async function handleMint(req: Request): Promise<Response> {
  if (!MAGIC_LINK_SECRET) {
    throw new HttpError(500, 'MAGIC_LINK_SECRET not configured')
  }
  const body = await parseJsonBody<MintBody>(req)
  const projectId = requireUuid(body.project_id, 'project_id')
  const isOwnerPortal = body.entity_type === 'owner_portal'
  // Entity-scoped tokens must carry an entity_id; owner_portal tokens do not.
  const entityId = isOwnerPortal ? projectId : requireUuid(body.entity_id ?? '', 'entity_id')

  const ALLOWED = ['rfi', 'submittal', 'change_order', 'punch_item', 'owner_portal']
  if (!ALLOWED.includes(body.entity_type)) {
    throw new HttpError(400, 'unknown entity_type')
  }
  if (!isOwnerPortal && (!body.recipient_email || !body.recipient_email.includes('@'))) {
    throw new HttpError(400, 'recipient_email required')
  }
  const scope = body.scope ?? 'view'
  if (!['view', 'comment'].includes(scope)) {
    throw new HttpError(400, 'scope must be "view" or "comment"')
  }

  const { user, supabase: userSb } = await authenticateRequest(req)
  await verifyProjectMembership(userSb, user.id, projectId)

  const ttlHours = body.ttl_hours ?? 14 * 24
  const expiresAt = new Date(Date.now() + ttlHours * 3_600_000).toISOString()

  // JWT payload — entity-scoped. Anyone holding the token can read this
  // (and only this) entity; the validate endpoint enforces it server-side.
  const payload = {
    iss: 'sitesync-magic-link',
    sub: body.recipient_email,
    aud: `${body.entity_type}:${entityId}`,
    pid: projectId,
    scope,
    exp: Math.floor(Date.parse(expiresAt) / 1000),
    iat: Math.floor(Date.now() / 1000),
    nonce: crypto.randomUUID(),
  }
  const token = await signJwt(payload, MAGIC_LINK_SECRET)
  const tokenHash = await sha256(token)

  const sUrl = Deno.env.get('SUPABASE_URL')!
  const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(sUrl, sKey)

  const { error: insertErr } = await (admin as any).from('magic_link_tokens').insert({
    project_id: projectId,
    entity_type: body.entity_type,
    entity_id: entityId,
    scope,
    recipient_email: (body.recipient_email ?? '').trim().toLowerCase() || null,
    token_hash: tokenHash,
    issued_by: user.id,
    expires_at: expiresAt,
  })
  if (insertErr) throw new HttpError(500, `mint: ${insertErr.message}`)

  // Owner-portal share URL is rooted at /#/owner/<token> and resolves to the
  // MagicLinkOwnerRoute component, which validates and renders OwnerStream.
  // Entity-scoped tokens keep the legacy /share/<entity_type>/<entity_id>?t=
  // shape so existing links still work.
  const shareBase = SHARE_BASE_URL.replace(/\/share\/?$/, '')
  const shareUrl = isOwnerPortal
    ? `${shareBase}/owner/${token}`
    : `${SHARE_BASE_URL}/${body.entity_type}/${entityId}?t=${token}`

  // Best-effort email — uses Resend if configured, otherwise just returns the URL.
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (resendKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: Deno.env.get('SENDER_EMAIL') ?? 'no-reply@sitesync.example',
          to: body.recipient_email,
          subject: `Shared with you: ${body.entity_type.toUpperCase()} on SiteSync`,
          html: `<p>You've been shared a ${body.entity_type} record.</p>
                 <p><a href="${shareUrl}">Open it now</a> — link expires ${expiresAt}.</p>
                 <p style="color:#666;font-size:11px">If you didn't expect this, ignore the email.</p>`,
        }),
      })
    } catch {
      // Email failure shouldn't block the response — caller can copy the URL.
    }
  }

  return new Response(
    JSON.stringify({ ok: true, share_url: shareUrl, expires_at: expiresAt, scope }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

// ── Validate ────────────────────────────────────────────────────────

async function handleValidate(url: URL): Promise<Response> {
  const token = url.searchParams.get('token')
  const entityType = url.searchParams.get('entity_type')
  const entityId = url.searchParams.get('entity_id')
  // Owner-portal validation only carries the token — type and id are
  // recovered from the JWT payload + the magic_link_tokens row.
  const isOwnerPortalProbe = !entityType && !entityId

  if (!token || (!isOwnerPortalProbe && (!entityType || !entityId))) {
    throw new HttpError(400, 'token required (entity_type+entity_id required for entity-scoped links)')
  }

  const verified = await verifyJwt(token, MAGIC_LINK_SECRET)
  if (!verified.ok || !verified.payload) {
    throw new HttpError(401, 'invalid token')
  }
  const p = verified.payload
  if (!isOwnerPortalProbe && p.aud !== `${entityType}:${entityId}`) {
    throw new HttpError(403, 'token scope mismatch')
  }
  if (p.exp && Date.now() / 1000 > p.exp) {
    throw new HttpError(401, 'token expired')
  }

  const sUrl = Deno.env.get('SUPABASE_URL')!
  const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(sUrl, sKey)

  const tokenHash = await sha256(token)
  const { data: row, error: fetchErr } = await (admin as any)
    .from('magic_link_tokens')
    .select('id, scope, project_id, entity_type, expires_at, revoked_at, recipient_email')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (fetchErr) throw new HttpError(500, `validate: ${fetchErr.message}`)
  if (!row) throw new HttpError(401, 'token not found')
  if (row.revoked_at) throw new HttpError(401, 'token revoked')
  if (isOwnerPortalProbe && row.entity_type !== 'owner_portal') {
    throw new HttpError(403, 'not an owner_portal token')
  }

  // Best-effort access log.
  await (admin as any)
    .from('magic_link_tokens')
    .update({
      accessed_count: ((row as any).accessed_count ?? 0) + 1,
      first_accessed_at: (row as any).first_accessed_at ?? new Date().toISOString(),
      last_accessed_at: new Date().toISOString(),
    })
    .eq('id', row.id)

  // For owner_portal tokens, surface project name/address on validation so
  // the OwnerStream branded header can render without a second round-trip.
  let projectName: string | null = null
  let projectAddress: string | null = null
  let companyId: string | null = null
  if (row.entity_type === 'owner_portal') {
    const { data: proj } = await (admin as any)
      .from('projects')
      .select('name, address, company_id')
      .eq('id', row.project_id)
      .maybeSingle()
    if (proj) {
      projectName = (proj as any).name ?? null
      projectAddress = (proj as any).address ?? null
      companyId = (proj as any).company_id ?? null
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      scope: row.scope,
      project_id: row.project_id,
      entity_type: row.entity_type,
      expires_at: row.expires_at,
      magic_link_token_id: row.id,
      // Owner-portal extras (null for entity-scoped tokens):
      project_name: projectName,
      project_address: projectAddress,
      company_id: companyId,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

// ── JWT helpers ────────────────────────────────────────────────────

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function b64urlDecode(s: string): Uint8Array {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice(0, (4 - (s.length % 4)) % 4)
  const bin = atob(norm)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmacSha256(secret: string, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg))
  return new Uint8Array(sig)
}

async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const headerB = b64urlEncode(new TextEncoder().encode(JSON.stringify(header)))
  const payloadB = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)))
  const data = `${headerB}.${payloadB}`
  const sig = await hmacSha256(secret, data)
  return `${data}.${b64urlEncode(sig)}`
}

async function verifyJwt(token: string, secret: string): Promise<{ ok: boolean; payload?: Record<string, any> }> {
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false }
  const [headerB, payloadB, sigB] = parts
  const data = `${headerB}.${payloadB}`
  const expected = await hmacSha256(secret, data)
  const actual = b64urlDecode(sigB)
  if (expected.length !== actual.length) return { ok: false }
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i]
  if (diff !== 0) return { ok: false }
  try {
    const json = new TextDecoder().decode(b64urlDecode(payloadB))
    return { ok: true, payload: JSON.parse(json) }
  } catch {
    return { ok: false }
  }
}
