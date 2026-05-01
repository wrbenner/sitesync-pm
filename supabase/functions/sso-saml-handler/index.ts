// ── sso-saml-handler ───────────────────────────────────────────────────────
// SAML 2.0 AssertionConsumerService (ACS) endpoint. The IdP POSTs the
// SAMLResponse (base64 of the XML assertion) to this URL after the user
// authenticates against the IdP.
//
// Flow:
//   1. Decode + parse the SAMLResponse XML
//   2. Verify signature against the org's saml_x509_certs (allows multiple
//      during rotation)
//   3. Validate audience + issuer + assertion validity window
//   4. Extract attributes per the org's attribute_mapping
//   5. Run decideAccess() → success / blocked / provisioned
//   6. Mint a Supabase session and 302 → app
//   7. Append a row to sso_login_events
//
// What's implemented here is the structural skeleton. Full XML signature
// verification on Deno requires a parser like `xmldsigjs` which isn't
// production-ready in Deno without additional setup. We document this
// gap explicitly + reject any assertion that doesn't carry a signature.
// Production deployment requires wiring an XML-DSig verifier; the
// admin UI surfaces this in the Trust page until it's done.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  handleCors,
  getCorsHeaders,
  errorResponse,
  HttpError,
} from '../shared/auth.ts'

interface SsoConfigRow {
  organization_id: string
  protocol: 'saml' | 'oidc'
  enabled: boolean
  saml_idp_entity_id: string | null
  saml_sp_entity_id: string | null
  saml_x509_certs: string | null
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
    if (req.method !== 'POST') {
      throw new HttpError(405, 'POST required')
    }

    const url = new URL(req.url)
    const orgSlug = url.searchParams.get('org')
    if (!orgSlug) throw new HttpError(400, 'org query param required')

    const form = await req.formData()
    const samlResponseB64 = form.get('SAMLResponse')
    const relayState = form.get('RelayState')
    if (typeof samlResponseB64 !== 'string') {
      throw new HttpError(400, 'SAMLResponse missing')
    }

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
      .maybeSingle() as { data: SsoConfigRow | null }
    if (!cfg || !cfg.enabled || cfg.protocol !== 'saml') {
      throw new HttpError(400, 'SAML SSO not enabled for this org')
    }

    const samlXml = atob(samlResponseB64)
    const issuer = extractTagValue(samlXml, 'saml:Issuer') ?? extractTagValue(samlXml, 'Issuer')
    const audience = extractTagValue(samlXml, 'saml:Audience') ?? extractTagValue(samlXml, 'Audience')

    if (cfg.saml_idp_entity_id && issuer && cfg.saml_idp_entity_id !== issuer) {
      await logSsoEvent(admin, org.id, 'saml', null, 'blocked_signature', `issuer mismatch: ${issuer} ≠ ${cfg.saml_idp_entity_id}`, samlXml.slice(0, 500))
      throw new HttpError(401, 'issuer mismatch')
    }
    if (cfg.saml_sp_entity_id && audience && cfg.saml_sp_entity_id !== audience) {
      await logSsoEvent(admin, org.id, 'saml', null, 'blocked_signature', `audience mismatch: ${audience} ≠ ${cfg.saml_sp_entity_id}`, samlXml.slice(0, 500))
      throw new HttpError(401, 'audience mismatch')
    }

    // Signature verification placeholder. Production deployment must
    // wire an XML-DSig verifier here; until then, refuse unsigned
    // assertions and rely on the issuer/audience checks above as a
    // defense-in-depth measure.
    if (!samlXml.includes('<ds:Signature')) {
      await logSsoEvent(admin, org.id, 'saml', null, 'blocked_signature', 'no signature in assertion', samlXml.slice(0, 500))
      throw new HttpError(401, 'unsigned assertions are rejected')
    }

    // Attribute extraction (best-effort regex scrape — full implementation
    // uses a real XML parser).
    const email = extractAttribute(samlXml, cfg.attribute_mapping?.email ?? 'email')
    if (!email) {
      await logSsoEvent(admin, org.id, 'saml', null, 'blocked_no_email', 'no email attribute', samlXml.slice(0, 500))
      throw new HttpError(401, 'no email attribute in assertion')
    }

    // From here, we'd:
    //   1. Apply test-mode + JIT decisions via the SPA-shared decideAccess
    //   2. Look up or create the auth.users row + insert organization_members
    //   3. Mint a Supabase session via admin.auth.admin.signInWithEmail
    //
    // We stop here because the actual signature verification + Supabase
    // session minting are platform-specific. The migration + lib + this
    // skeleton are the substrate; production wiring happens in the
    // SOC 2 audit prep follow-up.

    await logSsoEvent(admin, org.id, 'saml', email.toLowerCase(), 'success', 'assertion accepted (signature verification deferred)', samlXml.slice(0, 500))

    const redirect = typeof relayState === 'string' && relayState.startsWith('http')
      ? relayState
      : (Deno.env.get('SHARE_BASE_URL') ?? '/')
    return new Response(null, { status: 302, headers: { Location: redirect } })
  } catch (err) {
    return errorResponse(err, getCorsHeaders(req))
  }
})

function extractTagValue(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'))
  return m?.[1]?.trim() ?? null
}

function extractAttribute(xml: string, name: string): string | null {
  const re = new RegExp(`<saml:Attribute[^>]+Name="${name}"[^>]*>[\\s\\S]*?<saml:AttributeValue[^>]*>([^<]+)</saml:AttributeValue>`, 'i')
  const m = xml.match(re)
  return m?.[1]?.trim() ?? null
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
  } catch {
    // never let logging block the main flow
  }
}
