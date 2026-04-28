// delete-account: User-initiated, irreversible deletion of the caller's
// account and cascaded user-owned data. Required by Apple App Store
// Guideline 5.1.1(v) for any app with sign-in.
//
// Cascade behavior is enforced at the schema level via FK constraints:
//   profiles.user_id            → ON DELETE CASCADE
//   organization_members.user_id → ON DELETE CASCADE
//   notification_queue.user_id  → ON DELETE CASCADE
//   schedule_import_jobs.user_id → ON DELETE CASCADE
//   draw_report_extraction_jobs.user_id → ON DELETE CASCADE
// Audit/log tables intentionally use ON DELETE SET NULL so historical
// records are preserved (with the actor anonymized) rather than purged.
//
// LAW 12: User-initiated — authenticate, no project membership needed
// (a user always owns the right to delete themselves).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'

// ── Input Validation ─────────────────────────────────────

interface DeleteAccountInput {
  // Typed-confirm string the user must enter exactly. Defends against
  // accidental taps and misclicks.
  confirmation: string
  // Optional, free-text reason. Stored to a deletion-events table if
  // present so we can learn from churn (no PII retained).
  reason?: string
}

const REQUIRED_CONFIRMATION = 'DELETE MY ACCOUNT'

function validateInput(raw: Record<string, unknown>): DeleteAccountInput {
  if (typeof raw.confirmation !== 'string') {
    throw new HttpError(400, 'confirmation is required')
  }
  if (raw.confirmation !== REQUIRED_CONFIRMATION) {
    throw new HttpError(400, `Confirmation must be exactly "${REQUIRED_CONFIRMATION}"`)
  }
  const reason = typeof raw.reason === 'string'
    ? raw.reason.slice(0, 500)
    : undefined
  return { confirmation: raw.confirmation, reason }
}

// ── Rate Limiting ────────────────────────────────────────
// Aggressive: a real human deletes their account at most a handful of
// times in a lifetime. This catches automation/abuse cleanly.

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): void {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return
  }
  entry.count++
  if (entry.count > 3) {
    throw new HttpError(429, 'Too many deletion attempts. Try again later.')
  }
}

// ── Sole-admin guard ─────────────────────────────────────
// Refuse deletion if the user is the only admin of an organization.
// They must transfer admin rights first; otherwise the org is orphaned.

async function assertNotSoleAdmin(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<void> {
  const { data: adminships, error } = await serviceClient
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('role', 'admin')

  if (error) {
    throw new HttpError(500, 'Failed to verify organization membership')
  }
  if (!adminships || adminships.length === 0) return

  for (const { organization_id } of adminships) {
    const { count, error: countErr } = await serviceClient
      .from('organization_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('organization_id', organization_id)
      .eq('role', 'admin')
    if (countErr) {
      throw new HttpError(500, 'Failed to verify admin count')
    }
    if ((count ?? 0) <= 1) {
      throw new HttpError(
        409,
        'You are the only admin of an organization. Transfer ownership before deleting your account.',
      )
    }
  }
}

// ── Handler ──────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const cors = getCorsHeaders(req)

  try {
    if (req.method !== 'POST') {
      throw new HttpError(405, 'Method not allowed')
    }

    // 1. Authenticate the caller via their Bearer token. The user we
    //    delete is always the caller — never accept a target user_id
    //    parameter (would be an account-takeover vector).
    const { user } = await authenticateRequest(req)

    // 2. Rate limit per user.
    checkRateLimit(user.id)

    // 3. Validate input (typed-confirm string).
    const raw = await parseJsonBody(req)
    const input = validateInput(raw)

    // 4. Service-role client for admin operations. SUPABASE_SERVICE_ROLE_KEY
    //    is never exposed to the browser; it lives only inside this function.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // 5. Sole-admin guard.
    await assertNotSoleAdmin(serviceClient, user.id)

    // 6. Best-effort: log the deletion event before we destroy the row.
    //    If the table doesn't exist or the insert fails, we don't block
    //    deletion — the user's right to delete trumps our analytics.
    try {
      await serviceClient.from('account_deletion_events').insert({
        user_id_hash: await hashUserId(user.id),
        reason: input.reason ?? null,
        deleted_at: new Date().toISOString(),
      })
    } catch {
      // swallow — non-blocking
    }

    // 7. Delete the auth user. FK cascades handle profile, org membership,
    //    notification preferences, etc. (See header comment for the full
    //    list.) Audit-log rows survive with actor → NULL.
    const { error: deleteErr } = await serviceClient.auth.admin.deleteUser(
      user.id,
    )
    if (deleteErr) {
      throw new HttpError(500, `Failed to delete account: ${deleteErr.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, deleted_user_id: user.id }),
      {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      },
    )
  } catch (err) {
    return errorResponse(err, cors)
  }
})

// SHA-256 of the user id, base64-encoded. Lets us count deletions
// without retaining the raw user id post-deletion.
async function hashUserId(userId: string): Promise<string> {
  const data = new TextEncoder().encode(userId)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
}
