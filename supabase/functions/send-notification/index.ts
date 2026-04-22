// send-notification: Sends in-app and email notifications.
// LAW 12: User-initiated — authenticate, verify membership, validate, rate limit.


import {
  authenticateRequest,
  verifyProjectMembership,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  requireUuid,
  sanitizeText,
  escapeHtml,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'

// ── Input Validation ─────────────────────────────────────────

const ALLOWED_TYPES = new Set([
  'rfi_response', 'rfi_assigned', 'rfi_overdue',
  'task_assigned', 'task_completed', 'task_overdue',
  'submittal_approved', 'submittal_rejected', 'submittal_assigned',
  'change_order_approved', 'change_order_pending',
  'daily_log_submitted', 'daily_log_rejected',
  'punch_item_assigned', 'punch_item_completed',
  'mention', 'comment', 'general',
])

interface NotificationInput {
  user_id: string
  project_id: string
  type: string
  title: string
  body: string
  email?: string
  html?: string
  link?: string
}

function validateNotificationInput(raw: Record<string, unknown>): NotificationInput {
  const userId = requireUuid(raw.user_id, 'user_id')
  const projectId = requireUuid(raw.project_id, 'project_id')

  const type = String(raw.type || '')
  if (!ALLOWED_TYPES.has(type)) {
    throw new HttpError(400, `Invalid notification type: ${type}`)
  }

  const title = sanitizeText(String(raw.title || ''), 200)
  if (!title) throw new HttpError(400, 'title is required')

  const body = sanitizeText(String(raw.body || ''), 2000)
  if (!body) throw new HttpError(400, 'body is required')

  const email = raw.email ? String(raw.email) : undefined
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Invalid email address')
  }

  const html = raw.html ? String(raw.html).slice(0, 10000) : undefined
  const link = raw.link ? String(raw.link) : undefined
  if (link && !/^https?:\/\/.+/.test(link)) {
    throw new HttpError(400, 'link must be a valid URL')
  }

  return { user_id: userId, project_id: projectId, type, title, body, email, html, link }
}

// ── Rate Limiting (in-memory per-instance) ───────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 100
const RATE_WINDOW_MS = 60_000

function checkRateLimit(userId: string): void {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return
  }

  entry.count++
  if (entry.count > RATE_LIMIT) {
    throw new HttpError(429, `Rate limit exceeded: ${RATE_LIMIT} notifications per minute`)
  }
}

// ── Handler ──────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const cors = getCorsHeaders(req)

  try {
    // 1. Authenticate caller
    const { user, supabase } = await authenticateRequest(req)

    // 2. Rate limit
    checkRateLimit(user.id)

    // 3. Parse and validate input
    const raw = await parseJsonBody(req)
    const input = validateNotificationInput(raw)

    // 4. Verify caller is a member of the project
    await verifyProjectMembership(supabase, user.id, input.project_id)

    // 5. Verify target user is also a member of the project
    await verifyProjectMembership(supabase, input.user_id, input.project_id)

    // 6. Insert in-app notification (RLS enforced via caller's JWT)
    const { data: notification, error: insertError } = await supabase
      .from('notifications')
      .insert({
        user_id: input.user_id,
        project_id: input.project_id,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link || null,
      })
      .select('id')
      .single()

    if (insertError) {
      throw new HttpError(500, `Failed to create notification: ${insertError.message}`)
    }

    // 7. Send email if configured (non-blocking, best-effort)
    if (input.email) {
      const resendKey = Deno.env.get('RESEND_API_KEY')
      if (resendKey) {
        try {
          const emailHtml = input.html || `<p>${escapeHtml(input.body)}</p>`
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'SiteSync <notifications@sitesync.pm>',
              to: [input.email],
              subject: input.title,
              html: emailHtml,
            }),
          })
        } catch (emailErr) {
          console.error('Email delivery failed (non-blocking):', emailErr)
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, id: notification?.id }),
      { status: 201, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return errorResponse(error, cors)
  }
})
