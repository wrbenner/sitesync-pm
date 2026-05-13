// provision-org — BRT subsystem 1 §4.1
//
// Self-serve org provisioning. Called immediately after `auth.signUp()` or
// the OAuth first-time-callback so the new user lands on the dashboard with
// a working org context already in place.
//
// Request:
//   POST /functions/v1/provision-org
//   Authorization: Bearer <user JWT>
//   { "name": "Acme Builders", "slug": "acme" }
//
// Response (201):
//   { "organization_id": "uuid", "slug": "acme" }
//
// Error responses use the standard HttpError envelope from shared/auth.ts.
//
// Atomicity contract: the underlying SQL function `provision_organization()`
// runs the org insert + owner membership + audit-log entry in a single
// statement; failure of any step rolls the whole thing back. The edge fn
// itself adds: input validation, auth gating, duplicate-membership detection
// (idempotent retry returns the existing org for the same owner+slug), and
// telemetry hooks.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  sanitizeString,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'

interface ProvisionOrgRequest {
  name: string
  slug?: string
  metadata?: Record<string, unknown>
  turnstile_token?: string
}

// BRT sub-2 §4.2 — Cloudflare Turnstile server-side verification.
// Returns true if the token is valid (or if no secret is configured, in
// which case the function is opted out of CAPTCHA — useful for local dev
// without the CF dashboard config). The widget passes 'DEV_BYPASS' when
// the public site key is unset; we accept it only when the secret is also
// unset, so production builds with the secret cannot be bypassed.
async function verifyTurnstile(token: string | undefined, clientIp: string | null): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret) return true // CAPTCHA opt-out (dev / not-yet-configured)
  if (!token) return false
  if (token === 'DEV_BYPASS') return false // explicit reject — secret is set

  try {
    const formData = new URLSearchParams()
    formData.append('secret', secret)
    formData.append('response', token)
    if (clientIp) formData.append('remoteip', clientIp)

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) return false
    const json = (await res.json()) as { success?: boolean; 'error-codes'?: string[] }
    return Boolean(json.success)
  } catch (err) {
    console.error('[provision-org] turnstile siteverify error:', err)
    return false
  }
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const corsHeaders = getCorsHeaders(req)

  try {
    if (req.method !== 'POST') {
      throw new HttpError(405, 'Method not allowed')
    }

    // 1. Authenticate the caller — must be a logged-in user.
    const { user } = await authenticateRequest(req)

    // 2. Parse + validate the body.
    const body = await parseJsonBody<ProvisionOrgRequest>(req)
    if (!body.name || typeof body.name !== 'string') {
      throw new HttpError(400, 'name is required')
    }
    const name = sanitizeString(body.name, 200)
    if (name.length < 2) {
      throw new HttpError(400, 'name must be at least 2 characters')
    }
    const slug = typeof body.slug === 'string' ? sanitizeString(body.slug, 100) : ''
    const metadata = body.metadata && typeof body.metadata === 'object'
      ? body.metadata
      : {}

    // 2a. BRT sub-2 §4.2 — Cloudflare Turnstile server-side verify. Opt-out
    //     path: when TURNSTILE_SECRET_KEY is unset (local dev), the check
    //     passes through; production builds set the secret, which forces
    //     a real token + siteverify success.
    const clientIp = req.headers.get('CF-Connecting-IP')
      ?? req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
      ?? null
    const turnstileOk = await verifyTurnstile(body.turnstile_token, clientIp)
    if (!turnstileOk) {
      throw new HttpError(403, 'Human-verification challenge failed. Please refresh and try again.')
    }

    // 3. Idempotency check — if the user already owns an org with the same
    //    slug-or-name, return that one rather than creating a duplicate.
    //    This makes the endpoint safe to retry from the frontend.
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data: existingOrgs } = await adminClient
      .from('organization_members')
      .select('organization_id, organizations:organizations(id, name, slug)')
      .eq('user_id', user.id)
      .eq('role', 'owner')

    type ExistingMember = {
      organization_id: string
      organizations: { id: string; name: string; slug: string | null } | null
    }
    const dupe = (existingOrgs as ExistingMember[] | null | undefined)?.find(
      (row) =>
        row.organizations &&
        (row.organizations.name === name ||
          (slug && row.organizations.slug === slug.toLowerCase())),
    )
    if (dupe?.organizations) {
      return new Response(
        JSON.stringify({
          organization_id: dupe.organizations.id,
          slug: dupe.organizations.slug,
          existing: true,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    // 4. Atomic provision via the SQL function.
    const { data, error } = await adminClient.rpc('provision_organization', {
      p_name: name,
      p_slug: slug,
      p_owner: user.id,
      p_metadata: metadata,
    })

    if (error) {
      console.error('provision_organization RPC failed:', error)
      throw new HttpError(500, error.message || 'Failed to provision organization')
    }

    if (!data || typeof data !== 'string') {
      throw new HttpError(500, 'provision_organization returned no id')
    }

    // 5. Look up the resolved slug (the SQL fn may have appended -2/-3 etc.)
    //    so the client can route to the right URL on success.
    const { data: orgRow } = await adminClient
      .from('organizations')
      .select('slug')
      .eq('id', data)
      .single()

    return new Response(
      JSON.stringify({
        organization_id: data,
        slug: orgRow?.slug ?? slug,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    )
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
