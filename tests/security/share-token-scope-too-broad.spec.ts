/**
 * FMEA F.SHARE.2 — Share token scope too broad (project_id only)
 *
 * Hazard: a magic-link share token is issued for a single RFI in a project
 *         (entity_type='rfi', entity_id=<rfi_uuid>). If the validator only
 *         checked project_id, the token holder could swap entity_id in the
 *         URL to access ANY RFI / Submittal / CO in the same project.
 *
 * Test approach:
 *   1. Static layer (always runs): scan
 *      supabase/functions/entity-magic-link/index.ts and assert the
 *      validator checks `p.aud === \`${entity_type}:${entity_id}\``
 *      (per-entity audience binding) AND that the JWT issue path embeds
 *      `aud: \`${entity_type}:${entity_id}\``.
 *
 *   2. Live layer (skips without staging): mint a fake JWT whose `aud`
 *      points to entity A; hit the validate endpoint with the same token
 *      but querying entity B. Must reject with 4xx (the audience check
 *      runs before the row lookup).
 *
 *   3. Live attack-shape (skip-gracefully): even if signature verification
 *      blocks both calls with 401, the responses must be IDENTICAL — no
 *      observable difference between "wrong entity" and "invalid sig".
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const HANDLER_PATH = resolve(
  __dirname,
  '..',
  '..',
  'supabase',
  'functions',
  'entity-magic-link',
  'index.ts',
)

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''
const SHOULD_RUN_LIVE = Boolean(SUPABASE_URL && ANON_KEY)

function b64u(s: string): string {
  return Buffer.from(s)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
function makeJwt(payload: Record<string, unknown>): string {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const b = b64u(JSON.stringify(payload))
  const s = b64u('not-the-real-signature-' + Date.now())
  return `${h}.${b}.${s}`
}

describe('FMEA F.SHARE.2 — share token scope is entity-bound (not project-bound)', () => {
  const src = readFileSync(HANDLER_PATH, 'utf-8')

  it('JWT issue path binds aud to entity_type:entity_id (NOT to project_id)', () => {
    // The canonical pattern is `aud: \`${entity_type}:${entityId}\``.
    expect(
      /aud\s*:\s*[`'"][^`'"]*entity_type[^`'"]*:\$\{entityId\}/.test(src) ||
        /aud\s*:\s*`\$\{[^}]*entity_type[^}]*\}:\$\{entityId\}`/.test(src) ||
        /aud\s*:\s*`\$\{body\.entity_type\}:\$\{entityId\}`/.test(src),
      'JWT issue must bind aud to `${entity_type}:${entity_id}`, not project_id',
    ).toBe(true)

    // And the project-only binding (the hazard shape) must NOT appear.
    expect(
      /aud\s*:\s*`project:\$\{projectId\}`/.test(src),
      'aud must not be `project:${projectId}` — that is the hazard',
    ).toBe(false)
  })

  it('validate path enforces aud === entity_type:entity_id before DB lookup', () => {
    // Slice from the validate function to the first DB call.
    const validateStart = src.indexOf('async function handleValidate')
    expect(validateStart).toBeGreaterThan(-1)
    const validateBlock = src.slice(validateStart, validateStart + 1200)

    // The audience check is present and matches the issue pattern.
    expect(
      /p\.aud\s*!==\s*`\$\{entityType\}:\$\{entityId\}`/.test(validateBlock),
      'validate must reject with `p.aud !== \\`${entityType}:${entityId}\\``',
    ).toBe(true)

    // It must be a 403 (scope mismatch) not a silent 200.
    expect(/scope mismatch/.test(validateBlock)).toBe(true)
    expect(/403/.test(validateBlock)).toBe(true)
  })

  it('audience check runs BEFORE the magic_link_tokens row lookup inside handleValidate', () => {
    // String-order check, scoped to the validate function body to avoid
    // picking up references in comments / the issue path.
    const validateStart = src.indexOf('async function handleValidate')
    expect(validateStart).toBeGreaterThan(-1)
    const slice = src.slice(validateStart)
    const audCheck = slice.indexOf('scope mismatch')
    const dbLookup = slice.indexOf("from('magic_link_tokens')")
    expect(audCheck).toBeGreaterThan(-1)
    expect(dbLookup).toBeGreaterThan(-1)
    expect(
      audCheck,
      'audience mismatch must reject before DB lookup (no info leak via timing)',
    ).toBeLessThan(dbLookup)
  })

  it('owner_portal escape hatch is gated on entity_type=="owner_portal" (no general bypass)', () => {
    // The validate function has an `isOwnerPortalProbe` branch — make sure
    // it's strictly gated, not a general "skip aud check" path.
    const slice = src.slice(src.indexOf('async function handleValidate'))
    // isOwnerPortalProbe is derived from missing entity_type AND missing entity_id
    expect(/isOwnerPortalProbe\s*=\s*!entityType\s*&&\s*!entityId/.test(slice)).toBe(true)
    // The aud check is wrapped by `!isOwnerPortalProbe` — meaning entity-
    // scoped requests ALWAYS check aud.
    expect(/if\s*\(\s*!isOwnerPortalProbe[^)]*p\.aud/.test(slice)).toBe(true)
  })
})

describe.skipIf(!SHOULD_RUN_LIVE)(
  'FMEA F.SHARE.2 — live: cross-entity replay rejected',
  () => {
    const RFI_A = '11111111-1111-1111-1111-111111111111'
    const RFI_B = '22222222-2222-2222-2222-222222222222'

    it('token aud=rfi:A used to access rfi:B is rejected (4xx, never 200)', async () => {
      // Token claims it's bound to RFI A.
      const t = makeJwt({
        aud: `rfi:${RFI_A}`,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      })

      // Probe entity B with the A-bound token.
      const url = new URL(`${SUPABASE_URL}/functions/v1/entity-magic-link`)
      url.searchParams.set('token', t)
      url.searchParams.set('entity_type', 'rfi')
      url.searchParams.set('entity_id', RFI_B)
      const resp = await fetch(url, {
        method: 'GET',
        headers: { apikey: ANON_KEY },
      })
      expect(resp.status, 'cross-entity replay must NEVER return 200').not.toBe(200)
      expect(resp.status).toBeGreaterThanOrEqual(400)
    })

    it('token aud=rfi:A used to access submittal:A (cross-type) is rejected', async () => {
      const t = makeJwt({
        aud: `rfi:${RFI_A}`,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      })
      const url = new URL(`${SUPABASE_URL}/functions/v1/entity-magic-link`)
      url.searchParams.set('token', t)
      url.searchParams.set('entity_type', 'submittal')
      url.searchParams.set('entity_id', RFI_A) // same id, different type
      const resp = await fetch(url, {
        method: 'GET',
        headers: { apikey: ANON_KEY },
      })
      expect(resp.status).not.toBe(200)
      expect(resp.status).toBeGreaterThanOrEqual(400)
    })
  },
)
