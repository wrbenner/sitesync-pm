import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  HttpError,
  errorResponse,
  requireUuid,
} from '../shared/auth.ts'

// ── Types ────────────────────────────────────────────────────────────────────

type InspectionStatus = 'scheduled' | 'in_progress' | 'completed' | 'approved' | 'rejected' | 'cancelled'

interface TransitionRequest {
  inspection_id: string
  new_status: InspectionStatus
}

// ── State machine (mirrors inspectionMachine.ts, server-authoritative) ───────

function getValidTransitions(status: InspectionStatus, role: string): InspectionStatus[] {
  const canField = ['owner', 'admin', 'project_manager', 'superintendent', 'foreman'].includes(role)
  const canReview = ['owner', 'admin', 'project_manager'].includes(role)

  if (!canField) return []

  const base: Record<InspectionStatus, InspectionStatus[]> = {
    scheduled:   ['in_progress'],
    in_progress: ['completed'],
    completed:   [],
    approved:    [],
    rejected:    ['scheduled'],
    cancelled:   [],
  }

  const result: InspectionStatus[] = [...(base[status] ?? [])]

  if (canReview) {
    if (status === 'completed') {
      result.push('approved', 'rejected')
    }
    if (['scheduled', 'in_progress', 'rejected'].includes(status)) {
      result.push('cancelled')
    }
  }

  return result
}

// ── Handler ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  const corsCheck = handleCors(req)
  if (corsCheck) return corsCheck

  try {
    const { user } = await authenticateRequest(req)
    const body = await parseJsonBody<TransitionRequest>(req)

    const inspectionId = requireUuid(body.inspection_id, 'inspection_id')

    const validStatuses: InspectionStatus[] = [
      'scheduled', 'in_progress', 'completed', 'approved', 'rejected', 'cancelled',
    ]
    if (!validStatuses.includes(body.new_status)) {
      throw new HttpError(400, `new_status must be one of: ${validStatuses.join(', ')}`)
    }
    const newStatus = body.new_status

    // Use service role for cross-table reads without client RLS interference
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // ── Fetch inspection (non-deleted) ───────────────────────────────────────
    const { data: inspection, error: fetchError } = await adminClient
      .from('inspections')
      .select('id, project_id, status, created_by, inspector_id, deleted_at')
      .eq('id', inspectionId)
      .single()

    if (fetchError || !inspection) {
      throw new HttpError(404, `Inspection ${inspectionId} not found`)
    }
    if (inspection.deleted_at) {
      throw new HttpError(404, 'Inspection has been deleted')
    }

    // ── Server-resolve role — never trust caller ──────────────────────────────
    const { data: member } = await adminClient
      .from('project_members')
      .select('role')
      .eq('project_id', inspection.project_id)
      .eq('user_id', user.id)
      .single()

    if (!member?.role) {
      throw new HttpError(403, 'User is not a member of this project')
    }

    const currentStatus = inspection.status as InspectionStatus
    const validNext = getValidTransitions(currentStatus, member.role)

    if (!validNext.includes(newStatus)) {
      throw new HttpError(
        422,
        `Invalid transition: ${currentStatus} \u2192 ${newStatus} (role: ${member.role}). Valid: ${validNext.join(', ') || 'none'}`,
      )
    }

    // ── Apply transition with provenance ─────────────────────────────────────
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_by: user.id,
    }

    if (newStatus === 'completed') {
      updates.completed_date = new Date().toISOString()
    }

    const { error: updateError } = await adminClient
      .from('inspections')
      .update(updates)
      .eq('id', inspectionId)

    if (updateError) {
      throw new HttpError(500, `Failed to update inspection: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify({
        inspection_id: inspectionId,
        previous_status: currentStatus,
        new_status: newStatus,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          ...getCorsHeaders(req),
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error) {
    return errorResponse(error, getCorsHeaders(req))
  }
})
