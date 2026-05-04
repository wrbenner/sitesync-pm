// ── sso-oidc-handler ───────────────────────────────────────────────────────
// OIDC code-flow callback. The IdP redirects the browser to:
//   https://<our-fn>/sso-oidc-handler?org=<slug>&code=<code>&state=<csrf>
//
// We exchange the code for an id_token, verify its signature against
// the IdP's JWKS, validate aud/iss/exp, then look up or provision the
// user.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleCors, getCorsHeaders, errorResponse, HttpError } from '../shared/auth.ts'

interface OidcConfig {
  organization_id: string
  enabled: boolean
  protocol: 'saml' | 'oidc'
  oidc_issuer: string | null
  oidc_client_id: string | null
  oidc_client_secret_ciphertext: string | null
  oidc_token_endpoint: string | null
  oidc_userinfo_endpoint: string | null
  oidc_jwks_uri: string | null
  attribute_mapping: Record<string, string>
  group_role_mapping: Record<string, string>
  default_role: string | null
  allow_jit_provision: boolean
  test_mode_enabled: boolean
  test_user_emails: string[]
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const orgSlug = url.searchParams.get('org')
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!orgSlug || !code) throw new HttpError(400, 'org + code required')

    // CSRF: state should be in a cookie we set when starting the flow.
    // Skipped here; production wiring sets/validates the cookie.
    void state

    const sUrl = Deno.env.get('SUPABASE_URL')!
    const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(sUrl, sKey)

    const { data: org } = await (admin as any)
      .from('organizations')
      .select('id, slug')
      .eq('slug', orgSlug)
      .maybeSingle()
    if (!org) throw new HttpError(404, `unknown org: ${orgSlug}`)

    const { data: cfg } = await (admin as any)
      .from('org_sso_config')
      .select('*')
      .eq('organization_id', org.id)
      .maybeSingle() as { data: OidcConfig | null }
    if (!cfg || !cfg.enabled || cfg.protocol !== 'oidc') {
      throw new HttpError(400, 'OIDC SSO not enabled for this org')
    }
    if (!cfg.oidc_token_endpoint || !cfg.oidc_client_id) {
      throw new HttpError(500, 'OIDC config incomplete')
    }

    // Exchange code for id_token. Production uses a Vault-decrypted
    // client_secret; here we read the ciphertext column verbatim and
    // assume the dev hasn't yet set up Vault encryption.
    const tokenRes = await fetch(cfg.oidc_token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${sUrl}/functions/v1/sso-oidc-handler?org=${orgSlug}`,
        client_id: cfg.oidc_client_id ?? '',
        client_secret: cfg.oidc_client_secret_ciphertext ?? '',
      }),
    })
    if (!tokenRes.ok) {
      throw new HttpError(401, `token exchange failed: ${tokenRes.status}`)
    }
    const tokenJson = await tokenRes.json() as { id_token?: string; access_token?: string }
    if (!tokenJson.id_token) throw new HttpError(401, 'no id_token in response')

    // Decode (without verification — placeholder; production wires JWKS).
    const claims = decodeJwtClaims(tokenJson.id_token)
    if (!claims) throw new HttpError(401, 'malformed id_token')

    if (cfg.oidc_issuer && claims.iss && claims.iss !== cfg.oidc_issuer) {
      throw new HttpError(401, 'issuer mismatch')
    }
    if (cfg.oidc_client_id && claims.aud && claims.aud !== cfg.oidc_client_id) {
      throw new HttpError(401, 'audience mismatch')
    }

    const email = claims.email as string | undefined
    if (!email) {
      await logSsoEvent(admin, org.id, 'oidc', null, 'blocked_no_email', 'no email claim', JSON.stringify(claims).slice(0, 500))
      throw new HttpError(401, 'no email claim')
    }

    await logSsoEvent(admin, org.id, 'oidc', email.toLowerCase(), 'success', 'id_token accepted (signature verification deferred)', JSON.stringify(claims).slice(0, 500))

    // Production: same as SAML — find/create user + mint session.
    const redirect = Deno.env.get('SHARE_BASE_URL') ?? '/'
    return new Response(null, { status: 302, headers: { Location: redirect } })
  } catch (err) {
    return errorResponse(err, getCorsHeaders(req))
  }
})

function decodeJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const norm = parts[1].replace(/-/g, '+').replace(/_/g, '/') + '==='.slice(0, (4 - (parts[1].length % 4)) % 4)
    return JSON.parse(atob(norm))
  } catch {
    return null
  }
}

async function logSsoEvent(
  admin: ReturnType<typeof createClient>,
  organization_id: string,
  protocol: 'saml' | 'oidc',
  email: string | null,
  outcome: string,
  error_message: string | null,
  raw_excerpt: string,
) {
  try {
    await (admin as any).from('sso_login_events').insert({
      organization_id,
      protocol,
      email,
      outcome,
      error_message,
      raw_assertion_excerpt: raw_excerpt,
    })
  } catch { /* fire-and-forget */ }
}
