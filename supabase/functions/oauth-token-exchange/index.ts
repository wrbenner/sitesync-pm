// OAuth Token Exchange Edge Function
// Handles OAuth2 authorization code exchange and token refresh for all integration providers.
// Tokens are stored encrypted in the integrations.config JSONB column.
// NEVER exposes client secrets or access tokens to the frontend.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  verifyProjectMembership,
  requireMinimumRole,
  handleCors,
  getCorsHeaders,
  errorResponse,
  HttpError,
  parseJsonBody,
  requireUuid,
} from '../shared/auth.ts'

// ── Provider OAuth Configs ──────────────────────────────

interface OAuthProviderConfig {
  tokenUrl: string
  revokeUrl?: string
  scopes: string[]
}

const PROVIDER_CONFIGS: Record<string, OAuthProviderConfig> = {
  quickbooks: {
    tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    revokeUrl: 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke',
    scopes: ['com.intuit.quickbooks.accounting'],
  },
  google_drive: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  },
  autodesk_bim360: {
    tokenUrl: 'https://developer.api.autodesk.com/authentication/v2/token',
    revokeUrl: 'https://developer.api.autodesk.com/authentication/v2/revoke',
    scopes: ['data:read', 'data:write', 'account:read'],
  },
  sharepoint: {
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    revokeUrl: undefined,
    scopes: ['Files.ReadWrite.All', 'Sites.ReadWrite.All', 'offline_access'],
  },
  docusign: {
    tokenUrl: 'https://account-d.docusign.com/oauth/token',
    revokeUrl: 'https://account-d.docusign.com/oauth/revoke',
    scopes: ['signature', 'impersonation'],
  },
}

// ── Token Encryption (AES-GCM) ──────────────────────────
// Tokens are encrypted at rest using a 32-byte key from OAUTH_ENCRYPTION_KEY
// (base64). Each token uses a fresh 12-byte IV. Ciphertext format is
// "v1:<base64-iv>:<base64-ciphertext>". Plain-text fallback is refused — if
// the env key is missing we fail closed rather than store secrets in clear.

async function getEncryptionKey(): Promise<CryptoKey> {
  const b64 = Deno.env.get('OAUTH_ENCRYPTION_KEY')
  if (!b64) {
    throw new HttpError(500, 'OAUTH_ENCRYPTION_KEY is not configured')
  }
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  if (raw.length !== 32) {
    throw new HttpError(500, 'OAUTH_ENCRYPTION_KEY must decode to 32 bytes')
  }
  return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

function toB64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromB64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

async function encryptToken(plain: string | null | undefined): Promise<string | null> {
  if (plain == null) return null
  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain))
  return `v1:${toB64(iv)}:${toB64(new Uint8Array(ct))}`
}

async function decryptToken(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null
  // Backwards compatibility: pre-encryption plain-text values.
  if (!stored.startsWith('v1:')) return stored
  const [, ivB64, ctB64] = stored.split(':')
  if (!ivB64 || !ctB64) return null
  const key = await getEncryptionKey()
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64) },
    key,
    fromB64(ctB64),
  )
  return new TextDecoder().decode(pt)
}

// ── Request Types ───────────────────────────────────────

interface ExchangeRequest {
  provider: string
  code: string
  redirectUri: string
  projectId: string
  integrationId?: string // For refreshing existing integration
}

interface RefreshRequest {
  integrationId: string
  projectId: string
}

// ── Handler ─────────────────────────────────────────────

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const cors = getCorsHeaders(req)

  try {
    const { user, supabase } = await authenticateRequest(req)
    const url = new URL(req.url)
    const action = url.pathname.split('/').pop() // 'exchange' or 'refresh'

    if (action === 'exchange') {
      return await handleExchange(req, user, supabase, cors)
    } else if (action === 'refresh') {
      return await handleRefresh(req, user, supabase, cors)
    } else {
      throw new HttpError(400, 'Invalid action. Use /exchange or /refresh')
    }
  } catch (error) {
    return errorResponse(error, cors)
  }
})

// ── Exchange Authorization Code for Tokens ──────────────

async function handleExchange(
  req: Request,
  user: { id: string; email: string },
  supabase: ReturnType<typeof createClient>,
  cors: Record<string, string>,
): Promise<Response> {
  const body = await parseJsonBody<ExchangeRequest>(req)
  const { provider, code, redirectUri, projectId, integrationId } = body

  if (!provider || !code || !redirectUri || !projectId) {
    throw new HttpError(400, 'Missing required fields: provider, code, redirectUri, projectId')
  }

  requireUuid(projectId, 'projectId')
  const role = await verifyProjectMembership(supabase, user.id, projectId)
  requireMinimumRole(role, 'admin', 'manage integrations')

  const config = PROVIDER_CONFIGS[provider]
  if (!config) {
    throw new HttpError(400, `Unsupported OAuth provider: ${provider}`)
  }

  // Get client credentials from environment (NEVER from frontend)
  const clientId = Deno.env.get(`OAUTH_${provider.toUpperCase()}_CLIENT_ID`)
  const clientSecret = Deno.env.get(`OAUTH_${provider.toUpperCase()}_CLIENT_SECRET`)

  if (!clientId || !clientSecret) {
    throw new HttpError(500, `OAuth not configured for ${provider}`)
  }

  // Exchange code for tokens
  const tokenResponse = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!tokenResponse.ok) {
    const errBody = await tokenResponse.text()
    console.error('Token exchange failure body:', errBody)
    throw new HttpError(502, `Token exchange failed: ${tokenResponse.status}`)
  }

  const tokens = await tokenResponse.json()
  const now = new Date()
  const expiresAt = tokens.expires_in
    ? new Date(now.getTime() + tokens.expires_in * 1000).toISOString()
    : null

  // Store tokens in integration config. Access/refresh tokens are AES-GCM
  // encrypted; scope/expiry/type remain plain metadata.
  const tokenData = {
    accessToken: await encryptToken(tokens.access_token),
    refreshToken: await encryptToken(tokens.refresh_token ?? null),
    tokenExpiry: expiresAt,
    scope: tokens.scope ?? config.scopes.join(' '),
    tokenType: tokens.token_type ?? 'Bearer',
    encrypted: true,
  }

  if (integrationId) {
    // Update existing integration
    await supabase.from('integrations').update({
      config: tokenData,
      status: 'connected',
      last_sync: now.toISOString(),
      error_log: [],
    }).eq('id', integrationId)
  } else {
    // Create new integration record
    const { data, error } = await supabase.from('integrations').insert({
      type: provider,
      status: 'connected',
      config: tokenData,
      created_by: user.id,
      last_sync: now.toISOString(),
    }).select('id').single()

    if (error) throw new HttpError(500, 'Failed to create integration record')

    return new Response(
      JSON.stringify({ integrationId: data.id, expiresAt }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({ integrationId, expiresAt }),
    { headers: { ...cors, 'Content-Type': 'application/json' } },
  )
}

// ── Refresh Expired Tokens ──────────────────────────────

async function handleRefresh(
  req: Request,
  user: { id: string; email: string },
  supabase: ReturnType<typeof createClient>,
  cors: Record<string, string>,
): Promise<Response> {
  const body = await parseJsonBody<RefreshRequest>(req)
  requireUuid(body.integrationId, 'integrationId')
  requireUuid(body.projectId, 'projectId')

  const role = await verifyProjectMembership(supabase, user.id, body.projectId)
  requireMinimumRole(role, 'admin', 'manage integrations')

  // Fetch integration
  const { data: integration, error } = await supabase
    .from('integrations')
    .select('id, type, config')
    .eq('id', body.integrationId)
    .single()

  if (error || !integration) {
    throw new HttpError(404, 'Integration not found')
  }

  const config = PROVIDER_CONFIGS[integration.type]
  if (!config) {
    throw new HttpError(400, `Provider ${integration.type} does not support OAuth`)
  }

  const integrationConfig = integration.config as Record<string, string>
  const storedRefresh = integrationConfig?.refreshToken
  const refreshToken = await decryptToken(storedRefresh)

  if (!refreshToken) {
    throw new HttpError(422, 'No refresh token available. Re-authorize the integration.')
  }

  const clientId = Deno.env.get(`OAUTH_${integration.type.toUpperCase()}_CLIENT_ID`)
  const clientSecret = Deno.env.get(`OAUTH_${integration.type.toUpperCase()}_CLIENT_SECRET`)

  if (!clientId || !clientSecret) {
    throw new HttpError(500, `OAuth not configured for ${integration.type}`)
  }

  const tokenResponse = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!tokenResponse.ok) {
    // Mark integration as error state
    await supabase.from('integrations').update({
      status: 'error',
      error_log: ['Token refresh failed. Please re-authorize.'],
    }).eq('id', body.integrationId)

    throw new HttpError(502, 'Token refresh failed. Please re-authorize the integration.')
  }

  const tokens = await tokenResponse.json()
  const now = new Date()
  const expiresAt = tokens.expires_in
    ? new Date(now.getTime() + tokens.expires_in * 1000).toISOString()
    : null

  // Update stored tokens (re-encrypt; some providers rotate refresh tokens)
  const newRefreshPlain = tokens.refresh_token ?? refreshToken
  await supabase.from('integrations').update({
    config: {
      ...integrationConfig,
      accessToken: await encryptToken(tokens.access_token),
      refreshToken: await encryptToken(newRefreshPlain),
      tokenExpiry: expiresAt,
      encrypted: true,
    },
    status: 'connected',
    error_log: [],
  }).eq('id', body.integrationId)

  return new Response(
    JSON.stringify({ success: true, expiresAt }),
    { headers: { ...cors, 'Content-Type': 'application/json' } },
  )
}
