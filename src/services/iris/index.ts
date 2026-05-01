// ─────────────────────────────────────────────────────────────────────────────
// Iris service — Stream integration entry point (Wave 1, Tab D)
// ─────────────────────────────────────────────────────────────────────────────
// Decorates StreamItems with Iris enhancement metadata so the UI knows when
// a draft is available. The actual draft text is generated lazily by the
// drafts service when the user expands the item.
//
// Called by useActionStream() (Tab A) after items are assembled.
// ─────────────────────────────────────────────────────────────────────────────

import type { IrisEnhancement, StreamItem } from '../../types/stream'
import { displayName } from '../../hooks/queries/profiles'

// Public re-exports so callers that need the draft service can pull it from
// a single import path without reaching into sibling modules.
export { generateIrisDraft } from './drafts'
export { DRAFT_TEMPLATES } from './templates'
export type { IrisDraft, IrisDraftStatus, ProjectContextSnapshot } from './types'

const MS_PER_DAY = 1000 * 60 * 60 * 24

function daysPastDue(item: StreamItem, now: Date = new Date()): number {
  if (!item.dueDate) return 0
  const due = new Date(item.dueDate).getTime()
  if (Number.isNaN(due)) return 0
  const diffMs = now.getTime() - due
  if (diffMs <= 0) return 0
  return Math.floor(diffMs / MS_PER_DAY)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Resolve a UUID to a synthetic-seed friendly name when possible. */
function friendlyAssignee(value: string | null | undefined): string {
  if (!value) return 'responsible party'
  if (!UUID_RE.test(value)) return value
  return displayName(undefined, value, 'responsible party')
}

function getEnhancement(item: StreamItem): IrisEnhancement | undefined {
  // Overdue RFI (≥ 2 days) → follow-up email
  if (item.type === 'rfi' && item.overdue && daysPastDue(item) >= 2) {
    return {
      draftAvailable: true,
      draftType: 'follow_up_email',
      confidence: 0.85,
      summary: `Draft follow-up to ${friendlyAssignee(item.assignedTo)}`,
    }
  }

  // Missing daily log → daily log narrative
  if (item.type === 'daily_log') {
    return {
      draftAvailable: true,
      draftType: 'daily_log',
      confidence: 0.6,
      summary: 'Draft daily log from field data',
    }
  }

  // Overdue submittal → follow-up email
  if (item.type === 'submittal' && item.overdue) {
    return {
      draftAvailable: true,
      draftType: 'follow_up_email',
      confidence: 0.8,
      summary: 'Draft follow-up for overdue submittal',
    }
  }

  // Critical schedule activity → risk note
  if (item.type === 'schedule' && item.urgency === 'critical') {
    return {
      draftAvailable: true,
      draftType: 'schedule_suggestion',
      confidence: 0.7,
      summary: 'Draft schedule risk note',
    }
  }

  return undefined
}

export function detectIrisEnhancements(items: StreamItem[]): StreamItem[] {
  return items.map((item) => {
    // Don't overwrite an enhancement someone upstream already attached.
    if (item.irisEnhancement) return item
    const enhancement = getEnhancement(item)
    return enhancement ? { ...item, irisEnhancement: enhancement } : item
  })
}
