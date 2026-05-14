/**
 * Auth helpers for B.5 RLS role-matrix tests.
 *
 * Provides supabase-js clients authenticated as each of the 4 baseline roles:
 *   - anon            (no JWT — public role only)
 *   - viewer          (project_members.role = 'viewer')
 *   - project_manager (project_members.role = 'admin' — closest analogue;
 *                      'project_manager' is the user-facing label, but the
 *                      CHECK constraint on project_members.role uses 'admin')
 *   - owner           (organization_members.role = 'owner')
 *
 * Strategy:
 *   On first use, ensure 4 deterministic test users exist in staging
 *   (idempotent: created via admin API if missing). Each is wired into a
 *   shared "rls-test-org" with the appropriate role grant. Sign-in returns
 *   a regular supabase-js client carrying that user's JWT.
 *
 * If staging env vars are missing, every helper returns `null` and the
 * caller is expected to skip via `describe.skipIf(!SHOULD_RUN)`.
 *
 * NOTE: this is a minimal local helper while the parallel agent's
 * tests/rpc/auth-helpers.ts lands. The next loop iteration should
 * consolidate the two into a single shared module.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
export const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''
export const SHOULD_RUN = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY)

export type RoleName = 'anon' | 'viewer' | 'project_manager' | 'owner'

export const ROLES: RoleName[] = ['anon', 'viewer', 'project_manager', 'owner']

const TEST_PASSWORD = 'B5RlsMatrix!2026'
const TEST_ORG_NAME = 'B.5 RLS Matrix Test Org'

interface RoleAccount {
  role: RoleName
  email: string
  // Maps a logical role to (orgRole, projectRole). orgRole=null for non-org-member.
  orgRole: 'owner' | 'admin' | 'member' | null
  projectRole: 'owner' | 'admin' | 'member' | 'viewer' | null
}

const ROLE_ACCOUNTS: RoleAccount[] = [
  { role: 'anon', email: '', orgRole: null, projectRole: null },
  {
    role: 'viewer',
    email: 'b5-viewer@sitesync-staging.local',
    orgRole: 'member',
    projectRole: 'viewer',
  },
  {
    role: 'project_manager',
    email: 'b5-pm@sitesync-staging.local',
    orgRole: 'admin',
    projectRole: 'admin',
  },
  {
    role: 'owner',
    email: 'b5-owner@sitesync-staging.local',
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
        console.warn('[auth-helpers] could not create test org:', error.message)
        return null
      }
      orgId = (created as { id: string }).id
    }

    // Look up or create a project under that org.
    const { data: project } = await admin
      .from('projects')
      .select('id')
      .eq('organization_id', orgId)
      .eq('name', 'B.5 RLS Test Project')
      .limit(1)
      .maybeSingle()
    let projectId: string | null = (project as { id?: string } | null)?.id ?? null
    if (!projectId) {
      const { data: createdProj, error: pErr } = await admin
        .from('projects')
        .insert({ name: 'B.5 RLS Test Project', organization_id: orgId })
        .select('id')
        .single()
      if (pErr) {
        console.warn('[auth-helpers] could not create test project:', pErr.message)
        return null
      }
      projectId = (createdProj as { id: string }).id
    }

    _seededOrgId = orgId
    _seededProjectId = projectId
    return { orgId, projectId }
  } catch (e) {
    console.warn('[auth-helpers] org seed failed:', (e as Error).message)
    return null
  }
}

/** Ensure user exists, attached to test org + project with the right role. */
async function ensureRoleUser(acct: RoleAccount): Promise<string | null> {
  if (acct.role === 'anon') return null
  const admin = adminClient()

  // 1. Find or create the auth user.
  let userId: string | null = null
  try {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    const found = list?.users?.find((u) => u.email?.toLowerCase() === acct.email.toLowerCase())
    if (found) userId = found.id
  } catch {
    /* listUsers may not be paginated past 200 — fall through to create */
  }

  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: acct.email,
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (error || !created?.user) {
      console.warn(`[auth-helpers] createUser(${acct.email}) failed:`, error?.message)
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

  const c = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await c.auth.signInWithPassword({
    email: acct.email,
    password: TEST_PASSWORD,
  })
  if (error) {
    console.warn(`[auth-helpers] signIn(${acct.email}) failed:`, error.message)
    return null
  }
  _clientCache[role] = c
  return c
}

export function admin(): SupabaseClient {
  return adminClient()
}
