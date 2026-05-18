/**
 * Auth helpers for B.4 RPC role-matrix tests.
 *
 * Provides supabase-js clients authenticated as each of the 4 baseline roles:
 *   - anon            (no JWT — public/anon role only)
 *   - viewer          (organization_members.role = 'member',
 *                      project_members.role = 'viewer')
 *   - project_manager (organization_members.role = 'admin',
 *                      project_members.role = 'admin')
 *   - owner           (organization_members.role = 'owner',
 *                      project_members.role = 'owner')
 *
 * The B.4 suite uses a dedicated `b4-*@sitesync-staging.local` namespace so
 * we don't touch the scaletest-* seeded users (those are owned by the
 * scale-test harness and have their own password lifecycle).
 *
 * Strategy:
 *   On first use, ensure 3 deterministic test users + 1 test org + 1 test
 *   project exist in staging. Each user is wired with the appropriate role
 *   grant. Sign-in returns a regular supabase-js client carrying that user's
 *   JWT. The helper is idempotent and safe to re-run.
 *
 * If staging env vars are missing, every helper returns `null` and the
 * caller is expected to skip via `describe.skipIf(!SHOULD_RUN)`.
 *
 * NOTE: mirrors tests/rls/auth-helpers.ts intentionally — once the
 * platform-diagnoser loop stabilizes, both files should be consolidated
 * into a single shared module under tests/_shared/.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
export const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''
export const SHOULD_RUN = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY)

export type RoleName = 'anon' | 'viewer' | 'project_manager' | 'owner'

export const ROLES: readonly RoleName[] = ['anon', 'viewer', 'project_manager', 'owner']

const TEST_PASSWORD = 'B4RpcMatrix!2026'
const TEST_ORG_NAME = 'B.4 RPC Matrix Test Org'
const TEST_PROJECT_NAME = 'B.4 RPC Test Project'

interface RoleAccount {
  role: RoleName
  email: string
  orgRole: 'owner' | 'admin' | 'member' | null
  projectRole: 'owner' | 'admin' | 'member' | 'viewer' | null
}

const ROLE_ACCOUNTS: RoleAccount[] = [
  { role: 'anon', email: '', orgRole: null, projectRole: null },
  {
    role: 'viewer',
    email: 'b4-viewer@sitesync-staging.local',
    orgRole: 'member',
    projectRole: 'viewer',
  },
  {
    role: 'project_manager',
    email: 'b4-pm@sitesync-staging.local',
    orgRole: 'admin',
    projectRole: 'admin',
  },
  {
    role: 'owner',
    email: 'b4-owner@sitesync-staging.local',
    orgRole: 'owner',
    projectRole: 'owner',
  },
]

let _admin: SupabaseClient | null = null
function adminClient(): SupabaseClient {
  if (_admin) return _admin
  _admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _admin
}

let _seededOrgId: string | null = null
let _seededProjectId: string | null = null
let _seedAttempted = false
const _clientCache: Partial<Record<RoleName, SupabaseClient>> = {}
const _userIdCache: Partial<Record<RoleName, string>> = {}

/** Idempotent: ensure a test org + project exist, return their ids. */
async function ensureTestOrgAndProject(): Promise<{ orgId: string; projectId: string } | null> {
  if (_seededOrgId && _seededProjectId) {
    return { orgId: _seededOrgId, projectId: _seededProjectId }
  }
  if (_seedAttempted) return null
  _seedAttempted = true

  const admin = adminClient()
  try {
    // Look up existing test org by name.
    const { data: existing } = await admin
      .from('organizations')
      .select('id')
      .eq('name', TEST_ORG_NAME)
      .limit(1)
      .maybeSingle()
    let orgId: string | null = (existing as { id?: string } | null)?.id ?? null

    if (!orgId) {
      const { data: created, error } = await admin
        .from('organizations')
        .insert({ name: TEST_ORG_NAME })
        .select('id')
        .single()
      if (error) {
        console.warn('[b4-auth-helpers] could not create test org:', error.message)
        return null
      }
      orgId = (created as { id: string }).id
    }

    // Look up or create a project under that org.
    const { data: project } = await admin
      .from('projects')
      .select('id')
      .eq('organization_id', orgId)
      .eq('name', TEST_PROJECT_NAME)
      .limit(1)
      .maybeSingle()
    let projectId: string | null = (project as { id?: string } | null)?.id ?? null
    if (!projectId) {
      const { data: createdProj, error: pErr } = await admin
        .from('projects')
        .insert({ name: TEST_PROJECT_NAME, organization_id: orgId })
        .select('id')
        .single()
      if (pErr) {
        console.warn('[b4-auth-helpers] could not create test project:', pErr.message)
        return null
      }
      projectId = (createdProj as { id: string }).id
    }

    _seededOrgId = orgId
    _seededProjectId = projectId
    return { orgId, projectId }
  } catch (e) {
    console.warn('[b4-auth-helpers] org seed failed:', (e as Error).message)
    return null
  }
}

/** Ensure user exists, attached to test org + project with the right role. */
async function ensureRoleUser(acct: RoleAccount): Promise<string | null> {
  if (acct.role === 'anon') return null
  const admin = adminClient()

  // 1. Find or create the auth user. Paginate listUsers across a few pages
  // to handle the case where staging has > 200 users (it does — ~500+).
  let userId: string | null = null
  try {
    for (let page = 1; page <= 5; page++) {
      const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      const found = list?.users?.find((u) => u.email?.toLowerCase() === acct.email.toLowerCase())
      if (found) {
        userId = found.id
        break
      }
      if (!list?.users || list.users.length < 200) break
    }
  } catch {
    /* listUsers may not be paginated past N — fall through to create */
  }

  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: acct.email,
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (error || !created?.user) {
      console.warn(`[b4-auth-helpers] createUser(${acct.email}) failed:`, error?.message)
      return null
    }
    userId = created.user.id
  }

  // 2. Ensure org + project exist.
  const ids = await ensureTestOrgAndProject()
  if (!ids) return userId // sign-in still possible without grants

  // 3. Idempotent org_members upsert.
  if (acct.orgRole) {
    await admin
      .from('organization_members')
      .upsert(
        { organization_id: ids.orgId, user_id: userId, role: acct.orgRole },
        { onConflict: 'organization_id,user_id' },
      )
  }

  // 4. Idempotent project_members upsert.
  if (acct.projectRole) {
    await admin
      .from('project_members')
      .upsert(
        { project_id: ids.projectId, user_id: userId, role: acct.projectRole },
        { onConflict: 'project_id,user_id' },
      )
  }

  return userId
}

/**
 * Return a supabase-js client authenticated as the given role.
 * Returns `null` if staging env is unset or seeding failed for this role.
 */
export async function clientForRole(role: RoleName): Promise<SupabaseClient | null> {
  if (!SHOULD_RUN) return null
  if (_clientCache[role]) return _clientCache[role] ?? null

  if (role === 'anon') {
    const c = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    _clientCache.anon = c
    return c
  }

  const acct = ROLE_ACCOUNTS.find((r) => r.role === role)
  if (!acct) return null
  const userId = await ensureRoleUser(acct)
  if (!userId) return null
  _userIdCache[role] = userId

  const c = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await c.auth.signInWithPassword({
    email: acct.email,
    password: TEST_PASSWORD,
  })
  if (error) {
    console.warn(`[b4-auth-helpers] signIn(${acct.email}) failed:`, error.message)
    return null
  }
  _clientCache[role] = c
  return c
}

/** Resolve cached user id for a role (populated after clientForRole). */
export function userIdForRole(role: RoleName): string | null {
  return _userIdCache[role] ?? null
}

/** Resolve the seeded test org id (populated after first clientForRole call). */
export function testOrgId(): string | null {
  return _seededOrgId
}

/** Resolve the seeded test project id (populated after first clientForRole call). */
export function testProjectId(): string | null {
  return _seededProjectId
}

export function admin(): SupabaseClient {
  return adminClient()
}

/**
 * Bounded-concurrency runner. Caps in-flight promises at `limit`. The
 * generated B.4 spec uses this to keep RPC fan-out at ≤10 in parallel so we
 * don't get rate-limited by staging.
 */
export async function withConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}
