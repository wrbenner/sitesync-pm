// ─────────────────────────────────────────────────────────────────────────────
// Iris service — service-local types (Wave 1, Tab D)
// ─────────────────────────────────────────────────────────────────────────────
// Per CONTRACT.md: do NOT redefine StreamItem / IrisEnhancement / IrisDraftType
// here — those live in src/types/stream.ts (locked). This file only adds
// service-local types: the persisted draft shape and the lightweight project
// context object that templates need to build prompts.
// ─────────────────────────────────────────────────────────────────────────────

import type { IrisDraftType } from '../../types/stream'

export type IrisDraftStatus = 'pending' | 'approved' | 'rejected' | 'edited'

// ── Tone presets for Iris-generated communications ───────────────────────────
// Three orthogonal tones cover the realistic construction-PM use cases.
// Each preset feeds a deterministic guidance block into the prompt — the
// model never picks a tone on its own. Default is 'professional'; users can
// toggle per-draft via the tone selector or set a preference that persists.
//
// Tone applies only to drafts that produce email/text-style communications
// (follow-up emails, owner updates, RFI responses, submittal reviews).
// Drafts that produce structured artifacts (daily logs, schedule
// suggestions) ignore the parameter — there's no "diplomatic crew hours."

export type IrisDraftTone = 'professional' | 'direct' | 'diplomatic'

export interface IrisToneDescriptor {
  id: IrisDraftTone
  label: string                      // UI label (single word)
  blurb: string                      // one-line description shown beneath
  promptGuidance: string             // injected into the model prompt
}

export const IRIS_TONES: ReadonlyArray<IrisToneDescriptor> = [
  {
    id: 'professional',
    label: 'Professional',
    blurb: 'Balanced, courteous, business-appropriate.',
    promptGuidance:
      'Write in a balanced, professional tone. Courteous but not overly warm. Industry-standard business English. Acknowledge context, state the request or update clearly, close with a forward-looking line.',
  },
  {
    id: 'direct',
    label: 'Direct',
    blurb: 'Concise, action-oriented, no soft language.',
    promptGuidance:
      'Write in a direct, action-oriented tone. Lead with the ask or the fact. No softeners ("just checking in", "wanted to see if"). Put dates and accountability up front. Short paragraphs (1–2 sentences each). End with the specific next step expected.',
  },
  {
    id: 'diplomatic',
    label: 'Diplomatic',
    blurb: 'Softer ask, preserves relationships.',
    promptGuidance:
      'Write in a diplomatic tone. Acknowledge the recipient\'s constraints before stating the ask. Use collaborative framing ("we" and "together"). Soften deadlines as targets where possible without losing clarity. Close with appreciation. Best for senior recipients (architect/owner) or tense situations.',
  },
]

export const DEFAULT_TONE: IrisDraftTone = 'professional'

/** Look up a tone descriptor by id; falls back to professional. */
export function getToneDescriptor(tone: IrisDraftTone | null | undefined): IrisToneDescriptor {
  return IRIS_TONES.find((t) => t.id === tone) ?? IRIS_TONES[0]
}

/**
 * Whether a given draft type accepts a tone preset. Email/text drafts do;
 * structured artifacts (daily logs, schedule resequencing) don't.
 */
export function draftTypeAcceptsTone(draftType: IrisDraftType): boolean {
  return draftType === 'follow_up_email'
    || draftType === 'rfi_response'
    || draftType === 'submittal_review'
    || draftType === 'owner_update'
}

export interface IrisDraft {
  id: string                         // mirrors StreamItem.id ("rfi-123" etc.)
  type: IrisDraftType
  content: string
  sources: string[]                  // human-readable source descriptors
  status: IrisDraftStatus
  generatedAt: string                // ISO datetime
  editedContent?: string
  confidence?: number                // 0..1 — copied from the template
  error?: string                     // populated when generation fails
  /** The tone the draft was generated with — null for tone-insensitive types. */
  tone?: IrisDraftTone | null
}

export interface ProjectContextSnapshot {
  projectId: string | null
  projectName: string | null
  userName: string | null
  /**
   * Resolved display name of the item's recipient (item.assignedTo). The
   * caller should resolve this from the profiles table before invoking
   * generateIrisDraft — passing a raw UUID here will cause the model to
   * emit a `[Recipient's Name]` placeholder.
   */
  recipientName?: string | null
  /**
   * First name only of the sender, for casual sign-off ("— Walker"). When
   * absent, templates fall back to splitting userName on whitespace.
   */
  userFirstName?: string | null
  // Optional weather + crew snapshot for daily-log drafts. Templates degrade
  // gracefully when these are absent.
  weather?: {
    summary: string
    tempF?: number
  }
  workforceCount?: number
  fieldEntryCount?: number
  // Today (or "yesterday") so daily-log templates can self-date.
  asOfDate?: string                  // YYYY-MM-DD

  // ── Owner-update fields ────────────────────────────────────────────────
  // Populated by the Reports page when the user clicks "Generate Update".
  // Every section is optional; the template renders "No material change"
  // for sections with no data, instead of inventing.
  reportingPeriodDays?: number       // default 7

  scheduleStatus?: {
    behindActivities: OwnerUpdateScheduleItem[]
    milestonesHit: OwnerUpdateMilestone[]
    milestonesMissed: OwnerUpdateMilestone[]
  }

  budgetStatus?: {
    percentCommitted: number         // 0..100
    approvedTotal?: number           // dollars
    changeOrderExposure?: number     // dollars
    sourceLabel: string              // e.g. "Cost Codes — committed vs approved"
  }

  topRisks?: OwnerUpdateRisk[]       // up to 3
  decisionsNeeded?: OwnerUpdateDecision[]
  progressHighlights?: OwnerUpdateProgress[]
  lookahead14Days?: OwnerUpdateLookahead[]
}

export interface OwnerUpdateScheduleItem {
  name: string
  daysBehind: number
  sourceLabel: string                // e.g. "Schedule activity #142"
}

export interface OwnerUpdateMilestone {
  name: string
  dateLabel: string                  // human-readable, e.g. "Apr 22"
  sourceLabel: string
}

export interface OwnerUpdateRisk {
  title: string
  summary: string
  sourceLabel: string                // e.g. "Risk card: storefront-submittal"
}

export interface OwnerUpdateDecision {
  title: string
  summary: string
  sourceLabel: string
}

export interface OwnerUpdateProgress {
  summary: string
  sourceLabel: string                // e.g. "Daily log 2026-04-29" or "Photo …"
}

export interface OwnerUpdateLookahead {
  activity: string
  dateLabel: string
  sourceLabel: string
}
