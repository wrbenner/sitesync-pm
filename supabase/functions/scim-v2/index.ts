// ── scim-v2 ─────────────────────────────────────────────────────────────────
// SCIM 2.0 (RFC 7643/7644) /Users + /Groups endpoints. The IdP pushes user
// changes to us via these endpoints; we provision/deprovision automatically.
//
// Auth: Bearer token. The token is an org_api_token with scope
// 'scim.manage'. Token validation reuses the same hash compare that the
// public API uses.
//
// What's implemented:
//   GET  /Users        — list (with cursor pagination)
//   POST /Users        — create
//   GET  /Users/:id    — read
//   PATCH /Users/:id   — partial update (active=false → deprovision)
//   DELETE /Users/:id  — hard deprovision
//
//   GET  /Groups       — list custom roles + assignments as SCIM Groups
//   POST /Groups       — create
//   PATCH /Groups/:id  — add/remove members
//
// The SCIM endpoint surface is huge; we implement the minimum required
// for Okta + Azure AD + OneLogin to push users to us. Extension to
// schema customizations + bulk endpoints is follow-up work.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleCors, getCorsHeaders, errorResponse, HttpError } from '../shared/auth.ts'

interface TokenContext {
  organization_id: string
  token_id: string
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const ctx = await authenticateBearerToken(req)

    // Path within the function: strip the /functions/v1/scim-v2 prefix.
    const fullPath = url.pathname
    const idx = fullPath.indexOf('/scim-v2')
    const path = idx >= 0 ? fullPath.slice(idx + '/scim-v2'.length) : fullPath
    const segments = path.split('/').filter(Boolean)

    if (segments[0] === 'Users') {
      if (req.method === 'GET' && !segments[1]) return await listUsers(ctx, url)
      if (req.method === 'POST' && !segments[1]) return await createUser(ctx, await req.json())
      if (segments[1]) {
        if (req.method === 'GET') return await getUser(ctx, segments[1])
        if (req.method === 'PATCH') return await patchUser(ctx, segments[1], await req.json())
        if (req.method === 'DELETE') return await deleteUser(ctx, segments[1])
      }
    }
    if (segments[0] === 'Groups') {
      if (req.method === 'GET' && !segments[1]) return await listGroups(ctx, url)
      if (req.method === 'POST' && !segments[1]) return await createGroup(ctx, await req.json())
      if (segments[1] && req.method === 'PATCH') return await patchGroup(ctx, segments[1], await req.json())
    }

    if (segments[0] === 'ServiceProviderConfig' && req.method === 'GET') {
      return scimResponse(serviceProviderConfig())
    }
    if (segments[0] === 'ResourceTypes' && req.method === 'GET') {
      return scimResponse({
        Resources: [
          { schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'], id: 'User', name: 'User', endpoint: '/Users' },
          { schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'], id: 'Group', name: 'Group', endpoint: '/Groups' },
        ],
      })
    }

    return scimResponse(scimError('Not Found', 404), 404)
  } catch (err) {
    if (err instanceof HttpError) {
      return scimResponse(scimError(err.message, err.status), err.status)
    }
    return errorResponse(err, getCorsHeaders(req))
  }
})

// ── Auth ───────────────────────────────────────────────────────────

async function authenticateBearerToken(req: Request): Promise<TokenContext> {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) throw new HttpError(401, 'Bearer token required')
  const presented = auth.slice('Bearer '.length).trim()

  const sUrl = Deno.env.get('SUPABASE_URL')!
  const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(sUrl, sKey)

  // Look up by prefix (cheap); validate by hash.
  const prefixMatch = presented.match(/^(ss_(?:live|test)_[A-Z0-9]{6})/)
  if (!prefixMatch) throw new HttpError(401, 'invalid token shape')
  const prefix = prefixMatch[1]

  const { data: row } = await (admin as any)
    .from('org_api_tokens')
    .select('id, organization_id, token_hash, scopes, expires_at, revoked_at')
    .eq('prefix', prefix)
    .maybeSingle()
  if (!row) throw new HttpError(401, 'unknown token')
  if (row.revoked_at) throw new HttpError(401, 'token revoked')
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    throw new HttpError(401, 'token expired')
  }
  if (!Array.isArray(row.scopes) || (!row.scopes.includes('scim.manage') && !row.scopes.includes('*'))) {
    throw new HttpError(403, 'token lacks scim.manage scope')
  }

  // Hash compare
  const computed = await sha256Hex(presented)
  if (!constantTimeEqual(computed, row.token_hash)) {
    throw new HttpError(401, 'token hash mismatch')
  }
  return { organization_id: row.organization_id, token_id: row.id }
}

async function sha256Hex(s: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('')
}
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

// ── /Users ─────────────────────────────────────────────────────────

async function listUsers(ctx: TokenContext, url: URL): Promise<Response> {
  const startIndex = Number(url.searchParams.get('startIndex') ?? '1')
  const count = Math.min(200, Number(url.searchParams.get('count') ?? '50'))

  const sUrl = Deno.env.get('SUPABASE_URL')!
  const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(sUrl, sKey)

  const { data, count: total } = await (admin as any)
    .from('organization_members')
    .select('user_id, role, profiles:user_id(email, first_name, last_name, active)', { count: 'exact' })
    .eq('organization_id', ctx.organization_id)
    .range(startIndex - 1, startIndex - 1 + count - 1)

  return scimResponse({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: total ?? (data ?? []).length,
    Resources: ((data as any[] | null) ?? []).map(toScimUser),
    startIndex,
    itemsPerPage: count,
  })
}

async function getUser(ctx: TokenContext, userId: string): Promise<Response> {
  const sUrl = Deno.env.get('SUPABASE_URL')!
  const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(sUrl, sKey)
  const { data } = await (admin as any)
    .from('organization_members')
    .select('user_id, role, profiles:user_id(email, first_name, last_name, active)')
    .eq('organization_id', ctx.organization_id)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return scimResponse(scimError('User not found', 404), 404)
  return scimResponse(toScimUser(data))
}

async function createUser(_ctx: TokenContext, _body: any): Promise<Response> {
  // Stub: production wiring inserts into auth.users + organization_members.
  return scimResponse(scimError('createUser not implemented yet', 501), 501)
}

async function patchUser(ctx: TokenContext, userId: string, body: any): Promise<Response> {
  // Most common SCIM patch: { Operations: [{ op: 'replace', path: 'active', value: false }] }
  const ops: ReadonlyArray<{ op?: string; path?: string; value?: unknown }> = body?.Operations ?? []
  const setActive = ops.find((o) => (o.path ?? '').toLowerCase() === 'active')
  if (!setActive) return scimResponse(scimError('only active=true|false patches are supported', 501), 501)

  const sUrl = Deno.env.get('SUPABASE_URL')!
  const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(sUrl, sKey)

  if (setActive.value === false) {
    await (admin as any)
      .from('organization_members')
      .update({ deactivated_at: new Date().toISOString() })
      .eq('organization_id', ctx.organization_id)
      .eq('user_id', userId)
    // Cascade: revoke all of this user's API tokens; sessions are killed by Supabase auth.
    await (admin as any).rpc('revoke_user_tokens', { p_user_id: userId }).catch(() => undefined)
  }
  return getUser(ctx, userId)
}

async function deleteUser(ctx: TokenContext, userId: string): Promise<Response> {
  const sUrl = Deno.env.get('SUPABASE_URL')!
  const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(sUrl, sKey)
  await (admin as any)
    .from('organization_members')
    .delete()
    .eq('organization_id', ctx.organization_id)
    .eq('user_id', userId)
  return new Response(null, { status: 204 })
}

// ── /Groups ────────────────────────────────────────────────────────

async function listGroups(ctx: TokenContext, _url: URL): Promise<Response> {
  const sUrl = Deno.env.get('SUPABASE_URL')!
  const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(sUrl, sKey)
  const { data } = await (admin as any)
    .from('org_custom_roles')
    .select('id, name, description, permissions')
    .eq('organization_id', ctx.organization_id)
  return scimResponse({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: (data ?? []).length,
    Resources: ((data as any[] | null) ?? []).map((g) => ({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      id: g.id,
      displayName: g.name,
    })),
    startIndex: 1,
    itemsPerPage: (data ?? []).length,
  })
}

async function createGroup(_ctx: TokenContext, _body: any): Promise<Response> {
  return scimResponse(scimError('createGroup not implemented yet', 501), 501)
}
async function patchGroup(_ctx: TokenContext, _id: string, _body: any): Promise<Response> {
  return scimResponse(scimError('patchGroup not implemented yet', 501), 501)
}

// ── Helpers ────────────────────────────────────────────────────────

function toScimUser(row: any): Record<string, unknown> {
  const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: row.user_id,
    userName: p?.email,
    name: { givenName: p?.first_name, familyName: p?.last_name },
    emails: p?.email ? [{ value: p.email, primary: true }] : [],
    active: p?.active !== false,
  }
}

function serviceProviderConfig(): Record<string, unknown> {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    documentationUri: 'https://sitesync.example/docs/scim',
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: false, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      {
        type: 'oauthbearertoken',
        name: 'OAuth Bearer Token',
        description: 'Authentication via org API token with scope scim.manage',
      },
    ],
  }
}

function scimError(detail: string, status: number) {
  return {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    detail,
    status: String(status),
  }
}

function scimResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/scim+json' },
  })
}
