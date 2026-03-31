// liveblocks-auth: Issues Liveblocks room tokens for real-time collaboration.
// LAW 12: User-initiated — authenticate, verify project membership + room access, rate limit.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  authenticateRequest,
  verifyProjectMembership,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  requireUuid,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'

// ── Input Validation ─────────────────────────────────────────

interface LiveblocksAuthInput {
  room: string
  project_id: string
}

function validateInput(raw: Record<string, unknown>): LiveblocksAuthInput {
  const room = String(raw.room || '')
  if (!room || room.length > 200) {
    throw new HttpError(400, 'room is required (max 200 chars)')
  }
  const projectId = requireUuid(raw.project_id, 'project_id')
  return { room, project_id: projectId }
}

// ── Room Access Verification ─────────────────────────────────

function verifyRoomBelongsToProject(room: string, projectId: string): void {
  // Room naming convention: "project_{uuid}_*"
  // Verify the room ID actually references the claimed project
  const expectedPrefix = `project_${projectId}`
  if (!room.startsWith(expectedPrefix)) {
    throw new HttpError(403, 'Room does not belong to this project')
  }
}

// ── Rate Limiting (in-memory per-instance) ───────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 60
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
    throw new HttpError(429, 'Rate limit exceeded: too many token requests')
  }
}

// ── Handler ──────────────────────────────────────────────────

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const cors = getCorsHeaders(req)

  try {
    // 1. Authenticate user
    const { user, supabase } = await authenticateRequest(req)

    // 2. Rate limit
    checkRateLimit(user.id)

    // 3. Parse and validate input
    const raw = await parseJsonBody(req)
    const input = validateInput(raw)

    // 4. Verify room belongs to the claimed project
    verifyRoomBelongsToProject(input.room, input.project_id)

    // 5. Verify user is a member of the project
    await verifyProjectMembership(supabase, user.id, input.project_id)

    // 6. Get Liveblocks secret
    const liveblocksSecret = Deno.env.get('LIVEBLOCKS_SECRET_KEY')
    if (!liveblocksSecret) {
      throw new HttpError(500, 'LIVEBLOCKS_SECRET_KEY not configured')
    }

    // 7. Request Liveblocks room token
    const liveblocksResponse = await fetch(
      `https://api.liveblocks.io/v2/rooms/${encodeURIComponent(input.room)}/authorize`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${liveblocksSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          userInfo: {
            name: user.email?.split('@')[0] || 'User',
            color: `#${user.id.slice(0, 6)}`,
          },
        }),
      },
    )

    if (!liveblocksResponse.ok) {
      const errText = await liveblocksResponse.text()
      console.error('Liveblocks auth failed:', liveblocksResponse.status, errText)
      throw new HttpError(502, 'Failed to authorize with Liveblocks')
    }

    const data = await liveblocksResponse.json()
    return new Response(JSON.stringify(data), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return errorResponse(error, cors)
  }
})
