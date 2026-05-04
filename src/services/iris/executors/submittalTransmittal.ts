/**
 * Executor for action_type = "submittal.transmittal_draft".
 *
 * When a submittal needs to go out to the architect, design team, or
 * sub, Iris can draft the transmittal letter — recipients, message, and
 * which submittal it's about. The executor persists the transmittal row
 * and marks it 'sent' so the submittal's outgoing log is up to date.
 *
 * Design note: actual email delivery is a separate concern. Sending
 * (Resend, SendGrid, etc.) lives in an edge function that listens to
 * `transmittals.sent_date` changes — keeping the executor purely
 * data-layer keeps it idempotent on retry. If the email step fails it
 * shows up as a separate alert; the transmittal record itself is intact.
 */

import { supabase } from '../../../lib/supabase'
import { fromTable } from '../../../lib/db/queries'
import type {
  DraftedAction,
  DraftedSubmittalTransmittalPayload,
} from '../../../types/draftedActions'

export async function executeDraftedSubmittalTransmittal(draft: DraftedAction): Promise<{
  resource_type: string
  resource_id: string
  result: Record<string, unknown>
}> {
  if (draft.action_type !== 'submittal.transmittal_draft') {
    throw new Error(
      `executeDraftedSubmittalTransmittal called with wrong action_type: ${draft.action_type}`,
    )
  }
  const payload: DraftedSubmittalTransmittalPayload = draft.payload

  // Look up the submittal so we can copy its title/spec section into the
  // transmittal record. Failure to read it doesn't block the transmittal —
  // we just fall back to a generic subject.
  const { data: submittal } = await fromTable('submittals')
    .select('id, title, spec_section, number')
    .eq('id' as never, payload.submittal_id)
    .maybeSingle()

  const submittalRow = submittal as
    | { id: string; title?: string; spec_section?: string | null; number?: number | null }
    | null
  const subject = submittalRow?.title
    ? `Transmittal — ${submittalRow.title}`
    : 'Submittal Transmittal'

  const insertRow: Record<string, unknown> = {
    project_id: draft.project_id,
    subject,
    description: payload.message,
    to_company: payload.to_email[0] ?? '',
    to_email: payload.to_email.join(', '),
    items: [
      {
        submittal_id: payload.submittal_id,
        spec_section: submittalRow?.spec_section ?? null,
        number: submittalRow?.number ?? null,
      },
    ],
    status: 'sent',
    sent_date: new Date().toISOString(),
    // Provenance: every Iris-executed mutation tags the source draft.
    created_via: 'iris.draft',
    source_drafted_action_id: draft.id,
  }

  const { data, error } = await fromTable('transmittals')
    .insert(insertRow as never)
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Transmittal insert failed')
  }
  const transmittalId = (data as { id: string }).id

  return {
    resource_type: 'transmittal',
    resource_id: transmittalId,
    result: {
      transmittal_id: transmittalId,
      submittal_id: payload.submittal_id,
      recipients: payload.to_email,
      cc: payload.cc_email ?? [],
    },
  }
}
