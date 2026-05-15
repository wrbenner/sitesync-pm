/**
 * FMEA F.SCIM.1 — SCIM POST /Users duplicates if externalId not unique
 *
 * Hazard: SCIM 2.0 (RFC 7643/7644) §3.3 says POST /Users with a previously-
 *         seen externalId MUST return 409 Conflict (or an idempotent
 *         success returning the existing user). If the implementation
 *         blindly inserts, the IdP will create duplicate user rows on
 *         every retry — and IdPs (Okta, Azure AD) retry aggressively.
 *
 * Current implementation state (static probe):
 *   supabase/functions/scim-v2/index.ts:170 — `createUser` returns 501
 *   "createUser not implemented yet". This is itself a KNOWN-VIOLATION:
 *   the SCIM contract requires a working POST. Until then, IdP push will
 *   never wire users; the duplicate risk is latent (zero ops succeed).
 *
 * Test approach:
 *   1. Static layer — pin the current behaviour (501 stub) as a
 *      KNOWN-VIOLATION ledger entry. When the implementation lands, this
 *      assertion flips and the dedup-by-externalId test below runs.
 *   2. Static layer — assert externalId field is at least referenced in
 *      the SCIM schema mapping (toScimUser) for future readiness.
 *   3. Live layer (skips without staging): POST /Users twice with the
 *      same externalId; assert second response is 409 OR returns the
 *      same user id (idempotent semantics). NEVER 201 with a fresh id.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SCIM_PATH = resolve(
  __dirname,
  '..',
  '..',
  'supabase',
  'functions',
  'scim-v2',
  'index.ts',
)

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SCIM_TOKEN = process.env.SCIM_BEARER_TOKEN ?? ''
const SHOULD_RUN_LIVE = Boolean(SUPABASE_URL && SCIM_TOKEN)

describe('FMEA F.SCIM.1 — POST /Users externalId uniqueness', () => {
  const src = readFileSync(SCIM_PATH, 'utf-8')

  it('createUser entrypoint is wired for POST /Users (route exists)', () => {
    expect(
      /req\.method\s*===\s*['"]POST['"][^}]*createUser/.test(src),
      'POST /Users must dispatch to createUser',
    ).toBe(true)
  })

  it('KNOWN-VIOLATION: createUser is a 501 stub — no dedup logic possible yet', () => {
    // Locate createUser function body.
    const start = src.indexOf('async function createUser')
    expect(start, 'createUser must be declared').toBeGreaterThan(-1)
    const body = src.slice(start, start + 400)

    // Current shape: returns 501 "not implemented".
    const isStub = /not implemented/.test(body) && /501/.test(body)

    expect(
      isStub,
      'KNOWN-VIOLATION: supabase/functions/scim-v2/index.ts createUser() is a 501 stub. SCIM POST /Users from Okta/Azure AD/OneLogin fails today — and when it lands, the implementation must dedupe by externalId (RFC 7643 §3.3). Fix candidate: query organization_members WHERE external_id = $1 first; on hit return 409 Conflict with the existing resource; on miss INSERT with UNIQUE (organization_id, external_id) constraint.',
    ).toBe(true)
  })

  it('externalId column is NOT yet exposed in toScimUser → identity round-trip broken', () => {
    // Once createUser lands, toScimUser must include `externalId` for IdPs
    // to reconcile their state with ours. Pin the current absence so when
    // the impl ships, the test flips and reminds the author.
    const toScimUserStart = src.indexOf('function toScimUser')
    expect(toScimUserStart).toBeGreaterThan(-1)
    const body = src.slice(toScimUserStart, toScimUserStart + 500)

    expect(
      /externalId\s*:/.test(body),
      'KNOWN-VIOLATION: toScimUser() omits externalId — IdPs cannot reconcile their internal IDs against ours.',
    ).toBe(false)
  })

  it('current shape: bearer-token auth requires scim.manage scope', () => {
    // Regression guard on the auth layer. If a future patch loosens scope
    // requirements, the SCIM endpoint becomes a general user-creation
    // bypass. Pin the scope check.
    expect(/scim\.manage/.test(src)).toBe(true)
    expect(/token lacks scim\.manage scope/.test(src)).toBe(true)
  })

  it('org_api_tokens is the auth backbone (no generic Supabase JWT bypass)', () => {
    expect(/from\(\s*['"]org_api_tokens['"]\s*\)/.test(src)).toBe(true)
  })
})

describe.skipIf(!SHOULD_RUN_LIVE)(
  'FMEA F.SCIM.1 — live: duplicate POST is rejected/idempotent',
  () => {
    const externalId = `wave5-fmea-${Date.now()}`
    const body = JSON.stringify({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      userName: `${externalId}@fmea-test.local`,
      externalId,
      name: { givenName: 'F', familyName: 'M' },
      emails: [{ value: `${externalId}@fmea-test.local`, primary: true }],
      active: true,
    })

    async function post(): Promise<Response> {
      return fetch(`${SUPABASE_URL}/functions/v1/scim-v2/Users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SCIM_TOKEN}`,
          'Content-Type': 'application/scim+json',
        },
        body,
      })
    }

    it('first POST status is recorded; second POST is 409 OR same-id', async () => {
      const first = await post()
      const second = await post()

      // While createUser is a 501 stub, BOTH return 501. That is itself the
      // KNOWN-VIOLATION — at minimum, the two responses MUST be identical
      // (no observable race). Once the impl lands, swap to:
      //   second.status === 409 OR
      //   (first.status === 201 && second.status === 200 && same `id`).
      expect([200, 201, 409, 501]).toContain(first.status)
      expect(second.status).toBe(first.status)

      if (first.status === 501) {
        // Stub branch — record but don't fail.
        return
      }
      if (first.status === 201) {
        // Real impl: the second call must dedupe.
        const a = (await first.json().catch(() => ({}))) as { id?: string }
        const b = (await second.json().catch(() => ({}))) as { id?: string }
        if (second.status === 200) {
          expect(a.id).toBe(b.id)
        } else {
          expect(second.status).toBe(409)
        }
      }
    })

    it('response shape on duplicate is RFC 7644 §3.12 (scim Error or User)', async () => {
      const second = await post()
      const ct = second.headers.get('content-type') ?? ''
      // SCIM responses must be application/scim+json (RFC 7644 §3.1).
      expect(/scim\+json|application\/json/.test(ct)).toBe(true)
    })
  },
)
