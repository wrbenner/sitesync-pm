// agent-approval: Human-in-the-loop approval/rejection of AI agent proposed actions.
// LAW 12: User-initiated — authenticate, verify project membership, validate input.


import {
  authenticateRequest,
  verifyProjectMembership,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  requireUuid,
  sanitizeText,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'

// ── Input Validation ─────────────────────────────────────

interface ApprovalInput {
  action_id: string
  project_id: string
  approved: boolean
  feedback?: string
}

function validateInput(raw: Record<string, unknown>): ApprovalInput {
  const actionId = requireUuid(raw.action_id, 'action_id')
  const projectId = requireUuid(raw.project_id, 'project_id')

  if (typeof raw.approved !== 'boolean') {
    throw new HttpError(400, 'approved must be a boolean')
  }

  const feedback = raw.feedback ? sanitizeText(String(raw.feedback), 2000) : undefined

  return { action_id: actionId, project_id: projectId, approved: raw.approved, feedback }
}

// ── Rate Limiting ────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): void {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 })
    return
  }
  entry.count++
  if (entry.count > 60) {
    throw new HttpError(429, 'Rate limit exceeded')
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

    // 1. Authenticate
    const { user, supabase } = await authenticateRequest(req)

    // 2. Rate limit
    checkRateLimit(user.id)

    // 3. Parse and validate input
    const raw = await parseJsonBody(req)
    const input = validateInput(raw)

    // 4. Verify project membership
    const _role = await verifyProjectMembership(supabase, user.id, input.project_id)

    // 5. Verify the action exists and belongs to this project
    const { data: action, error: fetchError } = await supabase
      .from('ai_agent_actions')
      .select('id, status, agent_type, action_type, project_id')
      .eq('id', input.action_id)
      .eq('project_id', input.project_id)
      .single()

    if (fetchError || !action) {
      throw new HttpError(404, 'Agent action not found')
    }

    if (action.status !== 'pending_review') {
      throw new HttpError(409, `Action is already ${action.status}`)
    }

    // 6. Update the action status
    const newStatus = input.approved ? 'approved' : 'rejected'
    const { error: updateError } = await supabase
      .from('ai_agent_actions')
      .update({
        status: newStatus,
        approved_by: user.id,
        approval_feedback: input.feedback || null,
        approved_at: new Date().toISOString(),
      })
      .eq('id', input.action_id)

    if (updateError) {
      throw new HttpError(500, `Failed to update action: ${updateError.message}`)
    }

    // 7. Write audit trail
    await supabase.from('audit_trail').insert({
      project_id: input.project_id,
      actor_id: user.id,
      action: input.approved ? 'approve_agent_action' : 'reject_agent_action',
      entity_type: 'ai_agent_action',
      entity_id: input.action_id,
      new_value: { status: newStatus, feedback: input.feedback },
      user_agent: req.headers.get('User-Agent') || '',
    }).then(() => {}) // fire and forget

    return new Response(
      JSON.stringify({ success: true, action_id: input.action_id, status: newStatus }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return errorResponse(error, cors)
  }
})
