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
}

export interface ProjectContextSnapshot {
  projectId: string | null
  projectName: string | null
  userName: string | null
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
