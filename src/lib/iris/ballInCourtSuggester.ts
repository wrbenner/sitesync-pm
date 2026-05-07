// ── ballInCourtSuggester ────────────────────────────────────────────────
// P2b deliverable #6 — when Walker creates an RFI without an explicit
// assignee, suggest one based on (in priority order):
//   1. Drawing title-block designer of record
//   2. Spec section responsible party
//   3. Project directory member with the matching trade tag
//
// The full LLM-driven pipeline lives in ai-rfi-draft-v2 (passAnswerer).
// This client-side helper is the lightweight version used by the Create
// modal to surface a suggestion without round-tripping through Whisper.
//
// Returns null when no suggestion above the medium-confidence threshold
// is available — the create UI then leaves Ball in Court empty.

import { fromTable } from '../../lib/db/queries'
import type { IrisConfidenceBand } from './confidence'

const from = (table: string) => fromTable(table as never)

export interface BallInCourtSuggestion {
  userId: string
  displayName: string | null
  rationale: string
  confidence: number
  band: IrisConfidenceBand
}

interface SuggestParams {
  projectId: string
  drawingRef?: string | null      // e.g. "A-101"
  specSection?: string | null     // e.g. "09 21 16"
  trade?: string | null
}

export async function suggestBallInCourt(params: SuggestParams): Promise<BallInCourtSuggestion | null> {
  // Tier 1 — drawing designer of record
  if (params.drawingRef) {
    const { data } = await from('drawings')
      .select('id, designer_user_id, sheet_number, discipline')
      .eq('project_id' as never, params.projectId)
      .eq('sheet_number' as never, params.drawingRef)
      .limit(1)
    const row = (data?.[0] as { designer_user_id?: string; sheet_number?: string; discipline?: string } | undefined)
    if (row?.designer_user_id) {
      return {
        userId: row.designer_user_id,
        displayName: null,                // resolved by <UserName />
        rationale: `Designer of record on ${row.sheet_number}${row.discipline ? ` (${row.discipline})` : ''}`,
        confidence: 0.9,
        band: 'high',
      }
    }
  }

  // Tier 2 — spec section responsible party
  if (params.specSection) {
    const trade = params.specSection.replace(/\D/g, '').slice(0, 2)
    if (trade) {
      const { data } = await from('directory_contacts')
        .select('user_id, name, trade')
        .eq('project_id' as never, params.projectId)
        .eq('trade' as never, trade)
        .limit(1)
      const row = (data?.[0] as { user_id?: string; name?: string } | undefined)
      if (row?.user_id) {
        return {
          userId: row.user_id,
          displayName: row.name ?? null,
          rationale: `Trade match on spec ${params.specSection}`,
          confidence: 0.7,
          band: 'medium',
        }
      }
    }
  }

  // Tier 3 — directory member with matching trade tag
  if (params.trade) {
    const { data } = await from('directory_contacts')
      .select('user_id, name, trade')
      .eq('project_id' as never, params.projectId)
      .eq('trade' as never, params.trade)
      .limit(1)
    const row = (data?.[0] as { user_id?: string; name?: string } | undefined)
    if (row?.user_id) {
      return {
        userId: row.user_id,
        displayName: row.name ?? null,
        rationale: `Directory match on trade ${params.trade}`,
        confidence: 0.6,
        band: 'medium',
      }
    }
  }

  return null
}
