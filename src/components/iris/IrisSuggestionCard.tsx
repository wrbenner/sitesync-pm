/**
 * IrisSuggestionCard — single suggestion card.
 *
 * Reuses IrisApprovalGate (via a synthesized DraftedAction) for the
 * approve/reject UI, so the visual language stays identical to the
 * inbox approval flow.
 */

import React from 'react'
import { IrisApprovalGate } from './IrisApprovalGate'
import type { DraftedAction } from '../../types/draftedActions'
import type { Suggestion } from '../../lib/iris/suggestPolicy'

export interface IrisSuggestionCardProps {
  suggestion: Suggestion
  /** When the user approves: caller invokes the matching draft endpoint. */
  onAccept: (s: Suggestion) => void | Promise<void>
  /** Dismiss without action. */
  onDismiss: (s: Suggestion) => void | Promise<void>
  busy?: boolean
}

export const IrisSuggestionCard: React.FC<IrisSuggestionCardProps> = ({
  suggestion,
  onAccept,
  onDismiss,
  busy,
}) => {
  // Synthesize a DraftedAction-shaped object so IrisApprovalGate renders.
  // The actual writing of a row happens server-side after approve.
  const synthetic: DraftedAction = {
    id: `synthetic:${suggestion.kind}:${suggestion.entity_id}`,
    project_id: '',
    title: suggestion.title,
    summary: suggestion.rationale,
    citations: [],
    confidence: suggestion.confidence,
    status: 'pending',
    drafted_by: 'iris.policy',
    draft_reason: suggestion.rationale,
    related_resource_type: suggestion.entity_type,
    related_resource_id: suggestion.entity_id,
    executed_resource_type: null,
    executed_resource_id: null,
    execution_result: null,
    decided_by: null,
    decided_at: null,
    decision_note: null,
    executed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    // Map suggestion kind → action_type (best-effort).
    action_type: suggestionKindToActionType(suggestion.kind),
    payload: {} as never,
  } as DraftedAction

  return (
    <IrisApprovalGate
      draft={synthetic}
      onApprove={() => onAccept(suggestion)}
      onReject={() => onDismiss(suggestion)}
      busy={busy}
    />
  )
}

function suggestionKindToActionType(kind: Suggestion['kind']): DraftedAction['action_type'] {
  switch (kind) {
    case 'rfi.draft_response':
      return 'rfi.draft'
    case 'punch_item.follow_up':
      return 'punch_item.draft'
    case 'daily_log.draft':
      return 'daily_log.draft'
    case 'submittal.nudge_architect':
      return 'submittal.transmittal_draft'
    case 'change_order.request_backup':
      return 'rfi.draft' // stand-in; a future action_type will be added
    default:
      return 'rfi.draft'
  }
}

export default IrisSuggestionCard
