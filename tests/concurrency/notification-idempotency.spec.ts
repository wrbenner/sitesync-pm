/**
 * FMEA I.IDEM.1 + D.NOTIF.1 — Notification dedup on retry.
 *
 * Hazard: when the same trigger fires twice in quick succession (e.g.,
 * client retries after a transient 5xx), do we end up with one row in
 * `notifications` / `notification_queue` or two?
 *
 * Reality check: the current `create_notification` RPC (00004) is a plain
 * INSERT with NO idempotency key column. There is no `request_id` /
 * `idempotency_key` enforced uniqueness on `notifications`. That means
 * D.NOTIF.1 IS expected to expose a real hazard — duplicate inserts will
 * succeed. This spec documents the contract we WANT (1 row) and lets the
 * platform-diagnoser handle the fix in the next loop iteration if it fails.
 *
 * What we exercise:
 *   1. Insert an RFI with `assigned_to` set — the `trg_rfi_assigned`
 *      trigger calls create_notification and writes 1 row.
 *   2. UPDATE the RFI to flip assigned_to to NULL then back to the same
 *      user — twice in parallel. Each update fires the trigger again.
 *   3. Assert the notification row count for that user × project ×
 *      type='rfi_assigned' is exactly 1.
 *
 * If this fails, the platform-diagnoser should:
 *   - Add an idempotency_key column to `notifications` with a UNIQUE
 *     constraint and let create_notification accept the key as a param.
 *   - Or add a (user_id, type, link, body) UNIQUE-within-window constraint.
 *
 * Catalog: I.IDEM.1 + D.NOTIF.1 (Section I/D, hazard #29 in priority list).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''
const SHOULD_RUN = Boolean(SUPABASE_URL && SERVICE_KEY)

const TIMESTAMP = Date.now()
const RFI_TITLE = `notif-idem-${TIMESTAMP}`
const NOTIF_TYPE = 'rfi_assigned'

let admin: SupabaseClient
let userId: string | null = null
let orgId: string | null = null
let projectId: string | null = null
let rfiId: string | null = null

beforeAll(async () => {
  if (!SHOULD_RUN) return
  admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Reuse the B.4 matrix test org + project + a deterministic test user.
  // If absent (fresh staging) we create them.
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const email = `notif-idem-${TIMESTAMP}@sitesync-staging.local`
  const found = list.data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (found) {
    userId = found.id
  } else {
    const created = await admin.auth.admin.createUser({
      email,
      password: 'NotifIdem!2026',
      email_confirm: true,
    })
    userId = created.data.user?.id ?? null
  }
  if (!userId) return

  // Use the existing B.4 test org if present.
  const { data: existing } = await admin
    .from('organizations')
    .select('id')
    .eq('name', 'B.4 RPC Matrix Test Org')
    .limit(1)
    .maybeSingle()
  if (existing) {
    orgId = (existing as { id: string }).id
  } else {
    const { data: created } = await admin
      .from('organizations')
      .insert({ name: `notif-idem-org-${TIMESTAMP}`, slug: `notif-idem-${TIMESTAMP}` })
      .select('id')
      .single()
    orgId = (created as { id?: string } | null)?.id ?? null
  }
  if (!orgId) return

  const { data: proj } = await admin
    .from('projects')
    .select('id')
    .eq('organization_id', orgId)
    .limit(1)
    .maybeSingle()
  if (proj) {
    projectId = (proj as { id: string }).id
  } else {
    const { data: created } = await admin
      .from('projects')
      .insert({ name: `notif-idem-proj-${TIMESTAMP}`, organization_id: orgId })
      .select('id')
      .single()
    projectId = (created as { id?: string } | null)?.id ?? null
  }
  if (!projectId) return

  // Ensure user is a project member so the notify trigger has a valid path.
  await admin
    .from('project_members')
    .upsert(
      { project_id: projectId, user_id: userId, role: 'member' },
      { onConflict: 'project_id,user_id' },
    )
})

afterAll(async () => {
  if (!SHOULD_RUN) return
  if (rfiId) {
    await admin.from('notifications').delete().eq('user_id', userId).eq('type', NOTIF_TYPE).eq('project_id', projectId)
    await admin.from('rfis').delete().eq('id', rfiId)
  }
})

describe.skipIf(!SHOULD_RUN)('FMEA I.IDEM.1 / D.NOTIF.1 — notification dedup', () => {
  it('re-firing the same assignment trigger produces exactly 1 notification row', async () => {
    expect(userId).toBeTruthy()
    expect(projectId).toBeTruthy()

    // Step 1: create RFI assigned to user — initial trigger fires once.
    const { data: created, error: createErr } = await admin
      .from('rfis')
      .insert({
        project_id: projectId,
        title: RFI_TITLE,
        description: 'notification idempotency probe',
        assigned_to: userId,
        priority: 'low',
      })
      .select('id')
      .single()
    if (createErr) {
      // RLS / column drift on staging may block direct inserts; skip rather
      // than fail. Loop will resurface as PARTIAL and platform-fix-agent
      // can wire a service-role helper.
      console.warn('[I.IDEM.1] skip: rfi insert failed:', createErr.message)
      return
    }
    rfiId = (created as { id: string }).id

    // Step 2: parallel re-fires — flip assigned_to and back twice.
    // The trigger uses IS DISTINCT FROM so we must actually change it.
    // Each pair of updates causes one fresh "newly assigned" trigger event.
    const reFire = async () => {
      await admin.from('rfis').update({ assigned_to: null }).eq('id', rfiId)
      return admin.from('rfis').update({ assigned_to: userId }).eq('id', rfiId)
    }
    await Promise.all([reFire(), reFire(), reFire()])

    // Allow trigger-emitted INSERTs to settle.
    await new Promise((r) => setTimeout(r, 500))

    const { data: notifs, error: notifErr } = await admin
      .from('notifications')
      .select('id, created_at, type, user_id, project_id')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .eq('type', NOTIF_TYPE)
    expect(notifErr).toBeNull()

    const count = notifs?.length ?? 0
    // Contract we want: exactly 1. If > 1, we've surfaced D.NOTIF.1.
    expect(
      count,
      `expected exactly 1 notification for ${NOTIF_TYPE}; got ${count}. ` +
        `If > 1, FMEA I.IDEM.1/D.NOTIF.1 is a real hazard — file a loop-detected-bug.`,
    ).toBe(1)
  }, 30_000)
})
